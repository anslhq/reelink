# Reelink Completion Audit

> Historical/non-authoritative note: this audit is retained as a dated Wave-era reconciliation artifact from 2026-04-30. It is not the current canonical checklist, not an authority for archive readiness, and not a replacement for the active OpenSpec plan, current verifier output, or observed code/test evidence.

## Historical Context

This document recorded contradictions that existed at the time between:

- the completion plan at `/Users/harsha/.cursor/plans/reelink_completion_fb9c0886.plan.md`
- the then-current OpenSpec change set and active specs under `openspec/`
- the then-current implementation and tests under `reelink/`
- then-current status/checklist claims in `openspec/changes/build-reelink-mcp/tasks.md` and `reelink/README.md`

Use it only as historical context for how earlier Reelink/Reck gaps were identified. Current status must come from the active OpenSpec execution plan, current verifier output, and observed local code/test/package evidence.

## Executive Assessment

The completion plan is substantially correct.

The repo already contains meaningful implementation work, especially around artifact persistence, browser recording plumbing, child Playwright MCP gateway architecture, and honest missing-stream behavior. However, the branch is **not complete** by the plan's standard, and parts of the current OpenSpec/tasks/docs state materially overclaim completion.

The most important conclusion is this:

- Reelink is **not** blocked on rediscovering architecture.
- Reelink **is** blocked on reconciling public contracts, React capture reality, `reelink_run` contract shape, DevX/runtime expectations, and the truthfulness of OpenSpec/status artifacts.

In short: the codebase has strong infrastructure, but the public/product surface is still short of the completion plan in exactly the places the plan called out.

## Confirmed Critical Gaps

### 1. Public Layer 0 contract still returns `work_items` instead of spec-compatible `findings`

**Status:** Confirmed gap

The completion plan explicitly requires restoring or bridging the public analysis contract so the externally visible response exposes `findings` while preserving `work_items` only if needed for compatibility.

Current evidence:

- `reelink/src/mcp/tools/analysis.ts` registers `reelink_analyze` with output keys `recording_id`, `duration_sec`, `summary`, `work_items`, `next_steps`
- `reelink/src/analysis/pipeline.ts` returns `work_items`
- `reelink/src/schemas/layer0.ts` and related tests lock the `work_items` shape
- `openspec/changes/build-reelink-mcp/specs/video-finding-analysis/spec.md` still requires `{recording_id, duration_sec, summary, findings, next_steps}`

Affected files:

- `reelink/src/mcp/tools/analysis.ts`
- `reelink/src/analysis/pipeline.ts`
- `reelink/src/schemas/layer0.ts`
- `reelink/tests/analyze-orchestration.test.ts`
- `reelink/tests/mcp-tool-surface.test.ts`
- `openspec/changes/build-reelink-mcp/specs/video-finding-analysis/spec.md`
- `openspec/specs/video-finding-analysis/spec.md`

Why it matters:
This is a user-visible contract drift, not an internal naming issue.

### 2. Public browser gateway surface is missing `reelink_browser_evaluate` and `reelink_browser_take_screenshot`

**Status:** Confirmed gap

The completion plan explicitly calls these missing public tools out as bugs.

Current evidence:

- `reelink/src/browser-recording/playwright-driver.ts` supports forwarded child-gateway operations for evaluate and screenshot
- `reelink/src/mcp/tools/recording.ts` does **not** register public `reelink_browser_evaluate` or `reelink_browser_take_screenshot`
- `reelink/tests/mcp-tool-surface.test.ts` locks a smaller public tool surface that omits both tools
- `reelink/scripts/smoketest-child-gateway.ts` validates snapshot/click coverage but not evaluate/screenshot coverage

Affected files:

- `reelink/src/mcp/tools/recording.ts`
- `reelink/src/browser-recording/playwright-driver.ts`
- `reelink/tests/mcp-tool-surface.test.ts`
- `reelink/scripts/smoketest-child-gateway.ts`
- `openspec/changes/build-reelink-mcp/design.md`

