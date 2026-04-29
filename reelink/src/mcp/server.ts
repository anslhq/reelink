// fallow-ignore-next-line unresolved-import
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

import { analyzeVideo } from "../analyze.js";
import { AnalyzeResultSchema } from "../schemas.js";
import { withToolLogging } from "../utils/tool-middleware.js";

export function createReelinkMcpServer(): McpServer {
  const server = new McpServer({
    name: "reelink",
    version: "0.0.0",
  });

  server.registerTool(
    "reelink_analyze",
    {
      title: "Analyze a local UI recording",
      description:
        "Analyze a local .mov/.mp4/.webm screen recording and return timestamped UI findings. Layer 0 requires only a path.",
      inputSchema: {
        path: z.string().describe("Absolute or workspace-relative path to a .mov, .mp4, or .webm recording."),
        fps_sample: z
          .number()
          .positive()
          .max(30)
          .default(4)
          .describe("Requested sampling fps. v0.1 clamps to the bounded preprocessing policy."),
        focus: z.string().default("any").describe("Optional focus hint, e.g. transition flicker, loading state, nav glitch."),
      },
      outputSchema: {
        recording_id: z.string(),
        duration_sec: z.number().nullable(),
        summary: z.string(),
        findings: AnalyzeResultSchema.shape.findings,
        next_steps: z.array(z.string()),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reelink_analyze", async (args) => {
      const structuredContent = await analyzeVideo(args);
      return {
        content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    }),
  );

  registerUnavailableTool(server, "reelink_get_finding", {
    recording_id: z.string(),
    finding_id: z.string(),
  });
  registerUnavailableTool(server, "reelink_get_frame", {
    recording_id: z.string(),
    ts: z.number(),
  });
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
  registerUnavailableTool(server, "reelink_query", {
    recording_id: z.string(),
    question: z.string(),
  });
  registerUnavailableTool(server, "reelink_run", {
    task_description: z.string(),
    target_url: z.string(),
  });

  return server;
}

function registerUnavailableTool(server: McpServer, name: string, inputSchema: Record<string, z.ZodTypeAny>): void {
  server.registerTool(
    name,
    {
      title: name,
      description: `${name} is planned in the OpenSpec change but not implemented in the current Layer 0 slice.`,
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
        message: `${name} is not implemented yet. Run reelink_analyze for the Layer 0 video-to-findings workflow.`,
      };
      return {
        content: [{ type: "text", text: structuredContent.message }],
        structuredContent,
      };
    }),
  );
}
