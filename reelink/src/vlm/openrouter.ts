import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import type { ReelinkConfig } from "../config/env.js";
import { telemetryFor } from "../gateway/telemetry.js";
import type { WorkItem } from "../schemas.js";
import { logger } from "../utils/logger.js";
import { classifyOpenRouterSelectionError, selectOpenRouterQwenVideoModel } from "./catalog.js";
import { mediaTypeForVideo } from "./media.js";
import { mapModelAnalyzeOutputToWorkItems, ModelAnalyzeSchema } from "./work-items.js";

const log = logger("vlm-openrouter");

export type PreparedOpenRouterRawVideoModel = {
  provider: "openrouter";
  modelId: string;
  route: "openrouter-native-video";
  inputModalities: string[];
  routeFamily: "qwen-raw-video";
  model: ReturnType<ReturnType<typeof createOpenRouter>["chat"]>;
};

export type RawVideoProviderAnalysis = {
  provider: string;
  modelId: string;
  route: string;
  inputModalities?: string[];
  routeFamily?: string;
  summary: string;
  workItems: WorkItem[];
  nextSteps: string[];
};

export type OpenRouterRawVideoAnalyzeInput = {
  config: ReelinkConfig;
  durationSec: number | null;
  focus: string;
  sourceVideoPath?: string;
};

/** Returns null when no API key is configured (structured not-run path). */
export async function prepareOpenRouterRawVideoModel(config: ReelinkConfig): Promise<PreparedOpenRouterRawVideoModel | null> {
  if (!config.openRouterApiKey) {
    return null;
  }

  const selected = await selectOpenRouterQwenVideoModel(config.openRouterModel);
  const openrouter = createOpenRouter({ apiKey: config.openRouterApiKey });
  return {
    provider: "openrouter",
    modelId: selected.id,
    route: "openrouter-native-video",
    inputModalities: selected.inputModalities,
    routeFamily: "qwen-raw-video",
    model: openrouter.chat(selected.id, { plugins: [{ id: "response-healing" }] }),
  };
}

export async function analyzeRawVideoWithOpenRouter(input: OpenRouterRawVideoAnalyzeInput): Promise<RawVideoProviderAnalysis | null> {
  const selected = await prepareOpenRouterRawVideoModel(input.config);
  if (!selected) {
    return null;
  }
  if (!input.sourceVideoPath) {
    throw new Error("Raw video path is required for Qwen video analysis");
  }

  const startedAt = performance.now();
  const content = buildNativeVideoPrompt(input.sourceVideoPath, input.durationSec, input.focus);

  const result = await generateText({
    model: selected.model,
    output: Output.object({ schema: ModelAnalyzeSchema }),
    messages: [
      {
        role: "user",
        content,
      },
    ],
    experimental_telemetry: telemetryFor("vlm-router.analyze", {
      provider: selected.provider,
      model: selected.modelId,
      route: selected.route,
    }),
  });

  log.info(
    {
      provider: selected.provider,
      model: selected.modelId,
      route: selected.route,
      durationMs: Math.round(performance.now() - startedAt),
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
    },
    "vlm analysis complete",
  );

  return {
    provider: selected.provider,
    modelId: selected.modelId,
    route: selected.route,
    inputModalities: selected.inputModalities,
    routeFamily: selected.routeFamily,
    summary: result.output.summary,
    workItems: mapModelAnalyzeOutputToWorkItems(result.output, (index, type) => {
      log.warn({ index, type }, "dropping finding with null timestamp");
    }),
    nextSteps: result.output.next_steps,
  };
}

export function classifyOpenRouterProviderError(
  error: unknown,
):
  | ReturnType<typeof classifyOpenRouterSelectionError>
  | "provider_unavailable"
  | "provider_output_invalid" {
  const selection = classifyOpenRouterSelectionError(error);
  if (selection !== "unknown") return selection;
  if (!(error instanceof Error)) return "unknown";

  const message = error.message.toLowerCase();
  if (message.includes("schema") || message.includes("json") || message.includes("object")) {
    return "provider_output_invalid";
  }
  if (message.includes("network") || message.includes("fetch") || message.includes("timeout") || message.includes("rate limit")) {
    return "provider_unavailable";
  }
  return "unknown";
}

export function buildNativeVideoPrompt(sourceVideoPath: string, durationSec: number | null, focus: string) {
  return [
    {
      type: "text" as const,
      text:
        "You are Reck, a QA-focused video analyst for browser UI recordings. " +
        "Watch the raw video, not a still screenshot. Find UI bugs that require motion or timing evidence: animation flicker, transition overlap, loading flashes, layout shifts, stale state, z-index bugs, clipped text, and navigation glitches. " +
        `Recording duration: ${durationSec ?? "unknown"} seconds. Focus hint: ${focus}. ` +
        "Return strict JSON matching the schema. Use timestamps in seconds. If evidence is weak, return low confidence or no findings.",
    },
    {
      type: "file" as const,
      data: readFileSync(sourceVideoPath),
      filename: basename(sourceVideoPath),
      mediaType: mediaTypeForVideo(sourceVideoPath),
    },
  ];
}
