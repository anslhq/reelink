#!/usr/bin/env node
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { stdin as input } from "node:process";

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
    summary: "Open a Chromium window at <url>, record video until ENTER or Ctrl+C.",
    usage: "reelink record <url> [--out path.webm] [--max-seconds 60]",
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

type RecordOptions = { url: string; outPath: string; maxSeconds: number };

function parseRecordArgs(args: string[]): RecordOptions {
  const url = args.find((arg) => !arg.startsWith("--"));
  if (!url) throw new Error("Usage: reelink record <url> [--out path.webm] [--max-seconds 60]");
  const outArg = args[args.indexOf("--out") + 1];
  const maxArg = args[args.indexOf("--max-seconds") + 1];
  const outPath = args.includes("--out") && outArg ? resolve(outArg) : resolve(`demo-recordings/reelink-${Date.now()}.webm`);
  const maxSeconds = args.includes("--max-seconds") && maxArg ? Number(maxArg) : 60;
  if (!Number.isFinite(maxSeconds) || maxSeconds <= 0) throw new Error("--max-seconds must be a positive number");
  return { url, outPath, maxSeconds };
}

function waitForStop(maxSeconds: number): Promise<void> {
  return new Promise((done) => {
    const finish = () => {
      input.removeAllListeners("data");
      clearTimeout(timer);
      done();
    };
    const timer = setTimeout(() => {
      process.stderr.write(`reelink record: hit ${maxSeconds}s cap, stopping.\n`);
      finish();
    }, maxSeconds * 1000);
    process.once("SIGINT", () => {
      process.stderr.write("\nreelink record: SIGINT received, stopping.\n");
      finish();
    });
    input.resume();
    input.setEncoding("utf8");
    input.once("data", () => {
      process.stderr.write("reelink record: ENTER received, stopping.\n");
      finish();
    });
  });
}

async function recordCommand({ args }: CommandContext): Promise<void> {
  const { url, outPath, maxSeconds } = parseRecordArgs(args);
  const recDir = resolve("demo-recordings");
  mkdirSync(recDir, { recursive: true });
  mkdirSync(resolve(outPath, ".."), { recursive: true });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: recDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  process.stderr.write(`reelink record: opening ${url}\n`);
  await page.goto(url, { waitUntil: "domcontentloaded" }).catch((err) => {
    process.stderr.write(`reelink record: nav warning: ${err instanceof Error ? err.message : String(err)}\n`);
  });

  process.stderr.write(`reelink record: capturing. Reproduce the bug, then ENTER (or Ctrl+C). Auto-stops after ${maxSeconds}s.\n`);
  await waitForStop(maxSeconds);

  const video = page.video();
  await context.close();
  await browser.close();

  const tmpPath = await video?.path();
  if (!tmpPath || !existsSync(tmpPath)) throw new Error("Playwright did not write a video artifact");
  renameSync(tmpPath, outPath);
  process.stderr.write(`reelink record: saved ${outPath}\n`);
  process.stdout.write(`${outPath}\n`);
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
