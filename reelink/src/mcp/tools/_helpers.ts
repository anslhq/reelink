// fallow-ignore-next-line unresolved-import
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

import { withToolLogging } from "../../utils/tool-middleware.js";

type StructuredToolResult<T> = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: T;
};

export function jsonToolResult<T>(structuredContent: T): StructuredToolResult<T> {
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

export function textToolResult<T>(text: string, structuredContent: T): StructuredToolResult<T> {
  return {
    content: [{ type: "text", text }],
    structuredContent,
  };
}

export function registerUnavailableTool(server: McpServer, name: string, inputSchema: Record<string, z.ZodTypeAny>): void {
  server.registerTool(
    name,
    {
      title: name,
      description: `${name} is planned in the OpenSpec change but not implemented in the current analysis tool set.`,
      inputSchema,
      outputSchema: {
        status: z.literal("not_implemented"),
        message: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    withToolLogging(name, async () => {
      const structuredContent = {
        status: "not_implemented" as const,
        message: `${name} is not implemented yet. Run reelink_analyze for the analysis video-to-work-items workflow.`,
      };
      return textToolResult(structuredContent.message, structuredContent);
    }),
  );
}
