import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PATTERN_IDS, answerDeterministicQuery } from "../src/query/index.js";
import {
  createBrowserArtifactFixture,
  createImportedVideoFixture,
  createImportedVideoFixtureWithLayer0Unavailable,
  deterministicQueryRecordingId,
} from "./fixtures/recording-fixtures.js";

let workspace: string;
let previousCwd: string;

beforeEach(async () => {
  previousCwd = process.cwd();
  workspace = await mkdtemp(join(tmpdir(), "reelink-deterministic-query-"));
  process.chdir(workspace);
  createImportedVideoFixture(deterministicQueryRecordingId);
});

afterEach(async () => {
  process.chdir(previousCwd);
  await rm(workspace, { recursive: true, force: true });
});

describe("deterministic query engine", () => {
  test.each([
    {
      question: "what's the bug at 2.4s",
      matched: "finding_at_timestamp",
      answer: { kind: "finding", query_ts: 2.4, match: { id: "f1", title: "Hero card jumps during transition" }, delta_sec: 0 },
    },
    {
      question: "summary",
      matched: "summary",
      answer: {
        kind: "summary",
        recording_id: deterministicQueryRecordingId,
        duration_sec: 12.5,
        summary: "Two UI findings were detected in the imported recording.",
        work_item_count: 2,
        next_step_count: 2,
      },
    },
    {
      question: "list work items",
      matched: "list_findings",
      answer: { kind: "work_items", items: [{ id: "f1" }, { id: "f2" }] },
    },
    {
      question: "critical bugs",
      matched: "severity_findings",
      answer: { kind: "work_items", severity: "high", items: [{ id: "f1" }] },
    },
    {
      question: "next steps",
      matched: "next_steps",
      answer: { kind: "next_steps", next_steps: ["Inspect the transition container", "Check suspense fallback timing"] },
    },
    {
      question: "frame at 2.4 sec",
      matched: "frame_at_timestamp",
      answer: { kind: "frame", query_ts: 2.4, frame_index: 3, frame_ts: 2, delta_sec: 0.3999999999999999 },
    },
    {
      question: "show me loading state findings",
      matched: "type_findings",
      answer: { kind: "work_items", type: "loading-state", items: [{ id: "f2" }] },
    },
    {
      question: "how confident is finding f2",
      matched: "finding_confidence",
      answer: {
        kind: "confidence",
        finding_id: "f2",
        confidence: 0.74,
        title: "Spinner flashes after content appears",
        severity: "medium",
      },
    },
    {
      question: "what streams are available",
      matched: "available_streams",
      answer: {
        kind: "streams",
        streams: {
          layer0: { status: "available" },
          dom: { status: "not_collected", reason: "Runtime DOM capture was not available" },
          components: { status: "not_collected", reason: "Runtime component capture was not available" },
          network: { status: "not_collected", reason: "Browser recording was not used" },
          console: { status: "not_collected", reason: "Browser recording was not used" },
        },
        artifacts: { analysis: "analysis.json", frames: "frames" },
        preprocessing: { requested_fps: 4, effective_fps: 1, max_frames: 64, long_edge_px: 896, frame_count: 6 },
        redaction_applied: false,
      },
    },
    {
      question: "is the recording prod build",
      matched: "prod_build",
      answer: { kind: "prod_build", prod_build: false, evidence: "manifest.prod_build" },
    },
  ])("answers documented query case: $question", async ({ question, matched, answer }) => {
    const response = await answerDeterministicQuery(deterministicQueryRecordingId, question);

    expect(response.patterns_matched).toEqual([matched]);
    expect(response.answer).toMatchObject(answer);
  });

  test("returns a deterministic not-found answer for an unknown finding id", async () => {
    const response = await answerDeterministicQuery(deterministicQueryRecordingId, "show finding missing-1");

    expect(response).toMatchObject({
      answer: null,
      reason: "finding not found",
      patterns_matched: ["finding_by_id"],
    });
  });

  test("returns null for frame lookup when Layer 0 stream is unavailable", async () => {
    const id = "query-layer0-stream-blocked";
    createImportedVideoFixtureWithLayer0Unavailable(id);

    const response = await answerDeterministicQuery(id, "frame at 2.4 sec");

    expect(response).toMatchObject({
      answer: null,
      reason: "frame not available",
      patterns_matched: ["frame_at_timestamp"],
    });
  });

  test("preserves MCP reelink_query null fallback envelope for unanswerable questions", async () => {
    const unknown = await answerDeterministicQuery(
      deterministicQueryRecordingId,
      "what is the airspeed velocity of an unladen swallow",
    );

    expect(unknown.answer).toBe(null);
    expect(unknown.reason).toBe("deterministic v0.1 cannot answer; record more streams or upgrade");
    expect(unknown.patterns_matched).toEqual([]);
    expect(unknown.patterns_tried).toEqual([...PATTERN_IDS]);
  });

  test.each([
    ["browser artifacts", "show browser artifacts", "browser_artifacts", { kind: "browser_artifacts", manifest: { url: "http://localhost:3000" } }],
    ["browser console", "show browser console errors", "browser_console", { kind: "console", events: [{ text: "Hydration warning" }], parse_errors: 1 }],
    ["browser network", "show page network failures", "browser_network", { kind: "network", event_count: 2, failed_count: 1, parse_errors: 0 }],
    ["browser dom", "browser dom snapshot", "browser_dom", { kind: "dom", files: ["snapshot-0001.html", "snapshot-0002.html"] }],
  ])("delegates retained %s query extension to browser artifact storage", async (_name, question, matched, answer) => {
    const browserId = "browser-engine-session";
    createBrowserArtifactFixture(browserId);

    const response = await answerDeterministicQuery(browserId, question);

    expect(response.patterns_matched).toEqual([matched]);
    expect(response.answer).toMatchObject(answer);
  });
});

