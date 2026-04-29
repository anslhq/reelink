# reelink_query deterministic algorithm spec

This spec defines the deterministic v0.1 matcher for `reelink_query(recording_id, question)`. It must answer only from `analysis.json`, `manifest.json`, `work_items`, `summary`, `next_steps`, frame artifacts, and manifest stream metadata. It must not call GPT, OpenAI, ToolLoopAgent, VLMs, web search, or any other model path.

Reference recording used for examples:

`reelink/.reelink/page-d4c44c2734fe704efed18972f91e1d62-webm-9259449ec9/`

Note: the Slack task named `page-469cd67be477d6b3582c00140b5ca998-webm-d2c25fb94f`, but that folder was not present in the local repo or the current `origin/main` tree. The examples below use the available real page recording.

## 1. Pattern Catalog

Each matcher lowercases and trims `question`, preserves the original string for response metadata, and runs in the order listed here. The first matching pattern wins unless the pattern says to combine filters.

| Pattern id | Trigger | Slot extraction | Resolution path | Response shape |
| --- | --- | --- | --- | --- |
| `finding_at_timestamp` | Regex: `\b(what'?s|what is|show|describe)?\s*(the\s*)?(bug|finding|issue|work item)\s*(at|near|around)?\s*<timestamp>\b` or `\bfinding\s+at\s+<timestamp>\b` | Extract `ts`; optional words do not change behavior. | `loadAnalysis(id).work_items`; choose item with smallest `abs(item.ts - ts)`. Include `delta_sec`. | `{ answer: { kind: "finding", query_ts, match, delta_sec }, patterns_matched: ["finding_at_timestamp"] }` |
| `summary` | Keywords or regex: `\b(summary|summarize|what happened|what happened in this recording|what is this recording)\b` | No slots. | `loadAnalysis(id).summary`, `duration_sec`, `work_items.length`, `next_steps.length`. | `{ answer: { kind: "summary", recording_id, duration_sec, summary, work_item_count, next_step_count }, patterns_matched: ["summary"] }` |
| `list_findings` | Regex: `\b(list|show|what)\s+(all\s+)?(findings|work items|bugs|issues)\b` or `\bwhat work items exist\b` | No slots unless combined with severity/type trigger below. | `loadAnalysis(id).work_items`. | `{ answer: { kind: "work_items", items: WorkItem[] }, patterns_matched: ["list_findings"] }` |
| `severity_findings` | Regex: `\b(high|medium|low)\s+(severity\s+)?(findings|bugs|issues|work items)\b`; aliases: `critical` -> `high`, `crit` -> `high` | Extract `severity`. | `loadAnalysis(id).work_items.filter(item.severity === severity)`. | `{ answer: { kind: "work_items", severity, items: WorkItem[] }, patterns_matched: ["severity_findings"] }` |
| `next_steps` | Regex: `\b(next steps?|what should i do|what do i do|recommended fix|how should i fix)\b` | No slots. | `loadAnalysis(id).next_steps`. | `{ answer: { kind: "next_steps", next_steps: string[] }, patterns_matched: ["next_steps"] }` |
| `frame_at_timestamp` | Regex: `\b(frame|screenshot|image|still)\s*(at|near|around)?\s*<timestamp>\b` | Extract `ts`. | `loadManifest(id).preprocessing.effective_fps`, `.frame_count`, `.artifacts.frames`; call `findFrameNearTimestamp(id, ts)`. | `{ answer: { kind: "frame", query_ts, frame_path, frame_index, frame_ts, delta_sec }, patterns_matched: ["frame_at_timestamp"] }` |
| `type_findings` | Regex: `\b(show|list|what are|any)?\s*<type>\s+(findings|bugs|issues|work items)\b`; also accept `<type>` alone when it exactly equals a known `WorkItem.type`. | Extract `type` from known types in analysis. Normalize hyphen, underscore, and whitespace variants to the canonical stored type. | `loadAnalysis(id).work_items.filter(item.type === type)`. | `{ answer: { kind: "work_items", type, items: WorkItem[] }, patterns_matched: ["type_findings"] }` |
| `finding_confidence` | Regex: `\b(how confident|confidence|confidence score)\b.*\b(finding|bug|issue|work item)?\s*<id>\b` | Extract `fid`. | `findWorkItemById(id, fid)`. | `{ answer: { kind: "confidence", finding_id, confidence, title, severity }, patterns_matched: ["finding_confidence"] }` |
| `available_streams` | Regex: `\b(what streams are available|what data was collected|available streams|collected data|manifest streams)\b` | No slots. | `loadManifest(id).streams`, `.artifacts`, `.safety.redaction_applied`, `.preprocessing`. | `{ answer: { kind: "streams", streams, artifacts, preprocessing, redaction_applied }, patterns_matched: ["available_streams"] }` |
| `prod_build` | Regex: `\b(is|was)\s+(this\s+)?(recording\s+)?(a\s+)?prod(uction)?\s+build\b` or `\bprod_build\b` | No slots. | `loadManifest(id).prod_build`. | `{ answer: { kind: "prod_build", prod_build, evidence: "manifest.prod_build" }, patterns_matched: ["prod_build"] }` |
| `finding_by_id` | Regex: `\b(finding|bug|issue|work item)\s+<id>\b` | Extract `fid`. | `findWorkItemById(id, fid)`. | `{ answer: { kind: "finding", match: WorkItem }, patterns_matched: ["finding_by_id"] }` |
| `recording_duration` | Regex: `\b(duration|how long|length)\b` | No slots. | Prefer `loadAnalysis(id).duration_sec`; fall back to `loadManifest(id).duration_sec`. | `{ answer: { kind: "duration", duration_sec }, patterns_matched: ["recording_duration"] }` |

