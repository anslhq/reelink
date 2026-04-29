import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod/v4";

import { loadDotEnv } from "./dotenv.js";

const FileConfigSchema = z
  .object({
    default_fps_sample: z.number().positive().max(30).optional(),
    copy_imported_videos: z.boolean().optional(),
  })
  .passthrough();

export type ReelinkConfig = {
  homeDir: string;
  configPath: string;
  defaultFpsSample: number;
  copyImportedVideos: boolean;
  openRouterApiKey?: string;
  lmStudioBaseUrl?: string;
  openRouterModel?: string;
};

export function loadConfig(): ReelinkConfig {
  loadDotEnv();
  const homeDir = join(homedir(), ".reelink");
  const configPath = join(homeDir, "config.json");
  const fileConfig = readFileConfig(configPath);

  return {
    homeDir,
    configPath,
    defaultFpsSample: fileConfig.default_fps_sample ?? 4,
    copyImportedVideos: fileConfig.copy_imported_videos ?? false,
    openRouterApiKey: readEnv("OPENROUTER_API_KEY"),
    lmStudioBaseUrl: readEnv("LM_STUDIO_BASE_URL"),
    openRouterModel: readEnv("REELINK_OPENROUTER_MODEL") ?? readEnv("REELINK_VLM_MODEL"),
  };
}

function readFileConfig(path: string): { default_fps_sample?: number; copy_imported_videos?: boolean } {
  if (!existsSync(path)) return {};
  return FileConfigSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}
