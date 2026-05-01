// MCP tool middleware: wraps a tool handler with structured entry/exit logging.
//
// Every Reck-exposed tool runs through this so we have visibility into:
//   - tool name + invocation id
//   - arg shape (truncated, never logs raw bytes / pixels / video paths beyond filename)
//   - duration
//   - result shape (truncated)
//   - errors with stack
//
// Per Section 0.10 of openspec/changes/build-reelink-mcp/tasks.md.

import { logger } from "./logger.js";

const log = logger("tool");
const REDACTED = "[redacted]";
const STRING_PREVIEW_LENGTH = 200;
const ARRAY_PREVIEW_LENGTH = 5;
const MAX_DEPTH = 2;

type ToolHandler<TArgs, TResult> = (args: TArgs) => Promise<TResult> | TResult;

let invocationCounter = 0;

export function withToolLogging<TArgs, TResult>(
  toolName: string,
  handler: ToolHandler<TArgs, TResult>,
): ToolHandler<TArgs, TResult> {
  return async (args: TArgs) => {
    const invocationId = `${toolName}#${++invocationCounter}`;
    const startedAt = performance.now();
    log.info({ tool: toolName, invocationId, args: summarizeForToolLog(args) }, "tool-enter");
    try {
      const result = await handler(args);
      const durationMs = Math.round(performance.now() - startedAt);
      log.info(
        { tool: toolName, invocationId, durationMs, result: summarizeForToolLog(result) },
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
export function summarizeForToolLog(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return summarizeString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return summarizeArray(value, depth);
  if (typeof value === "object") return summarizeObject(value, depth);
  return `[${typeof value}]`;
}

function summarizeString(value: string): string {
  return value.length > STRING_PREVIEW_LENGTH
    ? value.slice(0, STRING_PREVIEW_LENGTH) + `…(+${value.length - STRING_PREVIEW_LENGTH} chars)`
    : value;
}

function summarizeArray(value: unknown[], depth: number): unknown {
  return depth > MAX_DEPTH
    ? `[array x${value.length}]`
    : value.slice(0, ARRAY_PREVIEW_LENGTH).map((v) => summarizeForToolLog(v, depth + 1));
}

function summarizeObject(value: object, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[object]";
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSensitiveLogKey(k) ? REDACTED : summarizeForToolLog(v, depth + 1);
  }
  return out;
}

function isSensitiveLogKey(key: string): boolean {
  return /key|secret|token|password|authorization/i.test(key);
}
