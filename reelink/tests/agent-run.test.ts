import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { runReckAgent } from "../src/agent-run/run.js";
import type { StoppedBrowserRecording } from "../src/browser-recording/lifecycle.js";
import type { Manifest } from "../src/schemas/recording.js";

type AgentRunArtifact = Record<string, unknown>;
type EvalEvidenceArtifact = Record<string, unknown>;

let workspace: string;
let previousCwd: string;
let recorder: FakeRunRecorder;

beforeEach(async () => {
  previousCwd = process.cwd();
  workspace = await mkdtemp(join(tmpdir(), "reck-agent-run-"));
  process.chdir(workspace);
  recorder = new FakeRunRecorder("rec_agent_test");
});

afterEach(async () => {
  process.chdir(previousCwd);
  await rm(workspace, { recursive: true, force: true });
});

describe("Layer 2 reck_run module", () => {
  test("records prompt, observations, summary, and deterministic eval evidence from stable DOM", async () => {
    const result = await runReckAgent(recorder, {
      task_description: "Verify the save button remains visible",
      target_url: "http://example.test",
      actions: [{ type: "snapshot", save_dom: true }],
    });

    expect(result).toMatchObject({
      recording_id: "rec_agent_test",
      success: true,
      status: "completed",
      task_description: "Verify the save button remains visible",
      target_url: "http://example.test",
      recent_observation: {
        frame_path: resolve(".reck/browser-recordings/rec_agent_test/frames/frame-0001.png"),
        dom_summary: "main:1, button:1",
        component_map: {
          source: "react_grab_events",
          event_count: 1,
          latest: expect.objectContaining({ component: "SaveButton" }),
        },
      },
      eval_evidence: {
        status: "deterministic",
        confidence: "high",
        verification_result: "not_run",
      },
    });
    expect(result.summary).toContain("1/1 actions completed");
    expect(existsSync(result.artifacts.agent_run)).toBe(true);
    expect(existsSync(result.artifacts.observations)).toBe(true);
    expect(existsSync(result.artifacts.eval_evidence)).toBe(true);

    const run = readJson<AgentRunArtifact>(result.artifacts.agent_run);
    const manifest = readJson<Manifest>(result.artifacts.manifest);
    const evidence = readJson<EvalEvidenceArtifact>(result.artifacts.eval_evidence);
    expect(run).toMatchObject({
      task_description: "Verify the save button remains visible",
      success: true,
      status: "completed",
      eval_evidence: "eval-evidence.json",
    });
    expect(manifest).toMatchObject({
      source_type: "agent_run",
      task_prompt: "Verify the save button remains visible",
      prod_build: null,
      prod_build_status: "unknown",
      relations: { browser_recording_id: "rec_agent_test", agent_run_id: "rec_agent_test", related_recording_ids: [], relation: "agent_run_capture" },
      artifacts: {
        agent_run: "agent-run.json",
        agent_observations: "agent-observations.jsonl",
        eval_evidence: "eval-evidence.json",
      },
      streams: {
        agent_run: { status: "available" },
        eval: { status: "available" },
      },
    });
    expect(evidence).toMatchObject({
      status: "deterministic",
      stable_observed_artifacts: [expect.objectContaining({ kind: "dom_snapshot" })],
    });
  });

  test("preserves motion-only evidence instead of fabricating deterministic evals", async () => {
    const result = await runReckAgent(recorder, {
      task_description: "Check the animation feels smooth",
      target_url: "http://example.test",
      actions: [{ type: "wait", ms: 50 }],
    });

    const manifest = readJson<Manifest>(result.artifacts.manifest);
    expect(result).toMatchObject({
      status: "completed",
      recent_observation: { dom_summary: "main:1, button:1" },
      eval_evidence: {
        status: "motion_only",
        confidence: "medium",
        assertion_strategy: null,
        expected_pre_fix_behavior: null,
        stable_observed_artifacts: [expect.objectContaining({ kind: "dom_snapshot" })],
        next_steps: expect.arrayContaining([
          "Treat screenshot and timing assertions as optional or experimental unless deterministic timing is established.",
        ]),
      },
    });
    expect(manifest.streams).toMatchObject({
      eval: {
        status: "not_collected",
        reason: "Motion/state evidence preserved; screenshot or timing assertions are optional, experimental, or not collected until deterministic timing is established",
      },
    });
  });

  test("keeps insufficient-context runs evidence-first when no stable artifacts exist", async () => {
    recorder.domSnapshots = [];
    recorder.frameSnapshots = [];
    recorder.reactGrabEvents = [];

    const result = await runReckAgent(recorder, {
      task_description: "Check the current page state",
      target_url: "http://example.test",
      actions: [{ type: "wait", ms: 50 }],
    });

    expect(result).toMatchObject({
      status: "completed",
      recent_observation: {
        frame_path: null,
        dom_summary: null,
        component_map: null,
      },
      eval_evidence: {
        status: "insufficient_context",
        confidence: "low",
        assertion_strategy: null,
        expected_pre_fix_behavior: null,
        stable_observed_artifacts: [],
        next_steps: expect.arrayContaining([
          "Collect a DOM snapshot, network/console events, or source/runtime context before writing a deterministic test.",
          "Draft verification prompt: replay the task, identify stable DOM, route, network, console, or state invariants, then convert those invariants into a Playwright check.",
        ]),
      },
    });
    const manifest = readJson<Manifest>(result.artifacts.manifest);
    expect(manifest.streams?.eval).toEqual({
      status: "not_collected",
      reason: "Insufficient repro, runtime, or source context was captured to generate a reliable deterministic verification artifact",
    });
  });

  test("captures partial failure state and still finalizes package artifacts", async () => {
    recorder.failClick = true;
    const result = await runReckAgent(recorder, {
      task_description: "Click a missing button",
      target_url: "http://example.test",
      actions: [{ type: "click", selector: "button.missing" }],
    });

    const run = readJson<AgentRunArtifact>(result.artifacts.agent_run);
    expect(result.success).toBe(false);
    expect(result.status).toBe("partial_failure");
    expect(result.summary).toContain("Partial failure at step 0");
    expect(result.steps).toEqual([
      { index: 0, action: { type: "click", selector: "button.missing" }, status: "failed", error: "click failed" },
    ]);
    expect(run).toMatchObject({ status: "partial_failure" });
    expect(existsSync(result.artifacts.video)).toBe(true);
  });

  test("returns failed public contract when recording finalization fails", async () => {
    recorder.failStop = true;
    const result = await runReckAgent(recorder, {
      task_description: "Open the page and preserve partial evidence",
      target_url: "http://example.test",
      actions: [{ type: "snapshot", save_dom: true }],
    });

    expect(result).toMatchObject({
      recording_id: "rec_agent_test",
      success: false,
      status: "failed",
      task_description: "Open the page and preserve partial evidence",
      target_url: "http://example.test",
      recent_observation: {
        frame_path: null,
        dom_summary: null,
        component_map: null,
        network_since_last: [],
        console_since_last: [],
      },
      eval_evidence: {
        status: "insufficient_context",
        confidence: "low",
        assertion_strategy: null,
        expected_pre_fix_behavior: null,
        verification_result: "not_run",
        stable_observed_artifacts: [],
      },
    });
    expect(result.summary).toContain("reck_run failed while preserving recording state");
    expect(result.summary).toContain("Failure at step 1: stop failed");
    expect(result.artifacts.video).toContain(".reck/browser-recordings/rec_agent_test/video.webm");
    expect(result.artifacts.manifest).toContain("missing:");
  });
});

