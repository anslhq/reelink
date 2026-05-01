import { runLayer0AnalysisPipeline } from "./analysis/pipeline.js";
import { AnalyzeArgsSchema, type AnalyzeResult } from "./schemas.js";

export async function analyzeVideo(rawArgs: unknown): Promise<AnalyzeResult> {
  const args = AnalyzeArgsSchema.parse(rawArgs);
  return runLayer0AnalysisPipeline(args);
}

