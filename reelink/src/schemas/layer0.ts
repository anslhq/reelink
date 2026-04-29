import { z } from "zod/v4";

const SeveritySchema = z.enum(["low", "medium", "high"]);

export const WorkItemSchema = z.object({
  id: z.string(),
  ts: z.number().min(0),
  type: z.string(),
  severity: SeveritySchema,
  title: z.string(),
  confidence: z.number().min(0).max(1),
  description: z.string().optional(),
  state: z.enum(["detected", "prepared", "approved", "routed", "executed", "completed"]),
  approval_state: z.enum(["pending", "approved", "rejected"]).nullable(),
  routed_to: z.string().nullable(),
  completed_at: z.string().nullable(),
  source: z.literal("video"),
  intent: z.enum(["fix", "investigate", "track"]),
});

export const AnalyzeResultSchema = z.object({
  recording_id: z.string(),
  duration_sec: z.number().nullable(),
  summary: z.string(),
  work_items: z.array(WorkItemSchema),
  next_steps: z.array(z.string()),
});

export const AnalyzeArgsSchema = z.object({
  path: z.string().min(1),
  fps_sample: z.number().positive().max(30).default(4),
  focus: z.string().default("any"),
});

export type AnalyzeResult = z.infer<typeof AnalyzeResultSchema>;
export type WorkItem = z.infer<typeof WorkItemSchema>;
