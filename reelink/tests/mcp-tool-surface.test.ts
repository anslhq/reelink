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

describe("Reck MCP tool surface", () => {
  test("locks Reck public tool names and annotations", () => {
    const tools = collectToolRegistrations();

    expect(tools.map((tool) => tool.name)).toEqual([
      "reck_analyze",
      "reck_get_finding",
      "reck_get_frame",
      "reck_get_dom",
      "reck_get_components",
      "reck_query",
      "reck_record_start",
      "reck_record_stop",
      "reck_record_status",
      "reck_browser_snapshot",
      "reck_browser_click",
      "reck_browser_type",
      "reck_browser_navigate",
      "reck_browser_evaluate",
      "reck_browser_take_screenshot",
      "reck_browser_wait",
      "reck_run",
    ]);

    expect(publicToolShape(tools)).toEqual({
      reck_analyze: {
        inputKeys: ["path", "fps_sample", "focus"],
        outputKeys: ["recording_id", "duration_sec", "summary", "findings", "next_steps"],
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      reck_get_finding: {
        inputKeys: ["recording_id", "finding_id"],
        outputKeys: ["recording_id", "finding_id", "work_item", "reason", "context"],
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      },
      reck_get_frame: {
        inputKeys: ["recording_id", "ts"],
        outputKeys: ["recording_id", "query_ts", "path", "frame_index", "frame_ts", "delta_sec", "exists", "reason"],
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      },
      reck_get_dom: {
        inputKeys: ["recording_id", "ts"],
        outputKeys: ["recording_id", "query_ts", "status", "stream", "reason", "path", "tree_summary", "snapshot_ts", "delta_sec", "url", "title", "streams_missing"],
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      },
      reck_get_components: {
        inputKeys: ["recording_id", "ts", "x", "y"],
        outputKeys: ["recording_id", "query_ts", "status", "stream", "reason", "component", "file", "line", "column", "props", "finding_id", "ts", "frame_idx", "element_path", "bounding_box", "selected_text", "css_classes", "computed_styles", "accessibility", "component_stack", "fiber_diff", "source_references", "candidate", "candidates", "markdown", "xml", "delta_sec", "source", "prod_build", "streams_missing"],
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      },
      reck_query: {
        inputKeys: ["recording_id", "question"],
        outputKeys: ["recording_id", "question", "answer", "reason", "patterns_matched", "patterns_tried"],
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      },
      reck_record_start: {
        inputKeys: ["url", "out_path", "max_seconds"],
        outputKeys: ["session_id", "status", "url", "path", "started_at", "max_seconds", "message"],
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      reck_record_stop: {
        inputKeys: ["session_id"],
        outputKeys: ["session_id", "status", "path", "exists", "size_bytes", "started_at", "stopped_at", "duration_limit_hit", "artifacts"],
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      reck_record_status: {
        inputKeys: [],
        outputKeys: ["active"],
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      },
      reck_browser_snapshot: {
        inputKeys: ["session_id", "save_dom"],
        outputKeys: ["session_id", "url", "title", "text", "dom_path"],
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false },
      },
      reck_browser_click: {
        inputKeys: ["session_id", "text", "selector", "x", "y"],
        outputKeys: ["session_id", "ok", "action", "gateway", "gateway_status", "cdp_endpoint", "url"],
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      reck_browser_type: {
        inputKeys: ["session_id", "selector", "text"],
        outputKeys: ["session_id", "ok", "selector", "gateway", "gateway_status", "cdp_endpoint", "url"],
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      reck_browser_navigate: {
        inputKeys: ["session_id", "url"],
        outputKeys: ["session_id", "ok", "gateway", "gateway_status", "cdp_endpoint", "url"],
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      reck_browser_evaluate: {
        inputKeys: ["session_id", "expression"],
        outputKeys: ["session_id", "ok", "result", "gateway", "gateway_status", "cdp_endpoint", "url"],
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false },
      },
      reck_browser_take_screenshot: {
        inputKeys: ["session_id", "path"],
        outputKeys: ["session_id", "ok", "path", "gateway", "gateway_status", "cdp_endpoint", "url"],
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      reck_browser_wait: {
        inputKeys: ["session_id", "ms"],
        outputKeys: ["session_id", "ok", "waited_ms", "url"],
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      reck_run: {
        inputKeys: ["task_description", "target_url", "max_seconds", "headless", "actions"],
        outputKeys: ["recording_id", "success", "status", "summary", "task_description", "target_url", "started_at", "stopped_at", "artifacts", "recent_observation", "eval_evidence", "steps"],
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
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
    const tool = collectToolRegistrations().find((registration) => registration.name === "reck_get_dom");

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

  test("classifies browser control tools as a single MCP gateway", () => {
    expect(directPlaywrightBrowserToolClassification).toEqual({
      classification: "single-mcp-gateway",
      reason:
        "Reck exposes a single MCP surface for curated browser automation while Reck-owned Playwright recording captures native video, trace, DOM, network, console, and runtime streams.",
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