Why it matters:
The internal gateway is real, but the public MCP contract is incomplete.

### 3. React capture/annotation is still partial and heuristic, not the plan's required real react-grab capture

**Status:** Confirmed gap

The completion plan requires real `react-grab` integration, visible selection/annotation behavior, full component/source capture, and agent-readable projections.

Current evidence:

- `reelink/src/browser-recording/lifecycle.ts` still behaves like a best-effort/heuristic path rather than a real user-driven annotation flow
- `reelink/src/runtime-artifacts/retrieval.ts` returns a thin component response and only local helper projections (`componentMarkdown`, `componentXml`)
- the current component projection output does not match the richer OpenSpec schema or the plan's requested `toAgentationMarkdown()` / `toReactGrabXML()` helpers

Affected files:

- `reelink/src/browser-recording/lifecycle.ts`
- `reelink/src/runtime-artifacts/retrieval.ts`
- `reelink/tests/browser-recording-lifecycle.test.ts`
- `reelink/tests/runtime-artifact-retrieval.test.ts`
- `openspec/changes/build-reelink-mcp/specs/react-fiber-source-map/spec.md`
- `openspec/specs/react-fiber-source-map/spec.md`

Why it matters:
This is the largest remaining product-surface gap after contract fixes. The current branch has graceful degradation and some capture plumbing, but not the fully intended React capture experience.

### 4. `reelink_run` still misses the required `success` contract and populated observation fields

**Status:** Confirmed gap

The completion plan requires `reelink_run` to expose the required success signal and to populate `frame_path` and `component_map` when artifacts exist.

Current evidence:

- `reelink/src/mcp/tools/recording.ts` defines `reelink_run` output with `status`, not `success`
- `reelink/src/agent-run/run.ts` returns `status` only
- `reelink/src/agent-run/run.ts` hardcodes `recent_observation.frame_path = null` and `recent_observation.component_map = null`
- `reelink/tests/agent-run.test.ts` currently locks the weaker shape instead of the plan/spec shape
- `openspec/changes/build-reelink-mcp/specs/agent-recording-workflow/spec.md` still requires `{recording_id, success, summary}` and next-action observation readiness

Affected files:

- `reelink/src/mcp/tools/recording.ts`
- `reelink/src/agent-run/run.ts`
- `reelink/tests/agent-run.test.ts`
- `openspec/changes/build-reelink-mcp/specs/agent-recording-workflow/spec.md`
- `openspec/specs/agent-recording-workflow/spec.md`

Why it matters:
This is a direct mismatch with both the plan and the OpenSpec contract.

### 5. Current OpenSpec/tasks/docs state overclaims completion and is not trustworthy as a status artifact

**Status:** Confirmed gap

The current repo has a status problem as much as an implementation problem.

Current evidence:

- `openspec/changes/build-reelink-mcp/tasks.md` marks areas complete/current despite the unresolved public contract gaps above
- `reelink/README.md` presents a linked-local launch path as canonical and describes a weaker/older public surface than the completion plan intends
- `openspec/changes/build-reelink-mcp/tasks.md` references docs such as `docs/setup-prompt.md`, `docs/integration-testing-runbook.md`, `docs/codex-demo-script.md`, `docs/submission-pack.md`, and `docs/demo-recording-guide.md`, but repo search under `reelink/` does not currently find these files

Affected files:

- `openspec/changes/build-reelink-mcp/tasks.md`
- `reelink/README.md`
- repo docs claims under `reelink/`

Why it matters:
The repo currently contains authoritative-looking completion claims that conflict with the code and the plan. Those claims must be corrected before the project can be audited honestly.

## Secondary Gaps / Cleanup

### 6. OpenSpec still encodes stale launch/install guidance

**Status:** Confirmed spec drift

The completion plan says production launch should be npm-oriented: `bunx -y reelink` / `bun install -g reelink`, with `reelink-mcp` only for linked-local testing.

Current evidence:

