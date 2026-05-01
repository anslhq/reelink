import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { findFrameNearTimestamp, legacyBrowserRecordingPaths, loadManifest, readBrowserJsonlFile, RecordingNotFoundError, resolveRecordingDir } from "../recordings/store.js";
import type { Manifest } from "../schemas.js";

export type MissingStreamResponse = {
  recording_id: string;
  query_ts: number;
  status: "missing_stream";
  stream: string;
  reason: string;
};

export type RuntimeDomResponse =
  | MissingStreamResponse
  | {
      recording_id: string;
      query_ts: number;
      status: "available";
      path: string;
      tree_summary: string;
      snapshot_ts: number;
      delta_sec: number;
      url?: string;
      title?: string;
      streams_missing: Record<string, string>;
    };

export type RuntimeComponentResponse =
  | MissingStreamResponse
  | {
      recording_id: string;
      query_ts: number;
      status: "available";
      finding_id: string | null;
      ts: number;
      frame_idx: number | null;
      prod_build: { status: "detected" | "unknown" | "unavailable"; value: boolean | null; reason: string | null };
      element_path: string | null;
      bounding_box: Record<string, number> | null;
      selected_text: string | null;
      css_classes: string[];
      computed_styles: Record<string, unknown> | null;
      accessibility: Record<string, unknown> | null;
      component: string | null;
      component_stack: Array<Record<string, unknown>>;
      fiber_diff: Record<string, unknown> | null;
      file: string | null;
      line: number | null;
      column: number | null;
      source_references: Array<{ file: string; line: number | null; column: number | null; component: string | null }>;
      props: Record<string, unknown> | null;
      candidate: RankedComponentCandidate;
      candidates: RankedComponentCandidate[];
      markdown: string;
      xml: string;
      delta_sec: number;
      source: "react_grab_events" | "fiber_commits" | "source_dictionary";
      streams_missing: Record<string, string>;
    };

export type RankedComponentCandidate = {
  rank: number;
  confidence: number | null;
  rationale: string;
  ts: number | null;
  delta_sec: number;
  component: string | null;
  file: string | null;
  line: number | null;
  column: number | null;
  finding_id: string | null;
  element_path: string | null;
  bounding_box: Record<string, number> | null;
  selected_text: string | null;
  css_classes: string[];
  props: Record<string, unknown> | null;
  component_stack: Array<Record<string, unknown>>;
  fiber_diff: Record<string, unknown> | null;
  raw: Record<string, unknown>;
};

type DomSnapshot = {
  ts: number;
  path: string;
  tree_summary?: string;
  url?: string;
  title?: string;
};

type SourceDictionaryEntry = {
  component?: string;
  display_name?: string;
  file?: string;
  line?: number | null;
  column?: number | null;
  snapshot_ts?: number;
  snapshot_path?: string;
  provenance?: string;
  source?: { file?: string; line?: number | null; column?: number | null };
  component_stack?: Array<Record<string, unknown>>;
};

export async function getRuntimeDom(recordingId: string, ts: number): Promise<RuntimeDomResponse> {
  const runtimePackage = await loadRuntimePackage(recordingId, ts);
  if ("status" in runtimePackage) return runtimePackage;
  const { manifest, root } = runtimePackage;
  const domStream = streamStatus(manifest, "dom");
  if (domStream.status !== "available") {
    return missingStream(recordingId, ts, "dom", domStream.reason ?? `DOM stream is ${domStream.status}`);
  }

  const snapshots = domSnapshots(manifest, root);
  if (!snapshots.length && streamStatus(manifest, "fiber_commits").status === "available") {
    const events = readBrowserJsonlFile(absoluteArtifactPath(root, manifest.artifacts.fiber_commits ?? "fiber-commits.jsonl")).events;
    const nearestFiber = nearestByTimestamp(events, ts);
    if (nearestFiber) {
      return {
        recording_id: recordingId,
        query_ts: ts,
        status: "available",
        path: absoluteArtifactPath(root, manifest.artifacts.fiber_commits ?? "fiber-commits.jsonl"),
        tree_summary: fiberTreeSummary(nearestFiber),
        snapshot_ts: typeof nearestFiber.ts === "number" ? nearestFiber.ts : 0,
        delta_sec: roundSeconds(Math.abs((typeof nearestFiber.ts === "number" ? nearestFiber.ts : 0) - ts)),
        streams_missing: missingRuntimeStreams(manifest),
      };
    }
  }
  if (!snapshots.length) {
    return missingStream(recordingId, ts, "dom", "DOM stream is marked available, but no persisted DOM snapshots were found");
  }

  const nearest = nearestByTimestamp(snapshots, ts);
  if (!nearest) {
    return missingStream(recordingId, ts, "dom", "DOM stream is marked available, but no persisted DOM snapshots were found");
  }
  const path = absoluteArtifactPath(root, nearest.path);
  if (!existsSync(path)) return missingStream(recordingId, ts, "dom", `DOM snapshot artifact is missing: ${relative(root, path)}`);

  return {
    recording_id: recordingId,
    query_ts: ts,
    status: "available",
    path,
    tree_summary: nearest.tree_summary ?? summarizeHtml(readFileSync(path, "utf8")),
    snapshot_ts: nearest.ts,
    delta_sec: roundSeconds(Math.abs(nearest.ts - ts)),
    url: nearest.url,
    title: nearest.title,
    streams_missing: missingRuntimeStreams(manifest),
  };
}

