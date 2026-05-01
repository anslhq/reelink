import type { WorkItem } from "../schemas.js";
import type { ReelinkConfig } from "../config/env.js";
import { analyzeRawVideoWithOpenRouter } from "./openrouter.js";

type VlmAnalysis = {
  provider: string;
  modelId: string;
  route: string;
  summary: string;
  workItems: WorkItem[];
  nextSteps: string[];
};

export async function analyzeFramesWithVlm(input: {
  config: ReelinkConfig;
  durationSec: number | null;
  framePaths: string[];
  focus: string;
  effectiveFps: number;
  sourceVideoPath?: string;
}): Promise<VlmAnalysis> {
  void input.framePaths;
  void input.effectiveFps;

  const analysis = await analyzeRawVideoWithOpenRouter({
    config: input.config,
    durationSec: input.durationSec,
    focus: input.focus,
    sourceVideoPath: input.sourceVideoPath,
  });
  if (!analysis) {
    return {
      provider: "none",
      modelId: "none",
      route: "unavailable",
      summary: "Model analysis was not run because OPENROUTER_API_KEY is not configured.",
      workItems: [],
      nextSteps: [
        "Set OPENROUTER_API_KEY for OpenRouter-hosted VL analysis.",
        "Use a Qwen route that supports video input for raw-video analysis.",
      ],
    };
  }

  return analysis;
}
