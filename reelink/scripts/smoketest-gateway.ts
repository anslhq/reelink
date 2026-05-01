// Gateway model-path smoke test.
// Verifies AI SDK v6 + OpenRouter Qwen VL path works end-to-end.
// Requires OPENROUTER_API_KEY in env.
//
// Test plan:
//   1. Send one demo-recordings/* video file directly to Qwen via OpenRouter.
//   2. Parse the structured-output JSON response (generateText + Output.object).
//   3. Log latency, token counts, finding shape.

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output, type ModelMessage } from "ai";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod/v4";
import { logger } from "../src/utils/logger.js";
import { telemetryFor } from "../src/gateway/telemetry.js";
import { loadDotEnv } from "../src/config/dotenv.js";

loadDotEnv();

const log = logger("smoketest-gateway");
const MODEL_ID = process.env["RECK_OPENROUTER_MODEL"] ?? process.env["REELINK_OPENROUTER_MODEL"] ?? "qwen/qwen3.6-flash";

await assertOpenRouterVideoModel(MODEL_ID);

const apiKey = process.env["OPENROUTER_API_KEY"];
if (!apiKey) {
  log.error({}, "OPENROUTER_API_KEY not set in env");
  process.exit(1);
}

const recordingsDir = join(process.cwd(), "demo-recordings");
if (!existsSync(recordingsDir)) {
  log.error({ recordingsDir }, "demo-recordings/ does not exist");
  process.exit(1);
}
const recordings = readdirSync(recordingsDir)
  .filter((f) => /\.(mov|mp4|webm)$/i.test(f))
  .sort((a, b) => statSync(join(recordingsDir, b)).mtimeMs - statSync(join(recordingsDir, a)).mtimeMs);
if (recordings.length === 0) {
  log.error(
    { recordingsDir },
    "no .mov/.mp4/.webm recordings under demo-recordings/ - record one first before running this smoke test",
  );
  process.exit(1);
}

const sourceVideo = join(recordingsDir, recordings[0]!);
const mediaParts: Extract<ModelMessage, { role: "user" }>["content"] extends Array<infer T> ? T[] : never = [
  {
    type: "text",
    text: "You are a QA engineer reviewing browser UI screen-recording evidence. Identify visible UI bugs: layout breaks, overlap, missing elements, text contrast, flicker, stuck loading, error states, transition glitches. Return strict JSON. If no bug is visible, set bug_detected=false, ts=null, type=\"none\", severity=\"low\", and explain briefly.",
  },
];

const videoBytes = readFileSync(sourceVideo);
mediaParts.push({
  type: "file",
  data: videoBytes,
  filename: sourceVideo.split("/").at(-1),
  mediaType: mediaTypeForVideo(sourceVideo),
});
log.info({ source: sourceVideo, bytes: videoBytes.length, model: MODEL_ID }, "using native video input for smoke test");

const openrouter = createOpenRouter({ apiKey });

const FindingSchema = z.object({
  bug_detected: z.boolean().describe("Whether a visible UI bug is present in the frame."),
  ts: z.number().min(0).nullable().describe("Timestamp in seconds. Use null when no bug is visible."),
  type: z.string().describe("Short bug category, or 'none' when no bug is visible."),
  severity: z.enum(["low", "medium", "high"]).describe("Severity of the visible issue."),
  description: z.string().describe("One concise sentence explaining the evidence."),
  confidence: z.number().min(0).max(1).describe("Confidence score between 0 and 1."),
});

const startedAt = performance.now();
try {
  const result = await generateStructuredFinding();
  logPass({
    latency_ms: Math.round(performance.now() - startedAt),
    input_tokens: result.usage?.inputTokens,
    output_tokens: result.usage?.outputTokens,
    finding: normalizeFinding(result.finding),
    mode: result.mode,
  });
  process.exit(0);
} catch (err) {
  if (isNoOutputGeneratedError(err)) {
    log.warn(
      { latency_ms: Math.round(performance.now() - startedAt), err: errorMessage(err) },
      "structured output produced no object; retrying with plain JSON validation",
    );
    try {
      const result = await generatePlainJsonFinding();
      logPass({
        latency_ms: Math.round(performance.now() - startedAt),
        input_tokens: result.usage?.inputTokens,
        output_tokens: result.usage?.outputTokens,
        finding: normalizeFinding(result.finding),
        mode: result.mode,
      });
      process.exit(0);
    } catch (fallbackErr) {
      logFailure(fallbackErr, startedAt);
      process.exit(1);
    }
  }
  logFailure(err, startedAt);
  process.exit(1);
}

