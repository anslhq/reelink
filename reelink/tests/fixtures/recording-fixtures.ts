import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { LEGACY_BROWSER_RECORDINGS_DIR } from "../../src/recordings/store.js";
import type { Manifest } from "../../src/schemas/recording.js";

export const importedVideoRecordingId = "imported-video-recording";
export const deterministicQueryRecordingId = "query-recording";

export function createImportedVideoFixture(id: string): void {
  const root = join(".reelink", id);
  const frames = join(root, "frames");
  mkdirSync(frames, { recursive: true });
  writeFileSync(join(frames, "frame-0003.jpg"), "fixture frame\n");
  writeJson(join(root, "analysis.json"), importedVideoAnalysis(id));
  writeJson(join(root, "manifest.json"), importedVideoManifest(id));
}

export function createLegacyImportedVideoFixture(id: string): void {
  const root = join(".reelink", id);
  mkdirSync(root, { recursive: true });
  writeJson(join(root, "analysis.json"), {
    recording_id: id,
    duration_sec: 3,
    summary: "Legacy fixture",
    findings: [
      {
        id: "legacy-1",
        ts: 1.25,
        type: "visual-regression",
        severity: "low",
        title: "Legacy finding shape",
        confidence: 0.5,
        description: "Legacy package used findings instead of work_items.",
      },
    ],
    next_steps: [],
  });
  writeJson(join(root, "manifest.json"), {
    recording_id: id,
    created_at: "2026-04-29T00:00:00.000Z",
    source_type: "imported_video",
    duration_sec: 3,
    preprocessing: {
      requested_fps: 1,
      effective_fps: 1,
      max_frames: 64,
      long_edge_px: 896,
      frame_count: 0,
    },
    artifacts: {},
    streams: {},
    prod_build: false,
    safety: { redaction_applied: false },
  });
}

export function createImportedVideoFixtureWithLayer0Unavailable(id: string): void {
  const root = join(".reelink", id);
  const frames = join(root, "frames");
  mkdirSync(frames, { recursive: true });
  writeFileSync(join(frames, "frame-0003.jpg"), "fixture frame\n");
  writeJson(join(root, "analysis.json"), importedVideoAnalysis(id));
  const manifest = importedVideoManifest(id) as Manifest;
  manifest.streams = {
    ...manifest.streams,
    layer0: { status: "not_collected", reason: "Fixture: sampled frames unavailable for retrieval" },
  };
  writeJson(join(root, "manifest.json"), manifest);
}

export function createBrowserArtifactFixture(id: string): void {
  const root = join(".reelink", LEGACY_BROWSER_RECORDINGS_DIR, id);
  const dom = join(root, "dom");
  mkdirSync(dom, { recursive: true });
  writeJson(join(root, "manifest.json"), { session_id: id, url: "http://localhost:3000" });
  writeFileSync(join(root, "console.jsonl"), `${JSON.stringify({ ts: 0.5, type: "error", text: "Hydration warning" })}\nnot-json\n`);
  writeFileSync(
    join(root, "network.jsonl"),
    `${JSON.stringify({ ts: 0.1, event: "request", method: "GET", url: "/api/data" })}\n${JSON.stringify({ ts: 1, event: "response", status: 500, ok: false, url: "/api/data" })}\n`,
  );
  writeFileSync(join(dom, "snapshot-0001.html"), "<main>first</main>\n");
  writeFileSync(join(dom, "snapshot-0002.html"), "<main>second</main>\n");
}

