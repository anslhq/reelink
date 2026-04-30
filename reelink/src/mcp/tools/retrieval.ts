// fallow-ignore-next-line unresolved-import
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { existsSync } from "node:fs";
import { z } from "zod/v4";

import { jsonToolResult } from "./_helpers.js";
import {
  findFrameNearTimestamp,
  findWorkItemById,
} from "../../recordings/store.js";
import { WorkItemSchema } from "../../schemas.js";
import { answerDeterministicQuery, QueryResponseSchema, type DeterministicQueryResponse } from "../../query/index.js";
import { withToolLogging } from "../../utils/tool-middleware.js";

export function registerRetrievalTools(server: McpServer): void {
  server.registerTool(
    "reelink_get_finding",
    {
      title: "Get a Reelink work item",
      description: "Load analysis.json for a recording and return the WorkItem identified by finding_id.",
      inputSchema: {
        recording_id: z.string(),
        finding_id: z.string(),
      },
      outputSchema: {
        recording_id: z.string(),
        finding_id: z.string(),
        work_item: WorkItemSchema.nullable(),
        reason: z.string().optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    withToolLogging("reelink_get_finding", async ({ recording_id, finding_id }) => {
      const workItem = await findWorkItemById(recording_id, finding_id);
      const structuredContent = workItem
        ? { recording_id, finding_id, work_item: workItem }
        : { recording_id, finding_id, work_item: null, reason: "finding not found" };
      return jsonToolResult(structuredContent);
    }),
  );

  server.registerTool(
    "reelink_get_frame",
    {
      title: "Get a Reelink frame near a timestamp",
      description: "Read manifest.json and return the nearest sampled frame path for a recording timestamp.",
      inputSchema: {
        recording_id: z.string(),
        ts: z.number(),
      },
      outputSchema: {
        recording_id: z.string(),
        query_ts: z.number(),
        path: z.string().nullable(),
        frame_index: z.number().nullable(),
        frame_ts: z.number().nullable(),
        delta_sec: z.number().nullable(),
        exists: z.boolean().optional(),
        reason: z.string().optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    withToolLogging("reelink_get_frame", async ({ recording_id, ts }) => {
      const frame = await findFrameNearTimestamp(recording_id, ts);
      const structuredContent = frame
        ? {
            recording_id,
            query_ts: ts,
            path: frame.path,
            frame_index: frame.index,
            frame_ts: frame.ts,
            delta_sec: frame.delta_sec,
            exists: existsSync(frame.path),
          }
        : {
            recording_id,
            query_ts: ts,
            path: null,
            frame_index: null,
            frame_ts: null,
            delta_sec: null,
            reason: "frame not available",
          };
      return jsonToolResult(structuredContent);
    }),
  );
}

export function registerQueryTools(server: McpServer): void {
  server.registerTool(
    "reelink_query",
    {
      title: "Query a Reelink recording deterministically",
      description: "Answer from analysis.json, manifest.json, work_items, next_steps, frames, and stream metadata. No model calls.",
      inputSchema: {
        recording_id: z.string(),
        question: z.string(),
      },
      outputSchema: QueryResponseSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    withToolLogging("reelink_query", async ({ recording_id, question }) => {
      const structuredContent: DeterministicQueryResponse = await answerDeterministicQuery(recording_id, question);
      return jsonToolResult(structuredContent);
    }),
  );
}
