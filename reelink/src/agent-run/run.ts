import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import type { BrowserRecordingModule, StartedBrowserRecording, StoppedBrowserRecording } from "../browser-recording/lifecycle.js";
import { readBrowserJsonlFile } from "../recordings/store.js";

export type AgentRunAction =
  | { type: "snapshot"; save_dom?: boolean }
  | { type: "navigate"; url: string }
  | { type: "click"; selector?: string; text?: string; x?: number; y?: number }
  | { type: "type"; selector: string; text: string }
  | { type: "wait"; ms?: number };

export type RunReckAgentInput = {
  task_description: string;
  target_url: string;
  max_seconds?: number;
  actions?: AgentRunAction[];
  headless?: boolean;
};

export type RunStepRecord = {
  index: number;
  action: AgentRunAction;
  status: "ok" | "failed";
  observation?: Record<string, unknown>;
  error?: string;
};

export type AgentRunObservation = {
  frame_path: string | null;
  dom_summary: string | null;
  component_map: Record<string, unknown> | null;
  network_since_last: Array<Record<string, unknown>>;
  console_since_last: Array<Record<string, unknown>>;
};

export type EvalEvidence = {
  status: "deterministic" | "motion_only" | "insufficient_context";
  confidence: "high" | "medium" | "low";
  recording_id: string;
  artifact_path: string;
  assertion_strategy: string | null;
  expected_pre_fix_behavior: string | null;
  verification_result: "not_run";
  stable_observed_artifacts: Array<Record<string, unknown>>;
  next_steps: string[];
};

export type RunReckAgentResult = {
  recording_id: string;
  success: boolean;
  status: "completed" | "partial_failure" | "failed";
  summary: string;
  task_description: string;
  target_url: string;
  started_at: string;
  stopped_at: string;
  artifacts: {
    manifest: string;
    agent_run: string;
    observations: string;
    eval_evidence: string;
    video: string;
    network: string;
    console: string;
    dom: string;
  };
  recent_observation: AgentRunObservation;
  eval_evidence: EvalEvidence;
  steps: RunStepRecord[];
};

type BrowserRecorder = Pick<
  BrowserRecordingModule,
  "startRecording" | "snapshotBrowser" | "navigateBrowser" | "clickBrowser" | "typeBrowser" | "waitBrowser" | "stopRecording"
>;

export async function runReckAgent(
  recorder: BrowserRecorder,
  input: RunReckAgentInput,
): Promise<RunReckAgentResult> {
  const started = await recorder.startRecording({
    url: input.target_url,
    max_seconds: input.max_seconds ?? 60,
    headless: input.headless,
  });
  const steps: RunStepRecord[] = [];
  let stopped: StoppedBrowserRecording | null = null;

  try {
    const actions = input.actions?.length ? input.actions : [{ type: "snapshot", save_dom: true } satisfies AgentRunAction];
    for (const [index, action] of actions.entries()) {
      try {
        steps.push({
          index,
          action,
          status: "ok",
          observation: await performAction(recorder, started.session_id, action),
        });
      } catch (error) {
        steps.push({ index, action, status: "failed", error: errorMessage(error) });
        break;
      }
    }
  } finally {
    stopped = await recorder.stopRecording(started.session_id).catch((error) => {
      steps.push({ index: steps.length, action: { type: "wait", ms: 0 }, status: "failed", error: errorMessage(error) });
      return null;
    });
  }

  if (!stopped) {
    return failedRunResult(started, input, steps);
  }

  const root = dirname(stopped.artifacts.manifest);
  const recentObservation = buildRecentObservation(stopped);
  const evalEvidencePath = join(root, "eval-evidence.json");
  const evalEvidence = buildEvalEvidence(stopped, input.task_description, evalEvidencePath);
  const runStatus = steps.some((step) => step.status === "failed") ? "partial_failure" : "completed";
  const success = runStatus === "completed";
  const summary = summarizeRun(input.task_description, runStatus, steps, evalEvidence);
  const observationsPath = join(root, "agent-observations.jsonl");
  const agentRunPath = join(root, "agent-run.json");

  writeJsonl(observationsPath, [recentObservation]);
  writeJson(evalEvidencePath, evalEvidence);

  const agentRun = {
    recording_id: stopped.session_id,
    task_description: input.task_description,
    target_url: input.target_url,
    success,
    status: runStatus,
    summary,
    steps,
    recent_observation: recentObservation,
    eval_evidence: relative(root, evalEvidencePath),
  };
  writeJson(agentRunPath, agentRun);
  updateManifest(stopped.artifacts.manifest, {
    source_type: "agent_run",
    task_prompt: input.task_description,
    agent_run: relative(root, agentRunPath),
    agent_observations: relative(root, observationsPath),
    eval_evidence: relative(root, evalEvidencePath),
    evalStatus: evalEvidence.status === "deterministic" ? "available" : "not_collected",
    evalReason: evalReasonFor(evalEvidence),
  });

  return {
    recording_id: stopped.session_id,
    success,
    status: runStatus,
    summary,
    task_description: input.task_description,
    target_url: input.target_url,
    started_at: stopped.started_at,
    stopped_at: stopped.stopped_at,
    artifacts: {
      manifest: stopped.artifacts.manifest,
      agent_run: agentRunPath,
      observations: observationsPath,
      eval_evidence: evalEvidencePath,
      video: stopped.path,
      network: stopped.artifacts.network,
      console: stopped.artifacts.console,
      dom: stopped.artifacts.dom,
    },
    recent_observation: recentObservation,
    eval_evidence: evalEvidence,
    steps,
  };
}

