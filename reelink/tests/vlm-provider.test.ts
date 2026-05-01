import { describe, expect, mock, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const generateText = mock(async () => ({
  output: {
    summary: "The transition flickers after navigation.",
    findings: [
      {
        ts: 1.5,
        type: "transition-flicker",
        severity: "high",
        title: "Route transition flickers",
        description: "The outgoing view briefly overlaps the incoming view.",
        confidence: 0.88,
      },
    ],
    next_steps: ["Inspect route transition state around navigation."],
  },
  usage: { inputTokens: 12, outputTokens: 34 },
}));

mock.module("ai", () => ({
  Output: {
    object: (value: unknown) => value,
  },
  generateText,
}));

mock.module("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: () => ({
    chat: (modelId: string) => ({ modelId }),
  }),
}));

mock.module("../src/vlm/catalog.js", () => ({
  PREFERRED_QWEN_VIDEO_MODEL_IDS: ["qwen/qwen3.6-flash", "qwen/qwen3.6-35b-a3b", "qwen/qwen3.6-plus"],
  classifyOpenRouterSelectionError: (error: unknown) => {
    if (!(error instanceof Error)) return "unknown";
    if (error.message.includes("Could not fetch the OpenRouter model catalog")) return "catalog_fetch";
    if (error.message.includes("was not found")) return "configured_missing";
    if (error.message.includes("does not accept raw video")) return "no_video_modality";
    if (error.message.includes("did not expose any Qwen model")) return "no_qwen_video";
    return "unknown";
  },
  parseOpenRouterModelsPayload: (payload: unknown) => {
    if (!payload || typeof payload !== "object" || !Array.isArray((payload as { data?: unknown }).data)) return [];
    return (payload as { data: Array<{ id?: unknown; architecture?: { input_modalities?: unknown } }> }).data.map((model) => ({
      id: typeof model.id === "string" ? model.id : "",
      inputModalities: Array.isArray(model.architecture?.input_modalities) ? model.architecture.input_modalities : [],
    }));
  },
  selectOpenRouterQwenVideoModel: async () => ({ id: "qwen/qwen3.6-flash", inputModalities: ["video", "text"] }),
  selectOpenRouterQwenVideoModelFromCatalog: (models: Array<{ id: string; inputModalities: string[] }>, configured?: string) => {
    const candidates = models.filter((model) => model.id.startsWith("qwen/") && model.inputModalities.includes("video"));
    if (configured) {
      const found = models.find((model) => model.id === configured);
      if (!found) throw new Error(`Configured OpenRouter model ${configured} was not found in the live OpenRouter catalog.`);
      if (!found.inputModalities.includes("video")) throw new Error(`Configured OpenRouter model ${configured} does not accept raw video.`);
      return found;
    }
    const preferred = ["qwen/qwen3.6-flash", "qwen/qwen3.6-35b-a3b", "qwen/qwen3.6-plus"]
      .map((id) => candidates.find((model) => model.id === id))
      .find(Boolean);
    if (preferred) return preferred;
    const first = candidates[0];
    if (!first) throw new Error("OpenRouter did not expose any Qwen model with video input modality.");
    return first;
  },
}));

const {
  PREFERRED_QWEN_VIDEO_MODEL_IDS,
  classifyOpenRouterSelectionError,
  parseOpenRouterModelsPayload,
  selectOpenRouterQwenVideoModelFromCatalog,
} = await import("../src/vlm/catalog.js");
const { mediaTypeForVideo } = await import("../src/vlm/media.js");
const { buildNativeVideoPrompt, classifyOpenRouterProviderError, prepareOpenRouterRawVideoModel } = await import("../src/vlm/openrouter.js");
const { analyzeFramesWithVlm } = await import("../src/vlm/router.js");
const { mapFindingsToWorkItems, mapModelAnalyzeOutputToWorkItems } = await import("../src/vlm/work-items.js");

describe("media type mapping", () => {
  test("maps common extensions to video MIME types", () => {
    expect(mediaTypeForVideo("/tmp/x.webm")).toBe("video/webm");
    expect(mediaTypeForVideo("CLIP.MOV")).toBe("video/quicktime");
    expect(mediaTypeForVideo("f.mp4")).toBe("video/mp4");
  });

  test("rejects unsupported extensions", () => {
    expect(() => mediaTypeForVideo("video.avi")).toThrow(/Unsupported video extension/);
  });
});

describe("OpenRouter catalog parsing", () => {
  test("extracts ids and input modalities", () => {
    const models = parseOpenRouterModelsPayload({
      data: [
        { id: "qwen/qwen3.6-flash", architecture: { input_modalities: ["video", "text"] } },
        { id: "other/x", architecture: {} },
      ],
    });
    expect(models).toEqual([
      { id: "qwen/qwen3.6-flash", inputModalities: ["video", "text"] },
      { id: "other/x", inputModalities: [] },
    ]);
  });

  test("returns empty array for malformed payloads", () => {
    expect(parseOpenRouterModelsPayload(null)).toEqual([]);
    expect(parseOpenRouterModelsPayload({})).toEqual([]);
    expect(parseOpenRouterModelsPayload({ data: "nope" })).toEqual([]);
  });
});

