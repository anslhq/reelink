/**
 * Slot extraction for deterministic v0.1 query (see docs/reelink-query-algorithm.md §2).
 * Model-free string parsing only.
 */

const TIMESTAMP_RE =
  /\b(?:(?<mm>\d{1,2}):(?<ss>\d{2}(?:\.\d+)?)|(?<sec>\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)?)\b/i;

export function parseTimestamp(value: string): number | null {
  const match = value.match(TIMESTAMP_RE);
  if (!match?.groups) return null;
  if (match.groups.sec) return Number(match.groups.sec);
  return Number(match.groups.mm) * 60 + Number(match.groups.ss);
}

export function extractSeverity(value: string): "high" | "medium" | "low" | null {
  const match = value.match(/\b(high|medium|low|critical|crit)\b/i);
  if (!match) return null;
  const severity = match[1]?.toLowerCase();
  if (severity === "critical" || severity === "crit") return "high";
  if (severity === "high" || severity === "medium" || severity === "low") return severity;
  return null;
}

/** Finding id after finding/bug/issue/work item, or bare id (second pattern). */
export function extractFindingId(value: string): string | null {
  const match =
    value.match(/\b(?:finding|bug|issue|work item)\s+(?<fid>[a-z][a-z0-9_-]*)\b/i) ?? value.match(/\b(?<fid>[a-z][a-z0-9_-]*)\b/i);
  return match?.groups?.fid ?? null;
}

export function typeAliases(type: string): string[] {
  const canonical = type.toLowerCase().trim().replace(/[\s_]+/g, "-");
  return [canonical, canonical.replace(/-/g, " "), canonical.replace(/-/g, "_")];
}
