import { describe, expect, test } from "bun:test";

import {
  buildLayer0Manifest,
  isProviderAnalysisSkipped,
  runLayer0AnalysisPipeline,
  type AnalysisPipelineAdapters,
  type ImportedVideoRecording,
  type Layer0ProviderResult,
  type PreprocessedVideo,
} from "../src/analysis/pipeline.js";
import { analyzeVideo } from "../src/analyze.js";
import { AnalyzeArgsSchema, type AnalyzeResult, type Manifest } from "../src/schemas.js";

const baseRecording: ImportedVideoRecording = {
  id: "recording-1",
  root: "/workspace/.reelink/recording-1",
  framesDir: "/workspace/.reelink/recording-1/frames",
  manifestPath: "/workspace/.reelink/recording-1/manifest.json",
  analysisPath: "/workspace/.reelink/recording-1/analysis.json",
  sourceVideoPath: "/workspace/source.mov",
};

const basePreprocessed: PreprocessedVideo = {
  durationSec: 4.2,
  framePaths: ["/workspace/.reelink/recording-1/frames/frame-0001.jpg", "/workspace/.reelink/recording-1/frames/frame-0002.jpg"],
  policy: {
    requestedFps: 4,
    effectiveFps: 1,
    maxFrames: 64,
    longEdgePx: 896,
  },
};

const workItem = {
  id: "f1",
  ts: 1.5,
  type: "transition-flicker",
  severity: "high" as const,
  title: "Route transition flickers",
  confidence: 0.88,
  description: "The outgoing view briefly overlaps the incoming view.",
  state: "detected" as const,
  approval_state: "pending" as const,
  routed_to: null,
  completed_at: null,
  source: "video" as const,
  intent: "fix" as const,
};

const modelResult: Layer0ProviderResult = {
  provider: "openrouter",
  modelId: "qwen/qwen3.6-flash",
  route: "openrouter-native-video",
  summary: "The transition flickers after navigation.",
  workItems: [workItem],
  nextSteps: ["Inspect route transition state around navigation."],
};

