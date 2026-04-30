import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { registerQueryTools } from "../src/mcp/tools/retrieval.js";
import { resolveLegacyBrowserRecordingArtifactDir } from "../src/recordings/store.js";
import {
  createBrowserArtifactFixture,
  createImportedVideoFixture,
  deterministicQueryRecordingId,
} from "./fixtures/recording-fixtures.js";

type ToolHandler = (args: { recording_id: string; question: string }) => Promise<ToolResult>;
type ToolResult = { structuredContent: QueryResponse };
type QueryResponse = {
  recording_id: string;
  question: string;
  answer: Record<string, unknown> | null;
  reason?: string;
  patterns_matched: string[];
  patterns_tried: string[];
};

type RegisteredTool = {
  name: string;
  config: Record<string, unknown>;
  handler: ToolHandler;
};

let workspace: string;
let previousCwd: string;
let query: ToolHandler;
let registeredTools: RegisteredTool[];

beforeEach(async () => {
  previousCwd = process.cwd();
  workspace = await mkdtemp(join(tmpdir(), "reelink-query-tools-"));
  process.chdir(workspace);
  createImportedVideoFixture(deterministicQueryRecordingId);
  registeredTools = [];
  const server = {
    registerTool(name: string, config: Record<string, unknown>, handler: ToolHandler) {
      registeredTools.push({ name, config, handler });
    },
  } as unknown as McpServer;
  registerQueryTools(server);
  query = registeredTools.find((tool) => tool.name === "reelink_query")?.handler ?? failQueryTool;
});

afterEach(async () => {
  process.chdir(previousCwd);
  await rm(workspace, { recursive: true, force: true });
});

describe("deterministic recording query tool", () => {
  test("registers the current query MCP tool schema and envelope", async () => {
    expect(registeredTools).toHaveLength(1);
    expect(registeredTools[0]?.name).toBe("reelink_query");
    expect(registeredTools[0]?.config).toMatchObject({
      title: "Query a Reelink recording deterministically",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    });

    const result = await query({ recording_id: deterministicQueryRecordingId, question: "summary" });

    expect(result.structuredContent).toEqual({
      recording_id: deterministicQueryRecordingId,
      question: "summary",
      answer: {
        kind: "summary",
        recording_id: deterministicQueryRecordingId,
        duration_sec: 12.5,
        summary: "Two UI findings were detected in the imported recording.",
        work_item_count: 2,
        next_step_count: 2,
      },
      patterns_matched: ["summary"],
      patterns_tried: ["finding_at_timestamp", "summary"],
    });
  });

  test.each([
    ["list work items", "list_findings", { kind: "work_items", items: expect.arrayContaining([expect.objectContaining({ id: "f1" }), expect.objectContaining({ id: "f2" })]) }],
    ["show high severity issues", "severity_findings", { kind: "work_items", severity: "high", items: [expect.objectContaining({ id: "f1" })] }],
    ["what should I do next", "next_steps", { kind: "next_steps", next_steps: ["Inspect the transition container", "Check suspense fallback timing"] }],
    ["show the frame at 2.4 seconds", "frame_at_timestamp", { kind: "frame", query_ts: 2.4, frame_index: 3, frame_ts: 2, delta_sec: 0.3999999999999999 }],
    ["layout shift findings", "type_findings", { kind: "work_items", type: "layout-shift", items: [expect.objectContaining({ id: "f1" })] }],
    ["how confident is finding f2", "finding_confidence", { kind: "confidence", finding_id: "f2", confidence: 0.74, title: "Spinner flashes after content appears", severity: "medium" }],
    ["what streams are available", "available_streams", { kind: "streams", redaction_applied: false }],
    ["was this a prod build", "prod_build", { kind: "prod_build", prod_build: false, evidence: "manifest.prod_build" }],
    ["finding f1", "finding_by_id", { kind: "finding", match: expect.objectContaining({ id: "f1" }) }],
    ["how long is the recording", "recording_duration", { kind: "duration", duration_sec: 12.5 }],
    ["what's the bug near 8 seconds", "finding_at_timestamp", { kind: "finding", query_ts: 8, match: expect.objectContaining({ id: "f2" }), delta_sec: 0.09999999999999964 }],
  ])("answers %s through %s", async (question, pattern, expectedAnswer) => {
    const result = await query({ recording_id: deterministicQueryRecordingId, question });

    expect(result.structuredContent.patterns_matched).toEqual([pattern]);
    expect(result.structuredContent.answer).toMatchObject(expectedAnswer);
  });

  test("returns deterministic null fallback for unknown questions", async () => {
    const result = await query({
      recording_id: deterministicQueryRecordingId,
      question: "what is the airspeed velocity of an unladen swallow",
    });

    expect(result.structuredContent).toEqual({
      recording_id: deterministicQueryRecordingId,
      question: "what is the airspeed velocity of an unladen swallow",
      answer: null,
      reason: "deterministic v0.1 cannot answer; record more streams or upgrade",
      patterns_matched: [],
      patterns_tried: [
        "finding_at_timestamp",
        "summary",
        "list_findings",
        "severity_findings",
        "next_steps",
        "frame_at_timestamp",
        "type_findings",
        "finding_confidence",
        "available_streams",
        "prod_build",
        "finding_by_id",
        "recording_duration",
      ],
    });
  });

  test("locks current browser artifact query extension behavior", async () => {
    const browserId = "browser-artifact-session";
    createBrowserArtifactFixture(browserId);

    const artifacts = await query({ recording_id: browserId, question: "show browser artifacts manifest" });
    const console = await query({ recording_id: browserId, question: "browser console errors" });
    const network = await query({ recording_id: browserId, question: "browser network failed requests" });
    const dom = await query({ recording_id: browserId, question: "browser dom snapshot" });

    expect(artifacts.structuredContent.patterns_matched).toEqual(["browser_artifacts"]);
    expect(artifacts.structuredContent.answer).toMatchObject({
      kind: "browser_artifacts",
      manifest_path: resolve(resolveLegacyBrowserRecordingArtifactDir(browserId), "manifest.json"),
      manifest: { session_id: browserId, url: "http://localhost:3000" },
    });
    expect(console.structuredContent.answer).toMatchObject({
      kind: "console",
      events: [{ ts: 0.5, type: "error", text: "Hydration warning" }],
      parse_errors: 1,
    });
    expect(network.structuredContent.answer).toMatchObject({
      kind: "network",
      event_count: 2,
      failed_count: 1,
      failed: [{ ts: 1, event: "response", status: 500, ok: false, url: "/api/data" }],
      parse_errors: 0,
    });
    expect(dom.structuredContent.answer).toMatchObject({
      kind: "dom",
      files: ["snapshot-0001.html", "snapshot-0002.html"],
      latest: resolve(resolveLegacyBrowserRecordingArtifactDir(browserId), "dom", "snapshot-0002.html"),
    });
  });
});

async function failQueryTool(): Promise<ToolResult> {
  throw new Error("reelink_query was not registered");
}