- `openspec/changes/build-reelink-mcp/design.md` and related specs still describe `npx -y reelink` / `npx reelink init`
- `reelink/README.md` still centers `bun link` and `reelink-mcp`
- `reelink/src/config/diagnostics/init-config.ts` emits `reelink-mcp` snippets
- `reelink/src/config/diagnostics/diagnostics.ts` still references linked-local resolution messaging

Affected files:

- `openspec/changes/build-reelink-mcp/design.md`
- `openspec/changes/build-reelink-mcp/specs/agent-recording-workflow/spec.md`
- `openspec/specs/agent-recording-workflow/spec.md`
- `reelink/README.md`
- `reelink/src/config/diagnostics/init-config.ts`
- `reelink/src/config/diagnostics/diagnostics.ts`

### 7. Browser-recording folder layout is implemented in code but still stale/unclear in OpenSpec

**Status:** Confirmed spec drift + cleanup

The completion plan says browser recordings should intentionally live under `.reelink/browser-recordings/<id>`, while imported videos may remain `.reelink/<id>` or sibling `.reelink` folders.

Current evidence:

- `reelink/src/recordings/store.ts` uses `LEGACY_BROWSER_RECORDINGS_DIR = "browser-recordings"`
- current OpenSpec canon does not consistently encode the browser-recording path split the plan now blesses

Affected files:

- `reelink/src/recordings/store.ts`
- `openspec/changes/build-reelink-mcp/specs/recording-state-package/spec.md`
- `openspec/specs/recording-state-package/spec.md`
- `openspec/changes/build-reelink-mcp/design.md`

### 8. `reelink init` is create-once and not safe for rerun/update

**Status:** Confirmed gap

Current evidence:

- `reelink/src/config/diagnostics/init-config.ts` uses `writeFileSync(..., { flag: "wx" })`
- there is no safe merge/update path for existing `~/.reelink/config.json`
- the completion plan explicitly calls for safe update behavior

Affected files:

- `reelink/src/config/diagnostics/init-config.ts`
- `reelink/src/cli.ts`
- `reelink/tests/config-doctor.test.ts`

### 9. `prod_build` is hardcoded `false`

**Status:** Confirmed gap

Current evidence:

- `reelink/src/analysis/manifest.ts` sets `prod_build: false`
- `reelink/src/browser-recording/lifecycle.ts` sets `prod_build: false`
- `reelink/src/schemas/recording.ts` defaults `prod_build` to false

Affected files:

- `reelink/src/analysis/manifest.ts`
- `reelink/src/browser-recording/lifecycle.ts`
- `reelink/src/schemas/recording.ts`
- related tests that lock false behavior

Required outcome:
Either real detection or an explicitly honest unavailable/unknown path. The current unconditional false is not acceptable.

### 10. Manifest linkage between Layer 0 recordings and browser recordings is incomplete

**Status:** Confirmed cleanup gap

The completion plan calls for related-folder linkage for Layer 0 plus browser captures.

Current evidence:

- `reelink/src/schemas/recording.ts` has no relation/linkage field in `ManifestSchema`
- `reelink/src/analysis/manifest.ts` and `reelink/src/browser-recording/lifecycle.ts` do not encode related-package linkage

Affected files:

- `reelink/src/schemas/recording.ts`
- `reelink/src/analysis/manifest.ts`
- `reelink/src/browser-recording/lifecycle.ts`

### 11. Component schema/projections are thinner than required

**Status:** Confirmed gap

Current evidence:

- `reelink/src/runtime-artifacts/retrieval.ts` returns a reduced shape: `component`, `file`, `line`, `column`, `props`, `candidate`, `candidates`, `markdown`, `xml`, `delta_sec`, `source`, `prod_build`
- `componentMarkdown()` and `componentXml()` are local helper functions, not the explicit exported `toAgentationMarkdown()` / `toReactGrabXML()` style helpers called for by the plan
- the current XML output is a minimal `<component ... />` shape, not a richer `<selected_element>` projection

Affected files:

