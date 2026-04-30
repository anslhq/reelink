import { z } from "zod/v4";

export const StreamStatusSchema = z.object({
  status: z.enum(["available", "not_collected", "unavailable", "failed"]),
  reason: z.string().optional(),
});

/** Recording package envelope (agent-readable manifest); `source_type` distinguishes layout pipelines. */
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
    redaction_rules: z.array(z.string()).optional(),
    redacted_streams: z.array(z.string()).optional(),
  }),
  dom_snapshots: z
    .array(
      z.object({
        ts: z.number(),
        path: z.string(),
        url: z.string().optional(),
        title: z.string().optional(),
        tree_summary: z.string().optional(),
      }),
    )
    .optional(),
});

export type Manifest = z.infer<typeof ManifestSchema>;
