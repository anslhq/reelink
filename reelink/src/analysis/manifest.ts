import type { Manifest } from "../schemas.js";

import type { ImportedVideoRecording, Layer0ProviderResult, PreprocessedVideo } from "./types.js";

export function buildLayer0Manifest(
  recording: ImportedVideoRecording,
  preprocessed: PreprocessedVideo,
  analysis: Layer0ProviderResult,
  createdAt: Date,
): Manifest {
  return {
    recording_id: recording.id,
    created_at: createdAt.toISOString(),
    source_type: "imported_video",
    source_path: recording.sourceVideoPath,
    duration_sec: preprocessed.durationSec,
    preprocessing: {
      requested_fps: preprocessed.policy.requestedFps,
      effective_fps: preprocessed.policy.effectiveFps,
      max_frames: preprocessed.policy.maxFrames,
      long_edge_px: preprocessed.policy.longEdgePx,
      frame_count: preprocessed.framePaths.length,
      strategy: preprocessed.policy.strategy,
      primary_analysis_uses_raw_video: preprocessed.policy.primaryAnalysisUsesRawVideo,
    },
    artifacts: {
      analysis: "analysis.json",
      frames: "frames/",
      source_video: recording.sourceVideoPath,
    },
    streams: {
      frames: { status: "available" },
      trace: { status: "not_collected", reason: "Layer 0 imported video analysis only" },
      fiber_commits: { status: "not_collected", reason: "Layer 0 imported video analysis only" },
      source_dictionary: { status: "not_collected", reason: "Layer 0 imported video analysis only" },
      react_grab_events: { status: "not_collected", reason: "Layer 0 imported video analysis only" },
      network: { status: "not_collected", reason: "Layer 0 imported video analysis only" },
      console: { status: "not_collected", reason: "Layer 0 imported video analysis only" },
      eval: { status: "not_collected", reason: "No verification artifact generated" },
    },
    model:
      analysis.provider === "none"
        ? undefined
        : {
            provider: analysis.provider,
            model_id: analysis.modelId,
            route: analysis.route,
            route_family: analysis.routeFamily,
            input_modalities: analysis.inputModalities,
            drift_policy:
              "Primary Layer 0 analysis requires an OpenRouter Qwen route with video input; image-only or unknown Qwen routes fail instead of falling back to frames.",
          },
    prod_build: null,
    prod_build_status: "unknown",
    relations: {
      imported_video_id: recording.id,
      related_recording_ids: [],
      relation: "source_import",
    },
    safety: {
      redaction_applied: false,
    },
  };
}