Empty result sets are still deterministic answers. Example: `high severity findings` on the reference recording returns `items: []`, not fallback.

## 2. Slot Extraction Rules

Timestamp extraction accepts seconds and minute-second formats. The parser returns seconds as a number.

```ts
const TIMESTAMP_RE =
  /\b(?:(?<mm>\d{1,2}):(?<ss>\d{2}(?:\.\d+)?)|(?<sec>\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)?)\b/i;
```

Examples:

| Input | Parsed seconds |
| --- | ---: |
| `1.5` | `1.5` |
| `1.5s` | `1.5` |
| `1.5 sec` | `1.5` |
| `00:01.5` | `1.5` |
| `01:02.25` | `62.25` |

Severity extraction accepts canonical severity values plus critical aliases.

```ts
const SEVERITY_RE = /\b(?<severity>high|medium|low|critical|crit)\b/i;
const normalizeSeverity = (value: string) =>
  value === "critical" || value === "crit" ? "high" : value;
```

Type extraction is data-driven. Build the known type set from `analysis.work_items.map(item => item.type)`, then match canonical and loose variants.

```ts
const normalizeTypeToken = (value: string) =>
  value.toLowerCase().trim().replace(/[\s_]+/g, "-");

const buildTypeAliases = (workItems: WorkItem[]) =>
  new Map(
    workItems.flatMap((item) => {
      const canonical = normalizeTypeToken(item.type);
      return [
        [canonical, item.type],
        [canonical.replace(/-/g, " "), item.type],
        [canonical.replace(/-/g, "_"), item.type],
      ];
    }),
  );
```

Finding id extraction accepts the exact stored id after the words `finding`, `bug`, `issue`, or `work item`, and also accepts a bare id only for confidence questions.

```ts
const FINDING_ID_RE = /\b(?:finding|bug|issue|work item)?\s*(?<fid>[a-z][a-z0-9_-]*)\b/i;
```

To avoid false positives, validate every extracted id against `analysis.work_items`. If no item matches, return a deterministic not-found answer for id-specific patterns:

```json
{
  "answer": null,
  "reason": "finding not found",
  "patterns_matched": ["finding_confidence"],
  "patterns_tried": ["finding_confidence"],
  "recording_id": "page-d4c44c2734fe704efed18972f91e1d62-webm-9259449ec9"
}
```

## 3. Fallback

No-match fallback must be exact except `patterns_tried`, which should contain the ordered pattern ids attempted by the matcher.

```json
{
  "answer": null,
  "reason": "deterministic v0.1 cannot answer; record more streams or upgrade",
  "patterns_matched": [],
  "patterns_tried": [
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
    "recording_duration"
  ]
}
```

Do not infer answers from free text outside the schemas. Do not synthesize DOM, stack, network, console, source, or trace context when the manifest stream status is `not_collected`, `unavailable`, or `failed`.

## 4. Helper Functions in `recordings/store.ts`

Faction A should add read-only helpers to the recording store. These signatures are intentionally path-oriented and deterministic.

