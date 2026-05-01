import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { findFrameNearTimestamp } from "../src/recordings/store.js";
import { getRuntimeComponents, getRuntimeDom, getRuntimeFindingContext } from "../src/runtime-artifacts/retrieval.js";
import { createBrowserArtifactFixture, createImportedVideoFixture, createRuntimeArtifactFixture, importedVideoRecordingId } from "./fixtures/recording-fixtures.js";

let workspace: string;
let previousCwd: string;

beforeEach(async () => {
  previousCwd = process.cwd();
  workspace = await mkdtemp(join(tmpdir(), "reelink-runtime-artifacts-"));
  process.chdir(workspace);
});

afterEach(async () => {
  process.chdir(previousCwd);
  await rm(workspace, { recursive: true, force: true });
});

describe("runtime artifact retrieval", () => {
  test("returns explicit missing-stream responses when DOM was not collected", async () => {
    createImportedVideoFixture(importedVideoRecordingId);

    await expect(getRuntimeDom(importedVideoRecordingId, 1.2)).resolves.toEqual({
      recording_id: importedVideoRecordingId,
      query_ts: 1.2,
      status: "missing_stream",
      stream: "dom",
      reason: "dom stream is not listed in manifest",
    });
  });

  test("looks up nearest persisted DOM snapshot by timestamp", async () => {
    createRuntimeArtifactFixture("runtime-package");

    const result = await getRuntimeDom("runtime-package", 1.1);

    expect(result).toMatchObject({
      recording_id: "runtime-package",
      query_ts: 1.1,
      status: "available",
      tree_summary: "html:1, body:1, main:1, button:1",
      snapshot_ts: 1.25,
      delta_sec: 0.15,
      url: "http://localhost:3000/settings",
      title: "Settings",
      streams_missing: {
        trace: "Fixture trace unavailable",
        fiber_commits: "Fixture uses react-grab events only",
        source_dictionary: "Fixture source dictionary unavailable",
        eval: "No verification artifact generated",
      },
    });
    if (result.status !== "available") throw new Error("expected DOM result");
    expect(result.path).toContain(".reck/runtime-package/dom/snapshot-0002.html");
    expect(readFileSync(result.path, "utf8")).toContain("Second");
  });

  test("looks up nearest frame across imported-video and browser-recording packages", async () => {
    createImportedVideoFixture(importedVideoRecordingId);
    createBrowserArtifactFixture("browser-frame-package");

    await expect(findFrameNearTimestamp(importedVideoRecordingId, 2.4)).resolves.toMatchObject({
      path: expect.stringContaining(".reck/imported-video-recording/frames/frame-0003.jpg"),
      index: 3,
      ts: 2,
      delta_sec: 0.3999999999999999,
    });
    await expect(findFrameNearTimestamp("browser-frame-package", 2.7)).resolves.toMatchObject({
      path: expect.stringContaining(".reelink/browser-recordings/browser-frame-package/frames/frame-0004.jpg"),
      index: 4,
      ts: 3,
      delta_sec: 0.2999999999999998,
    });
  });

  test("looks up component source by timestamp and coordinates from persisted react-grab events", async () => {
    createRuntimeArtifactFixture("runtime-package");

    const result = await getRuntimeComponents("runtime-package", 1, { x: 20, y: 30 });

    expect(result).toMatchObject({
      recording_id: "runtime-package",
      query_ts: 1,
      status: "available",
      component: "SaveButton",
      file: "src/components/SaveButton.tsx",
      line: 12,
      column: 7,
      finding_id: "react-grab-finding-1",
      frame_idx: 3,
      element_path: "html > body > main > button",
      bounding_box: { x: 10, y: 20, width: 120, height: 40 },
      selected_text: "Save",
      css_classes: ["btn", "btn-primary"],
      computed_styles: { display: "inline-flex", color: "rgb(255, 255, 255)" },
      accessibility: { role: "button", name: "Save", disabled: false },
      props: { label: "Save", token: "[redacted]", nested: { password: "[redacted]" } },
      delta_sec: 0.1,
      source: "react_grab_events",
      prod_build: { status: "unknown", value: null, reason: null },
    });
    if (result.status !== "available") throw new Error("expected component result");
    expect(result.component_stack.some((frame) => frame.display_name === "SaveButton")).toBe(true);
    expect(result.source_references.some((ref) => ref.file === "src/components/SaveButton.tsx" && ref.line === 12 && ref.column === 7 && ref.component === "SaveButton")).toBe(true);
    expect(result.markdown).toContain("Full DOM Path: html > body > main > button");
    expect(result.markdown).toContain("CSS Classes: btn btn-primary");
    expect(result.markdown).toContain("Position: x=10, y=20, width=120, height=40");
    expect(result.markdown).toContain("Selected text: Save");
    expect(result.markdown).toContain("Computed Styles:");
    expect(result.markdown).toContain("Accessibility:");
    expect(result.markdown).toContain("Source: src/components/SaveButton.tsx:12:7");
    expect(result.markdown).toContain("React: SaveButton > SettingsPage");
    expect(result.xml).toContain("<selected_element ");
    expect(result.xml).toContain('component="SaveButton"');
    expect(result.xml).toContain("<selected_text>Save</selected_text>");
    expect(result.xml).toContain("at SaveButton in src/components/SaveButton.tsx:12:7");
    expect(result.xml.trim().startsWith('<component')).toBe(false);
    expect(result.candidate).toMatchObject({
      rank: 1,
      confidence: 0.88,
      rationale: expect.stringContaining("coordinate hit inside bounding box"),
      component: "SaveButton",
      props: { token: "[redacted]", nested: { password: "[redacted]" } },
    });
    expect(result.candidates).toEqual([
      expect.objectContaining({ rank: 1, component: "SaveButton", confidence: 0.88 }),
      expect.objectContaining({ rank: 2, component: "SettingsForm", confidence: null, file: "src/routes/settings.tsx" }),
    ]);
  });

  test("keeps missing source context explicit in projections and candidates", async () => {
    createRuntimeArtifactFixture("runtime-package");

    const result = await getRuntimeComponents("runtime-package", 1.3, { x: 20, y: 30 });

    if (result.status !== "available") throw new Error("expected component result");
    expect(result.component).toBe("SettingsForm");
    expect(result.file).toBe("src/routes/settings.tsx");
    expect(result.component_stack[0]).toMatchObject({ display_name: "SettingsForm" });
    expect(result.source_references).toEqual([{ file: "src/routes/settings.tsx", line: 33, column: 5, component: "SettingsPage" }]);
    expect(result.props).toEqual({ apiKey: "[redacted]" });
    expect(result.xml).toContain("at SettingsForm in unavailable");
    expect(result.markdown).toContain("React: SettingsForm > SettingsPage");
  });


  test("returns explicit missing-stream responses when persisted component events do not match coordinates", async () => {
    createRuntimeArtifactFixture("runtime-package");

    await expect(getRuntimeComponents("runtime-package", 1, { x: 500, y: 500 })).resolves.toEqual({
      recording_id: "runtime-package",
      query_ts: 1,
      status: "missing_stream",
      stream: "react_grab_events",
      reason: "No react-grab event matched the requested timestamp/coordinates",
    });
  });

  test("looks up component source from persisted fiber commits when react-grab is absent", async () => {
    createRuntimeArtifactFixture("runtime-package", { componentSource: "fiber" });

    const result = await getRuntimeComponents("runtime-package", 0.75);

    expect(result).toMatchObject({
      recording_id: "runtime-package",
      query_ts: 0.75,
      status: "available",
      component: "SettingsPage",
      file: "src/routes/settings.tsx",
      line: 33,
      column: 5,
      finding_id: "fiber-finding-1",
      frame_idx: 2,
      fiber_diff: { changed_props: ["theme"] },
      delta_sec: 0.05,
      source: "fiber_commits",
    });
  });

  test("returns bounded finding context with explicit outside-window and safety metadata", async () => {
    createRuntimeArtifactFixture("runtime-package");

    const result = await getRuntimeFindingContext("runtime-package", {
      id: "finding-1",
      ts: 7,
      title: "Late finding",
    });

    expect(result.console).toMatchObject({
      path: expect.stringContaining(".reck/runtime-package/console.jsonl"),
      events: [],
      window_sec: 5,
      total_event_count: 2,
      included_event_count: 0,
      outside_window_count: 2,
      truncated_event_count: 0,
    });
    expect(result.network).toMatchObject({
      path: expect.stringContaining(".reck/runtime-package/network.jsonl"),
      events: [],
      window_sec: 5,
      total_event_count: 1,
      included_event_count: 0,
      outside_window_count: 1,
      truncated_event_count: 0,
    });
    expect(result.safety).toEqual({ redaction_applied: true, redaction_rules: [], redacted_streams: [] });
    expect(result.runtime_summary).toMatchObject({
      bounded: true,
      context_window_sec: 5,
      console_event_count: 0,
      network_event_count: 0,
      console_outside_window_count: 2,
      network_outside_window_count: 1,
      missing_context: {
        console: "No console events were persisted near this finding timestamp",
        network: "No network events were persisted near this finding timestamp",
      },
      omitted_large_payloads: ["network.har", "trace.zip", "raw_dom"],
    });
    expect(JSON.stringify(result)).not.toContain("<html><body>");
    expect(JSON.stringify(result)).not.toContain("network.har\":");
  });

  test("returns explicit missing-stream responses when component evidence was not collected", async () => {
    createImportedVideoFixture(importedVideoRecordingId);

    await expect(getRuntimeComponents(importedVideoRecordingId, 1.2)).resolves.toEqual({
      recording_id: importedVideoRecordingId,
      query_ts: 1.2,
      status: "missing_stream",
      stream: "react_grab_events",
      reason: "Layer 0 imported video analysis only",
    });
  });
});
