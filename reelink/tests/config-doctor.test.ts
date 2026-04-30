import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CONFIG_PRECEDENCE, composeReelinkConfig } from "../src/config/diagnostics/compose-config.js";
import { formatDoctorReportLines, runDoctorDiagnostics, writeInitialUserConfigFile } from "../src/config/diagnostics/index.js";
import type { DoctorDiagnostic, DoctorRuntime, ReelinkConfig } from "../src/config/types.js";
import { readUserConfigFile } from "../src/config/user-file-config.js";

describe("composeReelinkConfig", () => {
  test("publishes explicit config precedence rules", () => {
    expect(CONFIG_PRECEDENCE).toEqual([
      { setting: "defaultFpsSample", sources: ["environment", "dotenv", "user_config", "default"] },
      { setting: "copyImportedVideos", sources: ["environment", "dotenv", "user_config", "default"] },
      { setting: "openRouterApiKey", sources: ["environment", "dotenv"] },
      { setting: "lmStudioBaseUrl", sources: ["environment", "dotenv"] },
      { setting: "openRouterModel", sources: ["environment", "dotenv"] },
    ]);
  });

  test("uses defaults when no user config file", async () => {
    const home = await mkdtemp(join(tmpdir(), "reelink-home-empty-"));
    delete process.env.OPENROUTER_API_KEY;

    const config = composeReelinkConfig({ homeRoot: home });

    expect(config.homeDir).toBe(join(home, ".reelink"));
    expect(config.defaultFpsSample).toBe(4);
    expect(config.copyImportedVideos).toBe(false);
    expect(config.openRouterApiKey).toBeUndefined();
    expect(readUserConfigFile(config.configPath)).toEqual({});
  });

  test("merges ~/.reelink/config.json and resolves environment precedence", async () => {
    const home = await mkdtemp(join(tmpdir(), "reelink-home-merge-"));
    const reelinkDir = join(home, ".reelink");
    mkdirSync(reelinkDir, { recursive: true });
    writeFileSync(
      join(reelinkDir, "config.json"),
      `${JSON.stringify({ default_fps_sample: 8, copy_imported_videos: true }, null, 2)}\n`,
    );

    delete process.env.REELINK_OPENROUTER_MODEL;
    delete process.env.REELINK_VLM_MODEL;

    process.env.REELINK_OPENROUTER_MODEL = "explicit-openrouter-model";
    process.env.REELINK_DEFAULT_FPS_SAMPLE = "2";
    process.env.REELINK_COPY_IMPORTED_VIDEOS = "false";
    const config = composeReelinkConfig({ homeRoot: home });

    expect(config.defaultFpsSample).toBe(2);
    expect(config.copyImportedVideos).toBe(false);
    expect(config.openRouterModel).toBe("explicit-openrouter-model");

    delete process.env.REELINK_OPENROUTER_MODEL;
    delete process.env.REELINK_DEFAULT_FPS_SAMPLE;
    delete process.env.REELINK_COPY_IMPORTED_VIDEOS;

    process.env.REELINK_VLM_MODEL = "fallback-vlm-model";
    const fallback = composeReelinkConfig({ homeRoot: home });
    expect(fallback.defaultFpsSample).toBe(8);
    expect(fallback.copyImportedVideos).toBe(true);
    expect(fallback.openRouterModel).toBe("fallback-vlm-model");
    delete process.env.REELINK_VLM_MODEL;
  });
});

describe("writeInitialUserConfigFile", () => {
  test("writes only safe keys and rejects secrets persistence", async () => {
    const home = await mkdtemp(join(tmpdir(), "reelink-init-"));

    const path = writeInitialUserConfigFile({ homeRoot: home });

    expect(path).toBe(join(home, ".reelink", "config.json"));
    const json = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;

    expect(Object.keys(json)).toEqual(["default_fps_sample", "copy_imported_videos"]);
    expect(json).not.toHaveProperty("openRouterApiKey");
    expect(json).not.toHaveProperty("OPENROUTER_API_KEY");
    expect(json.default_fps_sample).toBe(4);
    expect(json.copy_imported_videos).toBe(false);
  });
});

describe("runDoctorDiagnostics", () => {
  function baseConfig(overrides: Partial<ReelinkConfig> = {}) {
    return {
      homeDir: "/tmp/.reelink",
      configPath: "/tmp/.reelink/config.json",
      defaultFpsSample: 4,
      copyImportedVideos: false,
      ...overrides,
    };
  }

  test("classifies node, API key, and config file", () => {
    const diagnostics = runDoctorDiagnostics(
      baseConfig({ openRouterApiKey: undefined, configPath: "/cfg/config.json" }),
      { nodeVersion: "20.10.1", configFileExists: false } satisfies DoctorRuntime,
    );

    const byId = Object.fromEntries(diagnostics.map((d) => [d.id, d])) as Record<string, DoctorDiagnostic>;

    expect(byId.node_version?.status).toBe("pass");
    expect(byId.bun_runtime?.status).toBe("pass");
    expect(byId.openrouter_api_key?.status).toBe("not_configured");
    expect(byId.openrouter_model?.status).toBe("skipped");
    expect(byId.user_config_file?.status).toBe("not_configured");
    expect(byId.node_version?.detail).not.toContain("MISSING_SECRET");
    expect(byId.openrouter_api_key?.detail).toBe("missing");
  });

  test("does not include secret values in doctor output", () => {
    const diagnostics = runDoctorDiagnostics(
      baseConfig({ openRouterApiKey: "MISSING_SECRET", openRouterModel: "qwen/test-video" }),
      { nodeVersion: "20.10.1", configFileExists: true } satisfies DoctorRuntime,
    );

    expect(formatDoctorReportLines(diagnostics).join("\n")).not.toContain("MISSING_SECRET");
    expect(diagnostics.map((diagnostic) => diagnostic.detail).join("\n")).not.toContain("MISSING_SECRET");
  });

  test("warn path for legacy stdout when diagnostics are not passing", () => {
    const lines = formatDoctorReportLines(
      runDoctorDiagnostics(baseConfig({ openRouterApiKey: "x".repeat(8) }), {
        nodeVersion: "18.0.0",
        bunVersion: null,
        configFileExists: true,
      }),
    );
    expect(lines[0]).toMatch(/^warn node:/);
    expect(lines[1]).toMatch(/^warn bun:/);
    expect(lines[2]).toMatch(/^ok OPENROUTER_API_KEY:/);
    expect(lines[3]).toMatch(/^warn OpenRouter model:/);
    expect(lines[4]).toMatch(/^ok config:/);
  });
});