describe("Qwen video model selection from catalog", () => {
  const baseCatalog = [
    { id: "meta/llama", inputModalities: ["text"] },
    { id: "qwen/qwen3.6-flash", inputModalities: ["video", "text"] },
    { id: "qwen/qwen3.6-35b-a3b", inputModalities: ["video"] },
  ];

  test("uses configured model when present and video-capable", () => {
    const picked = selectOpenRouterQwenVideoModelFromCatalog(baseCatalog, "qwen/qwen3.6-35b-a3b");
    expect(picked.id).toBe("qwen/qwen3.6-35b-a3b");
  });

  test("prefers configured order over discovery order", () => {
    const reverseOrder = [
      { id: "qwen/qwen3.6-35b-a3b", inputModalities: ["video"] },
      { id: "qwen/qwen3.6-flash", inputModalities: ["video", "text"] },
    ];
    const picked = selectOpenRouterQwenVideoModelFromCatalog(reverseOrder);
    expect(picked.id).toBe("qwen/qwen3.6-flash");
  });

  test("throws when configured model is missing", () => {
    expect(() => selectOpenRouterQwenVideoModelFromCatalog(baseCatalog, "missing/model")).toThrow(/was not found/);
  });

  test("throws when configured model lacks video modality", () => {
    expect(() =>
      selectOpenRouterQwenVideoModelFromCatalog(
        [
          { id: "qwen/qwen3.6-flash", inputModalities: ["text"] },
        ],
        "qwen/qwen3.6-flash",
      ),
    ).toThrow(/does not accept raw video/);
  });

  test("falls back to first preferred id with video support", () => {
    const onlyPreferredSecond = [
      { id: "qwen/qwen-other", inputModalities: ["video"] },
      { id: "qwen/qwen3.6-flash", inputModalities: ["video"] },
    ];
    const picked = selectOpenRouterQwenVideoModelFromCatalog(onlyPreferredSecond);
    expect(picked.id).toBe("qwen/qwen3.6-flash");
  });

  test("falls back to any qwen/* with video modality", () => {
    const catalog = [{ id: "qwen/qwen-custom", inputModalities: ["video"] }];
    const picked = selectOpenRouterQwenVideoModelFromCatalog(catalog);
    expect(picked.id).toBe("qwen/qwen-custom");
  });

  test("throws when no qwen video models exist", () => {
    expect(() =>
      selectOpenRouterQwenVideoModelFromCatalog([{ id: "meta/llama", inputModalities: ["text"] }]),
    ).toThrow(/did not expose any Qwen model/);
  });

  test("preferred ids match router fallback ordering", () => {
    expect(PREFERRED_QWEN_VIDEO_MODEL_IDS).toEqual(["qwen/qwen3.6-flash", "qwen/qwen3.6-35b-a3b", "qwen/qwen3.6-plus"]);
  });
});

describe("OpenRouter selection error classification", () => {
  test("classifies known failures", () => {
    expect(classifyOpenRouterSelectionError(new Error("Could not fetch the OpenRouter model catalog"))).toBe("catalog_fetch");
    expect(classifyOpenRouterSelectionError(new Error("Configured OpenRouter model x was not found in the live OpenRouter catalog."))).toBe(
      "configured_missing",
    );
    expect(classifyOpenRouterSelectionError(new Error("model x does not accept raw video."))).toBe("no_video_modality");
    expect(classifyOpenRouterSelectionError(new Error("did not expose any Qwen model with video input modality"))).toBe("no_qwen_video");
    expect(classifyOpenRouterSelectionError(new Error("other"))).toBe("unknown");
    expect(classifyOpenRouterSelectionError(null)).toBe("unknown");
  });
});

describe("OpenRouter raw-video prompt", () => {
  test("uses the raw video file part as the primary media input", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "reelink-vlm-prompt-"));
    const path = join(workspace, "clip.mp4");
    writeFileSync(path, "fake video bytes");

    try {
      const content = buildNativeVideoPrompt(path, 2.5, "transitions");

      expect(content).toHaveLength(2);
      expect(content[0]).toMatchObject({ type: "text" });
      expect(content[1]).toMatchObject({
        type: "file",
        filename: "clip.mp4",
        mediaType: "video/mp4",
      });
      expect("image" in content[1]!).toBe(false);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});

