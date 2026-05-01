import type { ReelinkConfig } from "../config/env.js";
import { WorkItemSchema, type AnalyzeResult } from "../schemas.js";

import { createDefaultAnalysisPipelineAdapters } from "./default-adapters.js";
import { AnalysisPipelineError, classifyProviderFailure, errorMessage } from "./errors.js";
import { buildLayer0Manifest } from "./manifest.js";
import type {
  AnalysisPipelineAdapters,
  AnalysisPipelineInput,
  ImportedVideoRecording,
  Layer0ProviderResult,
  PreprocessedVideo,
} from "./types.js";

export type {
  AnalysisPipelineAdapters,
  AnalysisPipelineInput,
  ConfigAdapter,
  ImportedVideoRecording,
  Layer0ProviderResult,
  PreprocessPolicy,
  PreprocessedVideo,
  PreprocessorAdapter,
  StorageAdapter,
  VlmProviderAdapter,
} from "./types.js";
export { isProviderAnalysisSkipped } from "./types.js";

export { AnalysisPipelineError, type AnalysisFailureKind } from "./errors.js";
export { buildLayer0Manifest } from "./manifest.js";
export { createDefaultAnalysisPipelineAdapters } from "./default-adapters.js";

export async function runLayer0AnalysisPipeline(
  input: AnalysisPipelineInput,
  adapters: AnalysisPipelineAdapters = createDefaultAnalysisPipelineAdapters(),
): Promise<AnalyzeResult> {
  assertSupportedVideoExtension(input.path);

  const config = adapters.config.load();
  const recording = createRecording(adapters, input.path, config.copyImportedVideos);
  const preprocessed = preprocessRecording(adapters, recording, input.fps_sample);
  const analysis = await analyzeRawVideo(adapters, config, recording, preprocessed, input.focus);

  const result: AnalyzeResult = {
    recording_id: recording.id,
    duration_sec: preprocessed.durationSec,
    summary: analysis.summary,
    findings: analysis.workItems.map(toPublicFinding),
    next_steps: analysis.nextSteps,
  };

  persistResult(adapters, recording, result);
  persistManifest(adapters, recording, preprocessed, analysis, adapters.clock.now());

  return result;
}

function assertSupportedVideoExtension(videoPath: string): void {
  if (!/\.(mov|mp4|webm)$/i.test(videoPath)) {
    throw new AnalysisPipelineError("unsupported_extension", "reck_analyze supports .mov, .mp4, and .webm files");
  }
}

function createRecording(adapters: AnalysisPipelineAdapters, videoPath: string, copyVideo?: boolean): ImportedVideoRecording {
  try {
    return adapters.storage.createImportedVideoRecording(videoPath, { copyVideo });
  } catch (error) {
    throw new AnalysisPipelineError("storage_failure", errorMessage(error), error);
  }
}

function preprocessRecording(
  adapters: AnalysisPipelineAdapters,
  recording: ImportedVideoRecording,
  requestedFps: number,
): PreprocessedVideo {
  try {
    return adapters.preprocessor.preprocess(recording.sourceVideoPath, recording.framesDir, requestedFps);
  } catch (error) {
    throw new AnalysisPipelineError("preprocessing_failure", errorMessage(error), error);
  }
}

async function analyzeRawVideo(
  adapters: AnalysisPipelineAdapters,
  config: ReelinkConfig,
  recording: ImportedVideoRecording,
  preprocessed: PreprocessedVideo,
  focus: string,
): Promise<Layer0ProviderResult> {
  try {
    const result = await adapters.provider.analyze({
      config,
      durationSec: preprocessed.durationSec,
      framePaths: preprocessed.framePaths,
      focus,
      effectiveFps: preprocessed.policy.effectiveFps,
      sourceVideoPath: recording.sourceVideoPath,
    });
    return normalizeProviderResult(result);
  } catch (error) {
    throw new AnalysisPipelineError(classifyProviderFailure(error), errorMessage(error), error);
  }
}

function normalizeProviderResult(result: Layer0ProviderResult): Layer0ProviderResult {
  return {
    ...result,
    workItems: result.workItems.flatMap((item) => {
      if (item.ts == null) return [];
      return [WorkItemSchema.parse(item)];
    }),
  };
}

function toPublicFinding(item: Layer0ProviderResult["workItems"][number]) {
  return {
    id: item.id,
    ts: item.ts,
    type: item.type,
    severity: item.severity,
    title: item.title,
    confidence: item.confidence,
  };
}

function persistResult(adapters: AnalysisPipelineAdapters, recording: ImportedVideoRecording, result: AnalyzeResult): void {
  try {
    adapters.storage.writeAnalysis(recording.analysisPath, result);
  } catch (error) {
    throw new AnalysisPipelineError("storage_failure", errorMessage(error), error);
  }
}

function persistManifest(
  adapters: AnalysisPipelineAdapters,
  recording: ImportedVideoRecording,
  preprocessed: PreprocessedVideo,
  analysis: Layer0ProviderResult,
  createdAt: Date,
): void {
  try {
    adapters.storage.writeManifest(recording.manifestPath, buildLayer0Manifest(recording, preprocessed, analysis, createdAt));
  } catch (error) {
    throw new AnalysisPipelineError("storage_failure", errorMessage(error), error);
  }
}
