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
    strategy: z.literal("cached-frame-retrieval"),
    primary_analysis_uses_raw_video: z.boolean(),
  }),
  artifacts: z.record(z.string(), z.string()),
  streams: z.record(z.string(), StreamStatusSchema),
  model: z
    .object({
      provider: z.string(),
      model_id: z.string(),
      route: z.string(),
      route_family: z.string().optional(),
      input_modalities: z.array(z.string()).optional(),
      drift_policy: z.string().optional(),
    })
    .optional(),
  prod_build: z.boolean().nullable().default(null),
  prod_build_status: z.enum(["detected", "unknown", "unavailable"]).default("unknown"),
  prod_build_reason: z.string().optional(),
  relations: z
    .object({
      imported_video_id: z.string().optional(),
      browser_recording_id: z.string().optional(),
      agent_run_id: z.string().optional(),
      related_recording_ids: z.array(z.string()).optional(),
      relation: z.string().optional(),
    })
    .optional(),
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
  frame_snapshots: z
    .array(
      z.object({
        ts: z.number(),
        path: z.string(),
        url: z.string().optional(),
      }),
    )
    .optional(),
});

export type Manifest = z.infer<typeof ManifestSchema>;
