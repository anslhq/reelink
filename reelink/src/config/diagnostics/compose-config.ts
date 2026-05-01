import { homedir } from "node:os";
import { join } from "node:path";

import type { ConfigPrecedenceRule, ReelinkConfig } from "../types.js";
import { readUserConfigFile } from "../user-file-config.js";

export const CONFIG_PRECEDENCE: readonly ConfigPrecedenceRule[] = [
  { setting: "defaultFpsSample", sources: ["environment", "dotenv", "user_config", "default"] },
  { setting: "copyImportedVideos", sources: ["environment", "dotenv", "user_config", "default"] },
  { setting: "openRouterApiKey", sources: ["environment", "dotenv"] },
  { setting: "lmStudioBaseUrl", sources: ["environment", "dotenv"] },
  { setting: "openRouterModel", sources: ["environment", "dotenv"] },
  { setting: "openAiApiKey", sources: ["environment", "dotenv"] },
  { setting: "openAiModel", sources: ["environment", "dotenv"] },
  { setting: "queryGptFallbackEnabled", sources: ["environment", "dotenv", "default"] },
];

const DEFAULT_FPS_SAMPLE = 4;
const DEFAULT_COPY_IMPORTED_VIDEOS = false;
const DEFAULT_QUERY_GPT_FALLBACK_ENABLED = false;

/**
 * Build config after `loadDotEnv()` has run via `loadConfig()`.
 *
 * Precedence: defaults < ~/.reck/config.json < dotenv-populated/process environment.
 * Secrets and model overrides are read only from environment (optionally set via dotenv files).
 *
 * @param options.homeRoot - Override user home directory (for tests). Defaults to `homedir()`.
 * @param options.env - Override environment map (for tests). Defaults to `process.env`.
 */
export function composeReelinkConfig(options?: { homeRoot?: string; env?: NodeJS.ProcessEnv }): ReelinkConfig {
  const root = options?.homeRoot ?? homedir();
  const env = options?.env ?? process.env;
  const homeDir = join(root, ".reck");
  const configPath = join(homeDir, "config.json");
  const legacyConfigPath = join(root, ".reelink", "config.json");
  const file = readUserConfigFile(configPath, legacyConfigPath);

  return {
    homeDir,
    configPath,
    defaultFpsSample: readNumberEnv(env, "RECK_DEFAULT_FPS_SAMPLE", "REELINK_DEFAULT_FPS_SAMPLE") ?? file.default_fps_sample ?? DEFAULT_FPS_SAMPLE,
    copyImportedVideos: readBooleanEnv(env, "RECK_COPY_IMPORTED_VIDEOS", "REELINK_COPY_IMPORTED_VIDEOS") ?? file.copy_imported_videos ?? DEFAULT_COPY_IMPORTED_VIDEOS,
    openRouterApiKey: readEnv(env, "OPENROUTER_API_KEY"),
    lmStudioBaseUrl: readEnv(env, "LM_STUDIO_BASE_URL"),
    openRouterModel: readEnv(env, "RECK_OPENROUTER_MODEL", "REELINK_OPENROUTER_MODEL") ?? readEnv(env, "RECK_VLM_MODEL", "REELINK_VLM_MODEL"),
    openAiApiKey: readEnv(env, "OPENAI_API_KEY"),
    openAiModel: readEnv(env, "RECK_OPENAI_QUERY_MODEL", "REELINK_OPENAI_QUERY_MODEL"),
    queryGptFallbackEnabled: readBooleanEnv(env, "RECK_QUERY_GPT_FALLBACK", "REELINK_QUERY_GPT_FALLBACK") ?? DEFAULT_QUERY_GPT_FALLBACK_ENABLED,
  };
}

function readEnv(env: NodeJS.ProcessEnv, name: string, legacyName?: string): string | undefined {
  const value = readNamedEnv(env, name);
  return value ?? (legacyName ? readNamedEnv(env, legacyName) : undefined);
}

function readNamedEnv(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function readNumberEnv(env: NodeJS.ProcessEnv, name: string, legacyName?: string): number | undefined {
  const value = readEnv(env, name, legacyName);
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function readBooleanEnv(env: NodeJS.ProcessEnv, name: string, legacyName?: string): boolean | undefined {
  const value = readEnv(env, name, legacyName)?.toLowerCase();
  if (!value) return undefined;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return undefined;
}
