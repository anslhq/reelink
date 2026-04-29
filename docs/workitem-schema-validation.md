# WorkItem Schema — Adversarial Review (Phase 0)

Faction B prep, read-only review of the Phase 0 `Finding → WorkItem` rename. Validates whether the schema actually round-trips through `qwen/qwen3.6-flash` cleanly. Findings cite `reelink/src/...` exactly.

## TL;DR (lead finding)

**Lifecycle fields are not round-tripped through Qwen at all.** They are hardcoded by Reelink in `reelink/src/vlm/router.ts:104-116`, post-call. Qwen only sees a 6-field `ModelAnalyzeSchema` (`ts`, `type`, `severity`, `title`, `description`, `confidence`). Every emitted WorkItem ships with `state: "detected"`, `approval_state: "pending"`, `routed_to: null`, `completed_at: null`, `source: "video"`, `intent: "fix"` regardless of content — see "Risks" below.

This is the design as implemented. The doc treats it as load-bearing fact and answers the adversarial questions accordingly.

---

## 1. The two schemas, verbatim

### Persisted shape — `WorkItem` (`reelink/src/schemas/layer0.ts:5-19`)

```ts
export const WorkItemSchema = z.object({
  id: z.string(),
  ts: z.number().min(0),
  type: z.string(),
  severity: SeveritySchema,                      // "low" | "medium" | "high"
  title: z.string(),
  confidence: z.number().min(0).max(1),
  description: z.string().optional(),
  state: z.enum(["detected", "prepared", "approved", "routed", "executed", "completed"]),
  approval_state: z.enum(["pending", "approved", "rejected"]).nullable(),
  routed_to: z.string().nullable(),
  completed_at: z.string().nullable(),
  source: z.literal("video"),
  intent: z.enum(["fix", "investigate", "track"]),
});
```

### Wire shape sent to Qwen — `ModelAnalyzeSchema` (`reelink/src/vlm/router.ts:14-27`)

```ts
const ModelAnalyzeSchema = z.object({
  summary: z.string(),
  findings: z.array(
    z.object({
      ts: z.number().min(0).nullable(),     // <-- nullable on the wire
      type: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      title: z.string(),
      description: z.string(),               // <-- required on the wire (not optional)
      confidence: z.number().min(0).max(1),
    }),
  ),
  next_steps: z.array(z.string()),
});
```

### Stitching layer (`reelink/src/vlm/router.ts:103-117`)

```ts
workItems: result.output.findings.map((finding, index) => ({
  id: `f${index + 1}`,
  ts: finding.ts ?? 0,
  type: finding.type,
  severity: finding.severity,
  title: finding.title,
  confidence: finding.confidence,
  description: finding.description,
  state: "detected",
  approval_state: "pending",
  routed_to: null,
  completed_at: null,
  source: "video",
  intent: "fix",
})),
```

The AI SDK call (`reelink/src/vlm/router.ts:70-84`) uses `Output.object({ schema: ModelAnalyzeSchema })`, which the SDK turns into a `responseFormat` JSON schema sent to OpenRouter AND a post-parse `safeValidateTypes` check (verified at `ai/packages/ai/src/generate-text/output.ts:114,142`). Out-of-schema responses throw `NoObjectGeneratedError`. OpenRouter's `response-healing` plugin (router.ts:133) repairs malformed JSON upstream of the SDK; it does not bypass the SDK's post-parse Zod validator.

---

## 2. Schema diff (Qwen wire vs persisted WorkItem)