```ts
import type { AnalyzeResult, Manifest, WorkItem } from "../schemas.js";

export type FrameMatch = {
  path: string;
  index: number;
  ts: number;
  delta_sec: number;
};

export function resolveRecordingDir(recording_id: string): string;

export async function loadAnalysis(recording_id: string): Promise<AnalyzeResult>;

export async function loadManifest(recording_id: string): Promise<Manifest>;

export async function listWorkItems(recording_id: string): Promise<WorkItem[]>;

export async function findWorkItemById(
  recording_id: string,
  finding_id: string,
): Promise<WorkItem | null>;

export async function findNearestWorkItemByTimestamp(
  recording_id: string,
  ts: number,
): Promise<{ item: WorkItem; delta_sec: number } | null>;

export async function findFrameNearTimestamp(
  recording_id: string,
  ts: number,
): Promise<FrameMatch | null>;

export async function listStreams(
  recording_id: string,
): Promise<Manifest["streams"]>;

export async function isProdBuild(recording_id: string): Promise<boolean>;
```

`findFrameNearTimestamp` should compute the nearest frame from `manifest.preprocessing.effective_fps` and `manifest.preprocessing.frame_count`, then resolve `manifest.artifacts.frames` plus a 1-based zero-padded file convention:

```ts
const frameIndex = Math.min(
  frame_count,
  Math.max(1, Math.round(ts * effective_fps) + 1),
);
const framePath = `${recordingDir}/${framesDir}/frame-${String(frameIndex).padStart(4, "0")}.jpg`;
```

For the reference recording, `effective_fps` is `1`, `frame_count` is `9`, and `ts=1.2` resolves to `frames/frame-0002.jpg` with `frame_ts=1`.

## 5. Tool Response Shape

The tool should follow the small MCP query style from the OpenSpec design: return structured JSON, file paths, ids, summaries, and metadata; do not embed pixels, large DOM dumps, trace bytes, or model prose. `reelink_query` is deterministic v0.1 and returns Reelink JSON.

Base shape:

```ts
type ReelinkQueryResponse = {
  recording_id: string;
  question: string;
  answer: null | Record<string, unknown>;
  patterns_matched: string[];
  patterns_tried: string[];
};
```

Pass example against the real local `analysis.json`:

```json
{
  "recording_id": "page-d4c44c2734fe704efed18972f91e1d62-webm-9259449ec9",
  "question": "what's the bug at 1.2s",
  "answer": {
    "kind": "finding",
    "query_ts": 1.2,
    "match": {
      "id": "f1",
      "ts": 1.2,
      "type": "layout-transition",
      "severity": "medium",
      "title": "View-transition title overlap",
      "confidence": 0.95,
      "description": "During the navigation triggered by the 'Go to blog' button, the new page title ('Blog Index') renders on top of the existing page title ('Harsha Vardhan') instead of transitioning away. This results in a temporary but noticeable visual overlap where both texts are superimposed.",
      "state": "detected",
      "approval_state": "pending",
      "routed_to": null,
      "completed_at": null,
      "source": "video",
      "intent": "fix"
    },
    "delta_sec": 0
  },
  "patterns_matched": ["finding_at_timestamp"],
  "patterns_tried": ["finding_at_timestamp"]
}
```

Fail example:

```json
{
  "recording_id": "page-d4c44c2734fe704efed18972f91e1d62-webm-9259449ec9",
  "question": "which React component owns the title",
  "answer": null,
  "reason": "deterministic v0.1 cannot answer; record more streams or upgrade",
  "patterns_matched": [],
  "patterns_tried": [
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
    "recording_duration"
  ]
}
```

The fail example must not answer from bippy or react-grab concepts because the reference `manifest.json` says `fiber_commits`, `source_dictionary`, and `react_grab_events` are `not_collected` for this Layer 0 imported-video recording. The timestamped DOM timeline spec allows missing streams and requires unavailable status rather than fabricated context.

## 6. Test Cases

All expected responses below use the real local example recording:

`page-d4c44c2734fe704efed18972f91e1d62-webm-9259449ec9`

1. Question: `what's the bug at 1.2s`

```json
{
  "answer": {
    "kind": "finding",
    "query_ts": 1.2,
    "match": {
      "id": "f1",
      "ts": 1.2,
      "type": "layout-transition",
      "severity": "medium",
      "title": "View-transition title overlap",
      "confidence": 0.95,
      "state": "detected",
      "approval_state": "pending",
      "routed_to": null,
      "completed_at": null,
      "source": "video",
      "intent": "fix"
    },
    "delta_sec": 0
  },
  "patterns_matched": ["finding_at_timestamp"]
}
```

2. Question: `summary`

```json
{
  "answer": {
    "kind": "summary",
    "recording_id": "page-d4c44c2734fe704efed18972f91e1d62-webm-9259449ec9",
    "duration_sec": 8.56,
    "summary": "Analysis of the view-transition sequence reveals a layout glitch where page titles overlap during navigation.",
    "work_item_count": 1,
    "next_step_count": 3
  },
  "patterns_matched": ["summary"]
}
```