class FakeRunRecorder {
  domSnapshots: Array<Record<string, unknown>> = [
    {
      ts: 0,
      path: resolve(".reck/browser-recordings/rec_agent_test/dom/snapshot-0001.html"),
      url: "http://example.test",
      title: "Example",
      tree_summary: "main:1, button:1",
    },
  ];
  frameSnapshots: Array<Record<string, unknown>> = [
    {
      ts: 0,
      path: "frames/frame-0001.png",
      url: "http://example.test",
    },
  ];
  reactGrabEvents: Array<Record<string, unknown>> = [
    {
      ts: 0,
      component: "SaveButton",
      source: { file: "src/components/SaveButton.tsx", line: 12, column: 7 },
    },
  ];
  failClick = false;
  failStop = false;

  constructor(private readonly recordingId: string) {}

  async startRecording({ url }: { url: string }) {
    const root = this.root();
    await mkdir(join(root, "dom"), { recursive: true });
    return {
      session_id: this.recordingId,
      status: "recording" as const,
      url,
      path: join(root, "video.webm"),
      started_at: "2026-04-30T00:00:00.000Z",
      max_seconds: 60,
      message: "started",
    };
  }

  async snapshotBrowser(sessionId: string, saveDom: boolean) {
    return {
      session_id: sessionId,
      url: "http://example.test",
      title: "Example",
      text: "Save",
      dom_path: saveDom ? String(this.domSnapshots[0]?.path ?? null) : null,
    };
  }