export async function getRuntimeComponents(
  recordingId: string,
  ts: number,
  coordinates: { x?: number; y?: number } = {},
): Promise<RuntimeComponentResponse> {
  const runtimePackage = await loadRuntimePackage(recordingId, ts);
  if ("status" in runtimePackage) return runtimePackage;
  const { manifest, root } = runtimePackage;
  const reactGrab = streamStatus(manifest, "react_grab_events");
  const fiberCommits = streamStatus(manifest, "fiber_commits");
  const sourceDictionary = streamStatus(manifest, "source_dictionary");

  if (reactGrab.status === "available") {
    const events = readBrowserJsonlFile(absoluteArtifactPath(root, manifest.artifacts.react_grab_events ?? "react-grab-events.jsonl")).events;
    const candidates = events.filter((event) => eventMatchesCoordinates(event, coordinates));
    const nearest = nearestByTimestamp(candidates, ts);
    if (!nearest) return missingStream(recordingId, ts, "react_grab_events", "No react-grab event matched the requested timestamp/coordinates");
    return componentResponse(recordingId, ts, nearest, candidates, "react_grab_events", manifest, coordinates);
  }

  const sourceDictionaryResponse = (): Exclude<RuntimeComponentResponse, MissingStreamResponse> | MissingStreamResponse => {
    const events = sourceDictionaryEvents(absoluteArtifactPath(root, manifest.artifacts.source_dictionary ?? "source-dictionary.json"));
    const nearest = nearestByTimestamp(events, ts);
    if (!nearest) return missingStream(recordingId, ts, "source_dictionary", "No source dictionary component entries were available");
    return componentResponse(recordingId, ts, nearest, events, "source_dictionary", manifest, coordinates);
  };

  if (fiberCommits.status === "available") {
    const events = readBrowserJsonlFile(absoluteArtifactPath(root, manifest.artifacts.fiber_commits ?? "fiber-commits.jsonl")).events;
    const nearest = nearestByTimestamp(events, ts);
    if (!nearest) return missingStream(recordingId, ts, "fiber_commits", "No fiber commit matched the requested timestamp");
    const fiberResponse = componentResponse(recordingId, ts, nearest, events, "fiber_commits", manifest, coordinates);
    if (fiberResponse.file || sourceDictionary.status !== "available") return fiberResponse;
    const dictionaryResponse = sourceDictionaryResponse();
    return dictionaryResponse.status === "available" ? dictionaryResponse : fiberResponse;
  }

  if (sourceDictionary.status === "available") return sourceDictionaryResponse();

  return missingStream(
    recordingId,
    ts,
    "react_grab_events",
    reactGrab.reason ?? fiberCommits.reason ?? "React component streams were not collected",
  );
}

