import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";

import { AnalyzeResultSchema, ManifestSchema, StoredAnalysisSchema, type AnalyzeResult, type Manifest, type StoredAnalysis, type WorkItem } from "../schemas.js";

/** Relative to `.reck/` for legacy MCP browser sessions (pre-canonical package layout). */
export const LEGACY_BROWSER_RECORDINGS_DIR = "browser-recordings" as const;

type ImportedVideoRecording = {
  id: string;
  root: string;
  framesDir: string;
  manifestPath: string;
  analysisPath: string;
  sourceVideoPath: string;
};

export class RecordingNotFoundError extends Error {
  constructor(recordingId: string) {
    super(`Recording not found: ${recordingId}`);
    this.name = "RecordingNotFoundError";
  }
}

export type FrameMatch = {
  path: string;
  index: number;
  ts: number;
  delta_sec: number;
};

export function createImportedVideoRecording(
  sourcePath: string,
  options: { copyVideo?: boolean } = {},
): ImportedVideoRecording {
  const absoluteSource = resolve(sourcePath);
  if (!existsSync(absoluteSource)) {
    throw new Error(`Recording path does not exist: ${absoluteSource}`);
  }

  const id = recordingIdFor(absoluteSource);
  const root = join(process.cwd(), ".reck", id);
  const framesDir = join(root, "frames");
  mkdirSync(framesDir, { recursive: true });

  const sourceVideoPath = options.copyVideo
    ? join(root, `source${extname(absoluteSource).toLowerCase() || ".video"}`)
    : absoluteSource;

  if (options.copyVideo) {
    copyFileSync(absoluteSource, sourceVideoPath);
  }

  return {
    id,
    root,
    framesDir,
    manifestPath: join(root, "manifest.json"),
    analysisPath: join(root, "analysis.json"),
    sourceVideoPath,
  };
}

export function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeManifest(path: string, manifest: Manifest): void {
  writeJson(path, manifest);
}

/**
 * Current packages resolve from `.reck/<id>/`, `.reck/browser-recordings/<id>`, or sibling `<id>.reck/`.
 * Legacy `.reelink` package layouts remain read-compatible only for existing data.
 */
export function resolveRecordingDir(recordingId: string): string {
  const direct = join(process.cwd(), ".reck", recordingId);
  if (existsSync(direct)) return direct;

  const browserDirect = resolveBrowserRecordingArtifactDir(recordingId);
  if (existsSync(browserDirect)) return browserDirect;

  const sibling = resolve(`${recordingId}.reck`);
  if (existsSync(sibling)) return sibling;

  const legacyDirect = join(process.cwd(), ".reelink", recordingId);
  if (existsSync(legacyDirect)) return legacyDirect;

  const legacyBrowserDirect = resolveLegacyBrowserRecordingArtifactDir(recordingId);
  if (existsSync(legacyBrowserDirect)) return legacyBrowserDirect;

  const legacySibling = resolve(recordingId + ".reelink");
  if (existsSync(legacySibling)) return legacySibling;

  throw new RecordingNotFoundError(recordingId);
}

/** Absolute path to `.reck/browser-recordings/<id>` (whether or not it exists yet). */
export function resolveBrowserRecordingArtifactDir(recordingId: string): string {
  return join(process.cwd(), ".reck", LEGACY_BROWSER_RECORDINGS_DIR, recordingId);
}

export function resolveLegacyBrowserRecordingArtifactDir(recordingId: string): string {
  return join(process.cwd(), ".reelink", LEGACY_BROWSER_RECORDINGS_DIR, recordingId);
}

/** Legacy browser session artifact root if present, else null. */
export function resolveLegacyBrowserRecordingRoot(recordingId: string): string | null {
  const root = resolveBrowserRecordingArtifactDir(recordingId);
  if (existsSync(root)) return root;
  const legacyRoot = resolveLegacyBrowserRecordingArtifactDir(recordingId);
  return existsSync(legacyRoot) ? legacyRoot : null;
}