function failedRunResult(
  started: StartedBrowserRecording,
  input: RunReckAgentInput,
  steps: RunStepRecord[],
): RunReckAgentResult {
  const stoppedAt = new Date().toISOString();
  const recentObservation: AgentRunObservation = {
    frame_path: null,
    dom_summary: null,
    component_map: null,
    network_since_last: [],
    console_since_last: [],
  };
  const evalEvidence: EvalEvidence = {
    status: "insufficient_context",
    confidence: "low",
    recording_id: started.session_id,
    artifact_path: "missing: recording finalization failed before eval-evidence.json could be written",
    assertion_strategy: null,
    expected_pre_fix_behavior: null,
    verification_result: "not_run",
    stable_observed_artifacts: [],
    next_steps: [
      "Inspect the preserved browser recording directory, if present, before retrying the task.",
      "Recording finalization failed, so recent observation artifacts are explicit missing values.",
      `Task prompt: ${input.task_description}`,
    ],
  };
  const failure = steps.find((step) => step.status === "failed");
  const failureSummary = failure ? ` Failure at step ${failure.index}: ${failure.error}.` : " Recording finalization failed.";

  return {
    recording_id: started.session_id,
    success: false,
    status: "failed",
    summary: `reck_run failed while preserving recording state for task: ${input.task_description}.${failureSummary} Next step: inspect partial recording artifacts and retry after resolving the failure.`,
    task_description: input.task_description,
    target_url: input.target_url,
    started_at: started.started_at,
    stopped_at: stoppedAt,
    artifacts: {
      manifest: "missing: recording finalization failed before manifest was returned",
      agent_run: "missing: recording finalization failed before agent-run.json could be written",
      observations: "missing: recording finalization failed before agent-observations.jsonl could be written",
      eval_evidence: evalEvidence.artifact_path,
      video: started.path,
      network: "missing: recording finalization failed before network artifact was returned",
      console: "missing: recording finalization failed before console artifact was returned",
      dom: "missing: recording finalization failed before DOM artifact was returned",
    },
    recent_observation: recentObservation,
    eval_evidence: evalEvidence,
    steps,
  };
}

async function performAction(
  recorder: BrowserRecorder,
  sessionId: string,
  action: AgentRunAction,
): Promise<Record<string, unknown>> {
  switch (action.type) {
    case "snapshot":
      return recorder.snapshotBrowser(sessionId, action.save_dom ?? true);
    case "navigate":
      return recorder.navigateBrowser({ session_id: sessionId, url: action.url });
    case "click":
      return recorder.clickBrowser({ session_id: sessionId, ...action });
    case "type":
      return recorder.typeBrowser({ session_id: sessionId, selector: action.selector, text: action.text });
    case "wait":
      return recorder.waitBrowser({ session_id: sessionId, ms: action.ms ?? 1000 });
    default:
      return exhaustive(action);
  }
}