- `reelink/src/runtime-artifacts/retrieval.ts`
- `reelink/src/mcp/tools/recording.ts`
- `openspec/changes/build-reelink-mcp/specs/react-fiber-source-map/spec.md`
- `openspec/specs/react-fiber-source-map/spec.md`

### 12. Child gateway smoke coverage is narrower than the required public surface

**Status:** Confirmed verification gap

Current evidence:

- `reelink/scripts/smoketest-child-gateway.ts` validates snapshot/click forwarding
- it does not prove public evaluate/screenshot routing because those tools are not public yet

Affected files:

- `reelink/scripts/smoketest-child-gateway.ts`
- `reelink/tests/mcp-tool-surface.test.ts`

## What Is Already Correct And Should NOT Be Reopened

These areas appear real and should be preserved while the remaining work is finished.

### A. Single child Playwright MCP gateway architecture

**Status:** Already satisfied

The architecture itself is correct and implemented in substance.

Key files:

- `reelink/src/browser-recording/playwright-driver.ts`
- `reelink/src/browser-recording/lifecycle.ts`
- `reelink/scripts/smoketest-child-gateway.ts`

What remains here is **public exposure and verification coverage**, not architectural redesign.

### B. Honest missing-stream behavior

**Status:** Already satisfied

Runtime retrieval and recording logic already return explicit missing-stream/unavailable states instead of fabricating DOM/component/eval data.

Key files:

- `reelink/src/runtime-artifacts/retrieval.ts`
- `reelink/src/browser-recording/lifecycle.ts`

### C. Relative browser manifest artifact paths

**Status:** Largely satisfied

Browser-recording artifact path hygiene is better than the completion plan sometimes implies. The remaining manifest issue is relation metadata and `prod_build`, not basic relativity.

Key files:

- `reelink/src/browser-recording/lifecycle.ts`
- `reelink/tests/browser-recording-lifecycle.test.ts`

### D. Redaction and bounded runtime evidence handling

**Status:** Already satisfied

Secret redaction, bounded event windows, and omission of huge raw payloads are already meaningfully implemented.

Key files:

- `reelink/src/browser-recording/lifecycle.ts`
- `reelink/src/runtime-artifacts/retrieval.ts`
- `reelink/tests/browser-recording-lifecycle.test.ts`

### E. Core recording/artifact plumbing

**Status:** Already satisfied enough to build on

The branch already persists manifests, frames, analysis output, DOM snapshots, network/console JSONL, and agent-run artifacts. This should be treated as an asset, not dismissed.

Key files:

- `reelink/src/recordings/store.ts`
- `reelink/src/browser-recording/lifecycle.ts`
- `reelink/src/agent-run/run.ts`

## Contradiction Matrix


| Topic                            | Completion Plan                                                                                                      | Current OpenSpec                                             | Current Code / Tests / Docs                                                        | Resolution                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Production launch path           | `bunx -y reelink` / `bun install -g reelink`; `reelink-mcp` only for linked-local testing                            | still centered on `npx`/`npx reelink init` in multiple specs | `reelink/README.md` and init snippets still center linked-local `reelink-mcp` flow | Update OpenSpec and DevX to production npm/bunx path; demote linked-local usage to local testing only |
| Layer 0 response contract        | public response must expose `findings`                                                                               | specs still require `findings`                               | code/tests expose `work_items` only                                                | Add public compatibility bridge and update tests                                                      |
| Browser recording package layout | browser sessions under `.reelink/browser-recordings/<id>`; imported videos remain `.reelink/<id>` or sibling package | stale/inconsistent                                           | code already uses `browser-recordings` path in store                               | Update specs/tasks/docs to match actual intended split                                                |
| Public browser gateway surface   | evaluate + screenshot must be public MCP tools                                                                       | under-specified                                              | internal driver supports them; public registration/tests omit them                 | Add tools, tests, and smoke coverage                                                                  |
| React capture / annotation       | real react-grab capture + visible annotation + full projections                                                      | stricter than current tasks file implies                     | current implementation still partial/heuristic                                     | Implement real event capture and richer output/projection helpers                                     |
| `reelink_run` contract           | `{recording_id, success, summary}` + usable recent observation                                                       | specs require success-based contract                         | code/tests use `status`, with null `frame_path` and `component_map`                | Update runtime/tool/test contract                                                                     |
| `prod_build`                     | detect or honestly mark unavailable                                                                                  | requires meaningful boolean semantics                        | hardcoded `false` in manifest builders/schema                                      | Implement detection or honest unknown path                                                            |
| Completion status claims         | only mark complete after observed passing behavior                                                                   | current tasks file says many areas are complete              | evidence conflicts with those claims                                               | Rewrite tasks/status honestly                                                                         |
| DevX docs                        | production onboarding + runbook path expected                                                                        | current tasks reference missing docs                         | repo search under `reelink/` does not currently find claimed files                 | Create/fix docs or stop claiming they exist                                                           |