export type LegacyBrowserRecordingPaths = {
  root: string;
  manifestPath: string;
  consoleJsonlPath: string;
  networkJsonlPath: string;
  networkHarPath: string;
  domDir: string;
  videoPath: string;
  tracePath: string;
  framesDir: string;
  logsJsonlPath: string;
  fiberCommitsJsonlPath: string;
  sourceDictionaryPath: string;
  reactGrabEventsJsonlPath: string;
};

export function legacyBrowserRecordingPathsFromRoot(root: string): LegacyBrowserRecordingPaths {
  return {
    root,
    manifestPath: join(root, "manifest.json"),
    consoleJsonlPath: join(root, "console.jsonl"),
    networkJsonlPath: join(root, "network.jsonl"),
    networkHarPath: join(root, "network.har"),
    domDir: join(root, "dom"),
    videoPath: join(root, "video.webm"),
    tracePath: join(root, "trace.zip"),
    framesDir: join(root, "frames"),
    logsJsonlPath: join(root, "logs.jsonl"),
    fiberCommitsJsonlPath: join(root, "fiber-commits.jsonl"),
    sourceDictionaryPath: join(root, "source-dictionary.json"),
    reactGrabEventsJsonlPath: join(root, "react-grab-events.jsonl"),
  };
}

export function legacyBrowserRecordingPaths(recordingId: string): LegacyBrowserRecordingPaths | null {
  const root = resolveLegacyBrowserRecordingRoot(recordingId);
  return root ? legacyBrowserRecordingPathsFromRoot(root) : null;
}

export type BrowserRecordingPackage = {
  id: string;
  root: string;
  manifestPath: string;
  consoleJsonlPath: string;
  networkJsonlPath: string;
  networkHarPath: string;
  domDir: string;
  videoPath: string;
  tracePath: string;
  framesDir: string;
  logsJsonlPath: string;
  fiberCommitsJsonlPath: string;
  sourceDictionaryPath: string;
  reactGrabEventsJsonlPath: string;
};

export function createBrowserRecordingPackage(
  recordingId: string,
  options: { outPath?: string } = {},
): BrowserRecordingPackage {
  const root = resolveBrowserRecordingArtifactDir(recordingId);
  const paths = legacyBrowserRecordingPathsFromRoot(root);
  mkdirSync(paths.domDir, { recursive: true });
  mkdirSync(paths.framesDir, { recursive: true });
  mkdirSync(dirname(paths.videoPath), { recursive: true });
  const videoPath = options.outPath ? resolve(options.outPath) : paths.videoPath;
  mkdirSync(dirname(videoPath), { recursive: true });

  return {
    id: recordingId,
    root,
    manifestPath: paths.manifestPath,
    consoleJsonlPath: paths.consoleJsonlPath,
    networkJsonlPath: paths.networkJsonlPath,
    networkHarPath: paths.networkHarPath,
    domDir: paths.domDir,
    videoPath,
    tracePath: paths.tracePath,
    framesDir: paths.framesDir,
    logsJsonlPath: paths.logsJsonlPath,
    fiberCommitsJsonlPath: paths.fiberCommitsJsonlPath,
    sourceDictionaryPath: paths.sourceDictionaryPath,
    reactGrabEventsJsonlPath: paths.reactGrabEventsJsonlPath,
  };
}

export function browserPackageRelativePath(browserPackage: BrowserRecordingPackage, absolutePath: string): string {
  return relative(browserPackage.root, absolutePath) || ".";
}

export type BrowserJsonlReadResult = {
  events: Array<Record<string, unknown>>;
  parse_errors: number;
};

export function readBrowserJsonlFile(path: string): BrowserJsonlReadResult {
  if (!existsSync(path)) return { events: [], parse_errors: 0 };

  const events: Array<Record<string, unknown>> = [];
  let parseErrors = 0;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line) continue;
    try {
      events.push(JSON.parse(line) as Record<string, unknown>);
    } catch {
      parseErrors += 1;
    }
  }

  return { events, parse_errors: parseErrors };
}

export function listLegacyBrowserDomHtmlFiles(domDir: string): string[] {
  if (!existsSync(domDir)) return [];
  return readdirSync(domDir)
    .filter((file) => file.endsWith(".html"))
    .sort();
}