async function loadRuntimePackage(recordingId: string, ts: number): Promise<{ manifest: Manifest; root: string } | MissingStreamResponse> {
  const browserPaths = legacyBrowserRecordingPaths(recordingId);
  if (browserPaths) {
    return { manifest: JSON.parse(readFileSync(browserPaths.manifestPath, "utf8")) as Manifest, root: browserPaths.root };
  }

  try {
    return { manifest: await loadManifest(recordingId), root: resolveRecordingDir(recordingId) };
  } catch (error) {
    if (error instanceof RecordingNotFoundError) return missingStream(recordingId, ts, "package", error.message);
    throw error;
  }
}

function missingStream(recordingId: string, ts: number, stream: string, reason: string): MissingStreamResponse {
  return { recording_id: recordingId, query_ts: ts, status: "missing_stream", stream, reason };
}

function streamStatus(manifest: Manifest, stream: string): { status: string; reason?: string } {
  return manifest.streams[stream] ?? manifest.streams[legacyStreamName(stream)] ?? { status: "not_collected", reason: `${stream} stream is not listed in manifest` };
}

function legacyStreamName(stream: string): string {
  if (stream === "react_grab_events" || stream === "fiber_commits" || stream === "source_dictionary") return "components";
  return stream;
}

function domSnapshots(manifest: Manifest, root: string): DomSnapshot[] {
  const manifestWithSnapshots = manifest as Manifest & { dom_snapshots?: DomSnapshot[] };
  if (Array.isArray(manifestWithSnapshots.dom_snapshots)) {
    return manifestWithSnapshots.dom_snapshots.map((snapshot) => ({
      ...snapshot,
      path: snapshot.path.startsWith("/") ? snapshot.path : join(root, snapshot.path),
    }));
  }
  const domArtifact = manifest.artifacts.dom;
  if (!domArtifact) return [];
  const domPath = absoluteArtifactPath(root, domArtifact);
  return existsSync(domPath) ? [{ ts: 0, path: domPath, tree_summary: undefined }] : [];
}

function sourceDictionaryEvents(path: string): Array<Record<string, unknown>> {
  if (!existsSync(path)) return [];
  const dictionary = JSON.parse(readFileSync(path, "utf8")) as { entries?: unknown; components?: unknown; provenance?: unknown };
  const rawEntries = Array.isArray(dictionary.entries)
    ? dictionary.entries
    : dictionary.components && typeof dictionary.components === "object"
      ? Object.values(dictionary.components as Record<string, unknown>)
      : [];
  return rawEntries
    .filter((entry): entry is SourceDictionaryEntry => Boolean(entry) && typeof entry === "object")
    .filter((entry) => entry.provenance === "next_prerender_stack" || dictionary.provenance === "next_prerender_stack")
    .map((entry, index) => sourceDictionaryEvent(entry, index));
}

function sourceDictionaryEvent(entry: SourceDictionaryEntry, index: number): Record<string, unknown> {
  const source = entry.source && typeof entry.source === "object" ? entry.source : {};
  const file = typeof entry.file === "string" ? entry.file : typeof source.file === "string" ? source.file : null;
  const line = typeof entry.line === "number" ? entry.line : typeof source.line === "number" ? source.line : null;
  const column = typeof entry.column === "number" ? entry.column : typeof source.column === "number" ? source.column : null;
  const component = typeof entry.component === "string" ? entry.component : typeof entry.display_name === "string" ? entry.display_name : null;
  return {
    ts: typeof entry.snapshot_ts === "number" ? entry.snapshot_ts : 0,
    finding_id: typeof entry.snapshot_path === "string" ? `source-dictionary:${entry.snapshot_path}:${index}` : `source-dictionary:${index}`,
    component,
    source: file ? { file, line, column } : undefined,
    component_stack: Array.isArray(entry.component_stack) && entry.component_stack.length
      ? entry.component_stack
      : component && file
        ? [{ display_name: component, source: { file, line, column }, provenance: entry.provenance ?? "source_dictionary" }]
        : [],
    selected_text: typeof entry.snapshot_path === "string" ? `DOM snapshot ${entry.snapshot_path}` : null,
    confidence: 0.5,
    provenance: entry.provenance ?? "source_dictionary",
  };
}

function nearestByTimestamp<T extends { ts?: unknown }>(events: T[], ts: number): T | null {
  if (!events.length) return null;
  return events.reduce((best, event) => {
    const eventTs = typeof event.ts === "number" ? event.ts : 0;
    const bestTs = typeof best.ts === "number" ? best.ts : 0;
    return Math.abs(eventTs - ts) < Math.abs(bestTs - ts) ? event : best;
  }, events[0] as T);
}

