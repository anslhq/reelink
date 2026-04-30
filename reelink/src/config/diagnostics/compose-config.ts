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
];

const DEFAULT_FPS_SAMPLE = 4;
const DEFAULT_COPY_IMPORTED_VIDEOS = false;

/**
 * Build config after `loadDotEnv()` has run via `loadConfig()`.
 *
 * Precedence: defaults < ~/.reelink/config.json < dotenv-populated/process environment.
 * Secrets and model overrides are read only from environment (optionally set via dotenv files).
 *
 * @param options.homeRoot - Override user home directory (for tests). Defaults to `homedir()`.
 * @param options.env - Override environment map (for tests). Defaults to `process.env`.
 */
export function composeReelinkConfig(options?: { homeRoot?: string; env?: NodeJS.ProcessEnv }): ReelinkConfig {
  const root = options?.homeRoot ?? homedir();
  const env = options?.env ?? process.env;
  const homeDir = join(root, ".reelink");
  const configPath = join(homeDir, "config.json");
  const file = readUserConfigFile(configPath);

  return {
    homeDir,
    configPath,
    defaultFpsSample: readNumberEnv(env, "REELINK_DEFAULT_FPS_SAMPLE") ?? file.default_fps_sample ?? DEFAULT_FPS_SAMPLE,
    copyImportedVideos: readBooleanEnv(env, "REELINK_COPY_IMPORTED_VIDEOS") ?? file.copy_imported_videos ?? DEFAULT_COPY_IMPORTED_VIDEOS,
    openRouterApiKey: readEnv(env, "OPENROUTER_API_KEY"),
    lmStudioBaseUrl: readEnv(env, "LM_STUDIO_BASE_URL"),
    openRouterModel: readEnv(env, "REELINK_OPENROUTER_MODEL") ?? readEnv(env, "REELINK_VLM_MODEL"),
  };
}

function readEnv(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function readNumberEnv(env: NodeJS.ProcessEnv, name: string): number | undefined {
  const value = readEnv(env, name);
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function readBooleanEnv(env: NodeJS.ProcessEnv, name: string): boolean | undefined {
  const value = readEnv(env, name)?.toLowerCase();
  if (!value) return undefined;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return undefined;
}