| Field | In `ModelAnalyzeSchema` (Qwen) | In `WorkItem` (persisted) | Source |
|---|---|---|---|
| `id` | absent | required string | added by Reelink as `f${index+1}` (router.ts:104) |
| `ts` | nullable, ≥0 | required, ≥0 | coerced via `?? 0` (router.ts:105) |
| `type` | required string | required string | passthrough |
| `severity` | enum L/M/H | enum L/M/H | passthrough |
| `title` | required string | required string | passthrough |
| `description` | required string | optional string | passthrough; wire is stricter than persisted |
| `confidence` | 0–1 | 0–1 | passthrough |
| `state` | absent | required enum (6 values) | hardcoded `"detected"` (router.ts:111) |
| `approval_state` | absent | nullable enum | hardcoded `"pending"` (router.ts:112) |
| `routed_to` | absent | nullable string | hardcoded `null` (router.ts:113) |
| `completed_at` | absent | nullable string | hardcoded `null` (router.ts:114) |
| `source` | absent | literal `"video"` | hardcoded `"video"` (router.ts:115) |
| `intent` | absent | enum (fix/investigate/track) | hardcoded `"fix"` (router.ts:116) |

The only field the model influences in the lifecycle is none of them. `intent` is uniformly `"fix"`; `state` is uniformly `"detected"`. The 6-state lifecycle and the 3-intent classification exist on disk but are unreachable from Layer 0 in the current code.

---

## 3. Adversarial questions, answered from source

**Q: Is `state: "detected"` set by Qwen or by Reelink post-call?**
By Reelink. Hardcoded at `reelink/src/vlm/router.ts:111`. Qwen never sees `state`.

**Q: Does the `description` field default correctly? (Schema marks it optional.)**
The persisted `WorkItem` marks it optional (`layer0.ts:12`), but the wire schema makes it **required** (`router.ts:22`). So Qwen is required to emit a description — the "optional" label on the persisted side is misleading because every emitted WorkItem will always have one. If the model returned no description, the post-parse `safeValidateTypes` against `ModelAnalyzeSchema` would throw. The "optional" marker on the persisted schema only matters if a non-VLM emitter ever writes a WorkItem without a description (none exists today).

**Q: Does `confidence` have min/max bounds enforced in the Zod schema? (Should be 0–1.)**
Yes, on both sides — `z.number().min(0).max(1)` at `layer0.ts:11` and `router.ts:23`. Both are enforced by `safeValidateTypes` post-parse.

**Q: What happens if Qwen returns a `severity` outside `low|medium|high`? Is the response repaired or rejected?**
Rejected. The AI SDK calls `safeValidateTypes` after parsing JSON (`ai/packages/ai/src/generate-text/output.ts:142`). A bad enum value throws `NoObjectGeneratedError`. There is no client-side repair. OpenRouter's `response-healing` plugin (router.ts:133) repairs malformed JSON, not invalid enums — it's upstream of the Zod check. End-user effect: `analyzeVideo` rejects with the validation error and the recording dir gets a `frames/` subdir but no `analysis.json` written. Manifest is also not written, because `writeManifest` runs after `writeJson(analysisPath)` in `analyze.ts:33-77`.

**Q: Does the `id` get assigned by Qwen or by Reelink?**
By Reelink. `f${index+1}` at `router.ts:104`. Qwen has no `id` field on the wire.

**Q: Are there any nullable-enum issues (Qwen has had bugs with `enum + nullable` combos)?**
Not on the **Qwen wire**: `ModelAnalyzeSchema` contains no nullable enums. `ts` is the only nullable field and it's a number, not an enum.

There IS a nullable enum on the **persisted/MCP-output** side: `approval_state: z.enum([...]).nullable()` at `layer0.ts:14`. This is exposed downstream as `outputSchema` for the `reelink_analyze` MCP tool via `AnalyzeResultSchema.shape.work_items` (`reelink/src/mcp/tools/analysis.ts:30`). If an MCP client validates the structured output with a strict JSON-Schema validator that mishandles `enum + nullable`, that's a client-side issue — but Reelink itself always emits `approval_state: "pending"` (router.ts:112), never `null`, so the nullable case never fires in practice. Worth knowing if a future emitter sets it to `null`.

---

