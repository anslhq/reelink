import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, writeFileSync } from "node:fs";
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
  createBrowserRecordingPackage,
  resolveLegacyBrowserRecordingRoot,
  resolveRecordingDir,
} from "../src/recordings/store.js";
import {
  createBrowserArtifactFixture,
  createImportedVideoFixture,
  createImportedVideoFixtureWithLayer0Unavailable,
  createLegacyImportedVideoFixture,
  createLegacySiblingImportedVideoFixture,
  createSiblingImportedVideoFixture,
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
      findings: [
        {
          id: "f1",
          ts: 2.4,
          type: "layout-shift",
          severity: "high",
          title: "Hero card jumps during transition",
          confidence: 0.91,
        },
        {
          id: "f2",
          ts: 8.1,
          type: "loading-state",
          severity: "medium",
          title: "Spinner flashes after content appears",
          confidence: 0.74,
        },
      ],
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
    expect(manifest.artifacts).toEqual({ analysis: "analysis.json", frames: "frames/", source_video: "/fixtures/imported-video.mov" });
    expect(manifest.prod_build).toBeNull();
    expect(manifest.prod_build_status).toBe("unknown");
    expect(manifest.relations).toEqual({ imported_video_id: importedVideoRecordingId, related_recording_ids: [], relation: "source_import" });
    expect(manifest.streams).toEqual({
      frames: { status: "available" },
      trace: { status: "not_collected", reason: "Layer 0 imported video analysis only" },
      fiber_commits: { status: "not_collected", reason: "Layer 0 imported video analysis only" },
      source_dictionary: { status: "not_collected", reason: "Layer 0 imported video analysis only" },
      react_grab_events: { status: "not_collected", reason: "Layer 0 imported video analysis only" },
      network: { status: "not_collected", reason: "Layer 0 imported video analysis only" },
      console: { status: "not_collected", reason: "Layer 0 imported video analysis only" },
      eval: { status: "not_collected", reason: "No verification artifact generated" },
    });
  });

  test("resolves package helpers and frame paths from the current layout", async () => {
    const root = resolveRecordingDir(importedVideoRecordingId);
    const items = await listWorkItems(importedVideoRecordingId);
    const nearest = await findNearestWorkItemByTimestamp(importedVideoRecordingId, 2.6);
    const f2 = await findWorkItemById(importedVideoRecordingId, "f2");
    const missing = await findWorkItemById(importedVideoRecordingId, "missing");
    const frame = await findFrameNearTimestamp(importedVideoRecordingId, 2.4);

    expect(root.endsWith(join(".reck", importedVideoRecordingId))).toBe(true);
    expect(existsSync(join(workspace, ".reelink", importedVideoRecordingId))).toBe(false);
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
    expect(await isProdBuild(importedVideoRecordingId)).toBeNull();
    expect(await listStreams(importedVideoRecordingId)).toEqual((await loadManifest(importedVideoRecordingId)).streams);
  });

  test("normalizes legacy findings arrays into current WorkItems", async () => {
    const legacyId = "legacy-import-recording";
    createLegacyImportedVideoFixture(legacyId);

    const analysis = await loadAnalysis(legacyId);

    expect(analysis.findings).toEqual([
      {
        id: "legacy-1",
        ts: 1.25,
        type: "visual-regression",
        severity: "low",
        title: "Legacy finding shape",
        confidence: 0.5,
      },
    ]);
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

  test("resolves current and legacy sibling imported-video packages", async () => {
    const siblingId = "sibling-import-recording";
    const legacySiblingId = "legacy-sibling-import-recording";
    createSiblingImportedVideoFixture(siblingId);
    createLegacySiblingImportedVideoFixture(legacySiblingId);

    expect(resolveRecordingDir(siblingId).endsWith(`${siblingId}.reck`)).toBe(true);
    expect(resolveRecordingDir(legacySiblingId).endsWith(`${legacySiblingId}.reelink`)).toBe(true);
    expect((await loadManifest(siblingId)).relations).toEqual({ imported_video_id: siblingId, related_recording_ids: [], relation: "source_import" });
    expect((await loadAnalysis(legacySiblingId)).work_items[0]?.id).toBe("legacy-1");
    expect((await findFrameNearTimestamp(siblingId, 2.4))?.path.endsWith(join(`${siblingId}.reck`, "frames", "frame-0003.jpg"))).toBe(true);
  });

  test("returns null for frame lookup when Layer 0 stream is explicitly unavailable", async () => {
    const id = "layer0-stream-blocked";
    createImportedVideoFixtureWithLayer0Unavailable(id);
    await expect(findFrameNearTimestamp(id, 2.4)).resolves.toBeNull();
  });

  test("creates new browser recording packages under .reck and resolves current browser packages", async () => {
    const sid = "store-browser-current";
    const browserPackage = createBrowserRecordingPackage(sid);
    writeFileSync(join(browserPackage.framesDir, "screenshot-0001.png"), "frame\n");
    writeFileSync(
      browserPackage.manifestPath,
      `${JSON.stringify({
        recording_id: sid,
        created_at: "2026-04-29T00:00:00.000Z",
        source_type: "browser_recording",
        source_path: "http://example.test",
        duration_sec: null,
        preprocessing: { requested_fps: 0, effective_fps: 0, max_frames: 0, long_edge_px: 0, frame_count: 0, strategy: "cached-frame-retrieval", primary_analysis_uses_raw_video: false },
        artifacts: { frames: "frames", video: "video.webm" },
        streams: { frames: { status: "available" }, trace: { status: "not_collected", reason: "Fixture trace unavailable" }, fiber_commits: { status: "unavailable", reason: "Fixture did not run React capture" }, source_dictionary: { status: "unavailable", reason: "Fixture did not run React capture" }, react_grab_events: { status: "failed", reason: "Fixture capture failed" }, network: { status: "not_collected", reason: "Fixture network unavailable" }, console: { status: "not_collected", reason: "Fixture console unavailable" }, eval: { status: "not_collected", reason: "No verification artifact generated" } },
        prod_build: false,
        prod_build_status: "detected",
        relations: { browser_recording_id: sid, related_recording_ids: [], relation: "browser_capture" },
        safety: { redaction_applied: false },
        frame_snapshots: [{ ts: 1.5, path: "frames/screenshot-0001.png", url: "http://example.test" }],
      }, null, 2)}\n`,
    );

    expect(browserPackage.root.endsWith(join(".reck", "browser-recordings", sid))).toBe(true);
    expect(existsSync(browserPackage.root)).toBe(true);
    expect(existsSync(join(workspace, ".reelink", "browser-recordings", sid))).toBe(false);
    expect(resolveRecordingDir(sid)).toBe(browserPackage.root);
    expect(await isProdBuild(sid)).toBe(false);
    expect(await findFrameNearTimestamp(sid, 1.4)).toEqual({
      path: join(browserPackage.framesDir, "screenshot-0001.png"),
      index: 1,
      ts: 1.5,
      delta_sec: 0.10000000000000009,
    });
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
