import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod/v4";

import { loadConfig, type ReelinkConfig } from "../config/env.js";
import { telemetryFor } from "../gateway/telemetry.js";
import { listStreams, loadAnalysis, loadManifest } from "../recordings/store.js";
import type { Manifest, StoredAnalysis } from "../schemas.js";
import { logger } from "../utils/logger.js";
import type { DeterministicQueryResponse } from "./deterministic-query-schema.js";
import { answerDeterministicQuery } from "./deterministic-query.js";

const GPT_FALLBACK_PATTERN = "gpt_fallback";
const DEFAULT_OPENAI_QUERY_MODEL = "gpt-5.5";

const GptFallbackOutputSchema = z.object({
  response: z.string().min(1),
  citations: z.array(z.string()).default([]),
});

type GptFallbackOutput = z.infer<typeof GptFallbackOutputSchema>;

export type QueryGptFallbackInput = {
  recordingId: string;
  question: string;
  deterministic: DeterministicQueryResponse;
  analysis: StoredAnalysis;
  manifest: Manifest;
  streams: Manifest["streams"];
};

export type QueryGptFallbackAdapter = (input: QueryGptFallbackInput) => Promise<GptFallbackOutput>;

export type HybridQueryOptions = {
  config?: ReelinkConfig;
  enabled?: boolean;
  adapter?: QueryGptFallbackAdapter;
};

const log = logger("query-gpt-fallback");

export async function answerHybridQuery(
  recordingId: string,
  question: string,
  options: HybridQueryOptions = {},
): Promise<DeterministicQueryResponse> {
  const deterministic = await answerDeterministicQuery(recordingId, question);
  if (deterministic.answer !== null) return deterministic;

  const config = options.config ?? loadConfig();
  const enabled = options.enabled ?? config.queryGptFallbackEnabled ?? false;
  if (!enabled) return deterministic;

  const adapter = options.adapter ?? createOpenAiQueryFallbackAdapter(config);
  if (!adapter) {
    return fallbackNotRun(deterministic, "OPENAI_API_KEY not configured");
  }

  try {
    const [analysis, manifest] = await Promise.all([loadAnalysis(recordingId), loadManifest(recordingId)]);
    const output = await adapter({
      recordingId,
      question,
      deterministic,
      analysis,
      manifest,
      streams: await listStreams(recordingId),
    });

    return {
      recording_id: recordingId,
      question,
      answer: {
        kind: GPT_FALLBACK_PATTERN,
        response: output.response,
        citations: output.citations,
        grounded_in: ["analysis.json", "manifest.json", "runtime streams"],
      },
      patterns_matched: [GPT_FALLBACK_PATTERN],
      patterns_tried: [...deterministic.patterns_tried, GPT_FALLBACK_PATTERN],
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown GPT fallback error";
    log.warn({ recordingId, reason }, "query GPT fallback failed");
    return fallbackNotRun(deterministic, `GPT fallback failed: ${reason}`);
  }
}

function createOpenAiQueryFallbackAdapter(config: ReelinkConfig): QueryGptFallbackAdapter | null {
  if (!config.openAiApiKey) return null;

  const openai = createOpenAI({ apiKey: config.openAiApiKey });
  const modelId = config.openAiModel ?? DEFAULT_OPENAI_QUERY_MODEL;
  const model = openai.responses(modelId);

  return async (input) => {
    const result = await generateText({
      model,
      output: Output.object({ schema: GptFallbackOutputSchema }),
      messages: [
        {
          role: "system",
          content:
            "You are Reck query fallback. Answer only from the supplied Reck analysis, manifest, and runtime stream data. " +
            "If the supplied data does not support an answer, say exactly what evidence is missing. Do not infer from outside knowledge.",
        },
        {
          role: "user",
          content: buildGroundedPrompt(input),
        },
      ],
      experimental_telemetry: telemetryFor("reelink-query.gpt-fallback", {
        provider: "openai",
        model: modelId,
      }),
    });

    return result.output;
  };
}

function fallbackNotRun(deterministic: DeterministicQueryResponse, reason: string): DeterministicQueryResponse {
  return {
    ...deterministic,
    reason: `${deterministic.reason ?? "deterministic answer unavailable"}; ${GPT_FALLBACK_PATTERN} not run: ${reason}`,
    patterns_tried: [...deterministic.patterns_tried, `${GPT_FALLBACK_PATTERN}:not_run`],
  };
}

function buildGroundedPrompt(input: QueryGptFallbackInput): string {
  return JSON.stringify(
    {
      question: input.question,
      deterministic_result: {
        reason: input.deterministic.reason,
        patterns_tried: input.deterministic.patterns_tried,
      },
      analysis: {
        recording_id: input.analysis.recording_id,
        duration_sec: input.analysis.duration_sec,
        summary: input.analysis.summary,
        work_items: input.analysis.work_items,
        next_steps: input.analysis.next_steps,
      },
      manifest: {
        recording_id: input.manifest.recording_id,
        source_type: input.manifest.source_type,
        source_path: input.manifest.source_path,
        duration_sec: input.manifest.duration_sec,
        artifacts: input.manifest.artifacts,
        preprocessing: input.manifest.preprocessing,
        prod_build: input.manifest.prod_build,
        safety: input.manifest.safety,
      },
      streams: input.streams,
      required_output: {
        response: "short grounded answer",
        citations: ["analysis.summary", "analysis.work_items[0]", "manifest.streams.dom"],
      },
    },
    null,
    2,
  );
}