## Comprehensive Ordered Remediation Checklist

This checklist is the execution order that best matches the completion plan and the repo evidence.

### Todo 1: `openspec-update`

Goal: make OpenSpec honest and aligned before touching implementation checkboxes again.

#### Confirmed gap work

- Update `openspec/changes/build-reelink-mcp/design.md` to distinguish:
  - production install/launch path (`bunx -y reelink` / `bun install -g reelink`)
  - linked-local testing path (`bun link`, `reelink-mcp`) as a local development/testing path only
- Update `openspec/changes/build-reelink-mcp/tasks.md` so incomplete work is marked incomplete
- Remove or downgrade `[x]` claims in `openspec/changes/build-reelink-mcp/tasks.md` where evidence conflicts with current code/tests
- Update `openspec/changes/build-reelink-mcp/specs/video-finding-analysis/spec.md` and `openspec/specs/video-finding-analysis/spec.md` to keep `findings` as the public contract authority
- Update `openspec/changes/build-reelink-mcp/specs/recording-state-package/spec.md` and `openspec/specs/recording-state-package/spec.md` to explicitly bless `.reelink/browser-recordings/<id>` for browser sessions
- Update `openspec/changes/build-reelink-mcp/specs/agent-recording-workflow/spec.md` and `openspec/specs/agent-recording-workflow/spec.md` to explicitly require public browser evaluate/screenshot tools if they remain part of the intended surface
- Ensure the active `openspec/specs/` canon matches the updated change-folder truth, not the stale pre-audit story

#### Already satisfied and should remain

- Preserve single child Playwright MCP gateway architecture
- Preserve no-rrweb and no-agentation v0.1 decisions
- Preserve honest missing-stream semantics

### Todo 2: `contracts-gateway`

Goal: fix the public MCP contract and gateway exposure.

#### Confirmed gap work

- Update `reelink/src/mcp/tools/analysis.ts` so public `reelink_analyze` exposes spec-compatible `findings`
- Update `reelink/src/analysis/pipeline.ts` to return or bridge `findings`
- Update `reelink/src/schemas/layer0.ts` and any shared schema exports to support the public `findings` contract
- Decide whether `work_items` remains as an internal/storage/backward-compatibility alias; if so, document it clearly and do not let it remain the only public field
- Add `reelink_browser_evaluate` to `reelink/src/mcp/tools/recording.ts`
- Add `reelink_browser_take_screenshot` to `reelink/src/mcp/tools/recording.ts`
- Update `reelink/tests/mcp-tool-surface.test.ts` to lock the corrected public surface
- Extend `reelink/scripts/smoketest-child-gateway.ts` to exercise evaluate/screenshot, not just snapshot/click

#### Already satisfied and should remain

- Keep `reelink/src/browser-recording/playwright-driver.ts` child-gateway architecture intact

### Todo 3: `react-grab-completion`

Goal: replace the current partial React/source capture story with the intended one.

#### Confirmed gap work

