/** Full pattern id list for `patterns_tried` on unknown-question fallback (see docs/reelink-query-algorithm.md). */
export const PATTERN_IDS = [
  "finding_at_timestamp",
  "summary",
  "list_findings",
  "severity_findings",
  "next_steps",
  "frame_at_timestamp",
  "dom_at_timestamp",
  "components_at_timestamp",
  "type_findings",
  "finding_confidence",
  "available_streams",
  "prod_build",
  "finding_by_id",
  "recording_duration",
] as const;

export type PatternId = (typeof PATTERN_IDS)[number];
