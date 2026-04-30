import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  findFrameNearTimestamp,
  findNearestWorkItemByTimestamp,
  findWorkItemById,
  isProdBuild,
  legacyBrowserRecordingPaths,
  listStreams,
  listWorkItems,
  loadAnalysis,
  loadManifest,
  readBrowserJsonlFile,
  resolveLegacyBrowserRecordingRoot,
  resolveRecordingDir,
} from "../src/recordings/store.js";
import {
  createBrowserArtifactFixture,
  createImportedVideoFixture,
  createImportedVideoFixtureWithLayer0Unavailable,
  createLegacyImportedVideoFixture,
  importedVideoRecordingId,
} from "./fixtures/recording-fixtures.js";

let workspace: string;
let previousCwd: string;

beforeEach(async () => {
  previousCwd = process.cwd();
  workspace = await mkdtemp(join(tmpdir(), "reelink-recordings-store-"));
  process.chdir(workspace);
  createImportedVideoFixture(importedVideoRecordingId);
});

afterEach(async () => {
  process.chdir(previousCwd);
  await rm(workspace, { recursive: true, force: true });
});

describe("imported video package storage", () => {
  test("loads current analysis and manifest envelope shapes", async () => {
    const analysis = await loadAnalysis(importedVideoRecordingId);
    const manifest = await loadManifest(importedVideoRecordingId);

    expect(analysis).toEqual({
      recording_id: importedVideoRecordingId,
      duration_sec: 12.5,
      summary: "Two UI findings were detected in the imported recording.",
      work_items: [
        {
          id: "f1",
          ts: 2.4,
          type: "layout-shift",
          severity: "high",
          title: "Hero card jumps during transition",
          confidence: 0.91,
          description: "The hero card shifts down as the transition starts.",
          state: "detected",
          approval_state: "pending",
          routed_to: null,
          completed_at: null,
          source: "video",
          intent: "fix",
        },
        {
          id: "f2",
          ts: 8.1,
          type: "loading-state",
          severity: "medium",
          title: "Spinner flashes after content appears",
          confidence: 0.74,
          description: "A loading spinner briefly appears over already-loaded content.",
          state: "detected",
          approval_state: "pending",
          routed_to: null,
          completed_at: null,
          source: "video",
          intent: "investigate",
        },
      ],
      next_steps: ["Inspect the transition container", "Check suspense fallback timing"],
    });

    expect(manifest.recording_id).toBe(importedVideoRecordingId);
    expect(manifest.source_type).toBe("imported_video");
    expect(manifest.artifacts).toEqual({ analysis: "analysis.json", frames: "frames" });
    expect(manifest.streams).toEqual({
      layer0: { status: "available" },
      dom: { status: "not_collected", reason: "Runtime DOM capture was not available" },
      components: { status: "not_collected", reason: "Runtime component capture was not available" },
      network: { status: "not_collected", reason: "Browser recording was not used" },
      console: { status: "not_collected", reason: "Browser recording was not used" },
    });
  });

  test("resolves package helpers and frame paths from the current layout", async () => {
    const root = resolveRecordingDir(importedVideoRecordingId);
    const items = await listWorkItems(importedVideoRecordingId);
    const nearest = await findNearestWorkItemByTimestamp(importedVideoRecordingId, 2.6);
    const f2 = await findWorkItemById(importedVideoRecordingId, "f2");
    const missing = await findWorkItemById(importedVideoRecordingId, "missing");
    const frame = await findFrameNearTimestamp(importedVideoRecordingId, 2.4);

    expect(root.endsWith(join(".reelink", importedVideoRecordingId))).toBe(true);
    expect(items.map((item) => item.id)).toEqual(["f1", "f2"]);
    expect(nearest?.item.id).toBe("f1");
    expect(nearest?.delta_sec).toBeCloseTo(0.2, 6);
    expect(f2?.title).toBe("Spinner flashes after content appears");
    expect(missing).toBeNull();
    expect(frame).toEqual({
      path: join(root, "frames", "frame-0003.jpg"),
      index: 3,
      ts: 2,
      delta_sec: 0.3999999999999999,
    });
    expect(existsSync(frame?.path ?? "")).toBe(true);
    expect(await isProdBuild(importedVideoRecordingId)).toBe(false);
    expect(await listStreams(importedVideoRecordingId)).toEqual((await loadManifest(importedVideoRecordingId)).streams);
  });

  test("normalizes legacy findings arrays into current WorkItems", async () => {
    const legacyId = "legacy-import-recording";
    createLegacyImportedVideoFixture(legacyId);

    const analysis = await loadAnalysis(legacyId);

    expect(analysis.work_items).toEqual([
      {
        id: "legacy-1",
        ts: 1.25,
        type: "visual-regression",
        severity: "low",
        title: "Legacy finding shape",
        confidence: 0.5,
        description: "Legacy package used findings instead of work_items.",
        state: "detected",
        approval_state: "pending",
        routed_to: null,
        completed_at: null,
        source: "video",
        intent: "fix",
      },
    ]);
  });

  test("returns null for frame lookup when Layer 0 stream is explicitly unavailable", async () => {
    const id = "layer0-stream-blocked";
    createImportedVideoFixtureWithLayer0Unavailable(id);
    await expect(findFrameNearTimestamp(id, 2.4)).resolves.toBeNull();
  });

  test("resolves legacy browser recording paths and parses console JSONL fixtures", () => {
    const sid = "store-browser-compat";
    createBrowserArtifactFixture(sid);
    const root = resolveLegacyBrowserRecordingRoot(sid);
    expect(root).not.toBeNull();
    expect(root?.includes("browser-recordings")).toBe(true);

    const paths = legacyBrowserRecordingPaths(sid);
    expect(paths?.consoleJsonlPath).toBeDefined();
    const parsed = readBrowserJsonlFile(paths!.consoleJsonlPath);
    expect(parsed.events).toEqual([{ ts: 0.5, type: "error", text: "Hydration warning" }]);
    expect(parsed.parse_errors).toBe(1);
  });
});