describe("video analyze orchestration", () => {
  test("returns structured summary when the provider skips analysis for a missing API key", async () => {
    const writes = createWriteCapture();
    const skipped: Layer0ProviderResult = {
      provider: "none",
      modelId: "none",
      route: "unavailable",
      summary: "Model analysis was not run because OPENROUTER_API_KEY is not configured.",
      workItems: [],
      nextSteps: ["Set OPENROUTER_API_KEY for OpenRouter-hosted VL analysis."],
    };
    const adapters = createAdapters({
      writes,
      providerResult: skipped,
    });

    const result = await runLayer0AnalysisPipeline({ path: "clip.mov", fps_sample: 4, focus: "any" }, adapters);

    expect(isProviderAnalysisSkipped(skipped)).toBe(true);
    expect(result).toEqual({
      recording_id: "recording-1",
      duration_sec: 4.2,
      summary: "Model analysis was not run because OPENROUTER_API_KEY is not configured.",
      work_items: [],
      next_steps: ["Set OPENROUTER_API_KEY for OpenRouter-hosted VL analysis."],
    });
    expect(writes.manifest?.model).toBeUndefined();
  });

  test("persists raw-video provider output compatible with CLI and MCP callers", async () => {
    const writes = createWriteCapture();
    const providerCalls: unknown[] = [];
    const adapters = createAdapters({ writes, providerCalls, providerResult: modelResult });

    const result = await runLayer0AnalysisPipeline({ path: "clip.mp4", fps_sample: 4, focus: "transitions" }, adapters);

    expect(result).toEqual({
      recording_id: "recording-1",
      duration_sec: 4.2,
      summary: "The transition flickers after navigation.",
      work_items: [workItem],
      next_steps: ["Inspect route transition state around navigation."],
    });
    expect(writes.analysisPath).toBe(baseRecording.analysisPath);
    expect(writes.analysis).toEqual(result);
    expect(writes.manifestPath).toBe(baseRecording.manifestPath);
    expect(writes.manifest?.model).toEqual({
      provider: "openrouter",
      model_id: "qwen/qwen3.6-flash",
      route: "openrouter-native-video",
    });
    expect(providerCalls[0]).toMatchObject({
      durationSec: 4.2,
      framePaths: basePreprocessed.framePaths,
      focus: "transitions",
      effectiveFps: 1,
      sourceVideoPath: baseRecording.sourceVideoPath,
    });
  });

  test("rejects unsupported extensions before touching storage", async () => {
    const storageCalls: string[] = [];
    const adapters = createAdapters({ storageCalls, providerResult: modelResult });

    await expect(runLayer0AnalysisPipeline({ path: "clip.avi", fps_sample: 4, focus: "any" }, adapters)).rejects.toMatchObject({
      kind: "unsupported_extension",
      message: "reelink_analyze supports .mov, .mp4, and .webm files",
    });
    expect(storageCalls).toEqual([]);
  });

  test("surfaces preprocessing failures without calling the provider", async () => {
    const providerCalls: unknown[] = [];
    const adapters = createAdapters({
      providerCalls,
      providerResult: modelResult,
      preprocessError: new Error("ffmpeg frame extraction failed"),
    });

    await expect(runLayer0AnalysisPipeline({ path: "clip.webm", fps_sample: 4, focus: "any" }, adapters)).rejects.toMatchObject({
      kind: "preprocessing_failure",
      message: "ffmpeg frame extraction failed",
    });
    expect(providerCalls).toEqual([]);
  });

  test("classifies provider transport, validation, and generic failures", async () => {
    await expect(
      runLayer0AnalysisPipeline(
        { path: "clip.mov", fps_sample: 4, focus: "any" },
        createAdapters({ providerError: new Error("network timeout while calling provider") }),
      ),
    ).rejects.toMatchObject({ kind: "provider_unavailable" });

    await expect(
      runLayer0AnalysisPipeline(
        { path: "clip.mov", fps_sample: 4, focus: "any" },
        createAdapters({ providerError: new Error("generated object did not match schema") }),
      ),
    ).rejects.toMatchObject({ kind: "provider_output_invalid" });

    await expect(
      runLayer0AnalysisPipeline(
        { path: "clip.mov", fps_sample: 4, focus: "any" },
        createAdapters({ providerError: new Error("Zod validation failed at findings") }),
      ),
    ).rejects.toMatchObject({ kind: "provider_output_invalid" });

    await expect(
      runLayer0AnalysisPipeline(
        { path: "clip.mov", fps_sample: 4, focus: "any" },
        createAdapters({ providerError: new Error("unexpected provider fault") }),
      ),
    ).rejects.toMatchObject({ kind: "provider_failure" });
  });

  test("surfaces storage failures when persistence fails", async () => {
    await expect(
      runLayer0AnalysisPipeline(
        { path: "clip.mov", fps_sample: 4, focus: "any" },
        createAdapters({
          providerResult: modelResult,
          persistAnalysisError: new Error("disk full"),
        }),
      ),
    ).rejects.toMatchObject({ kind: "storage_failure", message: "disk full" });

    await expect(
      runLayer0AnalysisPipeline(
        { path: "clip.mov", fps_sample: 4, focus: "any" },
        createAdapters({
          providerResult: modelResult,
          persistManifestError: new Error("permission denied"),
        }),
      ),
    ).rejects.toMatchObject({ kind: "storage_failure", message: "permission denied" });
  });

  test("drops provider items without timestamps before persistence", async () => {
    const writes = createWriteCapture();
    const adapters = createAdapters({
      writes,
      providerResult: {
        ...modelResult,
        workItems: [
          { ...workItem, id: "drop-me", ts: null },
          { ...workItem, id: "keep-me", ts: 3, title: "Keep timestamped item" },
        ] as unknown as Layer0ProviderResult["workItems"],
      },
    });

    const result = await runLayer0AnalysisPipeline({ path: "clip.mov", fps_sample: 4, focus: "any" }, adapters);

    expect(result.work_items).toEqual([{ ...workItem, id: "keep-me", ts: 3, title: "Keep timestamped item" }]);
    expect(writes.analysis?.work_items).toEqual(result.work_items);
  });

  test("records preprocessing defaults on the manifest for cached frames and retrieval", () => {
    const manifest = buildLayer0Manifest(baseRecording, basePreprocessed, modelResult, new Date("2026-04-29T00:00:00.000Z"));

    expect(manifest.preprocessing).toEqual({
      requested_fps: 4,
      effective_fps: 1,
      max_frames: 64,
      long_edge_px: 896,
      frame_count: 2,
    });
    expect(manifest.streams).toEqual({
      frames: { status: "available" },
      trace: { status: "not_collected", reason: "Layer 0 imported video analysis only" },
      fiber_commits: { status: "not_collected", reason: "Layer 0 imported video analysis only" },
      source_dictionary: { status: "not_collected", reason: "Layer 0 imported video analysis only" },
      react_grab_events: { status: "not_collected", reason: "Layer 0 imported video analysis only" },
      network: { status: "not_collected", reason: "Layer 0 imported video analysis only" },
      console: { status: "not_collected", reason: "Layer 0 imported video analysis only" },
      eval: { status: "not_collected", reason: "No verification artifact generated" },
    });
    expect(manifest.artifacts).toEqual({
      analysis: "analysis.json",
      frames: "frames/",
      source_video: baseRecording.sourceVideoPath,
    });
  });

  test("honors copy versus reference policy from configuration when creating the package", async () => {
    const storageOptions: Array<{ copyVideo?: boolean }> = [];
    const adapters = createAdapters({ storageOptions, providerResult: modelResult, copyImportedVideos: true });

    await runLayer0AnalysisPipeline({ path: "clip.mov", fps_sample: 4, focus: "any" }, adapters);

    expect(storageOptions).toEqual([{ copyVideo: true }]);
  });
});

