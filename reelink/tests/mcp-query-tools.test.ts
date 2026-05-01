import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import type { ReelinkConfig } from "../src/config/env.js";
import { registerQueryTools } from "../src/mcp/tools/retrieval.js";
import { answerHybridQuery, type QueryGptFallbackAdapter } from "../src/query/index.js";
import { resolveLegacyBrowserRecordingArtifactDir } from "../src/recordings/store.js";
import {
  createBrowserArtifactFixture,
  createImportedVideoFixture,
  createRuntimeArtifactFixture,
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
  workspace = await mkdtemp(join(tmpdir(), "reck-query-tools-"));
  process.chdir(workspace);
  createImportedVideoFixture(deterministicQueryRecordingId);
  registeredTools = [];
  const server = {
    registerTool(name: string, config: Record<string, unknown>, handler: ToolHandler) {
      registeredTools.push({ name, config, handler });
    },
  } as unknown as McpServer;
  registerQueryTools(server);
  query = registeredTools.find((tool) => tool.name === "reck_query")?.handler ?? failQueryTool;
});

afterEach(async () => {
  process.chdir(previousCwd);
  await rm(workspace, { recursive: true, force: true });
});

describe("hybrid recording query tool", () => {
  test("registers the current query MCP tool schema and envelope", async () => {
    expect(registeredTools).toHaveLength(1);
    expect(registeredTools[0]?.name).toBe("reck_query");
    expect(registeredTools[0]?.config).toMatchObject({
      title: "Query a Reck recording",
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
    ["was this a prod build", "prod_build", { kind: "prod_build", prod_build: null, evidence: "manifest.prod_build" }],
    ["finding f1", "finding_by_id", { kind: "finding", match: expect.objectContaining({ id: "f1" }) }],
    ["how long is the recording", "recording_duration", { kind: "duration", duration_sec: 12.5 }],
    ["what's the bug near 8 seconds", "finding_at_timestamp", { kind: "finding", query_ts: 8, match: expect.objectContaining({ id: "f2" }), delta_sec: 0.09999999999999964 }],
  ])("answers %s through %s", async (question, pattern, expectedAnswer) => {
    const result = await query({ recording_id: deterministicQueryRecordingId, question });

    expect(result.structuredContent.patterns_matched).toEqual([pattern]);
    expect(result.structuredContent.answer).toMatchObject(expectedAnswer);
  });

  test("returns deterministic null fallback for unknown questions when GPT fallback is disabled", async () => {
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
        "dom_at_timestamp",
        "components_at_timestamp",
        "type_findings",
        "finding_confidence",
        "available_streams",
        "prod_build",
        "finding_by_id",
        "recording_duration",
      ],
    });
  });

  test("deterministic answer bypasses GPT fallback adapter", async () => {
    let calls = 0;
    const response = await answerHybridQuery(deterministicQueryRecordingId, "summary", {
      enabled: true,
      config: fakeConfig({ queryGptFallbackEnabled: true }),
      adapter: async () => {
        calls += 1;
        return { response: "should not run", citations: [] };
      },
    });

    expect(calls).toBe(0);
    expect(response.patterns_matched).toEqual(["summary"]);
    expect(response.answer).toMatchObject({ kind: "summary" });
  });

  test("answers runtime artifact questions before optional GPT fallback", async () => {
    createRuntimeArtifactFixture("runtime-mcp-query");

    let calls = 0;
    const response = await answerHybridQuery("runtime-mcp-query", "which component is at 1.1 seconds", {
      enabled: true,
      config: fakeConfig({ queryGptFallbackEnabled: true }),
      adapter: async () => {
        calls += 1;
        return { response: "should not run", citations: [] };
      },
    });

    expect(calls).toBe(0);
    expect(response.patterns_matched).toEqual(["components_at_timestamp"]);
    expect(response.answer).toMatchObject({
      kind: "components",
      component: "SaveButton",
      file: "src/components/SaveButton.tsx",
    });
  });

  test("unknown question with enabled GPT fallback and no OpenAI key returns structured not-run response", async () => {
    const response = await answerHybridQuery(
      deterministicQueryRecordingId,
      "which component should I inspect for the visual regression",
      {
        enabled: true,
        config: fakeConfig({ queryGptFallbackEnabled: true, openAiApiKey: undefined }),
      },
    );

    expect(response.answer).toBe(null);
    expect(response.patterns_matched).toEqual([]);
    expect(response.patterns_tried.at(-1)).toBe("gpt_fallback:not_run");
    expect(response.reason).toContain("OPENAI_API_KEY not configured");
  });

  test("unknown question with fake GPT adapter returns grounded answer from package evidence", async () => {
    const seen: { workItemTitles: string[]; sourcePath?: string; streamKeys: string[] }[] = [];
    const fakeAdapter: QueryGptFallbackAdapter = async ({ analysis, manifest, streams }) => {
      seen.push({
        workItemTitles: analysis.work_items.map((item) => item.title),
        sourcePath: manifest.source_path,
        streamKeys: Object.keys(streams),
      });
      return {
        response:
          "Inspect the transition container because analysis.json reports 'Hero card jumps during transition' and manifest.json marks Layer 0 frames available.",
        citations: ["analysis.work_items[f1]", "analysis.next_steps[0]", "manifest.streams.layer0"],
      };
    };

    const response = await answerHybridQuery(
      deterministicQueryRecordingId,
      "which component should I inspect for the visual regression",
      {
        enabled: true,
        config: fakeConfig({ queryGptFallbackEnabled: true }),
        adapter: fakeAdapter,
      },
    );

    expect(seen).toEqual([
      {
        workItemTitles: ["Hero card jumps during transition", "Spinner flashes after content appears"],
        sourcePath: "/fixtures/imported-video.mov",
        streamKeys: ["frames", "trace", "fiber_commits", "source_dictionary", "react_grab_events", "network", "console", "eval"],
      },
    ]);
    expect(response.patterns_matched).toEqual(["gpt_fallback"]);
    expect(response.answer).toEqual({
      kind: "gpt_fallback",
      response:
        "Inspect the transition container because analysis.json reports 'Hero card jumps during transition' and manifest.json marks Layer 0 frames available.",
      citations: ["analysis.work_items[f1]", "analysis.next_steps[0]", "manifest.streams.layer0"],
      grounded_in: ["analysis.json", "manifest.json", "runtime streams"],
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
  throw new Error("reck_query was not registered");
}

function fakeConfig(overrides: Partial<ReelinkConfig> = {}): ReelinkConfig {
  return {
    homeDir: join(workspace, ".reelink"),
    configPath: join(workspace, ".reelink", "config.json"),
    defaultFpsSample: 4,
    copyImportedVideos: false,
    ...overrides,
  };
}