function buildRecentObservation(stopped: StoppedBrowserRecording): AgentRunObservation {
  const manifest = readJson(stopped.artifacts.manifest);
  const snapshots = Array.isArray(manifest.dom_snapshots) ? manifest.dom_snapshots : [];
  const latestSnapshot = snapshots.at(-1) as Record<string, unknown> | undefined;
  const frameSnapshots = Array.isArray(manifest.frame_snapshots) ? manifest.frame_snapshots : [];
  const latestFrame = frameSnapshots.at(-1) as Record<string, unknown> | undefined;
  const componentMap = readComponentMap(stopped.artifacts.react_grab_events, stopped.artifacts.fiber_commits);

  return {
    frame_path: resolveArtifactPath(stopped.artifacts.manifest, latestFrame?.path),
    dom_summary: typeof latestSnapshot?.tree_summary === "string" ? latestSnapshot.tree_summary : null,
    component_map: componentMap,
    network_since_last: readBrowserJsonlFile(stopped.artifacts.network).events.slice(-20),
    console_since_last: readBrowserJsonlFile(stopped.artifacts.console).events.slice(-20),
  };
}

function buildEvalEvidence(stopped: StoppedBrowserRecording, taskDescription: string, artifactPath: string): EvalEvidence {
  const manifest = readJson(stopped.artifacts.manifest);
  const snapshots = Array.isArray(manifest.dom_snapshots) ? manifest.dom_snapshots : [];
  const latestSnapshot = snapshots.at(-1) as Record<string, unknown> | undefined;
  const network = readBrowserJsonlFile(stopped.artifacts.network).events;
  const consoleEvents = readBrowserJsonlFile(stopped.artifacts.console).events;
  const failedNetwork = network.filter(
    (event) => event.event === "requestfailed" || event.ok === false || (typeof event.status === "number" && event.status >= 400),
  );
  const consoleErrors = consoleEvents.filter((event) => event.type === "error");
  const stable: Array<Record<string, unknown>> = [];

  if (latestSnapshot) {
    stable.push({ kind: "dom_snapshot", path: latestSnapshot.path, tree_summary: latestSnapshot.tree_summary ?? null });
  }
  if (failedNetwork.length) {
    stable.push({ kind: "failed_network", path: "network.jsonl", count: failedNetwork.length, sample: failedNetwork.slice(-5) });
  }
  if (consoleErrors.length) {
    stable.push({ kind: "console_errors", path: "console.jsonl", count: consoleErrors.length, sample: consoleErrors.slice(-5) });
  }

  if (isMotionOnlyTask(taskDescription)) {
    return {
      status: "motion_only",
      confidence: stable.length ? "medium" : "low",
      recording_id: stopped.session_id,
      artifact_path: artifactPath,
      assertion_strategy: null,
      expected_pre_fix_behavior: null,
      verification_result: "not_run",
      stable_observed_artifacts: stable,
      next_steps: [
        "Use the preserved recording and runtime artifacts as primary evidence for the motion behavior.",
        "Treat screenshot and timing assertions as optional or experimental unless deterministic timing is established.",
        "Add a deterministic check only after stable timing, DOM, or state invariants are identified.",
        `Task prompt: ${taskDescription}`,
      ],
    };
  }

  if (!stable.length) {
    return {
      status: "insufficient_context",
      confidence: "low",
      recording_id: stopped.session_id,
      artifact_path: artifactPath,
      assertion_strategy: null,
      expected_pre_fix_behavior: null,
      verification_result: "not_run",
      stable_observed_artifacts: [],
      next_steps: [
        "Collect a DOM snapshot, network/console events, or source/runtime context before writing a deterministic test.",
        "Draft verification prompt: replay the task, identify stable DOM, route, network, console, or state invariants, then convert those invariants into a Playwright check.",
        `Task prompt: ${taskDescription}`,
      ],
    };
  }

  return {
    status: "deterministic",
    confidence: latestSnapshot ? "high" : "medium",
    recording_id: stopped.session_id,
    artifact_path: artifactPath,
    assertion_strategy: latestSnapshot
      ? "Replay the target route and assert stable DOM/page-state invariants observed in the persisted DOM snapshot."
      : "Replay the target route and assert observed console/network failure invariants remain fixed.",
    expected_pre_fix_behavior: stable.map((item) => `${item.kind} observed in recording ${stopped.session_id}`).join("; "),
    verification_result: "not_run",
    stable_observed_artifacts: stable,
    next_steps: ["Create a Playwright test from the listed stable artifacts, then run it against the fixed app."],
  };
}

