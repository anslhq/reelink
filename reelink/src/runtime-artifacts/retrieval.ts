import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { loadManifest, readBrowserJsonlFile, RecordingNotFoundError, resolveRecordingDir } from "../recordings/store.js";
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
      component: string | null;
      file: string | null;
      line: number | null;
      column: number | null;
      props: Record<string, unknown> | null;
      candidate: Record<string, unknown>;
      candidates: Array<Record<string, unknown>>;
      delta_sec: number;
      source: "react_grab_events" | "fiber_commits";
      prod_build: boolean;
      streams_missing: Record<string, string>;
    };

type DomSnapshot = {
  ts: number;
  path: string;
  tree_summary?: string;
  url?: string;
  title?: string;
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

  if (reactGrab.status === "available") {
    const events = readBrowserJsonlFile(absoluteArtifactPath(root, manifest.artifacts.react_grab_events ?? "react-grab-events.jsonl")).events;
    const candidates = events.filter((event) => eventMatchesCoordinates(event, coordinates));
    const nearest = nearestByTimestamp(candidates, ts);
    if (!nearest) return missingStream(recordingId, ts, "react_grab_events", "No react-grab event matched the requested timestamp/coordinates");
    return componentResponse(recordingId, ts, nearest, candidates, "react_grab_events", manifest);
  }

  if (fiberCommits.status === "available") {
    const events = readBrowserJsonlFile(absoluteArtifactPath(root, manifest.artifacts.fiber_commits ?? "fiber-commits.jsonl")).events;
    const nearest = nearestByTimestamp(events, ts);
    if (!nearest) return missingStream(recordingId, ts, "fiber_commits", "No fiber commit matched the requested timestamp");
    return componentResponse(recordingId, ts, nearest, events, "fiber_commits", manifest);
  }

  return missingStream(
    recordingId,
    ts,
    "react_grab_events",
    reactGrab.reason ?? fiberCommits.reason ?? "React component streams were not collected",
  );
}

async function loadRuntimePackage(recordingId: string, ts: number): Promise<{ manifest: Manifest; root: string } | MissingStreamResponse> {
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
  source: "react_grab_events" | "fiber_commits",
  manifest: Manifest,
): Exclude<RuntimeComponentResponse, MissingStreamResponse> {
  const sourceLocation = sourceFromEvent(event);
  const eventTs = typeof event.ts === "number" ? event.ts : 0;
  return {
    recording_id: recordingId,
    query_ts: ts,
    status: "available",
    component: componentName(event),
    file: sourceLocation.file,
    line: sourceLocation.line,
    column: sourceLocation.column,
    props: sanitizeProps(event.props),
    candidate: event,
    candidates: candidates.slice(0, 10),
    delta_sec: roundSeconds(Math.abs(eventTs - ts)),
    source,
    prod_build: manifest.prod_build,
    streams_missing: missingRuntimeStreams(manifest),
  };
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
  return Object.fromEntries(Object.entries(value).map(([key, prop]) => [key, isSensitiveKey(key) ? "[redacted]" : prop]));
}

function eventMatchesCoordinates(event: Record<string, unknown>, coordinates: { x?: number; y?: number }): boolean {
  if (coordinates.x == null || coordinates.y == null) return true;
  const box = event.bounding_box;
  if (!box || typeof box !== "object") return true;
  const { x, y, width, height } = box as { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
  if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number" || typeof height !== "number") return true;
  return coordinates.x >= x && coordinates.x <= x + width && coordinates.y >= y && coordinates.y <= y + height;
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
