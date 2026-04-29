import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

import { AnalyzeResultSchema, ManifestSchema, type AnalyzeResult, type Manifest, type WorkItem } from "../schemas.js";

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
  const root = join(process.cwd(), ".reelink", id);
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

export function resolveRecordingDir(recordingId: string): string {
  const direct = join(process.cwd(), ".reelink", recordingId);
  if (existsSync(direct)) return direct;

  const sibling = resolve(`${recordingId}.reelink`);
  if (existsSync(sibling)) return sibling;

  throw new RecordingNotFoundError(recordingId);
}

export async function loadAnalysis(recordingId: string): Promise<AnalyzeResult> {
  const raw = JSON.parse(readFileSync(join(resolveRecordingDir(recordingId), "analysis.json"), "utf8")) as unknown;
  return AnalyzeResultSchema.parse(normalizeLegacyAnalysis(raw));
}

export async function loadManifest(recordingId: string): Promise<Manifest> {
  const raw = JSON.parse(readFileSync(join(resolveRecordingDir(recordingId), "manifest.json"), "utf8")) as unknown;
  return ManifestSchema.parse(raw);
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
  const manifest = await loadManifest(recordingId);
  const frameCount = manifest.preprocessing.frame_count;
  const effectiveFps = manifest.preprocessing.effective_fps;
  const framesDir = manifest.artifacts.frames;

  if (frameCount <= 0 || effectiveFps <= 0 || !framesDir) return null;

  const index = Math.min(frameCount, Math.max(1, Math.round(ts * effectiveFps) + 1));
  const frameTs = (index - 1) / effectiveFps;
  const path = join(resolveRecordingDir(recordingId), framesDir, `frame-${String(index).padStart(4, "0")}.jpg`);

  return {
    path,
    index,
    ts: frameTs,
    delta_sec: Math.abs(frameTs - ts),
  };
}

export async function listStreams(recordingId: string): Promise<Manifest["streams"]> {
  return (await loadManifest(recordingId)).streams;
}

export async function isProdBuild(recordingId: string): Promise<boolean> {
  return (await loadManifest(recordingId)).prod_build;
}

function normalizeLegacyAnalysis(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const candidate = raw as { findings?: unknown; work_items?: unknown };
  if (candidate.work_items || !Array.isArray(candidate.findings)) return raw;

  return {
    ...candidate,
    work_items: candidate.findings.map(legacyFindingToWorkItem),
    findings: undefined,
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
