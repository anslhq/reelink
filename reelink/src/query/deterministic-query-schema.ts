import { z } from "zod/v4";

const QueryAnswerSchema = z.record(z.string(), z.unknown()).nullable();

export const QueryResponseSchema = z.object({
  recording_id: z.string(),
  question: z.string(),
  answer: QueryAnswerSchema,
  reason: z.string().optional(),
  patterns_matched: z.array(z.string()),
  patterns_tried: z.array(z.string()),
});

export type DeterministicQueryResponse = z.infer<typeof QueryResponseSchema>;
