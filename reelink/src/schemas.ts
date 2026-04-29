import { z } from "zod/v4";

const SeveritySchema = z.enum(["low", "medium", "high"]);

const FindingSchema = z.object({
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

const StreamStatusSchema = z.object({
  status: z.enum(["available", "not_collected", "unavailable", "failed"]),
  reason: z.string().optional(),
});

export const ManifestSchema = z.object({
  recording_id: z.string(),
  created_at: z.string(),
  source_type: z.enum(["imported_video", "browser_recording", "agent_run"]),
  source_path: z.string().optional(),
  duration_sec: z.number().nullable(),
  preprocessing: z.object({
    requested_fps: z.number(),
    effective_fps: z.number(),
    max_frames: z.number(),
    long_edge_px: z.number(),
    frame_count: z.number(),
  }),
  artifacts: z.record(z.string(), z.string()),
  streams: z.record(z.string(), StreamStatusSchema),
  model: z
    .object({
      provider: z.string(),
      model_id: z.string(),
      route: z.string(),
    })
    .optional(),
  prod_build: z.boolean().default(false),
  safety: z.object({
    redaction_applied: z.boolean(),
  }),
});

export const AnalyzeArgsSchema = z.object({
  path: z.string().min(1),
  fps_sample: z.number().positive().max(30).default(4),
  focus: z.string().default("any"),
});

export type AnalyzeResult = z.infer<typeof AnalyzeResultSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;
export type Finding = z.infer<typeof FindingSchema>;
