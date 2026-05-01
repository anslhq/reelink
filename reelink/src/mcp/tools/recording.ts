// fallow-ignore-next-line unresolved-import
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

import { BrowserRecordingModule } from "../../browser-recording/lifecycle.js";
import { playwrightBrowserRecordingDriver } from "../../browser-recording/playwright-driver.js";
import { runReckAgent } from "../../agent-run/run.js";
import { getRuntimeComponents, getRuntimeDom } from "../../runtime-artifacts/retrieval.js";
import { jsonToolResult } from "./_helpers.js";
import { withToolLogging } from "../../utils/tool-middleware.js";

const browserRecording = new BrowserRecordingModule(playwrightBrowserRecordingDriver);

export function registerRecordingTools(server: McpServer): void {
  server.registerTool(
    "reck_get_dom",
    {
      title: "Get timestamped DOM evidence",
      description: "Return the nearest persisted DOM snapshot path and summary for a recording timestamp.",
      inputSchema: {
        recording_id: z.string(),
        ts: z.number(),
      },
      outputSchema: {
        recording_id: z.string(),
        query_ts: z.number(),
        status: z.enum(["available", "missing_stream"]),
        stream: z.string().optional(),
        reason: z.string().optional(),
        path: z.string().optional(),
        tree_summary: z.string().optional(),
        snapshot_ts: z.number().optional(),
        delta_sec: z.number().optional(),
        url: z.string().optional(),
        title: z.string().optional(),
        streams_missing: z.record(z.string(), z.string()).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    withToolLogging("reck_get_dom", async ({ recording_id, ts }) => jsonToolResult(await getRuntimeDom(recording_id, ts))),
  );

  server.registerTool(
    "reck_get_components",
    {
      title: "Get timestamped React component evidence",
      description: "Return persisted React component/source evidence near a timestamp when component streams were collected.",
      inputSchema: {
        recording_id: z.string(),
        ts: z.number(),
        x: z.number().optional(),
        y: z.number().optional(),
      },
      outputSchema: {
        recording_id: z.string(),
        query_ts: z.number(),
        status: z.enum(["available", "missing_stream"]),
        stream: z.string().optional(),
        reason: z.string().optional(),
        component: z.string().nullable().optional(),
        file: z.string().nullable().optional(),
        line: z.number().nullable().optional(),
        column: z.number().nullable().optional(),
        props: z.record(z.string(), z.unknown()).nullable().optional(),
        finding_id: z.string().nullable().optional(),
        ts: z.number().optional(),
        frame_idx: z.number().nullable().optional(),
        element_path: z.string().nullable().optional(),
        bounding_box: z.record(z.string(), z.number()).nullable().optional(),
        selected_text: z.string().nullable().optional(),
        css_classes: z.array(z.string()).optional(),
        computed_styles: z.record(z.string(), z.unknown()).nullable().optional(),
        accessibility: z.record(z.string(), z.unknown()).nullable().optional(),
        component_stack: z.array(z.record(z.string(), z.unknown())).optional(),
        fiber_diff: z.record(z.string(), z.unknown()).nullable().optional(),
        source_references: z.array(z.object({
          file: z.string(),
          line: z.number().nullable(),
          column: z.number().nullable(),
          component: z.string().nullable(),
        })).optional(),
        candidate: z.record(z.string(), z.unknown()).optional(),
        candidates: z.array(z.record(z.string(), z.unknown())).optional(),
        markdown: z.string().optional(),
        xml: z.string().optional(),
        delta_sec: z.number().optional(),
        source: z.enum(["react_grab_events", "fiber_commits"]).optional(),
        prod_build: z.object({
          status: z.enum(["detected", "unknown", "unavailable"]),
          value: z.boolean().nullable(),
          reason: z.string().nullable(),
        }).optional(),
        streams_missing: z.record(z.string(), z.string()).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    withToolLogging("reck_get_components", async ({ recording_id, ts, x, y }) =>
      jsonToolResult(await getRuntimeComponents(recording_id, ts, { x, y })),
    ),
  );
}

export function registerRunTools(server: McpServer): void {
  registerRecordLifecycleTools(server);
  registerBrowserAutomationTools(server);
  server.registerTool(
    "reck_run",
    {
      title: "Run and self-record a browser task",
      description: "Execute a shallow scripted browser run while preserving the task prompt, observations, results, and eval evidence in the recording package.",
      inputSchema: {
        task_description: z.string(),
        target_url: z.string(),
        max_seconds: z.number().positive().max(300).default(60),
        headless: z.boolean().default(true),
        actions: z
          .array(
            z.discriminatedUnion("type", [
              z.object({ type: z.literal("snapshot"), save_dom: z.boolean().optional() }),
              z.object({ type: z.literal("navigate"), url: z.string() }),
              z.object({
                type: z.literal("click"),
                selector: z.string().optional(),
                text: z.string().optional(),
                x: z.number().optional(),
                y: z.number().optional(),
              }),
              z.object({ type: z.literal("type"), selector: z.string(), text: z.string() }),
              z.object({ type: z.literal("wait"), ms: z.number().positive().max(30000).optional() }),
            ]),
          )
          .optional(),
      },
      outputSchema: {
        recording_id: z.string(),
        success: z.boolean(),
        status: z.enum(["completed", "partial_failure", "failed"]),
        summary: z.string(),
        task_description: z.string(),
        target_url: z.string(),
        started_at: z.string(),
        stopped_at: z.string(),
        artifacts: z.record(z.string(), z.string()),
        recent_observation: z.object({
          frame_path: z.string().nullable(),
          dom_summary: z.string().nullable(),
          component_map: z.record(z.string(), z.unknown()).nullable(),
          network_since_last: z.array(z.record(z.string(), z.unknown())),
          console_since_last: z.array(z.record(z.string(), z.unknown())),
        }),
        eval_evidence: z.object({
          status: z.enum(["deterministic", "motion_only", "insufficient_context"]),
          confidence: z.enum(["high", "medium", "low"]),
          recording_id: z.string(),
          artifact_path: z.string(),
          assertion_strategy: z.string().nullable(),
          expected_pre_fix_behavior: z.string().nullable(),
          verification_result: z.literal("not_run"),
          stable_observed_artifacts: z.array(z.record(z.string(), z.unknown())),
          next_steps: z.array(z.string()),
        }),
        steps: z.array(z.record(z.string(), z.unknown())),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reck_run", async (args) => jsonToolResult(await runReckAgent(browserRecording, args))),
  );
}

function registerRecordLifecycleTools(server: McpServer): void {
  server.registerTool(
    "reck_record_start",
    {
      title: "Start a headed browser recording",
      description:
        "Open a headed Chromium window at a URL and keep recording until reck_record_stop is called or max_seconds elapses.",
      inputSchema: {
        url: z.string(),
        out_path: z.string().optional(),
        max_seconds: z.number().positive().max(300).default(60),
      },
      outputSchema: {
        session_id: z.string(),
        status: z.literal("recording"),
        url: z.string(),
        path: z.string(),
        started_at: z.string(),
        max_seconds: z.number(),
        message: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reck_record_start", async ({ url, out_path, max_seconds }) =>
      jsonToolResult(await browserRecording.startRecording({ url, out_path, max_seconds })),
    ),
  );

  server.registerTool(
    "reck_record_stop",
    {
      title: "Stop a headed browser recording",
      description: "Stop an active Reck browser recording and return the saved .webm path plus captured artifacts.",
      inputSchema: {
        session_id: z.string(),
      },
      outputSchema: {
        session_id: z.string(),
        status: z.literal("stopped"),
        path: z.string(),
        exists: z.boolean(),
        size_bytes: z.number().nullable(),
        started_at: z.string(),
        stopped_at: z.string(),
        duration_limit_hit: z.boolean(),
        artifacts: z.object({
          video: z.string(),
          trace: z.string(),
          frames: z.string(),
          network: z.string(),
          network_har: z.string(),
          console: z.string(),
          logs: z.string(),
          dom: z.string(),
          fiber_commits: z.string(),
          source_dictionary: z.string(),
          react_grab_events: z.string(),
          manifest: z.string(),
        }),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reck_record_stop", async ({ session_id }) =>
      jsonToolResult(await browserRecording.stopRecording(session_id, false)),
    ),
  );

  server.registerTool(
    "reck_record_status",
    {
      title: "List active browser recordings",
      description: "Return active Reck recording sessions in this MCP server process.",
      inputSchema: {},
      outputSchema: {
        active: z.array(
          z.object({
            session_id: z.string(),
            url: z.string(),
            path: z.string(),
            started_at: z.string(),
            max_seconds: z.number(),
          }),
        ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    withToolLogging("reck_record_status", async () =>
      jsonToolResult(browserRecording.listActiveRecordings()),
    ),
  );
}

function registerBrowserAutomationTools(server: McpServer): void {
  server.registerTool(
    "reck_browser_snapshot",
    {
      title: "Snapshot the active recording browser",
      description: "Capture a lightweight DOM/text snapshot from an active Reck recording session.",
      inputSchema: {
        session_id: z.string(),
        save_dom: z.boolean().default(true),
      },
      outputSchema: {
        session_id: z.string(),
        url: z.string(),
        title: z.string(),
        text: z.string(),
        dom_path: z.string().nullable(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reck_browser_snapshot", async ({ session_id, save_dom }) =>
      jsonToolResult(await browserRecording.snapshotBrowser(session_id, save_dom)),
    ),
  );

  server.registerTool(
    "reck_browser_click",
    {
      title: "Click in the active recording browser",
      description: "Click by visible text, CSS selector, or x/y coordinates inside an active recording session.",
      inputSchema: {
        session_id: z.string(),
        text: z.string().optional(),
        selector: z.string().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
      },
      outputSchema: {
        session_id: z.string(),
        ok: z.boolean(),
        action: z.string(),
        gateway: z.string().optional(),
        gateway_status: z.string().optional(),
        cdp_endpoint: z.string().optional(),
        url: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reck_browser_click", async (args) => jsonToolResult(await browserRecording.clickBrowser(args))),
  );

  server.registerTool(
    "reck_browser_type",
    {
      title: "Type in the active recording browser",
      description: "Fill a selector in an active recording session.",
      inputSchema: {
        session_id: z.string(),
        selector: z.string(),
        text: z.string(),
      },
      outputSchema: {
        session_id: z.string(),
        ok: z.boolean(),
        selector: z.string(),
        gateway: z.string().optional(),
        gateway_status: z.string().optional(),
        cdp_endpoint: z.string().optional(),
        url: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reck_browser_type", async ({ session_id, selector, text }) => {
      return jsonToolResult(await browserRecording.typeBrowser({ session_id, selector, text }));
    }),
  );

  server.registerTool(
    "reck_browser_navigate",
    {
      title: "Navigate the active recording browser",
      description: "Navigate an active recording session to a URL.",
      inputSchema: {
        session_id: z.string(),
        url: z.string(),
      },
      outputSchema: {
        session_id: z.string(),
        ok: z.boolean(),
        gateway: z.string().optional(),
        gateway_status: z.string().optional(),
        cdp_endpoint: z.string().optional(),
        url: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reck_browser_navigate", async ({ session_id, url }) => {
      return jsonToolResult(await browserRecording.navigateBrowser({ session_id, url }));
    }),
  );

  server.registerTool(
    "reck_browser_evaluate",
    {
      title: "Evaluate JavaScript in the active recording browser",
      description: "Evaluate a small JavaScript expression in an active recording session and return a bounded structured result.",
      inputSchema: {
        session_id: z.string(),
        expression: z.string(),
      },
      outputSchema: {
        session_id: z.string(),
        ok: z.boolean(),
        result: z.unknown(),
        gateway: z.string().optional(),
        gateway_status: z.string().optional(),
        cdp_endpoint: z.string().optional(),
        url: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reck_browser_evaluate", async ({ session_id, expression }) => {
      return jsonToolResult(await browserRecording.evaluateBrowser({ session_id, expression }));
    }),
  );

  server.registerTool(
    "reck_browser_take_screenshot",
    {
      title: "Take a screenshot of the active recording browser",
      description: "Save a screenshot from an active recording session and return its artifact path without embedding image bytes.",
      inputSchema: {
        session_id: z.string(),
        path: z.string().optional(),
      },
      outputSchema: {
        session_id: z.string(),
        ok: z.boolean(),
        path: z.string(),
        gateway: z.string().optional(),
        gateway_status: z.string().optional(),
        cdp_endpoint: z.string().optional(),
        url: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reck_browser_take_screenshot", async ({ session_id, path }) => {
      return jsonToolResult(await browserRecording.takeScreenshotBrowser({ session_id, path }));
    }),
  );

  server.registerTool(
    "reck_browser_wait",
    {
      title: "Wait in the active recording browser",
      description: "Wait for a short interval while recording continues.",
      inputSchema: {
        session_id: z.string(),
        ms: z.number().positive().max(30000).default(1000),
      },
      outputSchema: {
        session_id: z.string(),
        ok: z.boolean(),
        waited_ms: z.number(),
        url: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reck_browser_wait", async ({ session_id, ms }) => {
      return jsonToolResult(await browserRecording.waitBrowser({ session_id, ms }));
    }),
  );
}