function componentResponse(
  recordingId: string,
  ts: number,
  event: Record<string, unknown>,
  candidates: Array<Record<string, unknown>>,
  source: "react_grab_events" | "fiber_commits" | "source_dictionary",
  manifest: Manifest,
  coordinates: { x?: number; y?: number },
): Exclude<RuntimeComponentResponse, MissingStreamResponse> {
  const canonical = canonicalComponent(recordingId, ts, event, candidates, source, manifest, coordinates);
  return {
    status: "available",
    ...canonical,
    markdown: toAgentationMarkdown(canonical),
    xml: toReactGrabXML(canonical),
  };
}

export type CanonicalRuntimeComponent = Omit<Exclude<RuntimeComponentResponse, MissingStreamResponse>, "markdown" | "xml" | "status" | "query_ts" | "streams_missing" | "delta_sec" | "source"> & {
  query_ts: number;
  delta_sec: number;
  source: "react_grab_events" | "fiber_commits" | "source_dictionary";
  streams_missing: Record<string, string>;
};

function canonicalComponent(
  recordingId: string,
  ts: number,
  event: Record<string, unknown>,
  candidates: Array<Record<string, unknown>>,
  source: "react_grab_events" | "fiber_commits" | "source_dictionary",
  manifest: Manifest,
  coordinates: { x?: number; y?: number },
): CanonicalRuntimeComponent {
  const sourceLocation = sourceFromEvent(event);
  const eventTs = typeof event.ts === "number" ? event.ts : 0;
  const stack = componentStack(event);
  const frameIdx = typeof event.frame_idx === "number" ? event.frame_idx : null;
  const rankedCandidates = rankCandidates(candidates, ts, coordinates);
  const selectedCandidate = rankedCandidate(event, rankedCandidates.find((candidate) => sameEventCandidate(candidate, event))?.rank ?? 1, ts, coordinates);
  return {
    recording_id: recordingId,
    finding_id: typeof event.finding_id === "string" ? event.finding_id : null,
    query_ts: ts,
    ts: eventTs,
    frame_idx: frameIdx,
    prod_build: {
      status: manifest.prod_build_status,
      value: manifest.prod_build_status === "detected" ? manifest.prod_build : null,
      reason: manifest.prod_build_reason ?? null,
    },
    element_path: typeof event.element_path === "string" ? event.element_path : null,
    bounding_box: numericRecord(event.bounding_box),
    selected_text: typeof event.selected_text === "string" ? event.selected_text : typeof event.text === "string" ? event.text : null,
    css_classes: stringArray(event.css_classes) ?? stringArray(event.classes) ?? [],
    computed_styles: objectRecord(event.computed_styles),
    accessibility: objectRecord(event.accessibility),
    component: componentName(event),
    component_stack: stack.map(boundedEvent),
    fiber_diff: objectRecord(event.fiber_diff),
    file: sourceLocation.file,
    line: sourceLocation.line,
    column: sourceLocation.column,
    source_references: sourceReferences(stack, sourceLocation),
    props: sanitizeProps(event.props),
    candidate: selectedCandidate,
    candidates: rankedCandidates,
    delta_sec: roundSeconds(Math.abs(eventTs - ts)),
    source,
    streams_missing: missingRuntimeStreams(manifest),
  };
}

function sameEventCandidate(candidate: RankedComponentCandidate, event: Record<string, unknown>): boolean {
  const eventTs = typeof event.ts === "number" ? event.ts : null;
  const findingId = typeof event.finding_id === "string" ? event.finding_id : null;
  return candidate.ts === eventTs && candidate.finding_id === findingId && candidate.component === componentName(event);
}

function rankCandidates(events: Array<Record<string, unknown>>, ts: number, coordinates: { x?: number; y?: number }): RankedComponentCandidate[] {
  return events
    .map((event) => ({ event, score: candidateScore(event, ts, coordinates) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ event }, index) => rankedCandidate(event, index + 1, ts, coordinates));
}

