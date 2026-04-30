import { existsSync } from "node:fs";

import type { DoctorDiagnostic, DoctorRuntime, ReelinkConfig } from "../types.js";

/** Classified configuration diagnostics. Does not persist or print secrets. */
export function runDoctorDiagnostics(config: ReelinkConfig, runtime?: DoctorRuntime): DoctorDiagnostic[] {
  const nodeVersion = runtime?.nodeVersion ?? process.versions.node;
  const checks: DoctorDiagnostic[] = [];

  const major = Number(nodeVersion.split(".")[0]);
  const nodeOk = Number.isFinite(major) && major >= 20;
  checks.push({
    id: "node_version",
    label: "node",
    status: nodeOk ? "pass" : "fail",
    detail: nodeVersion,
  });

  const bunVersion = runtime && "bunVersion" in runtime ? runtime.bunVersion : readBunVersion();
  checks.push({
    id: "bun_runtime",
    label: "bun",
    status: bunVersion ? "pass" : "warn",
    detail: bunVersion ? bunVersion : "not detected; use Bun to run local tests and scripts",
  });

  const hasKey = Boolean(config.openRouterApiKey);
  checks.push({
    id: "openrouter_api_key",
    label: "OPENROUTER_API_KEY",
    status: hasKey ? "pass" : "not_configured",
    detail: hasKey ? "set" : "missing",
  });

  checks.push({
    id: "openrouter_model",
    label: "OpenRouter model",
    status: classifyModelStatus(config, hasKey),
    detail: describeModelStatus(config, hasKey),
  });

  const configExists =
    runtime?.configFileExists !== undefined ? runtime.configFileExists : existsSync(config.configPath);

  checks.push({
    id: "user_config_file",
    label: "config",
    status: configExists ? "pass" : "not_configured",
    detail: configExists ? config.configPath : `${config.configPath} (file missing)`,
  });

  return checks;
}

function classifyModelStatus(config: ReelinkConfig, hasKey: boolean): DoctorDiagnostic["status"] {
  if (!hasKey) return "skipped";
  return config.openRouterModel ? "pass" : "warn";
}

function describeModelStatus(config: ReelinkConfig, hasKey: boolean): string {
  if (!hasKey) return "skipped until OPENROUTER_API_KEY is set";
  return config.openRouterModel ? config.openRouterModel : "using provider default model";
}

function readBunVersion(): string | null {
  const maybeBun = globalThis as typeof globalThis & { Bun?: { version?: string } };
  return maybeBun.Bun?.version ?? null;
}