  async navigateBrowser({ session_id, url }: { session_id: string; url: string }) {
    return { session_id, ok: true, url };
  }

  async clickBrowser() {
    if (this.failClick) throw new Error("click failed");
    return { session_id: this.recordingId, ok: true, action: "selector:button", url: "http://example.test" };
  }

  async typeBrowser({ session_id, selector }: { session_id: string; selector: string }) {
    return { session_id, ok: true, selector, url: "http://example.test" };
  }

  async waitBrowser({ session_id, ms }: { session_id: string; ms: number }) {
    return { session_id, ok: true, waited_ms: ms, url: "http://example.test" };
  }

  async stopRecording(): Promise<StoppedBrowserRecording> {
    if (this.failStop) throw new Error("stop failed");
    const root = this.root();
    await mkdir(join(root, "dom"), { recursive: true });
    await mkdir(join(root, "frames"), { recursive: true });
    writeFileSync(join(root, "video.webm"), "fake-video\n");
    writeFileSync(join(root, "network.jsonl"), "");
    writeFileSync(join(root, "console.jsonl"), "");
    writeFileSync(join(root, "fiber-commits.jsonl"), "");
    writeFileSync(join(root, "react-grab-events.jsonl"), this.reactGrabEvents.map((event) => JSON.stringify(event)).join("\n") + (this.reactGrabEvents.length ? "\n" : ""));
    if (this.frameSnapshots.length) writeFileSync(join(root, "frames/frame-0001.png"), "fake-frame\n");
    if (this.domSnapshots.length) writeFileSync(String(this.domSnapshots[0]?.path), "<main><button>Save</button></main>");
    writeFileSync(
      join(root, "manifest.json"),
      `${JSON.stringify(
        {
          recording_id: this.recordingId,
          created_at: "2026-04-30T00:00:00.000Z",
          source_type: "browser_recording",
          source_path: "http://example.test",
          duration_sec: null,
          preprocessing: { requested_fps: 0, effective_fps: 0, max_frames: 0, long_edge_px: 0, frame_count: 0 },
          artifacts: { video: "video.webm", network: "network.jsonl", console: "console.jsonl", dom: "dom", frames: "frames", fiber_commits: "fiber-commits.jsonl", react_grab_events: "react-grab-events.jsonl" },
          streams: { dom: { status: this.domSnapshots.length ? "available" : "not_collected" }, network: { status: "available" }, console: { status: "available" }, eval: { status: "not_collected" } },
          prod_build: null,
          prod_build_status: "unknown",
          relations: { browser_recording_id: this.recordingId, related_recording_ids: [], relation: "browser_capture" },
          safety: { redaction_applied: true },
          dom_snapshots: this.domSnapshots,
          frame_snapshots: this.frameSnapshots,
        },
        null,
        2,
      )}\n`,
    );
    return {
      session_id: this.recordingId,
      status: "stopped",
      path: join(root, "video.webm"),
      exists: true,
      size_bytes: 11,
      started_at: "2026-04-30T00:00:00.000Z",
      stopped_at: "2026-04-30T00:00:01.000Z",
      duration_limit_hit: false,
      artifacts: {
        video: join(root, "video.webm"),
        trace: join(root, "trace.zip"),
        frames: join(root, "frames"),
        network: join(root, "network.jsonl"),
        network_har: join(root, "network.har"),
        console: join(root, "console.jsonl"),
        logs: join(root, "logs.jsonl"),
        dom: join(root, "dom"),
        fiber_commits: join(root, "fiber-commits.jsonl"),
        source_dictionary: join(root, "source-dictionary.json"),
        react_grab_events: join(root, "react-grab-events.jsonl"),
        manifest: join(root, "manifest.json"),
      },
    };
  }

  private root(): string {
    return resolve(".reck/browser-recordings", this.recordingId);
  }
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}
