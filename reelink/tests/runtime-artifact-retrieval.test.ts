import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { getRuntimeComponents, getRuntimeDom } from "../src/runtime-artifacts/retrieval.js";
import { createImportedVideoFixture, createRuntimeArtifactFixture, importedVideoRecordingId } from "./fixtures/recording-fixtures.js";

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
      reason: "Runtime DOM capture was not available",
    });
  });

  test("looks up nearest persisted DOM snapshot by timestamp", async () => {
    createRuntimeArtifactFixture("runtime-package");

    const result = await getRuntimeDom("runtime-package", 1.1);

    expect(result).toMatchObject({
      recording_id: "runtime-package",
      query_ts: 1.1,
      status: "available",
      path: resolve(".reelink/runtime-package/dom/snapshot-0002.html"),
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
    expect(readFileSync(result.status === "available" ? result.path : "", "utf8")).toContain("Second");
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
      props: { label: "Save", token: "[redacted]" },
      delta_sec: 0.1,
      source: "react_grab_events",
      prod_build: false,
    });
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
      delta_sec: 0.05,
      source: "fiber_commits",
    });
  });

  test("returns explicit missing-stream responses when component evidence was not collected", async () => {
    createImportedVideoFixture(importedVideoRecordingId);

    await expect(getRuntimeComponents(importedVideoRecordingId, 1.2)).resolves.toEqual({
      recording_id: importedVideoRecordingId,
      query_ts: 1.2,
      status: "missing_stream",
      stream: "react_grab_events",
      reason: "Runtime component capture was not available",
    });
  });
});
