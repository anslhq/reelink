// Reck structured logger.
//
// Stdio MCP mode FORBIDS stdout writes (corrupts JSON-RPC). All logs go to stderr.
// In dev (RECK_LOG_PRETTY=1), pino-pretty is wired transport-side for readable output.
// In production / hackathon demo mode, raw JSON lines go to stderr; downstream tools tail them.
//
// Per Section 0.10 of openspec/changes/build-reelink-mcp/tasks.md.

import pino, { type Logger as PinoLogger, type LoggerOptions } from "pino";

type ReelinkLogger = PinoLogger;

const LEVEL_FROM_ENV = process.env["RECK_LOG_LEVEL"] ?? process.env["REELINK_LOG_LEVEL"] ?? "info";
const PRETTY = (process.env["RECK_LOG_PRETTY"] ?? process.env["REELINK_LOG_PRETTY"]) === "1";

function buildOptions(): LoggerOptions {
  const base: LoggerOptions = {
    level: LEVEL_FROM_ENV,
    base: {
      // Tag every line with the package version + a process-id so multi-process tail makes sense
      pkg: "reck",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label: string) => ({ level: label }),
    },
  };

  if (PRETTY) {
    base.transport = {
      target: "pino-pretty",
      options: {
        // pino-pretty must also write to stderr; default writes to stdout which corrupts MCP
        destination: 2,
        colorize: true,
        translateTime: "SYS:HH:MM:ss.l",
        ignore: "pkg,pid,hostname",
      },
    };
  }

  return base;
}

const root: ReelinkLogger = pino(
  buildOptions(),
  PRETTY ? undefined : pino.destination({ fd: 2, sync: false }),
);

export function logger(component: string): ReelinkLogger {
  return root.child({ component });
}
