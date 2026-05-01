// AI SDK v6 telemetry settings for Reck.
//
// We do NOT provide a custom OpenTelemetry tracer at v0.1 — the SDK's default
// is fine and OpenTelemetry exporters are explicitly deferred to v0.2.
//
// What we DO is attach structured metadata so AI SDK's emitted span attributes
// (provider, model, latency, token counts) end up tagged with the calling
// function id and our caller-supplied metadata. Pair with manual log lines
// around the call site for observability today.
//
// Per Section 0.10 of openspec/changes/build-reelink-mcp/tasks.md.

import type { TelemetrySettings } from "ai";

/**
 * Build the experimental_telemetry option for an AI SDK call.
 *
 * @param functionId Logical name for this call site (e.g. "vlm-router.analyze").
 * @param metadata Static attributes attached to every span emitted by this call.
 */
export function telemetryFor(
  functionId: string,
  metadata: Record<string, string | number | boolean> = {},
): TelemetrySettings {
  return {
    isEnabled: true,
    functionId,
    metadata: { ...metadata, "reck.function": functionId },
  };
}