export type DeterministicQueryAnswer = {
  recording_id: string;
  question: string;
  answer: Record<string, unknown> | null;
  reason?: string;
  patterns_matched: string[];
  patterns_tried: string[];
};

/**
 * Browser-only deterministic query branch: legacy `.reck/browser-recordings/<session_id>/`.
 * Returns null when that layout is absent; otherwise may append browser pattern ids to `tried` and return an answer.
 */
export function tryBrowserRecordingDeterministicQuery(
  recordingId: string,
  question: string,
  normalized: string,
  tried: string[],
): DeterministicQueryAnswer | null {
  const root = resolveLegacyBrowserRecordingRoot(recordingId);
  if (!root) return null;

  tried.push("browser_artifacts");
  const paths = legacyBrowserRecordingPathsFromRoot(root);
  const manifest = existsSync(paths.manifestPath)
    ? (JSON.parse(readFileSync(paths.manifestPath, "utf8")) as Record<string, unknown>)
    : {};

  if (isBrowserArtifactQuestion(normalized)) {
    return {
      recording_id: recordingId,
      question,
      answer: { kind: "browser_artifacts", manifest_path: paths.manifestPath, manifest },
      patterns_matched: ["browser_artifacts"],
      patterns_tried: [...tried],
    };
  }

  tried.push("browser_console");
  if (isBrowserConsoleQuestion(normalized)) {
    const parsed = readBrowserJsonlFile(paths.consoleJsonlPath);
    return {
      recording_id: recordingId,
      question,
      answer: {
        kind: "console",
        path: paths.consoleJsonlPath,
        events: parsed.events.slice(-50).map(compactBrowserEvent),
        parse_errors: parsed.parse_errors,
      },
      patterns_matched: ["browser_console"],
      patterns_tried: [...tried],
    };
  }

  tried.push("browser_network");
  if (isBrowserNetworkQuestion(normalized)) {
    const parsed = readBrowserJsonlFile(paths.networkJsonlPath);
    const { events } = parsed;
    const failed = events.filter(
      (event) =>
        event.event === "requestfailed" ||
        event.ok === false ||
        (typeof event.status === "number" && event.status >= 400),
    );
    return {
      recording_id: recordingId,
      question,
      answer: {
        kind: "network",
        path: paths.networkJsonlPath,
        event_count: events.length,
        failed_count: failed.length,
        failed: failed.slice(-50),
        parse_errors: parsed.parse_errors,
      },
      patterns_matched: ["browser_network"],
      patterns_tried: [...tried],
    };
  }

  tried.push("browser_dom");
  if (isBrowserDomQuestion(normalized)) {
    const files = listLegacyBrowserDomHtmlFiles(paths.domDir);
    return {
      recording_id: recordingId,
      question,
      answer: {
        kind: "dom",
        dir: paths.domDir,
        files,
        latest: files.length ? join(paths.domDir, files[files.length - 1] as string) : null,
      },
      patterns_matched: ["browser_dom"],
      patterns_tried: [...tried],
    };
  }

  return null;
}

function compactBrowserEvent(event: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(event).map(([key, value]) => [
      key,
      typeof value === "string" && value.length > 1000 ? `${value.slice(0, 1000)}...(+${value.length - 1000} chars)` : value,
    ]),
  );
}

function isBrowserArtifactQuestion(value: string): boolean {
  return (
    /\b(browser|page|headed)\b.*\b(artifacts?|recorded|manifest)\b/.test(value) ||
    /\b(artifacts?|recorded|manifest)\b.*\b(browser|page|headed)\b/.test(value)
  );
}

function isBrowserConsoleQuestion(value: string): boolean {
  return (
    /\b(browser|page)\b.*\b(console|logs?|errors?)\b/.test(value) || /\b(console|logs?|errors?)\b.*\b(browser|page)\b/.test(value)
  );
}

function isBrowserNetworkQuestion(value: string): boolean {
  return (
    /\b(browser|page)\b.*\b(network|requests?|responses?|failed requests?)\b/.test(value) ||
    /\b(network|requests?|responses?|failed requests?)\b.*\b(browser|page)\b/.test(value)
  );
}