function rankedCandidate(event: Record<string, unknown>, rank: number, ts: number, coordinates: { x?: number; y?: number }): RankedComponentCandidate {
  const sourceLocation = sourceFromEvent(event);
  const eventTs = typeof event.ts === "number" ? event.ts : null;
  return {
    rank,
    confidence: numericField(event.confidence),
    rationale: candidateRationale(event, ts, coordinates),
    ts: eventTs,
    delta_sec: roundSeconds(Math.abs((eventTs ?? 0) - ts)),
    component: componentName(event),
    file: sourceLocation.file,
    line: sourceLocation.line,
    column: sourceLocation.column,
    finding_id: typeof event.finding_id === "string" ? event.finding_id : null,
    element_path: typeof event.element_path === "string" ? event.element_path : null,
    bounding_box: numericRecord(event.bounding_box),
    selected_text: typeof event.selected_text === "string" ? event.selected_text : typeof event.text === "string" ? event.text : null,
    css_classes: stringArray(event.css_classes) ?? stringArray(event.classes) ?? [],
    props: sanitizeProps(event.props),
    component_stack: componentStack(event).map(boundedEvent),
    fiber_diff: objectRecord(event.fiber_diff),
    raw: boundedEvent(event),
  };
}

function candidateScore(event: Record<string, unknown>, ts: number, coordinates: { x?: number; y?: number }): number {
  const eventTs = typeof event.ts === "number" ? event.ts : 0;
  const timeScore = Math.max(0, 1 - Math.abs(eventTs - ts));
  const coordinateScore = coordinates.x == null || coordinates.y == null ? 0.25 : eventMatchesCoordinates(event, coordinates) ? 1 : 0;
  const sourceScore = sourceFromEvent(event).file ? 0.5 : 0;
  const confidence = numericField(event.confidence) ?? 0;
  return timeScore + coordinateScore + sourceScore + confidence;
}

function candidateRationale(event: Record<string, unknown>, ts: number, coordinates: { x?: number; y?: number }): string {
  const parts: string[] = [];
  const eventTs = typeof event.ts === "number" ? event.ts : null;
  parts.push(eventTs == null ? "timestamp unavailable" : `timestamp delta ${roundSeconds(Math.abs(eventTs - ts))}s`);
  if (coordinates.x != null && coordinates.y != null) {
    parts.push(eventMatchesCoordinates(event, coordinates) ? "coordinate hit inside bounding box" : "coordinate match unavailable or outside bounding box");
  }
  parts.push(sourceFromEvent(event).file ? "source reference available" : "source reference unavailable");
  const confidence = numericField(event.confidence);
  if (confidence != null) parts.push(`captured confidence ${confidence}`);
  return parts.join("; ");
}

function componentName(event: Record<string, unknown>): string | null {
  if (typeof event.component === "string") return event.component;
  if (typeof event.display_name === "string") return event.display_name;
  const stack = event.component_stack;
  if (Array.isArray(stack) && typeof stack[0] === "object" && stack[0] && "display_name" in stack[0]) {
    const displayName = (stack[0] as { display_name?: unknown }).display_name;
    return typeof displayName === "string" ? displayName : null;
  }
  return null;
}

function sourceFromEvent(event: Record<string, unknown>): { file: string | null; line: number | null; column: number | null } {
  const direct = parseSource(event.source);
  if (direct.file) return direct;
  const stack = event.component_stack;
  if (Array.isArray(stack)) {
    for (const frame of stack) {
      if (!frame || typeof frame !== "object") continue;
      const parsed = parseSource((frame as { source?: unknown }).source);
      if (parsed.file) return parsed;
    }
  }
  return { file: null, line: null, column: null };
}


export type RuntimeFindingContextResponse = {
  recording_id: string;
  finding_id: string;
  work_item: unknown | null;
  frame: { path: string; ts: number; delta_sec: number; exists: boolean } | null;
  dom: RuntimeDomResponse;
  components: RuntimeComponentResponse;
  console: BoundedEventSlice;
  network: BoundedEventSlice;
  safety: {
    redaction_applied: boolean;
    redaction_rules: string[];
    redacted_streams: string[];
  };
  runtime_summary: {
    bounded: true;
    context_window_sec: number;
    console_event_count: number;
    network_event_count: number;
    console_outside_window_count: number;
    network_outside_window_count: number;
    missing_context: Record<string, string>;
    omitted_large_payloads: string[];
  };
};

