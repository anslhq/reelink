import { describe, expect, test } from "bun:test";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { jsonToolResult } from "../src/mcp/tools/_helpers.js";
import { registerAnalysisTools } from "../src/mcp/tools/analysis.js";
import { registerRecordingTools, registerRunTools } from "../src/mcp/tools/recording.js";
import { registerQueryTools, registerRetrievalTools } from "../src/mcp/tools/retrieval.js";
import { directPlaywrightBrowserToolClassification } from "../src/browser-recording/lifecycle.js";
import { summarizeForToolLog } from "../src/utils/tool-middleware.js";

type ToolRegistration = {
  name: string;
  config: {
    title?: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    annotations?: Record<string, unknown>;
  };
  handler: (args: Record<string, unknown>) => unknown;
};

describe("current MCP tool surface", () => {
  test("locks current public tool names and annotations", () => {
    const tools = collectToolRegistrations();

    expect(tools.map((tool) => tool.name)).toEqual([
      "reelink_analyze",
      "reelink_get_finding",
      "reelink_get_frame",
      "reelink_get_dom",
      "reelink_get_components",
      "reelink_query",
      "reelink_record_start",
      "reelink_record_stop",
      "reelink_record_status",
      "reelink_browser_snapshot",
      "reelink_browser_click",
      "reelink_browser_type",
      "reelink_browser_navigate",
      "reelink_browser_wait",
      "reelink_run",
    ]);

    expect(publicToolShape(tools)).toEqual({
      reelink_analyze: {
        inputKeys: ["path", "fps_sample", "focus"],
        outputKeys: ["recording_id", "duration_sec", "summary", "work_items", "next_steps"],
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      reelink_get_finding: {
        inputKeys: ["recording_id", "finding_id"],
        outputKeys: ["recording_id", "finding_id", "work_item", "reason"],
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      },
      reelink_get_frame: {
        inputKeys: ["recording_id", "ts"],
        outputKeys: ["recording_id", "query_ts", "path", "frame_index", "frame_ts", "delta_sec", "exists", "reason"],
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      },
      reelink_get_dom: {
        inputKeys: ["recording_id", "ts"],
        outputKeys: ["recording_id", "query_ts", "status", "stream", "reason", "path", "tree_summary", "snapshot_ts", "delta_sec", "url", "title", "streams_missing"],
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      },
      reelink_get_components: {
        inputKeys: ["recording_id", "ts", "x", "y"],
        outputKeys: ["recording_id", "query_ts", "status", "stream", "reason", "component", "file", "line", "column", "props", "candidate", "candidates", "delta_sec", "source", "prod_build", "streams_missing"],
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      },
      reelink_query: {
        inputKeys: ["recording_id", "question"],
        outputKeys: ["recording_id", "question", "answer", "reason", "patterns_matched", "patterns_tried"],
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      },
      reelink_record_start: {
        inputKeys: ["url", "out_path", "max_seconds"],
        outputKeys: ["session_id", "status", "url", "path", "started_at", "max_seconds", "message"],
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      reelink_record_stop: {
        inputKeys: ["session_id"],
        outputKeys: ["session_id", "status", "path", "exists", "size_bytes", "started_at", "stopped_at", "duration_limit_hit", "artifacts"],
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      reelink_record_status: {
        inputKeys: [],
        outputKeys: ["active"],
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      },
      reelink_browser_snapshot: {
        inputKeys: ["session_id", "save_dom"],
        outputKeys: ["session_id", "url", "title", "text", "dom_path"],
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false },
      },
      reelink_browser_click: {
        inputKeys: ["session_id", "text", "selector", "x", "y"],
        outputKeys: ["session_id", "ok", "action", "url"],
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      reelink_browser_type: {
        inputKeys: ["session_id", "selector", "text"],
        outputKeys: ["session_id", "ok", "selector", "url"],
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      reelink_browser_navigate: {
        inputKeys: ["session_id", "url"],
        outputKeys: ["session_id", "ok", "url"],
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      reelink_browser_wait: {
        inputKeys: ["session_id", "ms"],
        outputKeys: ["session_id", "ok", "waited_ms", "url"],
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      reelink_run: {
        inputKeys: ["task_description", "target_url"],
        outputKeys: ["status", "message"],
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
    });
  });

  test("returns compatible structured JSON text envelopes", () => {
    const structuredContent = {
      recording_id: "rec_123",
      summary: "Analysis complete",
      work_items: [{ id: "f1" }],
    };

    expect(jsonToolResult(structuredContent)).toEqual({
      content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent,
    });
  });

  test("returns structured missing-stream responses for absent runtime artifacts", async () => {
    const tool = collectToolRegistrations().find((registration) => registration.name === "reelink_get_dom");

    expect(tool).toBeDefined();
    const result = await tool!.handler({ recording_id: "rec_123", ts: 1.2 });

    expect(result).toMatchObject({
      structuredContent: {
        recording_id: "rec_123",
        query_ts: 1.2,
        status: "missing_stream",
      },
    });
  });

  test("invokes fake module handlers through shallow adapter envelopes", async () => {
    const structuredContent = {
      recording_id: "rec_123",
      finding_id: "f1",
      work_item: null,
      reason: "finding not found",
    };
    const fakeModule = async (recording_id: string, finding_id: string) => ({
      recording_id,
      finding_id,
      work_item: null,
      reason: "finding not found",
    });

    async function fakeFindingAdapter({ recording_id, finding_id }: { recording_id: string; finding_id: string }) {
      return jsonToolResult(await fakeModule(recording_id, finding_id));
    }

    await expect(fakeFindingAdapter({ recording_id: "rec_123", finding_id: "f1" })).resolves.toEqual({
      content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent,
    });
  });

  test("redacts secrets and truncates long values in tool logs", () => {
    const summarized = summarizeForToolLog({
      apiKey: "sk-secret",
      nested: {
        authorization: "Bearer token",
        safe: "x".repeat(205),
      },
      values: [1, 2, 3, 4, 5, 6],
    });

    expect(summarized).toEqual({
      apiKey: "[redacted]",
      nested: {
        authorization: "[redacted]",
        safe: `${"x".repeat(200)}…(+5 chars)`,
      },
      values: [1, 2, 3, 4, 5],
    });
  });

  test("classifies direct Playwright browser control tools as demo-only", () => {
    expect(directPlaywrightBrowserToolClassification).toEqual({
      classification: "demo-only",
      reason:
        "Direct Playwright MCP browser controls drive the current headed demo recording only; OpenSpec runtime streams remain deferred to the Playwright MCP child/CDP gateway.",
    });
  });
});

function collectToolRegistrations(): ToolRegistration[] {
  const tools: ToolRegistration[] = [];
  const server = {
    registerTool(name: string, config: ToolRegistration["config"], handler: ToolRegistration["handler"]) {
      tools.push({ name, config, handler });
    },
  };

  const mcpServer = server as unknown as McpServer;

  registerAnalysisTools(mcpServer);
  registerRetrievalTools(mcpServer);
  registerRecordingTools(mcpServer);
  registerQueryTools(mcpServer);
  registerRunTools(mcpServer);

  return tools;
}

function publicToolShape(tools: ToolRegistration[]): Record<string, unknown> {
  return Object.fromEntries(
    tools.map((tool) => [
      tool.name,
      {
        inputKeys: Object.keys(tool.config.inputSchema ?? {}),
        outputKeys: Object.keys(tool.config.outputSchema ?? {}),
        annotations: tool.config.annotations,
      },
    ]),
  );
}
