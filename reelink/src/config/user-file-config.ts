import { existsSync, readFileSync } from "node:fs";

import { z } from "zod/v4";

const FileConfigSchema = z
  .object({
    default_fps_sample: z.number().positive().max(30).optional(),
    copy_imported_videos: z.boolean().optional(),
  })
  .passthrough();

/** Reads non-secret JSON from ~/.reck/config.json - missing file returns {} */
export type UserFileConfig = {
  default_fps_sample?: number;
  copy_imported_videos?: boolean;
};

export function readUserConfigFile(path: string, legacyPath?: string): UserFileConfig {
  const readablePath = existsSync(path) ? path : legacyPath && existsSync(legacyPath) ? legacyPath : null;
  if (!readablePath) return {};
  return FileConfigSchema.parse(JSON.parse(readFileSync(readablePath, "utf8")));
}