type BoundedEventSlice = {
  path: string | null;
  events: Array<Record<string, unknown>>;
  parse_errors: number;
  window_sec: number;
  total_event_count: number;
  included_event_count: number;
  outside_window_count: number;
  truncated_event_count: number;
};

export async function getRuntimeFindingContext(
  recordingId: string,
  finding: { id: string; ts: number } & Record<string, unknown>,
): Promise<RuntimeFindingContextResponse> {
  const runtimePackage = await loadRuntimePackage(recordingId, finding.ts);
  const frame = await findFrameNearTimestamp(recordingId, finding.ts).catch(() => null);
  if ("status" in runtimePackage) {
    return {
      recording_id: recordingId,
      finding_id: finding.id,
      work_item: finding,
      frame: frame ? { path: frame.path, ts: frame.ts, delta_sec: frame.delta_sec, exists: existsSync(frame.path) } : null,
      dom: runtimePackage,
      components: runtimePackage,
      console: emptyEventSlice(null),
      network: emptyEventSlice(null),
      safety: emptySafety(),
      runtime_summary: runtimeSummary(emptyEventSlice(null), emptyEventSlice(null), runtimePackage, runtimePackage),
    };
  }

  const { manifest, root } = runtimePackage;
  const consolePath = manifest.artifacts.console ? absoluteArtifactPath(root, manifest.artifacts.console) : null;
  const networkPath = manifest.artifacts.network ? absoluteArtifactPath(root, manifest.artifacts.network) : null;
  const consoleEvents = consolePath ? nearbyEvents(consolePath, readBrowserJsonlFile(consolePath), finding.ts) : emptyEventSlice(null);
  const networkEvents = networkPath ? nearbyEvents(networkPath, readBrowserJsonlFile(networkPath), finding.ts) : emptyEventSlice(null);
  const dom = await getRuntimeDom(recordingId, finding.ts);
  const components = await getRuntimeComponents(recordingId, finding.ts);

  return {
    recording_id: recordingId,
    finding_id: finding.id,
    work_item: finding,
    frame: frame ? { path: frame.path, ts: frame.ts, delta_sec: frame.delta_sec, exists: existsSync(frame.path) } : null,
    dom,
    components,
    console: consoleEvents,
    network: networkEvents,
    safety: safetyStatus(manifest),
    runtime_summary: runtimeSummary(consoleEvents, networkEvents, dom, components),
  };
}

const CONTEXT_WINDOW_SEC = 5;
const MAX_NEARBY_EVENTS = 20;

function nearbyEvents(path: string, parsed: { events: Array<Record<string, unknown>>; parse_errors: number }, ts: number): BoundedEventSlice {
  const insideWindow = parsed.events.filter((event) => typeof event.ts !== "number" || Math.abs(event.ts - ts) <= CONTEXT_WINDOW_SEC);
  const included = insideWindow.slice(-MAX_NEARBY_EVENTS).map(boundedEvent);
  return {
    path,
    events: included,
    parse_errors: parsed.parse_errors,
    window_sec: CONTEXT_WINDOW_SEC,
    total_event_count: parsed.events.length,
    included_event_count: included.length,
    outside_window_count: parsed.events.length - insideWindow.length,
    truncated_event_count: Math.max(0, insideWindow.length - included.length),
  };
}

function emptyEventSlice(path: string | null): BoundedEventSlice {
  return {
    path,
    events: [],
    parse_errors: 0,
    window_sec: CONTEXT_WINDOW_SEC,
    total_event_count: 0,
    included_event_count: 0,
    outside_window_count: 0,
    truncated_event_count: 0,
  };
}

