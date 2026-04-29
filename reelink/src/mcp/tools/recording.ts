// fallow-ignore-next-line unresolved-import
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

import { registerUnavailableTool } from "./_helpers.js";

export function registerRecordingTools(server: McpServer): void {
  registerUnavailableTool(server, "reelink_get_dom", {
    recording_id: z.string(),
    ts: z.number(),
  });
  registerUnavailableTool(server, "reelink_get_components", {
    recording_id: z.string(),
    ts: z.number(),
    x: z.number().optional(),
    y: z.number().optional(),
  });
}

export function registerRunTools(server: McpServer): void {
  registerUnavailableTool(server, "reelink_run", {
    task_description: z.string(),
    target_url: z.string(),
  });
}
