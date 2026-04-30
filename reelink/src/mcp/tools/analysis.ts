// fallow-ignore-next-line unresolved-import
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

import { analyzeVideo } from "../../analyze.js";
import { AnalyzeResultSchema } from "../../schemas.js";
import { withToolLogging } from "../../utils/tool-middleware.js";
import { jsonToolResult } from "./_helpers.js";

export function registerAnalysisTools(server: McpServer): void {
  server.registerTool(
    "reelink_analyze",
    {
      title: "Analyze a local UI recording",
      description:
        "Analyze a local .mov/.mp4/.webm screen recording and return timestamped UI work items. The analysis tool requires only a path.",
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
        work_items: AnalyzeResultSchema.shape.work_items,
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
      return jsonToolResult(structuredContent);
    }),
  );
}