function runtimeSummary(
  consoleEvents: BoundedEventSlice,
  networkEvents: BoundedEventSlice,
  dom?: RuntimeDomResponse,
  components?: RuntimeComponentResponse,
): RuntimeFindingContextResponse["runtime_summary"] {
  const missingContext: Record<string, string> = {};
  if (dom?.status === "missing_stream") missingContext.dom = dom.reason;
  if (components?.status === "missing_stream") missingContext.components = components.reason;
  if (!consoleEvents.events.length) missingContext.console = "No console events were persisted near this finding timestamp";
  if (!networkEvents.events.length) missingContext.network = "No network events were persisted near this finding timestamp";

  return {
    bounded: true,
    context_window_sec: CONTEXT_WINDOW_SEC,
    console_event_count: consoleEvents.events.length,
    network_event_count: networkEvents.events.length,
    console_outside_window_count: consoleEvents.outside_window_count,
    network_outside_window_count: networkEvents.outside_window_count,
    missing_context: missingContext,
    omitted_large_payloads: ["network.har", "trace.zip", "raw_dom"],
  };
}

function safetyStatus(manifest: Manifest): RuntimeFindingContextResponse["safety"] {
  return {
    redaction_applied: manifest.safety.redaction_applied,
    redaction_rules: manifest.safety.redaction_rules ?? [],
    redacted_streams: manifest.safety.redacted_streams ?? [],
  };
}

function emptySafety(): RuntimeFindingContextResponse["safety"] {
  return { redaction_applied: false, redaction_rules: [], redacted_streams: [] };
}

function boundedEvent(event: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(event)
      .slice(0, 24)
      .map(([key, value]) => [key, boundValue(value)]),
  );
}

function boundValue(value: unknown): unknown {
  if (typeof value === "string") return value.length > 1000 ? `${value.slice(0, 1000)}...(+${value.length - 1000} chars)` : value;
  if (Array.isArray(value)) return value.slice(0, 10).map(boundValue);
  if (value && typeof value === "object") return boundedEvent(value as Record<string, unknown>);
  return value;
}

export function toAgentationMarkdown(component: CanonicalRuntimeComponent): string {
  const position = component.bounding_box
    ? `x=${component.bounding_box.x ?? "?"}, y=${component.bounding_box.y ?? "?"}, width=${component.bounding_box.width ?? "?"}, height=${component.bounding_box.height ?? "?"}`
    : "unavailable";
  return [
    `Component: ${component.component ?? "unknown"}`,
    `Full DOM Path: ${component.element_path ?? "unavailable"}`,
    `CSS Classes: ${component.css_classes.length ? component.css_classes.join(" ") : "unavailable"}`,
    `Position: ${position}`,
    `Selected text: ${component.selected_text ?? "unavailable"}`,
    `Computed Styles: ${formatObject(component.computed_styles)}`,
    `Accessibility: ${formatObject(component.accessibility)}`,
    `Source: ${component.file ? `${component.file}${component.line ? `:${component.line}` : ""}${component.column ? `:${component.column}` : ""}` : "unavailable"}`,
    `React: ${component.component_stack.map((frame) => frame.display_name).filter(Boolean).join(" > ") || "unavailable"}`,
  ].join("\n");
}

export function toReactGrabXML(component: CanonicalRuntimeComponent): string {
  const attrs = [
    ["recording_id", component.recording_id],
    ["component", component.component ?? "unknown"],
    ["file", component.file ?? ""],
    ["line", component.line == null ? "" : String(component.line)],
    ["column", component.column == null ? "" : String(component.column)],
    ["dom_path", component.element_path ?? ""],
  ];
  const stack = component.component_stack
    .map((frame) => `<component name="${escapeXml(String(frame.display_name ?? "unknown"))}" source="${escapeXml(sourceLabel(frame))}" />`)
    .join("");
  return `<selected_element ${attrs.map(([key, value]) => `${key}="${escapeXml(value)}"`).join(" ")}>`
    + `<selected_text>${escapeXml(component.selected_text ?? "")}</selected_text>`
    + `<css_classes>${escapeXml(component.css_classes.join(" "))}</css_classes>`
    + `<accessibility>${escapeXml(formatObject(component.accessibility))}</accessibility>`
    + `<computed_styles>${escapeXml(formatObject(component.computed_styles))}</computed_styles>`
    + `<react_stack>${stack}</react_stack>`
    + `</selected_element>`;
}

