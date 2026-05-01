import {
  findFrameNearTimestamp,
  findNearestWorkItemByTimestamp,
  findWorkItemById,
  isProdBuild,
  listStreams,
  listWorkItems,
  loadAnalysis,
  loadManifest,
  tryBrowserRecordingDeterministicQuery,
  type DeterministicQueryAnswer,
} from "../recordings/store.js";
import { getRuntimeComponents, getRuntimeDom, getRuntimeFindingContext } from "../runtime-artifacts/retrieval.js";
import { PATTERN_IDS } from "./constants.js";
import type { DeterministicQueryResponse } from "./deterministic-query-schema.js";
import { extractFindingId, extractSeverity, parseTimestamp, typeAliases } from "./slots.js";

async function extractKnownType(recordingId: string, value: string): Promise<string | null> {
  const items = await listWorkItems(recordingId);
  for (const item of items) {
    const aliases = typeAliases(item.type);
    if (
      aliases.some(
        (alias) =>
          value === alias ||
          value.includes(`${alias} findings`) ||
          value.includes(`${alias} bugs`) ||
          value.includes(`${alias} issues`) ||
          value.includes(`${alias} work items`),
      )
    ) {
      return item.type;
    }
  }
  return null;
}

function workItemsResponse(
  recordingId: string,
  question: string,
  answer: Record<string, unknown>,
  pattern: string,
  tried: string[],
): DeterministicQueryResponse {
  return {
    recording_id: recordingId,
    question,
    answer,
    patterns_matched: [pattern],
    patterns_tried: [...tried],
  };
}

/**
 * Deterministic v0.1 query engine — no ML. Order and shapes follow `docs/reelink-query-algorithm.md`.
 * Browser-only branches defer to {@link tryBrowserRecordingDeterministicQuery} in the recordings store.
 */
export async function answerDeterministicQuery(recordingId: string, question: string): Promise<DeterministicQueryResponse> {
  const normalized = question.toLowerCase().trim();
  const tried: string[] = [];

  const browserArtifact: DeterministicQueryAnswer | null = tryBrowserRecordingDeterministicQuery(
    recordingId,
    question,
    normalized,
    tried,
  );
  if (browserArtifact) return browserArtifact;

  tried.push("finding_at_timestamp");
  if (/\b(?:what'?s|what is|show|describe)?\s*(?:the\s*)?(?:bug|finding|issue|work item)\s*(?:at|near|around)\s*\d|\bfinding\s+at\s+\d/.test(normalized)) {
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
    return workItemsResponse(
      recordingId,
      question,
      { kind: "work_items", items: await listWorkItems(recordingId) },
      "list_findings",
      tried,
    );
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
          ? {
              kind: "frame",
              query_ts: queryTs,
              frame_path: frame.path,
              frame_index: frame.index,
              frame_ts: frame.ts,
              delta_sec: frame.delta_sec,
            }
          : null,
        reason: frame ? undefined : "frame not available",
        patterns_matched: ["frame_at_timestamp"],
        patterns_tried: [...tried],
      };
    }
  }

  tried.push("dom_at_timestamp");
  if (/\b(dom|html|tree|snapshot)\b/.test(normalized) && !/\bbrowser\b/.test(normalized)) {
    const queryTs = parseTimestamp(normalized);
    if (queryTs != null) {
      const dom = await getRuntimeDom(recordingId, queryTs);
      return {
        recording_id: recordingId,
        question,
        answer: dom.status === "available"
          ? {
              kind: "dom",
              query_ts: queryTs,
              path: dom.path,
              tree_summary: dom.tree_summary,
              snapshot_ts: dom.snapshot_ts,
              delta_sec: dom.delta_sec,
            }
          : null,
        reason: dom.status === "available" ? undefined : `${dom.stream} unavailable: ${dom.reason}`,
        patterns_matched: ["dom_at_timestamp"],
        patterns_tried: [...tried],
      };
    }
  }

  tried.push("components_at_timestamp");
  if (/\b(components?|react|source|fiber)\b/.test(normalized)) {
    const queryTs = parseTimestamp(normalized);
    if (queryTs != null) {
      const components = await getRuntimeComponents(recordingId, queryTs);
      return {
        recording_id: recordingId,
        question,
        answer: components.status === "available"
          ? {
              kind: "components",
              query_ts: queryTs,
              component: components.component,
              file: components.file,
              line: components.line,
              column: components.column,
              ts: components.ts,
              delta_sec: components.delta_sec,
              source: components.source,
              source_references: components.source_references,
            }
          : null,
        reason: components.status === "available" ? undefined : `${components.stream} unavailable: ${components.reason}`,
        patterns_matched: ["components_at_timestamp"],
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
  if (/\b(is|was)\s+(this\s+|the\s+)?(recording\s+)?(a\s+)?prod(uction)?\s+build\b|\bprod_build\b/.test(normalized)) {
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
      answer: item ? { kind: "finding", match: item, context: await getRuntimeFindingContext(recordingId, item) } : null,
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
