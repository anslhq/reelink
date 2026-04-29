import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { z } from "zod/v4";

import type { ReelinkConfig } from "../config/env.js";
import { telemetryFor } from "../gateway/telemetry.js";
import type { Finding } from "../schemas.js";
import { logger } from "../utils/logger.js";

const log = logger("vlm-router");

const ModelAnalyzeSchema = z.object({
  summary: z.string(),
  findings: z.array(
    z.object({
      ts: z.number().min(0).nullable(),
      type: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      title: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  next_steps: z.array(z.string()),
});

type VlmAnalysis = {
  provider: string;
  modelId: string;
  route: string;
  summary: string;
  findings: Finding[];
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

  const selected = await selectModel(input.config);
  if (!selected) {
    return {
      provider: "none",
      modelId: "none",
      route: "unavailable",
      summary: "Model analysis was not run because OPENROUTER_API_KEY is not configured.",
      findings: [],
      nextSteps: [
        "Set OPENROUTER_API_KEY for OpenRouter-hosted VL analysis.",
        "Use a Qwen route that supports video input for raw-video analysis.",
      ],
    };
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
    summary: result.output.summary,
    findings: result.output.findings.map((finding, index) => ({
      id: `f${index + 1}`,
      ts: finding.ts ?? 0,
      type: finding.type,
      severity: finding.severity,
      title: finding.title,
      confidence: finding.confidence,
      description: finding.description,
    })),
    nextSteps: result.output.next_steps,
  };
}

async function selectModel(config: ReelinkConfig) {
  if (!config.openRouterApiKey) {
    return null;
  }

  const selected = await selectOpenRouterQwenVideoModel(config.openRouterModel);
  const openrouter = createOpenRouter({ apiKey: config.openRouterApiKey });
  return {
    provider: "openrouter",
    modelId: selected.id,
    route: "openrouter-native-video",
    model: openrouter.chat(selected.id, { plugins: [{ id: "response-healing" }] }),
  };
}

type OpenRouterModelInfo = {
  id: string;
  inputModalities: string[];
};

async function selectOpenRouterQwenVideoModel(configuredModelId?: string): Promise<OpenRouterModelInfo> {
  const models = await fetchOpenRouterModels();

  if (configuredModelId) {
    const configured = models.find((model) => model.id === configuredModelId);
    if (!configured) {
      throw new Error(`Configured OpenRouter model ${configuredModelId} was not found in the live OpenRouter catalog.`);
    }
    if (!configured.inputModalities.includes("video")) {
      throw new Error(
        `Configured OpenRouter model ${configuredModelId} does not accept raw video. Its input modalities are: ${configured.inputModalities.join(", ") || "unknown"}. Use a video-capable Qwen route such as qwen/qwen3.6-flash.`,
      );
    }
    return configured;
  }

  for (const preferred of ["qwen/qwen3.6-flash", "qwen/qwen3.6-35b-a3b", "qwen/qwen3.6-plus"]) {
    const candidate = models.find((model) => model.id === preferred && model.inputModalities.includes("video"));
    if (candidate) return candidate;
  }

  const firstQwenVideo = models.find((model) => model.id.startsWith("qwen/") && model.inputModalities.includes("video"));
  if (firstQwenVideo) return firstQwenVideo;

  throw new Error("OpenRouter catalog did not expose any Qwen model with video input modality. Reelink requires raw video input and will not silently fall back to frame prompts.");
}

async function fetchOpenRouterModels(): Promise<OpenRouterModelInfo[]> {
  const response = await fetch("https://openrouter.ai/api/v1/models").catch(() => null);
  if (!response?.ok) {
    throw new Error("Could not fetch the OpenRouter model catalog to verify video input support.");
  }
  const data = (await response.json()) as {
    data?: Array<{ id?: string; architecture?: { input_modalities?: string[] } }>;
  };
  return (data.data ?? [])
    .filter((model): model is { id: string; architecture?: { input_modalities?: string[] } } => Boolean(model.id))
    .map((model) => ({
      id: model.id,
      inputModalities: model.architecture?.input_modalities ?? [],
    }));
}

function buildNativeVideoPrompt(sourceVideoPath: string, durationSec: number | null, focus: string) {
  return [
    {
      type: "text" as const,
      text:
        "You are Reelink, a QA-focused video analyst for browser UI recordings. " +
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

function mediaTypeForVideo(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".mp4")) return "video/mp4";
  throw new Error(`Unsupported video extension for raw-video analysis: ${path}`);
}

