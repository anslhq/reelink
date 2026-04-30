export type AnalysisFailureKind =
  | "unsupported_extension"
  | "storage_failure"
  | "preprocessing_failure"
  | "missing_api_key"
  | "provider_unavailable"
  | "provider_output_invalid"
  | "provider_failure";

export class AnalysisPipelineError extends Error {
  constructor(
    readonly kind: AnalysisFailureKind,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "AnalysisPipelineError";
  }
}

/** Maps thrown provider errors to a stable failure kind without changing HTTP-facing behavior (still thrown Error). */
export function classifyProviderFailure(error: unknown): AnalysisFailureKind {
  if (error instanceof AnalysisPipelineError) return error.kind;
  if (!(error instanceof Error)) return "provider_failure";

  const message = error.message.toLowerCase();
  if (message.includes("openrouter_api_key") || message.includes("api key")) return "missing_api_key";
  if (
    message.includes("schema") ||
    message.includes("json") ||
    message.includes("object") ||
    message.includes("validation") ||
    message.includes("parse") ||
    message.includes("zod")
  ) {
    return "provider_output_invalid";
  }
  if (
    message.includes("catalog") ||
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("enotfound")
  ) {
    return "provider_unavailable";
  }
  return "provider_failure";
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