function evalReasonFor(evalEvidence: EvalEvidence): string | undefined {
  switch (evalEvidence.status) {
    case "deterministic":
      return undefined;
    case "motion_only":
      return "Motion/state evidence preserved; screenshot or timing assertions are optional, experimental, or not collected until deterministic timing is established";
    case "insufficient_context":
      return "Insufficient repro, runtime, or source context was captured to generate a reliable deterministic verification artifact";
    default:
      return exhaustive(evalEvidence.status);
  }
}

function isMotionOnlyTask(taskDescription: string): boolean {
  return /\b(animation|animate|animated|motion|transition|smooth|jank|stutter|flicker|temporal|timing|frame rate|framerate|fps)\b/i.test(taskDescription);
}

function readComponentMap(reactGrabEventsPath: string, fiberCommitsPath: string): Record<string, unknown> | null {
  const reactGrab = readBrowserJsonlFile(reactGrabEventsPath).events;
  if (reactGrab.length) {
    return {
      source: "react_grab_events",
      event_count: reactGrab.length,
      latest: reactGrab.at(-1) ?? null,
    };
  }

  const fiberCommits = readBrowserJsonlFile(fiberCommitsPath).events;
  if (fiberCommits.length) {
    return {
      source: "fiber_commits",
      event_count: fiberCommits.length,
      latest: fiberCommits.at(-1) ?? null,
    };
  }

  return null;
}

function resolveArtifactPath(manifestPath: string, path: unknown): string | null {
  if (typeof path !== "string" || !path) return null;
  if (path.startsWith("/")) return path;
  return join(dirname(manifestPath), path);
}

function updateManifest(
  manifestPath: string,
  updates: {
    source_type: "agent_run";
    task_prompt: string;
    agent_run: string;
    agent_observations: string;
    eval_evidence: string;
    evalStatus: "available" | "not_collected";
    evalReason?: string;
  },
): void {
  const manifest = readJson(manifestPath);
  manifest.source_type = updates.source_type;
  manifest.task_prompt = updates.task_prompt;
  manifest.relations = {
    ...(isRecord(manifest.relations) ? manifest.relations : {}),
    browser_recording_id: String(manifest.recording_id ?? updates.agent_run),
    agent_run_id: String(manifest.recording_id ?? updates.agent_run),
    related_recording_ids: relatedRecordingIds(manifest.relations),
    relation: "agent_run_capture",
  };
  manifest.artifacts = {
    ...(isRecord(manifest.artifacts) ? manifest.artifacts : {}),
    agent_run: updates.agent_run,
    agent_observations: updates.agent_observations,
    eval_evidence: updates.eval_evidence,
  };
  manifest.streams = {
    ...(isRecord(manifest.streams) ? manifest.streams : {}),
    agent_run: { status: "available" },
    eval: updates.evalReason ? { status: updates.evalStatus, reason: updates.evalReason } : { status: updates.evalStatus },
  };
  writeJson(manifestPath, manifest);
}

function relatedRecordingIds(relations: unknown): string[] {
  if (!isRecord(relations) || !Array.isArray(relations.related_recording_ids)) return [];
  return relations.related_recording_ids.filter((id): id is string => typeof id === "string");
}

function summarizeRun(
  taskDescription: string,
  status: "completed" | "partial_failure",
  steps: RunStepRecord[],
  evalEvidence: EvalEvidence,
): string {
  const completed = steps.filter((step) => step.status === "ok").length;
  const failed = steps.find((step) => step.status === "failed");
  const failure = failed ? ` Partial failure at step ${failed.index}: ${failed.error}.` : "";
  return `Recorded agent run for task: ${taskDescription}. ${completed}/${steps.length} actions completed with status ${status}.${failure} Eval evidence status: ${evalEvidence.status}.`;
}

function readJson(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeJsonl(path: string, values: unknown[]): void {
  writeFileSync(path, values.map((value) => JSON.stringify(value)).join("\n") + (values.length ? "\n" : ""));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function exhaustive(value: never): never {
  throw new Error(`Unsupported reck_run action: ${JSON.stringify(value)}`);
}