- Replace heuristic/best-effort React capture in `reelink/src/browser-recording/lifecycle.ts` with real react-grab-driven capture where supported
- Ensure visible user selection/annotation events are actually captured and persisted as real `react-grab-events.jsonl` evidence
- Expand `reelink/src/runtime-artifacts/retrieval.ts` to support the richer canonical component schema required by OpenSpec
- Introduce explicit exported projection helpers equivalent to `toAgentationMarkdown()` and `toReactGrabXML()`
- Ensure XML projection matches the intended `<selected_element>` style rather than the current minimal `<component ... />` output
- Preserve prop redaction guarantees while expanding schema richness
- Update `reelink/tests/runtime-artifact-retrieval.test.ts` and `reelink/tests/browser-recording-lifecycle.test.ts` to lock the stronger behavior

#### Cleanup work

- Reconcile component schema naming/fields with `openspec/changes/build-reelink-mcp/specs/react-fiber-source-map/spec.md`

#### Already satisfied and should remain

- Keep graceful degradation when React/source internals are genuinely unavailable

### Todo 4: `devx-manifest-run`

Goal: close the remaining DevX, manifest, and `reelink_run` gaps.

#### Confirmed gap work

- Update `reelink/src/config/diagnostics/init-config.ts` so `reelink init` safely updates existing config instead of failing on rerun
- Update `reelink/src/config/diagnostics/init-config.ts` and `reelink/README.md` to present the production npm/bunx install path as canonical
- Update `reelink/src/config/diagnostics/diagnostics.ts` doctor messaging so it matches the intended production story and does not assume linked-local usage as the main path
- Update `reelink/src/mcp/tools/recording.ts` and `reelink/src/agent-run/run.ts` so `reelink_run` returns the required `success` contract
- Populate `recent_observation.frame_path` when frame artifacts exist
- Populate `recent_observation.component_map` when component artifacts exist
- Update `reelink/tests/agent-run.test.ts` to lock the stronger contract
- Implement real `prod_build` detection or an explicitly honest unavailable path in:
  - `reelink/src/analysis/manifest.ts`
  - `reelink/src/browser-recording/lifecycle.ts`
  - `reelink/src/schemas/recording.ts`
- Add manifest relation/linkage metadata between imported video packages and browser recordings where applicable

#### Cleanup work

- Decide whether currently claimed docs should be created under `reelink/` or whether tasks/docs should stop claiming they exist
- If docs are intended, create/fix:
  - `reelink/docs/setup-prompt.md`
  - `reelink/docs/integration-testing-runbook.md`
  - `reelink/docs/codex-demo-script.md`
  - `reelink/docs/submission-pack.md`
  - `reelink/docs/demo-recording-guide.md`

### Todo 5: `verify-sync`

Goal: prove the corrected system and only then re-mark completion.

#### Confirmed gap work

- Update/add tests for `findings` compatibility
- Update/add tests for public browser evaluate/screenshot tools
- Update/add tests for real react-grab annotation events
- Update/add tests for richer component schema and projection helpers
- Update/add tests for init rerun/update behavior
- Update/add tests for manifest relation metadata and non-hardcoded `prod_build`
- Update/add tests for `reelink_run` `success` contract and populated observation fields
- Extend smoke coverage to the full intended child-gateway surface
- Run verification commands and capture observed pass/fail evidence before changing status artifacts
- Re-run OpenSpec validation/status commands
- Only after all relevant code/tests/docs pass, update `openspec/changes/build-reelink-mcp/tasks.md` to reflect observed completion

## Verification Checklist / Definition of Done

Do **not** mark Reelink complete until all of the following are true.

### Public contract checks

- `reelink_analyze` returns spec-compatible `findings`
- if `work_items` is preserved, it is clearly documented as compatibility/internal support, not the only public contract
- public tool surface includes `reelink_browser_evaluate`
- public tool surface includes `reelink_browser_take_screenshot`
- `reelink_run` returns `{recording_id, success, summary}` or an equivalent explicitly spec-updated contract if intentionally changed
- `reelink_run` populates `frame_path` and `component_map` when artifacts exist

### React/runtime checks

- react-grab capture is real on supported pages, not just heuristic DOM sampling
- component output supports the required richer schema
- projection helpers are explicit and tested
- prop redaction still holds
- honest degradation still holds where streams are unavailable