function isBrowserDomQuestion(value: string): boolean {
  return /\b(browser|page)\b.*\b(dom|html|snapshot)\b/.test(value) || /\b(dom|html|snapshot)\b.*\b(browser|page)\b/.test(value);
}

export async function loadAnalysis(recordingId: string): Promise<StoredAnalysis> {
  const raw = JSON.parse(readFileSync(join(resolveRecordingDir(recordingId), "analysis.json"), "utf8")) as unknown;
  return StoredAnalysisSchema.parse(normalizeStoredAnalysis(raw));
}

export async function loadManifest(recordingId: string): Promise<Manifest> {
  const raw = JSON.parse(readFileSync(join(resolveRecordingDir(recordingId), "manifest.json"), "utf8")) as unknown;
  return ManifestSchema.passthrough().parse(raw);
}

export async function listWorkItems(recordingId: string): Promise<WorkItem[]> {
  return (await loadAnalysis(recordingId)).work_items;
}

export async function findWorkItemById(recordingId: string, findingId: string): Promise<WorkItem | null> {
  return (await listWorkItems(recordingId)).find((item) => item.id === findingId) ?? null;
}

export async function findNearestWorkItemByTimestamp(
  recordingId: string,
  ts: number,
): Promise<{ item: WorkItem; delta_sec: number } | null> {
  const items = await listWorkItems(recordingId);
  if (items.length === 0) return null;

  const nearest = items.reduce((best, item) => {
    const delta = Math.abs(item.ts - ts);
    return delta < best.delta_sec ? { item, delta_sec: delta } : best;
  }, { item: items[0] as WorkItem, delta_sec: Math.abs((items[0] as WorkItem).ts - ts) });
  return nearest;
}

export async function findFrameNearTimestamp(recordingId: string, ts: number): Promise<FrameMatch | null> {
  const browserPaths = legacyBrowserRecordingPaths(recordingId);
  const root = existsSync(join(process.cwd(), ".reck", recordingId)) || existsSync(resolve(`${recordingId}.reck`)) || browserPaths
    ? resolveRecordingDir(recordingId)
    : null;
  if (!root) return browserPaths ? findBrowserFrameNearTimestamp(browserPaths, ts) : null;

  const manifest = await loadManifest(recordingId).catch((error) => {
    if (browserPaths) return null;
    throw error;
  });
  if (!manifest) return findBrowserFrameNearTimestamp(browserPaths as LegacyBrowserRecordingPaths, ts);
  const framesStream = manifest.streams?.frames ?? manifest.streams?.layer0;
  if (framesStream?.status && framesStream.status !== "available") {
    return null;
  }

  const manifestWithFrames = manifest as unknown as { frame_snapshots?: unknown };
  const frameSnapshots = Array.isArray(manifestWithFrames.frame_snapshots)
    ? manifestWithFrames.frame_snapshots.filter(isFrameSnapshot)
    : [];
  if (frameSnapshots.length) {
    const nearest = frameSnapshots.reduce((best, frame, index) => {
      const delta = Math.abs(frame.ts - ts);
      return delta < best.delta_sec ? { frame, index, delta_sec: delta } : best;
    }, { frame: frameSnapshots[0] as FrameSnapshot, index: 0, delta_sec: Math.abs((frameSnapshots[0] as FrameSnapshot).ts - ts) });
    return {
      path: resolvePackageArtifact(root, nearest.frame.path),
      index: nearest.index + 1,
      ts: nearest.frame.ts,
      delta_sec: nearest.delta_sec,
    };
  }

  if (browserPaths) return findBrowserFrameNearTimestamp(browserPaths, ts);

  const frameCount = manifest.preprocessing.frame_count;
  const effectiveFps = manifest.preprocessing.effective_fps;
  const framesDir = manifest.artifacts.frames;

  if (frameCount <= 0 || effectiveFps <= 0 || !framesDir || framesStream?.status !== "available") return null;

  const index = Math.min(frameCount, Math.max(1, Math.round(ts * effectiveFps) + 1));
  const frameTs = (index - 1) / effectiveFps;
  const path = join(resolvePackageArtifact(root, framesDir), `frame-${String(index).padStart(4, "0")}.jpg`);

  return {
    path,
    index,
    ts: frameTs,
    delta_sec: Math.abs(frameTs - ts),
  };
}

