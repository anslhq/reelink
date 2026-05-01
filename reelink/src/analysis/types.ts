import type { ReelinkConfig } from "../config/env.js";
import type { AnalyzeResult, Manifest, WorkItem } from "../schemas.js";

/** Recording layout for an imported-video Layer 0 analysis package under `.reck/<id>/`. */
export type ImportedVideoRecording = {
  id: string;
  root: string;
  framesDir: string;
  manifestPath: string;
  analysisPath: string;
  sourceVideoPath: string;
};

export type PreprocessPolicy = {
  requestedFps: number;
  effectiveFps: number;
  maxFrames: number;
  longEdgePx: number;
  strategy: "cached-frame-retrieval";
  primaryAnalysisUsesRawVideo: boolean;
};

/** Deterministic jpeg frames under `frames/` for retrieval and future non-raw providers. */
export type PreprocessedVideo = {
  durationSec: number | null;
  framePaths: string[];
  policy: PreprocessPolicy;
};

export type Layer0ProviderResult = {
  provider: string;
  modelId: string;
  route: string;
  inputModalities?: string[];
  routeFamily?: string;
  summary: string;
  workItems: WorkItem[];
  nextSteps: string[];
};

export type AnalysisPipelineInput = {
  path: string;
  fps_sample: number;
  focus: string;
};

export type ConfigAdapter = {
  load(): ReelinkConfig;
};

export type StorageAdapter = {
  createImportedVideoRecording(sourcePath: string, options: { copyVideo?: boolean }): ImportedVideoRecording;
  writeAnalysis(path: string, result: AnalyzeResult): void;
  writeManifest(path: string, manifest: Manifest): void;
};

export type PreprocessorAdapter = {
  preprocess(sourcePath: string, framesDir: string, requestedFps: number): PreprocessedVideo;
};

export type VlmProviderAdapter = {
  analyze(input: {
    config: ReelinkConfig;
    durationSec: number | null;
    framePaths: string[];
    focus: string;
    effectiveFps: number;
    sourceVideoPath: string;
  }): Promise<Layer0ProviderResult>;
};

export type AnalysisPipelineAdapters = {
  config: ConfigAdapter;
  storage: StorageAdapter;
  preprocessor: PreprocessorAdapter;
  provider: VlmProviderAdapter;
  clock: { now(): Date };
};

/** Structured skip when no API key / route unavailable — success path, not {@link AnalysisPipelineError}. */
export function isProviderAnalysisSkipped(result: Layer0ProviderResult): boolean {
  return result.provider === "none";
}
