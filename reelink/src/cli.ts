#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { analyzeVideo } from "./analyze.js";
import { loadConfig } from "./config/env.js";
import { logger } from "./utils/logger.js";

const log = logger("cli");

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (isHelpCommand(command)) {
    printHelp();
    return;
  }

  const handler = commandHandlers[command];
  if (!handler) throw new Error(`Unknown command: ${command}`);
  await handler(rest);
}

const commandHandlers: Record<string, (args: string[]) => Promise<void> | void> = {
  analyze: analyzeCommand,
  init: initConfig,
  doctor,
  mcp: startMcpServer,
  server: startMcpServer,
};

function isHelpCommand(command: string | undefined): boolean {
  return !command || command === "help" || command === "--help" || command === "-h";
}

async function analyzeCommand(rest: string[]): Promise<void> {
  const path = rest[0];
  if (!path) throw new Error("Usage: reelink analyze <recording.mov> [focus]");
  const result = await analyzeVideo({ path: resolve(path), focus: rest[1] ?? "any" });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function startMcpServer(): Promise<void> {
  await import("./server.js");
}

function initConfig(): void {
  const home = join(homedir(), ".reelink");
  const configPath = join(home, "config.json");
  mkdirSync(home, { recursive: true });
  writeFileSync(configPath, `${JSON.stringify({ default_fps_sample: 4, copy_imported_videos: false }, null, 2)}\n`, {
    flag: "wx",
  });
  process.stdout.write(`Wrote ${configPath}\n`);
  process.stdout.write("Register this MCP command in your coding agent: reelink-mcp\n");
}

function doctor(): void {
  const config = loadConfig();
  const checks = [
    { name: "node", ok: Number(process.versions.node.split(".")[0]) >= 20, detail: process.versions.node },
    { name: "OPENROUTER_API_KEY", ok: Boolean(config.openRouterApiKey), detail: config.openRouterApiKey ? "set" : "missing" },
    { name: "config", ok: true, detail: config.configPath },
  ];

  for (const check of checks) {
    process.stdout.write(`${check.ok ? "ok" : "warn"} ${check.name}: ${check.detail}\n`);
  }
}

function printHelp(): void {
  process.stdout.write(`Reelink

Usage:
  reelink analyze <recording.mov> [focus]
  reelink init
  reelink doctor
  reelink mcp

MCP server bin:
  reelink-mcp
`);
}

main().catch((err) => {
  log.error(
    {
      err: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    },
    "cli failed",
  );
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
