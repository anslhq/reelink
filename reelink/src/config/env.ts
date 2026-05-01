import { loadDotEnv } from "./dotenv.js";
import { composeReelinkConfig } from "./diagnostics/compose-config.js";

export type { ReelinkConfig } from "./types.js";

export function loadConfig(): import("./types.js").ReelinkConfig {
  loadDotEnv();
  return composeReelinkConfig();
}