type Finding = z.infer<typeof FindingSchema>;

type FindingSmokeResult = {
  finding: Finding;
  usage?: { inputTokens?: number; outputTokens?: number };
  mode: "structured-output" | "plain-json";
};

async function generateStructuredFinding(): Promise<FindingSmokeResult> {
  const result = await generateText({
    model: openrouter.chat(MODEL_ID, { plugins: [{ id: "response-healing" }] }),
    output: Output.object({ schema: FindingSchema }),
    messages: [
      {
        role: "user",
        content: mediaParts,
      },
    ],
    experimental_telemetry: telemetryFor("smoketest.vlm-call", {
      model: MODEL_ID,
      provider: "openrouter",
      mode: "structured-output",
    }),
  });
  return { finding: result.output, usage: result.usage, mode: "structured-output" };
}

async function generatePlainJsonFinding(): Promise<FindingSmokeResult> {
  const result = await generateText({
    model: openrouter.chat(MODEL_ID, { plugins: [{ id: "response-healing" }] }),
    messages: [
      {
        role: "user",
        content: [
          ...mediaParts,
          {
            type: "text",
            text: "Return only a single JSON object with keys bug_detected, ts, type, severity, description, confidence. No markdown fences.",
          },
        ],
      },
    ],
    experimental_telemetry: telemetryFor("smoketest.vlm-call", {
      model: MODEL_ID,
      provider: "openrouter",
      mode: "plain-json-retry",
    }),
  });
  return { finding: parseFindingJson(result.text), usage: result.usage, mode: "plain-json" };
}

function parseFindingJson(text: string): Finding {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("```") ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "") : trimmed;
  return FindingSchema.parse(JSON.parse(jsonText));
}

function normalizeFinding(finding: Finding): Finding {
  return finding.bug_detected ? finding : { ...finding, ts: null };
}

function logPass(result: {
  latency_ms: number;
  input_tokens?: number;
  output_tokens?: number;
  finding: Finding;
  mode: FindingSmokeResult["mode"];
}): void {
  log.info(result, "smoke test PASS — model returned valid JSON");
}

function logFailure(err: unknown, startedAt: number): void {
  log.error(
    {
      latency_ms: Math.round(performance.now() - startedAt),
      err: errorMessage(err),
      stack: err instanceof Error ? err.stack?.slice(0, 1000) : undefined,
    },
    "smoke test FAIL",
  );
}

function isNoOutputGeneratedError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === "AI_NoOutputGeneratedError" || err.message.includes("No output generated");
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function mediaTypeForVideo(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".mp4")) return "video/mp4";
  throw new Error(`Unsupported video extension for raw-video smoke test: ${path}`);
}

async function assertOpenRouterVideoModel(modelId: string): Promise<void> {
  const response = await fetch("https://openrouter.ai/api/v1/models").catch(() => null);
  if (!response?.ok) {
    throw new Error("Could not fetch the OpenRouter model catalog to verify video input support.");
  }

  const data = (await response.json()) as {
    data?: Array<{ id?: string; architecture?: { input_modalities?: string[] } }>;
  };
  const model = (data.data ?? []).find((candidate) => candidate.id === modelId);
  if (!model) {
    throw new Error(`Configured OpenRouter model ${modelId} was not found in the live OpenRouter catalog.`);
  }
  const modalities = model.architecture?.input_modalities ?? [];
  if (!modalities.includes("video")) {
    throw new Error(
      `Configured OpenRouter model ${modelId} does not accept raw video. Its input modalities are: ${modalities.join(", ") || "unknown"}. Use qwen/qwen3.6-flash or another OpenRouter Qwen route with video input.`,
    );
  }
}
