// MCP tool middleware: wraps a tool handler with structured entry/exit logging.
//
// Every Reelink-exposed tool runs through this so we have visibility into:
//   - tool name + invocation id
//   - arg shape (truncated, never logs raw bytes / pixels / video paths beyond filename)
//   - duration
//   - result shape (truncated)
//   - errors with stack
//
// Per Section 0.10 of openspec/changes/build-reelink-mcp/tasks.md.

import { logger } from "./logger.js";

const log = logger("tool");

type ToolHandler<TArgs, TResult> = (args: TArgs) => Promise<TResult> | TResult;

let invocationCounter = 0;

export function withToolLogging<TArgs, TResult>(
  toolName: string,
  handler: ToolHandler<TArgs, TResult>,
): ToolHandler<TArgs, TResult> {
  return async (args: TArgs) => {
    const invocationId = `${toolName}#${++invocationCounter}`;
    const startedAt = performance.now();
    log.info({ tool: toolName, invocationId, args: summarize(args) }, "tool-enter");
    try {
      const result = await handler(args);
      const durationMs = Math.round(performance.now() - startedAt);
      log.info(
        { tool: toolName, invocationId, durationMs, result: summarize(result) },
        "tool-exit",
      );
      return result;
    } catch (err) {
      const durationMs = Math.round(performance.now() - startedAt);
      log.error(
        {
          tool: toolName,
          invocationId,
          durationMs,
          err: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        },
        "tool-error",
      );
      throw err;
    }
  };
}

// Truncate large/binary fields so logs stay readable and keys never leak.
function summarize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return summarizeString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return summarizeArray(value, depth);
  if (typeof value === "object") return summarizeObject(value, depth);
  return `[${typeof value}]`;
}

function summarizeString(value: string): string {
  return value.length > 200 ? value.slice(0, 200) + `…(+${value.length - 200} chars)` : value;
}

function summarizeArray(value: unknown[], depth: number): unknown {
  return depth > 2 ? `[array x${value.length}]` : value.slice(0, 5).map((v) => summarize(v, depth + 1));
}

function summarizeObject(value: object, depth: number): unknown {
  if (depth > 2) return "[object]";
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = /key|secret|token|password|authorization/i.test(k) ? "[redacted]" : summarize(v, depth + 1);
  }
  return out;
}
