#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { analyzeVideo } from "./analyze.js";
import { loadConfig } from "./config/env.js";
import { logger } from "./utils/logger.js";

const log = logger("cli");

type CommandContext = {
  args: string[];
  commandName: string;
};

type CommandHandler = {
  summary: string;
  usage: string;
  run: (context: CommandContext) => Promise<void> | void;
};

const commandHandlers = {
  analyze: {
    summary: "Analyze a recording and print JSON state.",
    usage: "reelink analyze <recording.mov> [focus]",
    run: analyzeCommand,
  },
  init: {
    summary: "Create a default Reelink config file.",
    usage: "reelink init",
    run: initConfig,
  },
  doctor: {
    summary: "Check local Reelink configuration.",
    usage: "reelink doctor",
    run: doctor,
  },
  record: {
    summary: "Record a browser session for later analysis.",
    usage: "reelink record",
    run: recordCommand,
  },
  mcp: {
    summary: "Start the MCP server.",
    usage: "reelink mcp",
    run: startMcpServer,
  },
  server: {
    summary: "Start the MCP server.",
    usage: "reelink server",
    run: startMcpServer,
  },
} satisfies Record<string, CommandHandler>;

type CommandName = keyof typeof commandHandlers;

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (isHelpCommand(command)) {
    printHelp();
    return;
  }

  const handler = resolveCommand(command);
  await handler.run({ args, commandName: command });
}

function isHelpCommand(command: string | undefined): command is undefined | "help" | "--help" | "-h" {
  return !command || command === "help" || command === "--help" || command === "-h";
}

function resolveCommand(command: string): CommandHandler {
  if (isCommandName(command)) return commandHandlers[command];
  throw new Error(`Unknown command: ${command}`);
}

function isCommandName(command: string): command is CommandName {
  return Object.prototype.hasOwnProperty.call(commandHandlers, command);
}

async function analyzeCommand({ args }: CommandContext): Promise<void> {
  const path = args[0];
  if (!path) throw new Error("Usage: reelink analyze <recording.mov> [focus]");
  const result = await analyzeVideo({ path: resolve(path), focus: args[1] ?? "any" });
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

function recordCommand(): void {
  process.stderr.write("reelink record is not implemented yet. Use your browser recorder workflow, then run `reelink analyze <recording.mov>`.\n");
  process.exitCode = 1;
}

function printHelp(): void {
  process.stdout.write(`Reelink

Usage:
${Object.values(commandHandlers)
  .map((handler) => `  ${handler.usage}`)
  .join("\n")}

Commands:
${Object.entries(commandHandlers)
  .map(([name, handler]) => `  ${name.padEnd(8)} ${handler.summary}`)
  .join("\n")}

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
