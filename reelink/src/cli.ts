#!/usr/bin/env node
import { resolve } from "node:path";
import { stdin as input } from "node:process";

import { analyzeVideo } from "./analyze.js";
import { BrowserRecordingModule } from "./browser-recording/lifecycle.js";
import { playwrightBrowserRecordingDriver } from "./browser-recording/playwright-driver.js";
import { loadConfig } from "./config/env.js";
import {
  CLAUDE_CODE_MCP_SNIPPET,
  CLINE_ROO_MCP_SNIPPET,
  CODEX_MCP_SNIPPET,
  CURSOR_MCP_SNIPPET,
  LOCAL_MCP_SNIPPET,
  VSCODE_COPILOT_MCP_SNIPPET,
  formatDoctorReportLines,
  initializeFrameworkTarget,
  runDoctorDiagnostics,
  writeInitialUserConfigFile,
} from "./config/diagnostics/index.js";
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
    usage: "reck analyze <recording.mov> [focus]",
    run: analyzeCommand,
  },
  init: {
    summary: "Create a default Reck config file.",
    usage: "reck init",
    run: initConfig,
  },
  doctor: {
    summary: "Check local Reck configuration.",
    usage: "reck doctor",
    run: doctor,
  },
  record: {
    summary: "Open a Chromium window at <url>, record video until ENTER or Ctrl+C.",
    usage: "reck record <url> [--out path.webm] [--max-seconds 60]",
    run: recordCommand,
  },
  mcp: {
    summary: "Start the MCP server.",
    usage: "reck mcp",
    run: startMcpServer,
  },
  server: {
    summary: "Start the MCP server.",
    usage: "reck server",
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
  if (!path) throw new Error("Usage: reck analyze <recording.mov> [focus]");
  const result = await analyzeVideo({ path: resolve(path), focus: args[1] ?? "any" });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function startMcpServer(): Promise<void> {
  await import("./server.js");
}

function initConfig(): void {
  const configPath = writeInitialUserConfigFile();
  const targetInspection = initializeFrameworkTarget(resolve(process.cwd()));
  process.stdout.write(`Wrote or updated ${configPath}\n`);
  process.stdout.write(`Initialized target ${resolve(process.cwd())}: ${targetInspection.framework}\n`);
  if (targetInspection.reactGrabInitMessage) {
    const changed = targetInspection.reactGrabInitChanged ? "updated" : "unchanged";
    process.stdout.write(`React Grab source setup ${changed}: ${targetInspection.reactGrabInitMessage}\n`);
    if (targetInspection.reactGrabInitFile) process.stdout.write(`React Grab source file: ${targetInspection.reactGrabInitFile}\n`);
  }
  process.stdout.write("\nCodex MCP config (~/.codex/config.toml):\n");
  process.stdout.write(`${CODEX_MCP_SNIPPET}\n`);
  process.stdout.write("Keep OPENROUTER_API_KEY in the agent env block or shell env only; Reck config never stores secrets.\n");
  process.stdout.write("For browser annotation capture, run bun install in local checkouts so react-grab is available.\n");
  process.stdout.write("\nCursor MCP config (~/.cursor/mcp.json) if needed:\n");
  process.stdout.write(CURSOR_MCP_SNIPPET);
  process.stdout.write("\nClaude Code MCP config (snippet-only):\n");
  process.stdout.write(CLAUDE_CODE_MCP_SNIPPET);
  process.stdout.write("\nCline/Roo MCP config (snippet-only):\n");
  process.stdout.write(CLINE_ROO_MCP_SNIPPET);
  process.stdout.write("\nVS Code Copilot MCP config (snippet-only):\n");
  process.stdout.write(VSCODE_COPILOT_MCP_SNIPPET);
  process.stdout.write("\n");
  process.stdout.write(LOCAL_MCP_SNIPPET);
}

function doctor(): void {
  const config = loadConfig();
  const diagnostics = runDoctorDiagnostics(config);
  for (const line of formatDoctorReportLines(diagnostics)) {
    process.stdout.write(`${line}\n`);
  }
}

type RecordOptions = { url: string; outPath?: string; maxSeconds: number };

function parseRecordArgs(args: string[]): RecordOptions {
  const url = args.find((arg) => !arg.startsWith("--"));
  if (!url) throw new Error("Usage: reck record <url> [--out path.webm] [--max-seconds 60]");
  const outArg = args[args.indexOf("--out") + 1];
  const maxArg = args[args.indexOf("--max-seconds") + 1];
  const outPath = args.includes("--out") && outArg ? resolve(outArg) : undefined;
  const maxSeconds = args.includes("--max-seconds") && maxArg ? Number(maxArg) : 60;
  if (!Number.isFinite(maxSeconds) || maxSeconds <= 0) throw new Error("--max-seconds must be a positive number");
  return { url, outPath, maxSeconds };
}

function waitForStop(maxSeconds: number): Promise<void> {
  return new Promise((done) => {
    let finished = false;
    const onSigint = () => {
      process.stderr.write("\nreck record: SIGINT received, stopping.\n");
      finish();
    };
    const onData = () => {
      process.stderr.write("reck record: ENTER received, stopping.\n");
      finish();
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      input.off("data", onData);
      process.off("SIGINT", onSigint);
      clearTimeout(timer);
      input.pause();
      done();
    };
    const timer = setTimeout(() => {
      process.stderr.write(`reck record: hit ${maxSeconds}s cap, stopping.\n`);
      finish();
    }, maxSeconds * 1000);
    process.once("SIGINT", onSigint);
    input.resume();
    input.setEncoding("utf8");
    input.once("data", onData);
  });
}

async function recordCommand({ args }: CommandContext): Promise<void> {
  const { url, outPath, maxSeconds } = parseRecordArgs(args);
  const browserRecording = new BrowserRecordingModule(playwrightBrowserRecordingDriver);
  process.stderr.write(`reck record: opening ${url}\n`);
  const started = await browserRecording.startRecording({ url, out_path: outPath, max_seconds: maxSeconds });

  process.stderr.write(`reck record: capturing. Reproduce the bug, then ENTER (or Ctrl+C). Auto-stops after ${maxSeconds}s.\n`);
  await waitForStop(maxSeconds);

  const stopped = await browserRecording.stopRecording(started.session_id, false);
  process.stderr.write(`reck record: saved ${stopped.path}\n`);
  process.stdout.write(`${stopped.path}\n`);
}

function printHelp(): void {
  process.stdout.write(`Reck

Usage:
${Object.values(commandHandlers)
  .map((handler) => `  ${handler.usage}`)
  .join("\n")}

Commands:
${Object.entries(commandHandlers)
  .map(([name, handler]) => `  ${name.padEnd(8)} ${handler.summary}`)
  .join("\n")}

MCP server bin:
  reck-mcp
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