3. Question: `list work items`

```json
{
  "answer": {
    "kind": "work_items",
    "items": [
      {
        "id": "f1",
        "ts": 1.2,
        "type": "layout-transition",
        "severity": "medium",
        "title": "View-transition title overlap",
        "confidence": 0.95,
        "state": "detected",
        "approval_state": "pending",
        "routed_to": null,
        "completed_at": null,
        "source": "video",
        "intent": "fix"
      }
    ]
  },
  "patterns_matched": ["list_findings"]
}
```

4. Question: `high severity findings`

```json
{
  "answer": {
    "kind": "work_items",
    "severity": "high",
    "items": []
  },
  "patterns_matched": ["severity_findings"]
}
```

5. Question: `critical bugs`

```json
{
  "answer": {
    "kind": "work_items",
    "severity": "high",
    "items": []
  },
  "patterns_matched": ["severity_findings"]
}
```

6. Question: `next steps`

```json
{
  "answer": {
    "kind": "next_steps",
    "next_steps": [
      "Inspect the view-transition CSS rules for the header text elements.",
      "Check if the 'enter' and 'exit' animations are properly defined to prevent z-index stacking issues.",
      "Verify that the old title is scaled or faded out before the new title scales in."
    ]
  },
  "patterns_matched": ["next_steps"]
}
```

7. Question: `frame at 1.2 sec`

```json
{
  "answer": {
    "kind": "frame",
    "query_ts": 1.2,
    "frame_path": ".reelink/page-d4c44c2734fe704efed18972f91e1d62-webm-9259449ec9/frames/frame-0002.jpg",
    "frame_index": 2,
    "frame_ts": 1,
    "delta_sec": 0.2
  },
  "patterns_matched": ["frame_at_timestamp"]
}
```

8. Question: `show me layout transition findings`

```json
{
  "answer": {
    "kind": "work_items",
    "type": "layout-transition",
    "items": [
      {
        "id": "f1",
        "ts": 1.2,
        "type": "layout-transition",
        "severity": "medium",
        "title": "View-transition title overlap",
        "confidence": 0.95,
        "state": "detected",
        "approval_state": "pending",
        "routed_to": null,
        "completed_at": null,
        "source": "video",
        "intent": "fix"
      }
    ]
  },
  "patterns_matched": ["type_findings"]
}
```

9. Question: `how confident is finding f1`

```json
{
  "answer": {
    "kind": "confidence",
    "finding_id": "f1",
    "confidence": 0.95,
    "title": "View-transition title overlap",
    "severity": "medium"
  },
  "patterns_matched": ["finding_confidence"]
}
```

10. Question: `what streams are available`

```json
{
  "answer": {
    "kind": "streams",
    "streams": {
      "frames": { "status": "available" },
      "trace": {
        "status": "not_collected",
        "reason": "Layer 0 imported video analysis only"
      },
      "fiber_commits": {
        "status": "not_collected",
        "reason": "Layer 0 imported video analysis only"
      },
      "source_dictionary": {
        "status": "not_collected",
        "reason": "Layer 0 imported video analysis only"
      },
      "react_grab_events": {
        "status": "not_collected",
        "reason": "Layer 0 imported video analysis only"
      },
      "network": {
        "status": "not_collected",
        "reason": "Layer 0 imported video analysis only"
      },
      "console": {
        "status": "not_collected",
        "reason": "Layer 0 imported video analysis only"
      },
      "eval": {
        "status": "not_collected",
        "reason": "No verification artifact generated"
      }
    },
    "artifacts": {
      "analysis": "analysis.json",
      "frames": "frames/",
      "source_video": "/Users/harsha/Developer/hackathon/reelink/demo-recordings/page@d4c44c2734fe704efed18972f91e1d62.webm"
    },
    "preprocessing": {
      "requested_fps": 4,
      "effective_fps": 1,
      "max_frames": 64,
      "long_edge_px": 896,
      "frame_count": 9
    },
    "redaction_applied": false
  },
  "patterns_matched": ["available_streams"]
}
```

11. Question: `is the recording prod build`

```json
{
  "answer": {
    "kind": "prod_build",
    "prod_build": false,
    "evidence": "manifest.prod_build"
  },
  "patterns_matched": ["prod_build"]
}
```

12. Question: `which React component owns the title`

```json
{
  "answer": null,
  "reason": "deterministic v0.1 cannot answer; record more streams or upgrade",
  "patterns_matched": [],
  "patterns_tried": [
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
    "recording_duration"
  ]
}
```