function fiberTreeSummary(event: Record<string, unknown>): string {
  const stack = event.component_stack;
  if (Array.isArray(stack)) {
    return stack
      .map((frame) => (frame && typeof frame === "object" ? (frame as { display_name?: unknown }).display_name : null))
      .filter((name): name is string => typeof name === "string")
      .slice(0, 20)
      .join(" > ");
  }
  return componentName(event) ?? "fiber topology available";
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function parseSource(value: unknown): { file: string | null; line: number | null; column: number | null } {
  if (!value) return { file: null, line: null, column: null };
  if (typeof value === "string") return { file: value, line: null, column: null };
  if (typeof value === "object") {
    const source = value as { file?: unknown; line?: unknown; column?: unknown };
    return {
      file: typeof source.file === "string" ? source.file : null,
      line: typeof source.line === "number" ? source.line : null,
      column: typeof source.column === "number" ? source.column : null,
    };
  }
  return { file: null, line: null, column: null };
}

function sanitizeProps(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value).map(([key, prop]) => [key, sanitizePropValue(key, prop)]));
}

function sanitizePropValue(key: string, value: unknown): unknown {
  if (isSensitiveKey(key)) return "[redacted]";
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => sanitizePropValue(key, item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [childKey, sanitizePropValue(childKey, childValue)]));
  }
  return boundValue(value);
}

function eventMatchesCoordinates(event: Record<string, unknown>, coordinates: { x?: number; y?: number }): boolean {
  if (coordinates.x == null || coordinates.y == null) return true;
  const box = event.bounding_box;
  if (!box || typeof box !== "object") return true;
  const { x, y, width, height } = box as { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
  if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number" || typeof height !== "number") return true;
  return coordinates.x >= x && coordinates.x <= x + width && coordinates.y >= y && coordinates.y <= y + height;
}

function componentStack(event: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.isArray(event.component_stack) ? event.component_stack.filter((frame): frame is Record<string, unknown> => Boolean(frame) && typeof frame === "object") : [];
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? boundedEvent(value as Record<string, unknown>) : null;
}

function numericRecord(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, number] => typeof entry[1] === "number");
  return entries.length ? Object.fromEntries(entries) : null;
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 50) : null;
}

function sourceReferences(stack: Array<Record<string, unknown>>, fallback: { file: string | null; line: number | null; column: number | null }): Array<{ file: string; line: number | null; column: number | null; component: string | null }> {
  const refs = stack.map((frame) => {
    const source = parseSource(frame.source);
    return source.file ? { ...source, file: source.file, component: typeof frame.display_name === "string" ? frame.display_name : null } : null;
  }).filter((ref): ref is { file: string; line: number | null; column: number | null; component: string | null } => Boolean(ref));
  if (!refs.length && fallback.file) return [{ ...fallback, file: fallback.file, component: null }];
  return refs.slice(0, 10);
}

function formatObject(value: Record<string, unknown> | null): string {
  return value ? JSON.stringify(value) : "unavailable";
}

function sourceLabel(frame: Record<string, unknown>): string {
  const source = parseSource(frame.source);
  const displayName = typeof frame.display_name === "string" ? frame.display_name : "unknown";
  if (!source.file) return `at ${displayName} in unavailable`;
  return `at ${displayName} in ${source.file}${source.line ? `:${source.line}` : ""}${source.column ? `:${source.column}` : ""}`;
}

function numericField(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function missingRuntimeStreams(manifest: Manifest): Record<string, string> {
  const streams = ["trace", "fiber_commits", "source_dictionary", "react_grab_events", "network", "console", "eval"];
  return Object.fromEntries(
    streams
      .map((stream) => [stream, streamStatus(manifest, stream)] as const)
      .filter(([, status]) => status.status !== "available")
      .map(([stream, status]) => [stream, status.reason ?? status.status]),
  );
}

function absoluteArtifactPath(root: string, artifactPath: string): string {
  return artifactPath.startsWith("/") ? artifactPath : join(root, artifactPath);
}

function summarizeHtml(html: string): string {
  const tags = [...html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)\b/g)].map((match) => match[1]?.toLowerCase()).filter(Boolean);
  const counts = new Map<string, number>();
  for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].map(([tag, count]) => `${tag}:${count}`).join(", ");
}

function isSensitiveKey(key: string): boolean {
  return /authorization|cookie|token|secret|password|api[-_]?key|x-api-key/i.test(key);
}

function roundSeconds(value: number): number {
  return Math.round(value * 1000) / 1000;
}