## 4. Smoketest plan (spec only — do not run)

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Generate fresh fixture. Script lives at reelink/scripts/ and npm script
#    `smoketest:recording` assumes cwd=reelink. The script console.log()s
#    the absolute path of the produced .webm.
cd /Users/harsha/Developer/hackathon/reelink
VIDEO="$(bun run smoketest:recording | tail -n 1)"
test -f "$VIDEO" || { echo "fixture missing: $VIDEO"; exit 2; }

# 2. Run analyze. Need OPENROUTER_API_KEY set in env or ~/.reelink/config.json
#    or the run no-ops with provider="none" and zero work_items (router.ts:50-62).
bun run src/cli.ts analyze "$VIDEO" >/tmp/reelink-stdout.json

# 3. Locate the persisted file (the contract — stdout is best-effort).
RECORDING_ID="$(jq -r .recording_id /tmp/reelink-stdout.json)"
ANALYSIS=".reelink/${RECORDING_ID}/analysis.json"
test -f "$ANALYSIS" || { echo "analysis.json missing at $ANALYSIS"; exit 3; }

# 4. Assert the rename landed: top-level key is `work_items`, not `findings`.
jq -e 'has("work_items") and (has("findings") | not)' "$ANALYSIS" \
  || { echo "FAIL: persisted file still uses old `findings` key"; exit 4; }

# 5. Assert at least one work item exists. (If Qwen returned zero findings,
#    skip the lifecycle-field assertions but warn — empty result is legal.)
COUNT="$(jq '.work_items | length' "$ANALYSIS")"
if [ "$COUNT" -eq 0 ]; then
  echo "WARN: model emitted 0 work_items; lifecycle assertions skipped"
  exit 0
fi

# 6. Assert every work_item has all 6 lifecycle fields AND confidence in [0,1].
jq -e '
  .work_items
  | all(
      has("state") and has("approval_state") and has("routed_to")
      and has("completed_at") and has("source") and has("intent")
      and (.confidence >= 0 and .confidence <= 1)
      and (.id | type == "string")
      and (.severity | IN("low","medium","high"))
    )
' "$ANALYSIS" || { echo "FAIL: lifecycle/bounds check"; exit 5; }

# 7. Assert the hardcoded constants (router.ts:111-116) are what we expect.
#    If Faction A starts deriving these per-finding, this assertion will need
#    updating — but for now it's the contract.
jq -e '
  .work_items
  | all(
      .state == "detected"
      and .approval_state == "pending"
      and .routed_to == null
      and .completed_at == null
      and .source == "video"
      and .intent == "fix"
    )
' "$ANALYSIS" || { echo "FAIL: hardcoded lifecycle defaults drifted"; exit 6; }

