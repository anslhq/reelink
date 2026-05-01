import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { CONFIG_PRECEDENCE, composeReelinkConfig } from "../src/config/diagnostics/compose-config.js";
import {
  CLAUDE_CODE_MCP_SNIPPET,
  CLINE_ROO_MCP_SNIPPET,
  CODEX_MCP_SNIPPET,
  CURSOR_MCP_SNIPPET,
  LOCAL_MCP_SNIPPET,
  VSCODE_COPILOT_MCP_SNIPPET,
  formatDoctorReportLines,
  runDoctorDiagnostics,
  writeInitialUserConfigFile,
} from "../src/config/diagnostics/index.js";
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
      { setting: "openAiApiKey", sources: ["environment", "dotenv"] },
      { setting: "openAiModel", sources: ["environment", "dotenv"] },
      { setting: "queryGptFallbackEnabled", sources: ["environment", "dotenv", "default"] },
    ]);
  });

  test("uses defaults when no user config file", async () => {
    const home = await mkdtemp(join(tmpdir(), "reck-home-empty-"));
    delete process.env.OPENROUTER_API_KEY;

    const config = composeReelinkConfig({ homeRoot: home });

    expect(config.homeDir).toBe(join(home, ".reck"));
    expect(config.defaultFpsSample).toBe(4);
    expect(config.copyImportedVideos).toBe(false);
    expect(config.openRouterApiKey).toBeUndefined();
    expect(readUserConfigFile(config.configPath)).toEqual({});
  });

  test("merges ~/.reck/config.json and resolves environment precedence", async () => {
    const home = await mkdtemp(join(tmpdir(), "reck-home-merge-"));
    const reelinkDir = join(home, ".reck");
    mkdirSync(reelinkDir, { recursive: true });
    writeFileSync(
      join(reelinkDir, "config.json"),
      `${JSON.stringify({ default_fps_sample: 8, copy_imported_videos: true }, null, 2)}\n`,
    );

    delete process.env.RECK_OPENROUTER_MODEL;
    delete process.env.RECK_VLM_MODEL;

    process.env.RECK_OPENROUTER_MODEL = "explicit-openrouter-model";
    process.env.RECK_DEFAULT_FPS_SAMPLE = "2";
    process.env.RECK_COPY_IMPORTED_VIDEOS = "false";
    const config = composeReelinkConfig({ homeRoot: home });

    expect(config.defaultFpsSample).toBe(2);
    expect(config.copyImportedVideos).toBe(false);
    expect(config.openRouterModel).toBe("explicit-openrouter-model");

    delete process.env.RECK_OPENROUTER_MODEL;
    delete process.env.RECK_DEFAULT_FPS_SAMPLE;
    delete process.env.RECK_COPY_IMPORTED_VIDEOS;

    process.env.RECK_VLM_MODEL = "fallback-vlm-model";
    const fallback = composeReelinkConfig({ homeRoot: home, env: { RECK_VLM_MODEL: "fallback-vlm-model" } });
    expect(fallback.defaultFpsSample).toBe(8);
    expect(fallback.copyImportedVideos).toBe(true);
    expect(fallback.openRouterModel).toBe("fallback-vlm-model");
    delete process.env.RECK_VLM_MODEL;
  });

  test("reads legacy config file only when primary Reck config is absent", async () => {
    const home = await mkdtemp(join(tmpdir(), "reck-home-legacy-file-"));
    const legacyDir = join(home, ".reelink");
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(join(legacyDir, "config.json"), JSON.stringify({ default_fps_sample: 7, copy_imported_videos: true }, null, 2) + "\n");

    const legacyOnly = composeReelinkConfig({ homeRoot: home, env: {} });
    expect(legacyOnly.configPath).toBe(join(home, ".reck", "config.json"));
    expect(legacyOnly.defaultFpsSample).toBe(7);
    expect(legacyOnly.copyImportedVideos).toBe(true);

    const reckDir = join(home, ".reck");
    mkdirSync(reckDir, { recursive: true });
    writeFileSync(join(reckDir, "config.json"), JSON.stringify({ default_fps_sample: 3, copy_imported_videos: false }, null, 2) + "\n");

    const currentWins = composeReelinkConfig({ homeRoot: home, env: {} });
    expect(currentWins.defaultFpsSample).toBe(3);
    expect(currentWins.copyImportedVideos).toBe(false);
  });

  test("prefers RECK env values over legacy REELINK env values", async () => {
    const home = await mkdtemp(join(tmpdir(), "reck-home-env-precedence-"));
    const config = composeReelinkConfig({
      homeRoot: home,
      env: {
        RECK_DEFAULT_FPS_SAMPLE: "5",
        REELINK_DEFAULT_FPS_SAMPLE: "9",
        RECK_COPY_IMPORTED_VIDEOS: "false",
        REELINK_COPY_IMPORTED_VIDEOS: "true",
        RECK_OPENROUTER_MODEL: "reck-model",
        REELINK_OPENROUTER_MODEL: "legacy-model",
        RECK_QUERY_GPT_FALLBACK: "true",
        REELINK_QUERY_GPT_FALLBACK: "false",
      },
    });

    expect(config.defaultFpsSample).toBe(5);
    expect(config.copyImportedVideos).toBe(false);
    expect(config.openRouterModel).toBe("reck-model");
    expect(config.queryGptFallbackEnabled).toBe(true);

    const legacyOnly = composeReelinkConfig({
      homeRoot: home,
      env: {
        REELINK_DEFAULT_FPS_SAMPLE: "9",
        REELINK_COPY_IMPORTED_VIDEOS: "true",
        REELINK_OPENROUTER_MODEL: "legacy-model",
        REELINK_QUERY_GPT_FALLBACK: "true",
      },
    });

    expect(legacyOnly.defaultFpsSample).toBe(9);
    expect(legacyOnly.copyImportedVideos).toBe(true);
    expect(legacyOnly.openRouterModel).toBe("legacy-model");
    expect(legacyOnly.queryGptFallbackEnabled).toBe(true);
  });
});

