import { loadConfig } from "./config/env.js";
import { createImportedVideoRecording, writeJson, writeManifest } from "./recordings/store.js";
import { AnalyzeArgsSchema, type AnalyzeResult, type Manifest } from "./schemas.js";
import { preprocessVideo } from "./video/preprocessor.js";
import { analyzeFramesWithVlm } from "./vlm/router.js";

export async function analyzeVideo(rawArgs: unknown): Promise<AnalyzeResult> {
  const args = AnalyzeArgsSchema.parse(rawArgs);
  if (!/\.(mov|mp4|webm)$/i.test(args.path)) {
    throw new Error("reelink_analyze supports .mov, .mp4, and .webm files");
  }

  const config = loadConfig();
  const recording = createImportedVideoRecording(args.path, { copyVideo: config.copyImportedVideos });
  const preprocessed = preprocessVideo(recording.sourceVideoPath, recording.framesDir, args.fps_sample);
  const analysis = await analyzeFramesWithVlm({
    config,
    durationSec: preprocessed.durationSec,
    framePaths: preprocessed.framePaths,
    focus: args.focus,
    effectiveFps: preprocessed.policy.effectiveFps,
    sourceVideoPath: recording.sourceVideoPath,
  });

  const result: AnalyzeResult = {
    recording_id: recording.id,
    duration_sec: preprocessed.durationSec,
    summary: analysis.summary,
    work_items: analysis.workItems,
    next_steps: analysis.nextSteps,
  };

  writeJson(recording.analysisPath, result);

  const manifest: Manifest = {
    recording_id: recording.id,
    created_at: new Date().toISOString(),
    source_type: "imported_video",
    source_path: recording.sourceVideoPath,
    duration_sec: preprocessed.durationSec,
    preprocessing: {
      requested_fps: preprocessed.policy.requestedFps,
      effective_fps: preprocessed.policy.effectiveFps,
      max_frames: preprocessed.policy.maxFrames,
      long_edge_px: preprocessed.policy.longEdgePx,
      frame_count: preprocessed.framePaths.length,
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
          },
    prod_build: false,
    safety: {
      redaction_applied: false,
    },
  };

  writeManifest(recording.manifestPath, manifest);
  return result;
}
