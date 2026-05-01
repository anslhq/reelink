import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

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

  const packageResolution = runtime && "packageResolution" in runtime ? runtime.packageResolution : resolvePackage();
  checks.push({
    id: "package_resolution",
    label: "package",
    status: packageResolution ? "pass" : "warn",
    detail: packageResolution
      ? "@anslai/reck package resolves; installed binaries are reck and reck-mcp"
      : "@anslai/reck package not resolvable from this process; production launch uses bunx -y @anslai/reck or installed reck; reck-mcp is the linked/local MCP binary",
  });

  const playwrightChromiumInstalled =
    runtime && "playwrightChromiumInstalled" in runtime
      ? runtime.playwrightChromiumInstalled
      : isPlaywrightChromiumInstalled();
  checks.push({
    id: "playwright_chromium",
    label: "Playwright Chromium",
    status: playwrightChromiumInstalled ? "pass" : "warn",
    detail: playwrightChromiumInstalled
      ? "installed"
      : "not detected; run bunx --bun playwright install chromium before browser recording",
  });

  const reactGrabResolvable = runtime && "reactGrabResolvable" in runtime ? runtime.reactGrabResolvable : isReactGrabResolvable();
  checks.push({
    id: "react_grab_installed",
    label: "React Grab installed",
    status: reactGrabResolvable ? "pass" : "warn",
    detail: reactGrabResolvable
      ? "installed: react-grab package resolves for browser component annotation"
      : "not installed: react-grab package not resolvable; run bun install before browser annotation capture",
  });

  const reactGrabInitialized = runtime && "reactGrabInitialized" in runtime ? runtime.reactGrabInitialized : readTargetBoolean("react_grab_initialized");
  checks.push({
    id: "react_grab_initialized",
    label: "React Grab initialized",
    status: reactGrabInitialized ? "pass" : "not_configured",
    detail: reactGrabInitialized
      ? "initialized: target metadata reports React Grab source setup"
      : "not initialized: run reck init in the target app to set up React source capture",
  });

  const reactGrabVerified = runtime && "reactGrabVerified" in runtime ? runtime.reactGrabVerified : readTargetBoolean("react_grab_verified") === true;
  checks.push({
    id: "react_grab_verified",
    label: "React Grab verified",
    status: reactGrabVerified ? "pass" : "warn",
    detail: reactGrabVerified
      ? "verified: browser capture evidence observed for this target"
      : "not verified: package resolution and source setup do not prove browser capture; run a real recording to verify",
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

  const codexConfigStatus = runtime?.codexConfigStatus ?? readCodexConfigStatus();
  checks.push({
    id: "codex_mcp_config",
    label: "Codex MCP config",
    status: codexConfigStatus === "configured" ? "pass" : codexConfigStatus === "missing" ? "not_configured" : "warn",
    detail:
      codexConfigStatus === "configured"
        ? "reck server block found"
        : "~/.codex/config.toml has no [mcp_servers.reck] block; run reck init and copy the Codex snippet",
  });

  const selfHostedConfigured = Boolean(config.lmStudioBaseUrl);
  checks.push({
    id: "self_hosted_qwen",
    label: "self-hosted Qwen fallback",
    status: selfHostedConfigured ? "pass" : "not_configured",
    detail: selfHostedConfigured ? "LM_STUDIO_BASE_URL set" : "not configured; hosted OpenRouter/Qwen remains the default path",
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

function resolvePackage(): string | null {
  try {
    return createRequire(import.meta.url).resolve("../../server.js");
  } catch {
    return null;
  }
}

function isPlaywrightChromiumInstalled(): boolean | null {
  try {
    const executablePath = createRequire(import.meta.url)("playwright").chromium.executablePath() as string;
    return existsSync(executablePath);
  } catch {
    return null;
  }
}

function isReactGrabResolvable(): boolean | null {
  try {
    createRequire(import.meta.url).resolve("react-grab/dist/index.global.js");
    return true;
  } catch {
    return null;
  }
}

function readTargetBoolean(key: string): boolean | null {
  const path = join(process.cwd(), ".reck", "target.json");
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const value = (parsed as Record<string, unknown>)[key];
    return typeof value === "boolean" ? value : null;
  } catch {
    return null;
  }
}

function readCodexConfigStatus(): "configured" | "missing" | "unknown" {
  const path = join(homedir(), ".codex", "config.toml");
  if (!existsSync(path)) return "missing";
  try {
    const contents = readFileSync(path, "utf8");
    return /\[mcp_servers\.reck]/.test(contents) ? "configured" : "missing";
  } catch {
    return "unknown";
  }
}
