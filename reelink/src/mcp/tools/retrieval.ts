// fallow-ignore-next-line unresolved-import
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

import { registerUnavailableTool } from "./shared.js";

export function registerRetrievalTools(server: McpServer): void {
  registerUnavailableTool(server, "reelink_get_finding", {
    recording_id: z.string(),
    finding_id: z.string(),
  });
  registerUnavailableTool(server, "reelink_get_frame", {
    recording_id: z.string(),
    ts: z.number(),
  });
}

export function registerQueryTools(server: McpServer): void {
  registerUnavailableTool(server, "reelink_query", {
    recording_id: z.string(),
    question: z.string(),
  });
}