function findBrowserFrameNearTimestamp(paths: LegacyBrowserRecordingPaths, ts: number): FrameMatch | null {
  if (!existsSync(paths.framesDir)) return null;

  const files = readdirSync(paths.framesDir)
    .filter((file) => /\.(?:jpg|jpeg|png|webp)$/i.test(file))
    .sort();
  if (!files.length) return null;

  const fps = browserFrameFps(paths.manifestPath);
  const candidates = files.map((file, offset) => {
    const index = frameIndexFromName(file) ?? offset + 1;
    const frameTs = (index - 1) / fps;
    return { path: join(paths.framesDir, file), index, ts: frameTs, delta_sec: Math.abs(frameTs - ts) };
  });

  return candidates.reduce((best, candidate) => (candidate.delta_sec < best.delta_sec ? candidate : best), candidates[0] as FrameMatch);
}

function browserFrameFps(manifestPath: string): number {
  if (!existsSync(manifestPath)) return 1;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  const preprocessing = manifest.preprocessing;
  if (preprocessing && typeof preprocessing === "object") {
    const fps = (preprocessing as { effective_fps?: unknown }).effective_fps;
    if (typeof fps === "number" && fps > 0) return fps;
  }
  const fps = manifest.effective_fps ?? manifest.fps;
  return typeof fps === "number" && fps > 0 ? fps : 1;
}

function frameIndexFromName(file: string): number | null {
  const match = file.match(/(?:frame|screenshot|snapshot)[-_]?(\d+)/i) ?? file.match(/(\d+)/);
  if (!match?.[1]) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function listStreams(recordingId: string): Promise<Manifest["streams"]> {
  return (await loadManifest(recordingId)).streams;
}

export async function isProdBuild(recordingId: string): Promise<boolean | null> {
  const manifest = await loadManifest(recordingId);
  return manifest.prod_build_status === "detected" ? manifest.prod_build : null;
}

type FrameSnapshot = {
  ts: number;
  path: string;
};

function isFrameSnapshot(value: unknown): value is FrameSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FrameSnapshot>;
  return typeof candidate.ts === "number" && typeof candidate.path === "string" && candidate.path.length > 0;
}

function resolvePackageArtifact(root: string, artifactPath: string): string {
  return artifactPath.startsWith("/") ? artifactPath : join(root, artifactPath);
}

function normalizeStoredAnalysis(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const candidate = raw as { findings?: unknown; work_items?: unknown };
  const workItems = Array.isArray(candidate.work_items)
    ? candidate.work_items
    : Array.isArray(candidate.findings)
      ? candidate.findings.map(legacyFindingToWorkItem)
      : undefined;
  if (!workItems) return raw;

  return {
    ...candidate,
    findings: Array.isArray(candidate.findings) ? candidate.findings.map(publicFindingFromUnknown) : workItems.map(publicFindingFromUnknown),
    work_items: workItems,
  };
}

function publicFindingFromUnknown(finding: unknown): Pick<WorkItem, "id" | "ts" | "type" | "severity" | "title" | "confidence"> {
  const item = legacyFindingToWorkItem(finding);
  return {
    id: item.id,
    ts: item.ts,
    type: item.type,
    severity: item.severity,
    title: item.title,
    confidence: item.confidence,
  };
}

function legacyFindingToWorkItem(finding: unknown): WorkItem {
  const item = finding as Partial<WorkItem>;
  return {
    id: String(item.id ?? "f0"),
    ts: Number(item.ts ?? 0),
    type: String(item.type ?? "unknown"),
    severity: item.severity ?? "low",
    title: String(item.title ?? "Untitled work item"),
    confidence: Number(item.confidence ?? 0),
    description: item.description,
    state: "detected",
    approval_state: "pending",
    routed_to: null,
    completed_at: null,
    source: "video",
    intent: "fix",
  };
}

function recordingIdFor(sourcePath: string): string {
  const h = createHash("sha1");
  h.update(sourcePath);
  h.update(String(Date.now()));
  const stem = basename(sourcePath).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `${stem || "recording"}-${h.digest("hex").slice(0, 10)}`;
}