describe("writeInitialUserConfigFile", () => {
  test("writes only safe keys and rejects secrets persistence", async () => {
    const home = await mkdtemp(join(tmpdir(), "reck-init-"));

    const path = writeInitialUserConfigFile({ homeRoot: home });

    expect(path).toBe(join(home, ".reck", "config.json"));
    const json = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;

    expect(Object.keys(json)).toEqual(["default_fps_sample", "copy_imported_videos"]);
    expect(json).not.toHaveProperty("openRouterApiKey");
    expect(json).not.toHaveProperty("OPENROUTER_API_KEY");
    expect(json.default_fps_sample).toBe(4);
    expect(json.copy_imported_videos).toBe(false);
  });

  test("publishes production MCP snippets without embedding a real key", () => {
    expect(CODEX_MCP_SNIPPET).toContain('[mcp_servers.reck]');
    expect(CODEX_MCP_SNIPPET).toContain('command = "bunx"');
    expect(CODEX_MCP_SNIPPET).toContain('args = ["-y", "@anslai/reck", "mcp"]');
    expect(CODEX_MCP_SNIPPET).toContain('reck-mcp');
    expect(CURSOR_MCP_SNIPPET).toContain('"command": "bunx"');
    expect(CURSOR_MCP_SNIPPET).toContain('"args": ["-y", "@anslai/reck", "mcp"]');
    expect(LOCAL_MCP_SNIPPET).toContain('reck mcp');
    expect(LOCAL_MCP_SNIPPET).toContain('reck-mcp');
    for (const snippet of [CLAUDE_CODE_MCP_SNIPPET, CLINE_ROO_MCP_SNIPPET, VSCODE_COPILOT_MCP_SNIPPET]) {
      expect(snippet).toContain('"reck"');
      expect(snippet).toContain('"command": "bunx"');
      expect(snippet).toContain('"args": ["-y", "@anslai/reck", "mcp"]');
      expect(snippet).toContain('RECK_OPENROUTER_MODEL');
      expect(snippet).toContain('snippet-only');
      expect(snippet).not.toContain('sk-');
      expect(snippet).not.toContain('reelink');
    }
    expect(CODEX_MCP_SNIPPET).not.toContain("sk-");
    expect(CURSOR_MCP_SNIPPET).not.toContain("sk-");
    expect(CODEX_MCP_SNIPPET).not.toContain("cli.ts");
  });

  test("reruns safely and preserves existing non-secret config keys", async () => {
    const home = await mkdtemp(join(tmpdir(), "reck-init-rerun-"));
    const firstPath = writeInitialUserConfigFile({ homeRoot: home });
    writeFileSync(firstPath, `${JSON.stringify({ default_fps_sample: 8, custom_note: "keep" }, null, 2)}\n`);

    const secondPath = writeInitialUserConfigFile({ homeRoot: home });
    const json = JSON.parse(readFileSync(secondPath, "utf8")) as Record<string, unknown>;

    expect(secondPath).toBe(firstPath);
    expect(json).toEqual({ default_fps_sample: 8, copy_imported_videos: false, custom_note: "keep" });
    expect(json).not.toHaveProperty("OPENROUTER_API_KEY");
  });
});

