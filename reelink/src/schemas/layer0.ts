import { z } from "zod/v4";

const SeveritySchema = z.enum(["low", "medium", "high"]);

export const FindingSchema = z.object({
  id: z.string(),
  ts: z.number().min(0),
  type: z.string(),
  severity: SeveritySchema,
  title: z.string(),
  confidence: z.number().min(0).max(1),
  description: z.string().optional(),
});

export const AnalyzeResultSchema = z.object({
  recording_id: z.string(),
  duration_sec: z.number().nullable(),
  summary: z.string(),
  findings: z.array(FindingSchema),
  next_steps: z.array(z.string()),
});

export const AnalyzeArgsSchema = z.object({
  path: z.string().min(1),
  fps_sample: z.number().positive().max(30).default(4),
  focus: z.string().default("any"),
});

export type AnalyzeResult = z.infer<typeof AnalyzeResultSchema>;
export type Finding = z.infer<typeof FindingSchema>;
