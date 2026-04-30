import type { DoctorDiagnostic } from "../types.js";

/**
 * Stable CLI prefixes: legacy doctor used only `ok` and `warn` on stdout.
 */
function legacyPrefix(status: DoctorDiagnostic["status"]): "ok" | "warn" {
  switch (status) {
    case "pass":
    case "skipped":
      return "ok";
    case "warn":
    case "fail":
    case "not_configured":
      return "warn";
  }
}

export function formatDoctorReportLines(checks: DoctorDiagnostic[]): string[] {
  return checks.map((check) => `${legacyPrefix(check.status)} ${check.label}: ${check.detail}`);
}