### Manifest / storage checks

- browser session layout and imported video layout are explicitly documented and tested
- manifest artifact paths are relative where required
- `prod_build` is not hardcoded false without evidence
- manifest relation/linkage metadata exists where the plan requires related-folder linkage

### DevX checks

- `reelink init` safely reruns and updates existing config
- `reelink doctor` messaging matches the intended production install path
- README and any runbook/setup docs match the intended install and testing story
- docs claimed by tasks/docs actually exist where claimed, or the claims are removed

### Verification commands

Run, inspect, and record results for at least:

```bash
cd /Users/harsha/Developer/hackathon/reelink
bun install
bun run typecheck
bun run build
bun test tests/mcp-tool-surface.test.ts
bun test tests/analyze-orchestration.test.ts
bun test tests/agent-run.test.ts
bun test tests/runtime-artifact-retrieval.test.ts
bun test tests/browser-recording-lifecycle.test.ts
bun run scripts/smoketest-child-gateway.ts
```

And for OpenSpec:

```bash
cd /Users/harsha/Developer/hackathon
openspec validate build-reelink-mcp
openspec status --change build-reelink-mcp
```

Final rule:

- `openspec/changes/build-reelink-mcp/tasks.md` is updated **after** the corresponding code/tests/docs verification passes, not before

## File Map Of Likely Touched Files

### OpenSpec sync

- `openspec/changes/build-reelink-mcp/design.md`
- `openspec/changes/build-reelink-mcp/tasks.md`
- `openspec/changes/build-reelink-mcp/specs/agent-recording-workflow/spec.md`
- `openspec/changes/build-reelink-mcp/specs/video-finding-analysis/spec.md`
- `openspec/changes/build-reelink-mcp/specs/react-fiber-source-map/spec.md`
- `openspec/changes/build-reelink-mcp/specs/recording-state-package/spec.md`
- `openspec/specs/agent-recording-workflow/spec.md`
- `openspec/specs/video-finding-analysis/spec.md`
- `openspec/specs/react-fiber-source-map/spec.md`
- `openspec/specs/recording-state-package/spec.md`

### Analysis contract

- `reelink/src/mcp/tools/analysis.ts`
- `reelink/src/analysis/pipeline.ts`
- `reelink/src/schemas/layer0.ts`
- `reelink/tests/analyze-orchestration.test.ts`

### Browser gateway contract

- `reelink/src/mcp/tools/recording.ts`
- `reelink/src/browser-recording/playwright-driver.ts`
- `reelink/tests/mcp-tool-surface.test.ts`
- `reelink/scripts/smoketest-child-gateway.ts`

### React capture and retrieval schema

- `reelink/src/browser-recording/lifecycle.ts`
- `reelink/src/runtime-artifacts/retrieval.ts`
- `reelink/tests/browser-recording-lifecycle.test.ts`
- `reelink/tests/runtime-artifact-retrieval.test.ts`

### Manifest and recording metadata

- `reelink/src/analysis/manifest.ts`
- `reelink/src/schemas/recording.ts`
- `reelink/src/recordings/store.ts`
- `reelink/src/browser-recording/lifecycle.ts`

### DevX and `reelink_run`

- `reelink/src/config/diagnostics/init-config.ts`
- `reelink/src/config/diagnostics/diagnostics.ts`
- `reelink/src/cli.ts`
- `reelink/src/agent-run/run.ts`
- `reelink/tests/agent-run.test.ts`
- `reelink/README.md`
- intended docs under `reelink/docs/` if they are supposed to exist

## Bottom Line

Do **not** accept the current `openspec/changes/build-reelink-mcp/tasks.md` completion story as authoritative.

The correct interpretation of the repo today is:

- the plan was right,
- the branch has real implementation progress,
- the architecture does not need to be reinvented,
- but the project is still incomplete at the public contract, React capture, `reelink_run`, DevX, and verification-sync layers.

Until those items are fixed and re-verified, the honest status is **substantial progress, not completion**.