echo "OK: $COUNT work_items, all fields present, all bounds valid"
```

Cost: one OpenRouter call to `qwen/qwen3.6-flash` per run (the fixture is ~8s of WebM). The Playwright fixture cost is negligible.

---

## 5. Risks (ranked, demo-time blast radius)

1. **Stale on-disk evidence of the rename.** The only persisted analysis in the repo (`reelink/.reelink/page-469cd67be477d6b3582c00140b5ca998-webm-d2c25fb94f/analysis.json`) still uses `findings: [...]` and contains zero lifecycle fields. It predates the rename. There is no committed end-to-end run of the new schema. The "Layer 0 verified end-to-end" claim has no verifiable artifact. Run the smoketest above to produce one before the demo.

2. **`intent` is uniformly `"fix"`.** Hardcoded at `router.ts:116`. Any demo narrative that says "this WorkItem got routed to investigate" or "this one is just a tracker" is unreachable from Layer 0. If the demo claims intent diversity, either Faction A adds a deriver (heuristic from `severity` × `type` is the cheapest) or the demo script avoids the claim.

3. **`approval_state` always `"pending"` at emit time.** Same shape as #2 — `router.ts:112`. The state machine `pending → approved/rejected` exists in the schema but no code transitions it. If the demo shows approval flow, something downstream of `analyzeVideo` has to mutate the persisted JSON. Faction A's Layer 1 plan should clarify who owns that transition.

4. **Silent timestamp coercion.** `ModelAnalyzeSchema.findings[].ts` is `z.number().min(0).nullable()` (`router.ts:18`), and the stitcher uses `finding.ts ?? 0` (`router.ts:105`). If Qwen returns `null` for `ts`, the WorkItem lands at `ts: 0` with no log warning. Timestamp is the entire premise of "video-as-state" — a finding silently anchored at t=0 will look like a real bug at the start of the recording. Either log when the coercion fires, or reject `ts: null` outright.

5. **Wire `description` is required, persisted is optional.** If Faction A ever wants a non-VLM emitter to write a WorkItem without a description, they'll discover the wire schema disagrees. Today this is theoretical; if Layer 1 adds a programmatic emitter (e.g. from console errors), the gap matters.

---

## 6. Recommendations (Faction A, if any of the risks land)

Each recommendation is one fix at one location. None are blocking — the schema works as-is for a smoketest demo. Apply selectively.

- **R1 (covers Risk #4): warn on `ts` coercion in `reelink/src/vlm/router.ts:105`.**
  Replace `ts: finding.ts ?? 0` with a small guard that logs when the model returned `null` and consider rejecting the finding instead of anchoring it at 0. Cheap fix; avoids silent t=0 ghosts in the demo.

- **R2 (covers Risk #2): derive `intent` in `reelink/src/vlm/router.ts:116`.**
  Cheap heuristic: `severity === "high" → "fix"`, `severity === "medium" → "investigate"`, `severity === "low" → "track"`. Or have Qwen emit an `intent` field on the wire by adding it to `ModelAnalyzeSchema` at `router.ts:17-24`. Either approach is a 5-line change.

- **R3 (covers Risk #1): commit the smoketest as a CI check before the demo.**
  Land §4's script at `reelink/scripts/smoketest-analyze.ts` (or shell). Add to `package.json` scripts as `smoketest:analyze`. Run it once with a real `OPENROUTER_API_KEY` and commit the resulting `.reelink/<id>/analysis.json` as a fixture under `reelink/__fixtures__/` so the new schema has on-disk evidence.

- **R4 (covers Risk #5): tighten `description` on the persisted side at `reelink/src/schemas/layer0.ts:12`.**
  If the only emitter today is the VLM router (which always produces a description), drop `.optional()`. If a programmatic emitter is planned for Layer 1, leave it optional but document the gap in `schemas/layer0.ts` near line 12.

- **R5 (covers Risk #3): document the lifecycle owner.**
  Add a comment block at `reelink/src/schemas/layer0.ts:13-19` naming who is allowed to mutate `state`, `approval_state`, `routed_to`, `completed_at`. Without an owner, those fields will remain dead weight on the WorkItem.

---

## Files referenced

- `reelink/src/schemas/layer0.ts` — `WorkItemSchema`, `AnalyzeResultSchema`, `AnalyzeArgsSchema`
- `reelink/src/schemas/recording.ts` — `ManifestSchema`
- `reelink/src/schemas.ts` — re-exports
- `reelink/src/vlm/router.ts` — `ModelAnalyzeSchema`, `analyzeFramesWithVlm`, `selectModel`
- `reelink/src/analyze.ts` — `analyzeVideo` orchestrator (writes `analysis.json` then `manifest.json`)
- `reelink/src/recordings/store.ts` — `writeJson`, `createImportedVideoRecording`
- `reelink/src/mcp/tools/analysis.ts` — MCP `reelink_analyze` tool registration
- `reelink/src/cli.ts` — `analyzeCommand` entrypoint
- `reelink/scripts/generate-playwright-fixture.ts` — fixture generator (deliberate view-transition overlap bug)
- `ai/packages/ai/src/generate-text/output.ts:114,142` — confirms `Output.object` enforces JSON schema both wire-side and post-parse
- `reelink/.reelink/page-469cd67be477d6b3582c00140b5ca998-webm-d2c25fb94f/analysis.json` — stale pre-rename artifact (uses old `findings` shape)
