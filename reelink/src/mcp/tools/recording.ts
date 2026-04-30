// fallow-ignore-next-line unresolved-import
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

import { BrowserRecordingModule } from "../../browser-recording/lifecycle.js";
import { playwrightBrowserRecordingDriver } from "../../browser-recording/playwright-driver.js";
import { getRuntimeComponents, getRuntimeDom } from "../../runtime-artifacts/retrieval.js";
import { jsonToolResult, registerUnavailableTool } from "./_helpers.js";
import { withToolLogging } from "../../utils/tool-middleware.js";

const browserRecording = new BrowserRecordingModule(playwrightBrowserRecordingDriver);

export function registerRecordingTools(server: McpServer): void {
  server.registerTool(
    "reelink_get_dom",
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
    withToolLogging("reelink_get_dom", async ({ recording_id, ts }) => jsonToolResult(await getRuntimeDom(recording_id, ts))),
  );

  server.registerTool(
    "reelink_get_components",
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
        candidate: z.record(z.string(), z.unknown()).optional(),
        candidates: z.array(z.record(z.string(), z.unknown())).optional(),
        delta_sec: z.number().optional(),
        source: z.enum(["react_grab_events", "fiber_commits"]).optional(),
        prod_build: z.boolean().optional(),
        streams_missing: z.record(z.string(), z.string()).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    withToolLogging("reelink_get_components", async ({ recording_id, ts, x, y }) =>
      jsonToolResult(await getRuntimeComponents(recording_id, ts, { x, y })),
    ),
  );
}

export function registerRunTools(server: McpServer): void {
  registerRecordLifecycleTools(server);
  registerBrowserAutomationTools(server);
  registerUnavailableTool(server, "reelink_run", {
    task_description: z.string(),
    target_url: z.string(),
  });
}

function registerRecordLifecycleTools(server: McpServer): void {
  server.registerTool(
    "reelink_record_start",
    {
      title: "Start a headed browser recording",
      description:
        "Open a headed Chromium window at a URL and keep recording until reelink_record_stop is called or max_seconds elapses.",
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
    withToolLogging("reelink_record_start", async ({ url, out_path, max_seconds }) =>
      jsonToolResult(await browserRecording.startRecording({ url, out_path, max_seconds })),
    ),
  );

  server.registerTool(
    "reelink_record_stop",
    {
      title: "Stop a headed browser recording",
      description: "Stop an active Reelink browser recording and return the saved .webm path plus captured artifacts.",
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
          network: z.string(),
          console: z.string(),
          dom: z.string(),
          manifest: z.string(),
        }),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reelink_record_stop", async ({ session_id }) =>
      jsonToolResult(await browserRecording.stopRecording(session_id, false)),
    ),
  );

  server.registerTool(
    "reelink_record_status",
    {
      title: "List active browser recordings",
      description: "Return active Reelink recording sessions in this MCP server process.",
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
    withToolLogging("reelink_record_status", async () =>
      jsonToolResult(browserRecording.listActiveRecordings()),
    ),
  );
}

function registerBrowserAutomationTools(server: McpServer): void {
  server.registerTool(
    "reelink_browser_snapshot",
    {
      title: "Snapshot the active recording browser",
      description: "Capture a lightweight DOM/text snapshot from an active Reelink recording session.",
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
    withToolLogging("reelink_browser_snapshot", async ({ session_id, save_dom }) =>
      jsonToolResult(await browserRecording.snapshotBrowser(session_id, save_dom)),
    ),
  );

  server.registerTool(
    "reelink_browser_click",
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
        url: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reelink_browser_click", async (args) => jsonToolResult(await browserRecording.clickBrowser(args))),
  );

  server.registerTool(
    "reelink_browser_type",
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
        url: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reelink_browser_type", async ({ session_id, selector, text }) => {
      return jsonToolResult(await browserRecording.typeBrowser({ session_id, selector, text }));
    }),
  );

  server.registerTool(
    "reelink_browser_navigate",
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
        url: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reelink_browser_navigate", async ({ session_id, url }) => {
      return jsonToolResult(await browserRecording.navigateBrowser({ session_id, url }));
    }),
  );

  server.registerTool(
    "reelink_browser_wait",
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
    withToolLogging("reelink_browser_wait", async ({ session_id, ms }) => {
      return jsonToolResult(await browserRecording.waitBrowser({ session_id, ms }));
    }),
  );
}