export function createRuntimeArtifactFixture(id: string, options: { componentSource?: "react-grab" | "fiber" } = {}): void {
  const root = join(".reelink", id);
  const dom = join(root, "dom");
  mkdirSync(dom, { recursive: true });
  writeFileSync(join(root, "video.webm"), "fixture video\n");
  writeFileSync(join(dom, "snapshot-0001.html"), "<html><body><main><button>First</button></main></body></html>\n");
  writeFileSync(join(dom, "snapshot-0002.html"), "<html><body><main><button>Second</button></main></body></html>\n");
  writeFileSync(
    join(root, "console.jsonl"),
    `${JSON.stringify({ ts: 0.2, type: "log", text: "safe log" })}\n${JSON.stringify({ ts: 0.8, type: "error", text: "password=[redacted]" })}\n`,
  );
  writeFileSync(
    join(root, "network.jsonl"),
    `${JSON.stringify({ ts: 0.4, event: "request", method: "GET", url: "https://example.test/api?token=[redacted]" })}\n`,
  );
  if (options.componentSource === "fiber") {
    writeFileSync(
      join(root, "fiber-commits.jsonl"),
      `${JSON.stringify({
        ts: 0.8,
        component: "SettingsPage",
        component_stack: [
          { display_name: "SettingsPage", fiber_id: "fiber-2", source: { file: "src/routes/settings.tsx", line: 33, column: 5 } },
        ],
      })}\n`,
    );
  } else {
    writeFileSync(
      join(root, "react-grab-events.jsonl"),
      `${JSON.stringify({
        ts: 1.1,
        route: "/settings",
        element_path: "html > body > main > button",
        bounding_box: { x: 10, y: 20, width: 120, height: 40 },
        component: "SaveButton",
        props: { label: "Save", token: "[redacted]" },
        component_stack: [
          { display_name: "SaveButton", fiber_id: "fiber-1", source: { file: "src/components/SaveButton.tsx", line: 12, column: 7 } },
          { display_name: "SettingsPage", fiber_id: "fiber-2", source: { file: "src/routes/settings.tsx", line: 33, column: 5 } },
        ],
      })}\n`,
    );
  }
  writeJson(join(root, "manifest.json"), {
    recording_id: id,
    created_at: "2026-04-29T00:00:00.000Z",
    source_type: "browser_recording",
    source_path: "http://localhost:3000/settings",
    duration_sec: null,
    preprocessing: {
      requested_fps: 0,
      effective_fps: 0,
      max_frames: 0,
      long_edge_px: 0,
      frame_count: 0,
    },
    artifacts: {
      video: "video.webm",
      dom: "dom",
      console: "console.jsonl",
      network: "network.jsonl",
      network_har: "network.har",
      trace: "trace.zip",
      fiber_commits: "fiber-commits.jsonl",
      source_dictionary: "source-dictionary.json",
      react_grab_events: "react-grab-events.jsonl",
    },
    streams: {
      layer0: { status: "not_collected", reason: "Fixture browser recording has no Layer 0 analysis" },
      frames: { status: "not_collected", reason: "Fixture browser recording has no sampled frames" },
      trace: { status: "not_collected", reason: "Fixture trace unavailable" },
      dom: { status: "available" },
      fiber_commits: options.componentSource === "fiber" ? { status: "available" } : { status: "not_collected", reason: "Fixture uses react-grab events only" },
      source_dictionary: { status: "not_collected", reason: "Fixture source dictionary unavailable" },
      react_grab_events: options.componentSource === "fiber" ? { status: "not_collected", reason: "Fixture uses fiber commits only" } : { status: "available" },
      network: { status: "available" },
      console: { status: "available" },
      eval: { status: "not_collected", reason: "No verification artifact generated" },
    },
    prod_build: false,
    safety: { redaction_applied: true },
    dom_snapshots: [
      {
        ts: 0.25,
        path: "dom/snapshot-0001.html",
        url: "http://localhost:3000/settings",
        title: "Settings",
        tree_summary: "html:1, body:1, main:1, button:1",
      },
      {
        ts: 1.25,
        path: "dom/snapshot-0002.html",
        url: "http://localhost:3000/settings",
        title: "Settings",
        tree_summary: "html:1, body:1, main:1, button:1",
      },
    ],
  });
}

function importedVideoAnalysis(id: string) {
  return {
    recording_id: id,
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
  };
}

function importedVideoManifest(id: string) {
  return {
    recording_id: id,
    created_at: "2026-04-29T00:00:00.000Z",
    source_type: "imported_video",
    source_path: "/fixtures/imported-video.mov",
    duration_sec: 12.5,
    preprocessing: {
      requested_fps: 4,
      effective_fps: 1,
      max_frames: 64,
      long_edge_px: 896,
      frame_count: 6,
    },
    artifacts: { analysis: "analysis.json", frames: "frames" },
    streams: {
      layer0: { status: "available" },
      dom: { status: "not_collected", reason: "Runtime DOM capture was not available" },
      components: { status: "not_collected", reason: "Runtime component capture was not available" },
      network: { status: "not_collected", reason: "Browser recording was not used" },
      console: { status: "not_collected", reason: "Browser recording was not used" },
    },
    model: { provider: "openrouter", model_id: "qwen/qwen3.6-flash", route: "raw-video" },
    prod_build: false,
    safety: { redaction_applied: false },
  };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
