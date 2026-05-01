import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Loads `.env.local` first, then `.env`, under `cwd`. Uses `??=` so entries already present
 * in `process.env` (including nested order between the two files) are never overwritten by files.
 */
export function loadDotEnv(cwd = process.cwd()): void {
  for (const filename of [".env.local", ".env"]) {
    const path = join(cwd, filename);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const entry = parseDotEnvLine(line);
      if (!entry) continue;
      process.env[entry.key] ??= entry.value;
    }
  }
}

export function parseDotEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const assignment = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trimStart() : trimmed;
  const separator = assignment.indexOf("=");
  if (separator <= 0) return null;
  const key = assignment.slice(0, separator).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;
  const value = unquoteEnvValue(assignment.slice(separator + 1).trim());
  return { key, value };
}

function unquoteEnvValue(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  const commentStart = value.search(/\s+#/);
  return commentStart === -1 ? value : value.slice(0, commentStart).trimEnd();
}
