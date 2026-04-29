// fallow-ignore-next-line unresolved-import
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod/v4";

import {
  findFrameNearTimestamp,
  findNearestWorkItemByTimestamp,
  findWorkItemById,
  isProdBuild,
  listStreams,
  listWorkItems,
  loadAnalysis,
  loadManifest,
} from "../../recordings/store.js";
import { WorkItemSchema } from "../../schemas.js";
import { withToolLogging } from "../../utils/tool-middleware.js";

const PATTERN_IDS = [
  "finding_at_timestamp",
  "summary",
  "list_findings",
  "severity_findings",
  "next_steps",
  "frame_at_timestamp",
  "type_findings",
  "finding_confidence",
  "available_streams",
  "prod_build",
  "finding_by_id",
  "recording_duration",
  "browser_artifacts",
  "browser_console",
  "browser_network",
  "browser_dom",
] as const;

const QueryAnswerSchema = z.record(z.string(), z.unknown()).nullable();
const QueryResponseSchema = z.object({
  recording_id: z.string(),
  question: z.string(),
  answer: QueryAnswerSchema,
  reason: z.string().optional(),
  patterns_matched: z.array(z.string()),
  patterns_tried: z.array(z.string()),
});

export function registerRetrievalTools(server: McpServer): void {
  server.registerTool(
    "reelink_get_finding",
    {
      title: "Get a Reelink work item",
      description: "Load analysis.json for a recording and return the WorkItem identified by finding_id.",
      inputSchema: {
        recording_id: z.string(),
        finding_id: z.string(),
      },
      outputSchema: {
        recording_id: z.string(),
        finding_id: z.string(),
        work_item: WorkItemSchema.nullable(),
        reason: z.string().optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    withToolLogging("reelink_get_finding", async ({ recording_id, finding_id }) => {
      const workItem = await findWorkItemById(recording_id, finding_id);
      const structuredContent = workItem
        ? { recording_id, finding_id, work_item: workItem }
        : { recording_id, finding_id, work_item: null, reason: "finding not found" };
      return jsonToolResult(structuredContent);
    }),
  );

  server.registerTool(
    "reelink_get_frame",
    {
      title: "Get a Reelink frame near a timestamp",
      description: "Read manifest.json and return the nearest sampled frame path for a recording timestamp.",
      inputSchema: {
        recording_id: z.string(),
        ts: z.number(),
      },
      outputSchema: {
        recording_id: z.string(),
        query_ts: z.number(),
        path: z.string().nullable(),
        frame_index: z.number().nullable(),
        frame_ts: z.number().nullable(),
        delta_sec: z.number().nullable(),
        exists: z.boolean().optional(),
        reason: z.string().optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    withToolLogging("reelink_get_frame", async ({ recording_id, ts }) => {
      const frame = await findFrameNearTimestamp(recording_id, ts);
      const structuredContent = frame
        ? {
            recording_id,
            query_ts: ts,
            path: frame.path,
            frame_index: frame.index,
            frame_ts: frame.ts,
            delta_sec: frame.delta_sec,
            exists: existsSync(frame.path),
          }
        : {
            recording_id,
            query_ts: ts,
            path: null,
            frame_index: null,
            frame_ts: null,
            delta_sec: null,
            reason: "frame not available",
          };
      return jsonToolResult(structuredContent);
    }),
  );
}

export function registerQueryTools(server: McpServer): void {
  server.registerTool(
    "reelink_query",
    {
      title: "Query a Reelink recording deterministically",
      description: "Answer from analysis.json, manifest.json, work_items, next_steps, frames, and stream metadata. No model calls.",
      inputSchema: {
        recording_id: z.string(),
        question: z.string(),
      },
      outputSchema: QueryResponseSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    withToolLogging("reelink_query", async ({ recording_id, question }) => {
      const structuredContent = await answerDeterministicQuery(recording_id, question);
      return jsonToolResult(structuredContent);
    }),
  );
}

async function answerDeterministicQuery(recordingId: string, question: string): Promise<z.infer<typeof QueryResponseSchema>> {
  const normalized = question.toLowerCase().trim();
  const tried: string[] = [];

  const browserArtifact = browserArtifactResponse(recordingId, question, normalized, tried);
  if (browserArtifact) return browserArtifact;

  tried.push("finding_at_timestamp");
  if (/(bug|finding|issue|work item).*(at|near|around)?\s*\d|finding\s+at\s+\d/.test(normalized)) {
    const queryTs = parseTimestamp(normalized);
    if (queryTs != null) {
      const nearest = await findNearestWorkItemByTimestamp(recordingId, queryTs);
      return {
        recording_id: recordingId,
        question,
        answer: nearest ? { kind: "finding", query_ts: queryTs, match: nearest.item, delta_sec: nearest.delta_sec } : null,
        reason: nearest ? undefined : "finding not found",
        patterns_matched: ["finding_at_timestamp"],
        patterns_tried: [...tried],
      };
    }
  }

  tried.push("summary");
  if (/\b(summary|summarize|what happened|what is this recording)\b/.test(normalized)) {
    const analysis = await loadAnalysis(recordingId);
    return {
      recording_id: recordingId,
      question,
      answer: {
        kind: "summary",
        recording_id: recordingId,
        duration_sec: analysis.duration_sec,
        summary: analysis.summary,
        work_item_count: analysis.work_items.length,
        next_step_count: analysis.next_steps.length,
      },
      patterns_matched: ["summary"],
      patterns_tried: [...tried],
    };
  }

  tried.push("list_findings");
  if (/\b(list|show|what)\s+(all\s+)?(findings|work items|bugs|issues)\b|\bwhat work items exist\b/.test(normalized)) {
    return workItemsResponse(recordingId, question, { kind: "work_items", items: await listWorkItems(recordingId) }, "list_findings", tried);
  }

  tried.push("severity_findings");
  const severity = extractSeverity(normalized);
  if (severity && /\b(findings|bugs|issues|work items)\b/.test(normalized)) {
    const items = (await listWorkItems(recordingId)).filter((item) => item.severity === severity);
    return workItemsResponse(recordingId, question, { kind: "work_items", severity, items }, "severity_findings", tried);
  }

  tried.push("next_steps");
  if (/\b(next steps?|what should i do|what do i do|recommended fix|how should i fix)\b/.test(normalized)) {
    const analysis = await loadAnalysis(recordingId);
    return {
      recording_id: recordingId,
      question,
      answer: { kind: "next_steps", next_steps: analysis.next_steps },
      patterns_matched: ["next_steps"],
      patterns_tried: [...tried],
    };
  }

  tried.push("frame_at_timestamp");
  if (/\b(frame|screenshot|image|still)\b/.test(normalized)) {
    const queryTs = parseTimestamp(normalized);
    if (queryTs != null) {
      const frame = await findFrameNearTimestamp(recordingId, queryTs);
      return {
        recording_id: recordingId,
        question,
        answer: frame
          ? { kind: "frame", query_ts: queryTs, frame_path: frame.path, frame_index: frame.index, frame_ts: frame.ts, delta_sec: frame.delta_sec }
          : null,
        reason: frame ? undefined : "frame not available",
        patterns_matched: ["frame_at_timestamp"],
        patterns_tried: [...tried],
      };
    }
  }

  tried.push("type_findings");
  const type = await extractKnownType(recordingId, normalized);
  if (type) {
    const items = (await listWorkItems(recordingId)).filter((item) => item.type === type);
    return workItemsResponse(recordingId, question, { kind: "work_items", type, items }, "type_findings", tried);
  }

  tried.push("finding_confidence");
  if (/\b(how confident|confidence|confidence score)\b/.test(normalized)) {
    const fid = extractFindingId(normalized);
    const item = fid ? await findWorkItemById(recordingId, fid) : null;
    return {
      recording_id: recordingId,
      question,
      answer: item ? { kind: "confidence", finding_id: item.id, confidence: item.confidence, title: item.title, severity: item.severity } : null,
      reason: item ? undefined : "finding not found",
      patterns_matched: ["finding_confidence"],
      patterns_tried: [...tried],
    };
  }

  tried.push("available_streams");
  if (/\b(what streams are available|what data was collected|available streams|collected data|manifest streams)\b/.test(normalized)) {
    const manifest = await loadManifest(recordingId);
    return {
      recording_id: recordingId,
      question,
      answer: {
        kind: "streams",
        streams: await listStreams(recordingId),
        artifacts: manifest.artifacts,
        preprocessing: manifest.preprocessing,
        redaction_applied: manifest.safety.redaction_applied,
      },
      patterns_matched: ["available_streams"],
      patterns_tried: [...tried],
    };
  }

  tried.push("prod_build");
  if (/\b(is|was)\s+(this\s+)?(recording\s+)?(a\s+)?prod(uction)?\s+build\b|\bprod_build\b/.test(normalized)) {
    return {
      recording_id: recordingId,
      question,
      answer: { kind: "prod_build", prod_build: await isProdBuild(recordingId), evidence: "manifest.prod_build" },
      patterns_matched: ["prod_build"],
      patterns_tried: [...tried],
    };
  }

  tried.push("finding_by_id");
  if (/\b(finding|bug|issue|work item)\s+[a-z][a-z0-9_-]*\b/.test(normalized)) {
    const fid = extractFindingId(normalized);
    const item = fid ? await findWorkItemById(recordingId, fid) : null;
    return {
      recording_id: recordingId,
      question,
      answer: item ? { kind: "finding", match: item } : null,
      reason: item ? undefined : "finding not found",
      patterns_matched: ["finding_by_id"],
      patterns_tried: [...tried],
    };
  }

  tried.push("recording_duration");
  if (/\b(duration|how long|length)\b/.test(normalized)) {
    const analysis = await loadAnalysis(recordingId);
    return {
      recording_id: recordingId,
      question,
      answer: { kind: "duration", duration_sec: analysis.duration_sec ?? (await loadManifest(recordingId)).duration_sec },
      patterns_matched: ["recording_duration"],
      patterns_tried: [...tried],
    };
  }

  return {
    recording_id: recordingId,
    question,
    answer: null,
    reason: "deterministic v0.1 cannot answer; record more streams or upgrade",
    patterns_matched: [],
    patterns_tried: [...PATTERN_IDS],
  };
}

function browserArtifactResponse(
  recordingId: string,
  question: string,
  normalized: string,
  tried: string[],
): z.infer<typeof QueryResponseSchema> | null {
  const root = resolve(".reelink", "browser-recordings", recordingId);
  if (!existsSync(root)) return null;

  tried.push("browser_artifacts");
  const manifestPath = join(root, "manifest.json");
  const manifest = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>)
    : {};

  if (isBrowserArtifactQuestion(normalized)) {
    return {
      recording_id: recordingId,
      question,
      answer: { kind: "browser_artifacts", manifest_path: manifestPath, manifest },
      patterns_matched: ["browser_artifacts"],
      patterns_tried: [...tried],
    };
  }

  tried.push("browser_console");
  if (isBrowserConsoleQuestion(normalized)) {
    const path = join(root, "console.jsonl");
    const parsed = readBrowserJsonl(path);
    return {
      recording_id: recordingId,
      question,
      answer: {
        kind: "console",
        path,
        events: parsed.events.slice(-50).map(compactEvent),
        parse_errors: parsed.parse_errors,
      },
      patterns_matched: ["browser_console"],
      patterns_tried: [...tried],
    };
  }

  tried.push("browser_network");
  if (isBrowserNetworkQuestion(normalized)) {
    const path = join(root, "network.jsonl");
    const parsed = readBrowserJsonl(path);
    const { events } = parsed;
    const failed = events.filter(
      (event) =>
        event.event === "requestfailed" ||
        event.ok === false ||
        (typeof event.status === "number" && event.status >= 400),
    );
    return {
      recording_id: recordingId,
      question,
      answer: {
        kind: "network",
        path,
        event_count: events.length,
        failed_count: failed.length,
        failed: failed.slice(-50),
        parse_errors: parsed.parse_errors,
      },
      patterns_matched: ["browser_network"],
      patterns_tried: [...tried],
    };
  }

  tried.push("browser_dom");
  if (isBrowserDomQuestion(normalized)) {
    const domDir = join(root, "dom");
    const files = existsSync(domDir)
      ? readdirSync(domDir)
          .filter((file) => file.endsWith(".html"))
          .sort()
      : [];
    return {
      recording_id: recordingId,
      question,
      answer: {
        kind: "dom",
        dir: domDir,
        files,
        latest: files.length ? join(domDir, files[files.length - 1] as string) : null,
      },
      patterns_matched: ["browser_dom"],
      patterns_tried: [...tried],
    };
  }

  return null;
}

function compactEvent(event: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(event).map(([key, value]) => [
      key,
      typeof value === "string" && value.length > 1000 ? `${value.slice(0, 1000)}...(+${value.length - 1000} chars)` : value,
    ]),
  );
}

function isBrowserArtifactQuestion(value: string): boolean {
  return /\b(browser|page|headed)\b.*\b(artifacts?|recorded|manifest)\b/.test(value) ||
    /\b(artifacts?|recorded|manifest)\b.*\b(browser|page|headed)\b/.test(value);
}

function isBrowserConsoleQuestion(value: string): boolean {
  return /\b(browser|page)\b.*\b(console|logs?|errors?)\b/.test(value) ||
    /\b(console|logs?|errors?)\b.*\b(browser|page)\b/.test(value);
}

function isBrowserNetworkQuestion(value: string): boolean {
  return /\b(browser|page)\b.*\b(network|requests?|responses?|failed requests?)\b/.test(value) ||
    /\b(network|requests?|responses?|failed requests?)\b.*\b(browser|page)\b/.test(value);
}

function isBrowserDomQuestion(value: string): boolean {
  return /\b(browser|page)\b.*\b(dom|html|snapshot)\b/.test(value) ||
    /\b(dom|html|snapshot)\b.*\b(browser|page)\b/.test(value);
}

function readBrowserJsonl(path: string): { events: Array<Record<string, unknown>>; parse_errors: number } {
  if (!existsSync(path)) return { events: [], parse_errors: 0 };

  const events: Array<Record<string, unknown>> = [];
  let parseErrors = 0;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line) continue;
    try {
      events.push(JSON.parse(line) as Record<string, unknown>);
    } catch {
      parseErrors += 1;
    }
  }

  return { events, parse_errors: parseErrors };
}

function workItemsResponse(
  recordingId: string,
  question: string,
  answer: Record<string, unknown>,
  pattern: string,
  tried: string[],
): z.infer<typeof QueryResponseSchema> {
  return {
    recording_id: recordingId,
    question,
    answer,
    patterns_matched: [pattern],
    patterns_tried: [...tried],
  };
}

function parseTimestamp(value: string): number | null {
  const match = value.match(/\b(?:(?<mm>\d{1,2}):(?<ss>\d{2}(?:\.\d+)?)|(?<sec>\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)?)\b/i);
  if (!match?.groups) return null;
  if (match.groups.sec) return Number(match.groups.sec);
  return Number(match.groups.mm) * 60 + Number(match.groups.ss);
}

function extractSeverity(value: string): "high" | "medium" | "low" | null {
  const match = value.match(/\b(high|medium|low|critical|crit)\b/i);
  if (!match) return null;
  const severity = match[1]?.toLowerCase();
  if (severity === "critical" || severity === "crit") return "high";
  if (severity === "high" || severity === "medium" || severity === "low") return severity;
  return null;
}

async function extractKnownType(recordingId: string, value: string): Promise<string | null> {
  const items = await listWorkItems(recordingId);
  for (const item of items) {
    const aliases = typeAliases(item.type);
    if (aliases.some((alias) => value === alias || value.includes(`${alias} findings`) || value.includes(`${alias} bugs`) || value.includes(`${alias} issues`) || value.includes(`${alias} work items`))) {
      return item.type;
    }
  }
  return null;
}

function typeAliases(type: string): string[] {
  const canonical = type.toLowerCase().trim().replace(/[\s_]+/g, "-");
  return [canonical, canonical.replace(/-/g, " "), canonical.replace(/-/g, "_")];
}

function extractFindingId(value: string): string | null {
  const match = value.match(/\b(?:finding|bug|issue|work item)\s+(?<fid>[a-z][a-z0-9_-]*)\b/i) ?? value.match(/\b(?<fid>[a-z][a-z0-9_-]*)\b/i);
  return match?.groups?.fid ?? null;
}

function jsonToolResult(structuredContent: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}