describe("analyzeVideo public entry", () => {
  test("rejects invalid arguments before running the pipeline", async () => {
    await expect(analyzeVideo({ path: "", fps_sample: 4, focus: "x" })).rejects.toThrow();
  });

  test("uses the same defaults for fps_sample and focus as the MCP analyze tool", () => {
    expect(AnalyzeArgsSchema.parse({ path: "clip.mov" })).toEqual({
      path: "clip.mov",
      fps_sample: 4,
      focus: "any",
    });
  });
});

function createWriteCapture(): {
  analysisPath?: string;
  analysis?: AnalyzeResult;
  manifestPath?: string;
  manifest?: Manifest;
} {
  return {};
}

function createAdapters(options: {
  writes?: ReturnType<typeof createWriteCapture>;
  storageCalls?: string[];
  storageOptions?: Array<{ copyVideo?: boolean }>;
  providerCalls?: unknown[];
  providerResult?: Layer0ProviderResult;
  providerError?: Error;
  preprocessError?: Error;
  copyImportedVideos?: boolean;
  persistAnalysisError?: Error;
  persistManifestError?: Error;
} = {}): AnalysisPipelineAdapters {
  return {
    config: {
      load: () => ({
        homeDir: "/home/reelink",
        configPath: "/home/reelink/config.json",
        defaultFpsSample: 4,
        openRouterApiKey: options.providerResult?.provider === "none" ? undefined : "test-key",
        openRouterModel: undefined,
        copyImportedVideos: options.copyImportedVideos ?? false,
      }),
    },
    storage: {
      createImportedVideoRecording: (sourcePath, storageOpts) => {
        options.storageCalls?.push(sourcePath);
        options.storageOptions?.push(storageOpts);
        return baseRecording;
      },
      writeAnalysis: (path, result) => {
        if (options.persistAnalysisError) throw options.persistAnalysisError;
        if (options.writes) {
          options.writes.analysisPath = path;
          options.writes.analysis = result;
        }
      },
      writeManifest: (path, manifest) => {
        if (options.persistManifestError) throw options.persistManifestError;
        if (options.writes) {
          options.writes.manifestPath = path;
          options.writes.manifest = manifest;
        }
      },
    },
    preprocessor: {
      preprocess: () => {
        if (options.preprocessError) throw options.preprocessError;
        return basePreprocessed;
      },
    },
    provider: {
      analyze: async (input) => {
        options.providerCalls?.push(input);
        if (options.providerError) throw options.providerError;
        return options.providerResult ?? modelResult;
      },
    },
    clock: { now: () => new Date("2026-04-29T00:00:00.000Z") },
  };
}