describe("OpenRouter provider error classification", () => {
  test("classifies provider transport and output failures", () => {
    expect(classifyOpenRouterProviderError(new Error("network timeout while calling model"))).toBe("provider_unavailable");
    expect(classifyOpenRouterProviderError(new Error("generated object did not match schema"))).toBe("provider_output_invalid");
    expect(classifyOpenRouterProviderError(new Error("Configured OpenRouter model x was not found in the live OpenRouter catalog."))).toBe(
      "configured_missing",
    );
  });
});

describe("WorkItem mapping", () => {
  test("validates strict model JSON before mapping", () => {
    const items = mapModelAnalyzeOutputToWorkItems({
      summary: "ok",
      findings: [
        {
          ts: 4,
          type: "motion",
          severity: "medium",
          title: "Button jumps",
          description: "The button jumps during hover.",
          confidence: 0.8,
        },
      ],
      next_steps: ["Replay the hover"],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "f1", ts: 4, intent: "fix" });
    expect(() =>
      mapModelAnalyzeOutputToWorkItems({
        summary: "bad",
        findings: [{ ts: 1, type: "bad", severity: "critical", title: "t", description: "d", confidence: 0.5 }],
        next_steps: [],
      }),
    ).toThrow();
  });

  test("maps strict JSON findings to WorkItems with sequential ids", () => {
    const items = mapFindingsToWorkItems([
      {
        ts: 1,
        type: "bug",
        severity: "high",
        title: "t",
        description: "d",
        confidence: 0.9,
      },
      {
        ts: 2,
        type: "glitch",
        severity: "low",
        title: "t2",
        description: "d2",
        confidence: 0.5,
      },
    ]);
    expect(items.map((w) => w.id)).toEqual(["f1", "f2"]);
    expect(items[0]?.title).toBe("t");
    expect(items[1]?.severity).toBe("low");
  });

  test("drops null timestamps and preserves ordering for remaining items", () => {
    const dropped: number[] = [];
    const items = mapFindingsToWorkItems(
      [
        {
          ts: null,
          type: "a",
          severity: "medium",
          title: "gone",
          description: "d",
          confidence: 0.5,
        },
        {
          ts: 3,
          type: "b",
          severity: "low",
          title: "keep",
          description: "d",
          confidence: 0.6,
        },
      ],
      (idx) => dropped.push(idx),
    );
    expect(dropped).toEqual([0]);
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("f1");
    expect(items[0]?.ts).toBe(3);
    expect(items[0]?.title).toBe("keep");
  });
});

describe("OpenRouter provider paths", () => {
  test("prepareOpenRouterRawVideoModel returns null without a key", async () => {
    const cfg = {
      homeDir: "/tmp",
      configPath: "/tmp/c.json",
      defaultFpsSample: 4,
      copyImportedVideos: false,
    };
    await expect(prepareOpenRouterRawVideoModel(cfg)).resolves.toBeNull();
  });

  test("analyzeFramesWithVlm returns structured not-run result without a key", async () => {
    const cfg = {
      homeDir: "/tmp",
      configPath: "/tmp/c.json",
      defaultFpsSample: 4,
      copyImportedVideos: false,
    };
    const result = await analyzeFramesWithVlm({
      config: cfg,
      durationSec: 10,
      framePaths: ["/unused/frame.jpg"],
      focus: "ui",
      effectiveFps: 1,
      sourceVideoPath: "/would/use/raw.mp4",
    });
    expect(result.provider).toBe("none");
    expect(result.workItems).toEqual([]);
    expect(result.nextSteps.length).toBeGreaterThan(0);
    expect(result.summary).toContain("OPENROUTER_API_KEY");
  });

  test("analyzeFramesWithVlm maps a successful provider response without hosted credentials", async () => {
    generateText.mockClear();
    const workspace = await mkdtemp(join(tmpdir(), "reelink-vlm-success-"));
    const path = join(workspace, "clip.mp4");
    writeFileSync(path, "fake video bytes");

    try {
      const result = await analyzeFramesWithVlm({
        config: {
          homeDir: "/tmp",
          configPath: "/tmp/c.json",
          defaultFpsSample: 4,
          copyImportedVideos: false,
          openRouterApiKey: "test-key",
        },
        durationSec: 6,
        framePaths: ["/unused/frame.jpg"],
        focus: "navigation flicker",
        effectiveFps: 1,
        sourceVideoPath: path,
      });

      expect(generateText).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        provider: "openrouter",
        modelId: "qwen/qwen3.6-flash",
        route: "openrouter-native-video",
        inputModalities: ["video", "text"],
        routeFamily: "qwen-raw-video",
        summary: "The transition flickers after navigation.",
        nextSteps: ["Inspect route transition state around navigation."],
      });
      expect(result.workItems).toEqual([
        expect.objectContaining({
          id: "f1",
          ts: 1.5,
          type: "transition-flicker",
          severity: "high",
          title: "Route transition flickers",
          confidence: 0.88,
        }),
      ]);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
