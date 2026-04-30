import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const INIT_BODY = `${JSON.stringify({ default_fps_sample: 4, copy_imported_videos: false }, null, 2)}\n`;

/**
 * Writes ~/.reelink/config.json once with non-secret defaults only (no secrets ever).
 * @param homeRoot - override user's home directory (for tests; default is `homedir()`)
 * @returns absolute path written
 */
export function writeInitialUserConfigFile(options?: { homeRoot?: string }): string {
  const root = options?.homeRoot ?? homedir();
  const home = join(root, ".reelink");
  const configPath = join(home, "config.json");
  mkdirSync(home, { recursive: true });
  writeFileSync(configPath, INIT_BODY, { flag: "wx" });
  return configPath;
}
