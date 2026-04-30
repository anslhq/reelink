export type OpenRouterModelInfo = {
  id: string;
  inputModalities: string[];
};

/** Preference order when no explicit model is configured. Matches previous router behavior. */
export const PREFERRED_QWEN_VIDEO_MODEL_IDS: readonly string[] = [
  "qwen/qwen3.6-flash",
  "qwen/qwen3.6-35b-a3b",
  "qwen/qwen3.6-plus",
];

export function parseOpenRouterModelsPayload(data: unknown): OpenRouterModelInfo[] {
  if (!data || typeof data !== "object") return [];
  const record = data as { data?: unknown };
  const rows = record.data;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row): row is { id?: string; architecture?: { input_modalities?: string[] } } => Boolean(row && typeof row === "object"))
    .filter((model): model is { id: string; architecture?: { input_modalities?: string[] } } => typeof model.id === "string" && model.id.length > 0)
    .map((model) => ({
      id: model.id,
      inputModalities: model.architecture?.input_modalities ?? [],
    }));
}

export async function fetchOpenRouterModels(): Promise<OpenRouterModelInfo[]> {
  const response = await fetch("https://openrouter.ai/api/v1/models").catch(() => null);
  if (!response?.ok) {
    throw new Error("Could not fetch the OpenRouter model catalog to verify video input support.");
  }
  const data = (await response.json()) as unknown;
  return parseOpenRouterModelsPayload(data);
}

/**
 * Pick a Qwen model that accepts raw video, using configured preference when valid,
 * then known-good defaults, then any qwen/* with video modality.
 */
export function selectOpenRouterQwenVideoModelFromCatalog(
  models: OpenRouterModelInfo[],
  configuredModelId?: string,
): OpenRouterModelInfo {
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

  for (const preferred of PREFERRED_QWEN_VIDEO_MODEL_IDS) {
    const candidate = models.find((model) => model.id === preferred && model.inputModalities.includes("video"));
    if (candidate) return candidate;
  }

  const firstQwenVideo = models.find((model) => model.id.startsWith("qwen/") && model.inputModalities.includes("video"));
  if (firstQwenVideo) return firstQwenVideo;

  throw new Error(
    "OpenRouter catalog did not expose any Qwen model with video input modality. Reelink requires raw video input and will not silently fall back to frame prompts.",
  );
}

export async function selectOpenRouterQwenVideoModel(configuredModelId?: string): Promise<OpenRouterModelInfo> {
  const models = await fetchOpenRouterModels();
  return selectOpenRouterQwenVideoModelFromCatalog(models, configuredModelId);
}

/** Best-effort classification of selection/catalog failures for diagnostics and tests. */
export function classifyOpenRouterSelectionError(error: unknown): "catalog_fetch" | "configured_missing" | "no_video_modality" | "no_qwen_video" | "unknown" {
  if (!(error instanceof Error)) return "unknown";
  const msg = error.message;
  if (msg.includes("Could not fetch the OpenRouter model catalog")) return "catalog_fetch";
  if (msg.includes("was not found in the live OpenRouter catalog")) return "configured_missing";
  if (msg.includes("does not accept raw video")) return "no_video_modality";
  if (msg.includes("did not expose any Qwen model with video input modality")) return "no_qwen_video";
  return "unknown";
}
