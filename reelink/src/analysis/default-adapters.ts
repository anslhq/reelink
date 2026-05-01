import { loadConfig } from "../config/env.js";
import { createImportedVideoRecording, writeJson, writeManifest } from "../recordings/store.js";
import { preprocessVideo } from "../video/preprocessor.js";
import { analyzeFramesWithVlm } from "../vlm/router.js";

import type { AnalysisPipelineAdapters } from "./types.js";

export function createDefaultAnalysisPipelineAdapters(): AnalysisPipelineAdapters {
  return {
    config: { load: loadConfig },
    storage: {
      createImportedVideoRecording,
      writeAnalysis: writeJson,
      writeManifest,
    },
    preprocessor: { preprocess: preprocessVideo },
    provider: { analyze: analyzeFramesWithVlm },
    clock: { now: () => new Date() },
  };
}