describe("runDoctorDiagnostics", () => {
  function baseConfig(overrides: Partial<ReelinkConfig> = {}) {
    return {
      homeDir: "/tmp/.reck",
      configPath: "/tmp/.reck/config.json",
      defaultFpsSample: 4,
      copyImportedVideos: false,
      ...overrides,
    };
  }

  test("classifies node, API key, and config file", () => {
    const diagnostics = runDoctorDiagnostics(
      baseConfig({ openRouterApiKey: undefined, configPath: "/cfg/config.json" }),
      {
        nodeVersion: "20.10.1",
        configFileExists: false,
        packageResolution: "/repo/reelink/dist/server.js",
        playwrightChromiumInstalled: true,
        reactGrabResolvable: true,
        reactGrabInitialized: false,
        reactGrabVerified: false,
        codexConfigStatus: "missing",
      } satisfies DoctorRuntime,
    );

    const byId = Object.fromEntries(diagnostics.map((d) => [d.id, d])) as Record<string, DoctorDiagnostic>;

    expect(byId.node_version?.status).toBe("pass");
    expect(byId.bun_runtime?.status).toBe("pass");
    expect(byId.package_resolution?.status).toBe("pass");
    expect(byId.playwright_chromium?.status).toBe("pass");
    expect(byId.react_grab_installed?.status).toBe("pass");
    expect(byId.react_grab_initialized?.status).toBe("not_configured");
    expect(byId.react_grab_verified?.status).toBe("warn");
    expect(byId.openrouter_api_key?.status).toBe("not_configured");
    expect(byId.openrouter_model?.status).toBe("skipped");
    expect(byId.user_config_file?.status).toBe("not_configured");
    expect(byId.codex_mcp_config?.status).toBe("not_configured");
    expect(byId.self_hosted_qwen?.status).toBe("not_configured");
    expect(byId.node_version?.detail).not.toContain("MISSING_SECRET");
    expect(byId.openrouter_api_key?.detail).toBe("missing");
  });

  test("does not include secret values in doctor output", () => {
    const diagnostics = runDoctorDiagnostics(
      baseConfig({ openRouterApiKey: "MISSING_SECRET", openRouterModel: "qwen/test-video" }),
      {
        nodeVersion: "20.10.1",
        configFileExists: true,
        packageResolution: "/repo/reelink/dist/server.js",
        playwrightChromiumInstalled: true,
        reactGrabResolvable: true,
        reactGrabInitialized: true,
        reactGrabVerified: true,
        codexConfigStatus: "configured",
      } satisfies DoctorRuntime,
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
        packageResolution: null,
        playwrightChromiumInstalled: false,
        reactGrabResolvable: false,
        reactGrabInitialized: false,
        reactGrabVerified: false,
        codexConfigStatus: "configured",
      }),
    );
    expect(lines[0]).toMatch(/^warn node:/);
    expect(lines[1]).toMatch(/^warn bun:/);
    expect(lines[2]).toMatch(/^warn package:/);
    expect(lines[3]).toMatch(/^warn Playwright Chromium:/);
    expect(lines[4]).toMatch(/^warn React Grab installed:/);
    expect(lines[5]).toMatch(/^warn React Grab initialized:/);
    expect(lines[6]).toMatch(/^warn React Grab verified:/);
    expect(lines[7]).toMatch(/^ok OPENROUTER_API_KEY:/);
    expect(lines[8]).toMatch(/^warn OpenRouter model:/);
    expect(lines[9]).toMatch(/^ok config:/);
    expect(lines[10]).toMatch(/^ok Codex MCP config:/);
    expect(lines[11]).toMatch(/^warn self-hosted Qwen fallback:/);
  });
});
