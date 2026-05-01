import { z } from "zod/v4";

import type { WorkItem } from "../schemas.js";

export const ModelAnalyzeSchema = z.object({
  summary: z.string(),
  findings: z.array(
    z.object({
      ts: z.number().min(0).nullable(),
      type: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      title: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  next_steps: z.array(z.string()),
});

export type ModelAnalyzeOutput = z.infer<typeof ModelAnalyzeSchema>;

export function mapModelAnalyzeOutputToWorkItems(
  output: unknown,
  onNullTimestamp?: (index: number, type: string) => void,
): WorkItem[] {
  return mapFindingsToWorkItems(ModelAnalyzeSchema.parse(output).findings, onNullTimestamp);
}

export function mapFindingsToWorkItems(
  findings: ModelAnalyzeOutput["findings"],
  onNullTimestamp?: (index: number, type: string) => void,
): WorkItem[] {
  return findings
    .filter((finding, index) => {
      if (finding.ts == null) {
        onNullTimestamp?.(index, finding.type);
        return false;
      }
      return true;
    })
    .map((finding, index) => ({
      id: `f${index + 1}`,
      ts: finding.ts as number,
      type: finding.type,
      severity: finding.severity,
      title: finding.title,
      confidence: finding.confidence,
      description: finding.description,
      state: "detected" as const,
      approval_state: "pending" as const,
      routed_to: null,
      completed_at: null,
      source: "video" as const,
      intent: "fix" as const,
    }));
}
