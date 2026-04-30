import { existsSync, readFileSync } from "node:fs";

import { z } from "zod/v4";

const FileConfigSchema = z
  .object({
    default_fps_sample: z.number().positive().max(30).optional(),
    copy_imported_videos: z.boolean().optional(),
  })
  .passthrough();

/** Reads non-secret JSON from ~/.reelink/config.json - missing file returns {} */
export type UserFileConfig = {
  default_fps_sample?: number;
  copy_imported_videos?: boolean;
};

export function readUserConfigFile(path: string): UserFileConfig {
  if (!existsSync(path)) return {};
  return FileConfigSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}
