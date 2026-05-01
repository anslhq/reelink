# GAPLIST

Last updated: 2026-04-30

## Purpose

This file is the delta between:
- `PRODUCT.md` as the definitive product definition, and
- the current repository state.

It is intentionally product-first.

This is **not** a roadmap of nice-to-haves.
It is a list of what is still missing, partial, misleading, or under-verified relative to the full intended product.

---

## Overall status

### What is real and working now
- Layer 0 imported video analysis works.
- Layer 0 persistence works.
- Deterministic retrieval over Layer 0 artifacts works.
- `reelink record <url>` exists.
- Public repo, README, license, and setup docs exist.
- A substantial amount of Layer 1 / Layer 2 code now exists.

### What is not fully complete
- Layer 1 is not yet proven as a real first-class supported product path.
- Layer 2 is not yet proven as a real first-class supported product path.
- Public contract vocabulary and compatibility policy are still messy.
- WorkItem lifecycle/protocol semantics are only partially captured as a product contract.
- Init/doctor/onboarding still reflect a split between ideal production path and actual tested local path.
- OpenSpec status and public docs still overstate completeness in places.

---

## Tier 1 — Highest-priority gaps

These are the core product gaps. If these are not finished, Reelink is still not the product defined in `PRODUCT.md`.

### 1. Layer 1 is not fully proven end-to-end

**What the product requires:**
Layer 1 must be a real, supported browser-native recording workflow that captures a timestamp-aligned state package with video, trace, DOM/runtime, network, console, React/source evidence, and public retrieval over those artifacts.

**What exists now:**
- `reelink/src/browser-recording/lifecycle.ts`
- `reelink/src/browser-recording/playwright-driver.ts`
- `reelink/src/runtime-artifacts/retrieval.ts`
- `reelink/src/mcp/tools/recording.ts`
- `reelink/src/recordings/store.ts`
- explicit `browser-recordings` package support exists in code
- public Layer 1 browser tools exist in MCP surface

**What is still missing or weak:**
- no single, trustworthy proof that the browser gateway, browser recording, and recording-owned Chromium really behave as the canonical supported path on a real app
- no proof in this review that the public Layer 1 tool path is verified to the same standard as Layer 0
- docs and tasks still read as if this path is already completely settled

**Files involved:**
- `reelink/src/browser-recording/lifecycle.ts`
- `reelink/src/browser-recording/playwright-driver.ts`
- `reelink/src/mcp/tools/recording.ts`
- `reelink/src/runtime-artifacts/retrieval.ts`
- `reelink/src/recordings/store.ts`
- `openspec/changes/build-reelink-mcp/design.md`
- `openspec/changes/build-reelink-mcp/tasks.md`

**Completion requirement:**
A real supported app recording must prove:
- video is captured,
- trace is captured,
- React/source capture is captured when available,
- public browser tools operate on the same session being recorded,
- runtime retrieval returns real evidence,
- and manifest/status fields stay honest.

### 2. Layer 2 is still under-verified as a product workflow

**What the product requires:**
`reelink_run` must be a real public workflow for agent self-recording.

**What exists now:**
- `reelink/src/agent-run/run.ts` exists and exposes `success`
- `reelink/src/mcp/tools/recording.ts` exposes `reelink_run`
- eval evidence structures exist

**What is still missing or weak:**
- no strong proof in this review that `reelink_run` is trustworthy in real app usage, not just in scaffolding/tests
- unclear whether all declared output states are genuinely reachable and consistent
- not enough current evidence that recent observations are always populated from real browser-recording artifacts in the intended user path

**Files involved:**
- `reelink/src/agent-run/run.ts`
- `reelink/src/mcp/tools/recording.ts`
- `openspec/changes/build-reelink-mcp/specs/agent-recording-workflow/spec.md`
- `openspec/changes/build-reelink-mcp/specs/eval-evidence-generation/spec.md`

**Completion requirement:**
The repo needs real proof for:
- success case
- partial-failure case
- insufficient-context case
- motion-only evidence case
- and durable artifact preservation

### 3. React/source capture is still not proven at the level the product definition demands

**What the product requires:**
Visible react-grab behavior, source path exposure, component mapping, and real event capture are product-critical.

**What exists now:**
- `react-grab-events.jsonl` is part of the package and runtime code paths
- `reelink/src/runtime-artifacts/retrieval.ts` has rich component schema support and projection helpers
- `reelink/src/browser-recording/lifecycle.ts` clearly contains explicit react-grab handling

**What is still missing or weak:**
- no final proof here that a real supported app produces the full intended visible react-grab + source-path experience end-to-end
- no final proof here that `react-grab-events.jsonl` is always sourced from real interaction on a real supported app path rather than only fixture/synthetic or partial evidence

**Files involved:**
- `reelink/src/browser-recording/lifecycle.ts`
- `reelink/src/runtime-artifacts/retrieval.ts`
- `openspec/changes/build-reelink-mcp/specs/react-fiber-source-map/spec.md`
- `reelink/docs/integration-testing-runbook.md`

**Completion requirement:**
A real app verification target must prove:
- visible overlay/glow
- click/annotate
- source path recovery
- component stack recovery
- and persisted `react-grab-events.jsonl`

### 4a. WorkItem protocol semantics are not yet fully locked

**What the product requires:**
A `WorkItem` is not only a renamed `Finding`. It is the first public slice of a broader agent-readable work protocol, with lifecycle/state semantics that can extend beyond bug reporting.

**What exists now:**
- `PRODUCT.md` establishes `WorkItem` as the richer long-term concept
- current code and docs use lifecycle fields like `state`, `approval_state`, `routed_to`, and `completed_at` in places
- the README and transcript both push toward a broader work-state framing

**What is still missing or weak:**
- no final product-level contract for which lifecycle fields are guaranteed in public responses
- no explicit statement of whether those fields are inferred, stamped, or model-produced
- no clear long-term story for how `WorkItem` extends beyond video bugs without confusing the current wedge

**Completion requirement:**
Document the public `WorkItem` contract explicitly: required fields, optional fields, lifecycle semantics, and how this protocol remains broader than the current bug-finding wedge.

### 4b. Motion-bug and non-technical reporter wedge needs explicit protection

**What the product requires:**
The product must stay anchored in the real wedge discussed in the transcript: motion/time-based bugs that screenshots miss, and an input path that works for non-technical reporters with only a recording.

**What exists now:**
- `PRODUCT.md` captures motion bugs and the second-order reporter clearly
- current Layer 0 UX still starts from a local video path

**What is still missing or weak:**
- no explicit guard against drifting back toward generic QA tooling language
- no explicit acceptance criterion that the product remain legible to a non-code user who can only hand over a recording

**Completion requirement:**
Keep this wedge explicit in docs and proof: at least one real workflow should remain understandable and usable for a reporter who has no repo access and only a screen recording.

### 4c. Provider/model-route drift remains a product risk

**What the product requires:**
The product thesis must survive model-route churn. If a model family changes, the public product behavior should stay stable and the docs should explain the real route honestly.

**What exists now:**
- live provider availability already forced route changes during development
- docs describe Qwen raw-video first at the thesis level

**What is still missing or weak:**
- no explicit product-level rule for how to document route-family changes when provider availability shifts
- risk of silently drifting from the researched model family to whatever is merely available at the moment

**Completion requirement:**
Add one stable policy: the product contract is behavior-first, provider-second, and any route-family shift that changes capabilities or trade-offs must be documented as a deliberate compatibility/availability decision.

### 4. Public contract still lacks final clarity

**What the product requires:**
A stable public contract for the API surface.

**What exists now:**
- `reelink/src/mcp/tools/analysis.ts` exposes both `findings` and `work_items`
- `reelink/src/analysis/pipeline.ts` materializes both
- `reelink/src/schemas/layer0.ts` defines both
- `reelink/src/query/deterministic-query.ts` still mixes `findings`-named patterns with `work_items` answers

**What is still missing or weak:**
- no final product-level decision on whether `findings` is the sole public Layer 0 contract
- no explicit end-state compatibility policy
- mixed terminology still leaks into query patterns and docs

**Files involved:**
- `reelink/src/mcp/tools/analysis.ts`
- `reelink/src/analysis/pipeline.ts`
- `reelink/src/schemas/layer0.ts`
- `reelink/src/query/deterministic-query.ts`
- `openspec/changes/build-reelink-mcp/specs/video-finding-analysis/spec.md`

**Completion requirement:**
Finalize one of:
- `findings` is the public contract, `work_items` internal only
- or dual-shape is an intentional compatibility window with a removal policy

---

## Tier 2 — Critical supporting gaps

### 5. Init / doctor / setup path is still split between ideal and real

**What the product requires:**
Install, setup, client registration, and doctor must be part of a coherent, truthful user story.

**What exists now:**
- `reelink/src/config/diagnostics/init-config.ts` provides snippets and safe merge behavior
- `reelink/src/cli.ts` includes `init` and `doctor`
- `docs/setup-prompt.md` and `reelink/docs/integration-testing-runbook.md` exist
- `reelink/docs/setup-prompt.md` still describes `bunx -y reelink` style product paths while `docs/setup-prompt.md` was rewritten around `bun link` + linked binary testing

**What is still missing or weak:**
- no single clean install story yet
- production docs and actual tested path still diverge
- current docs reflect hackathon expediency more than long-term OSS polish

**Files involved:**
- `reelink/src/config/diagnostics/init-config.ts`
- `reelink/src/config/diagnostics/diagnostics.ts`
- `reelink/src/cli.ts`
- `docs/setup-prompt.md`
- `reelink/docs/setup-prompt.md`
- `reelink/docs/integration-testing-runbook.md`
- `reelink/README.md`

**Completion requirement:**
The repo needs a final decision and proof for:
- production install path
- local dev path
- linked local test path
- supported clients
- and doctor readiness semantics

### 6. Recording package semantics are still not fully stabilized

**What the product requires:**
A stable, truthful recording package model across imported video, browser recording, and agent-run recording.

**What exists now:**
- imported video packages under `.reelink/<id>`
- browser package support under `.reelink/browser-recordings/<id>`
- manifest semantics include stream maps and `prod_build`
- `prod_build` is now honest (`null` / unknown path exists)

**What is still missing or weak:**
- relationship/linkage semantics between imported recordings, browser recordings, and agent runs are still not clearly proven as final
- package/documentation clarity is not fully finished

**Files involved:**
- `reelink/src/recordings/store.ts`
- `reelink/src/schemas/recording.ts`
- `reelink/src/analysis/manifest.ts`
- `reelink/src/browser-recording/lifecycle.ts`

**Completion requirement:**
The manifest and package layout must be stabilized and documented as a product contract, not just implementation behavior.

### 7. Eval evidence is present but still not product-clean

**What the product requires:**
Reelink recordings must be usable as durable evidence, without fake deterministic claims.

**What exists now:**
- eval evidence structures in `reelink/src/agent-run/run.ts`
- query/runtime/package code acknowledges eval streams
- OpenSpec carries the idea clearly

**What is still missing or weak:**
- no current proof here that final user-visible docs and outputs cleanly separate:
  - durable evidence,
  - suggested next assertion,
  - and generated deterministic test behavior
- hackathon-era language may still overstate the future test-generation angle

**Files involved:**
- `reelink/src/agent-run/run.ts`
- `openspec/changes/build-reelink-mcp/specs/eval-evidence-generation/spec.md`
- `reelink/README.md`

**Completion requirement:**
Eval evidence must be clearly truthful in code, docs, and tests.

---

## Tier 3 — Quality/coherence gaps

### 8. OpenSpec status still overclaims completion

**What exists now:**
- `openspec/changes/build-reelink-mcp/tasks.md` has a reconciled status table
- many tasks are checked complete across P0, P1A, P1B, P2, P3

**What is wrong:**
- it reads much closer to “complete” than the repo actually is under the full product definition
- P2 and P3 in particular are presented as if they are verified product paths, when the stronger proof level is not obvious from this repo review

**Completion requirement:**
OpenSpec should distinguish between implemented, tested, and fully product-verified.

### 9. Public docs still need a cleaner shipped-vs-roadmap split

The public repo is much better than before, but it still needs a clearer split between:
- shipped now,
- verified now,
- and roadmap.

This is especially true because `docs/` and `openspec/` now expose more future-facing technical shape than the actual shipped runtime fully proves.

### 10. Repo structure is publishable but still transitional

The root repo is now clean enough for publishing, but the actual runtime still lives under `reelink/` as a nested package. That is acceptable now, but long-term OSS polish may still want promotion to the root once the implementation stabilizes.

---

## Product truths that are already satisfied

These are no longer open questions.

- Reelink is correctly framed as temporal memory for coding agents.
- Qwen raw-video first is real in code.
- The product keeps a single-MCP story.
- `react-grab` + `bippy` remain the intended Layer 1 React/source path.
- Codex is the canonical client path.
- Retrieval is no longer hypothetical.
- `reelink record` is no longer hypothetical.

---

## Recommended next moves

### 1. Stop large doc rewrites
The product definition now exists in:
- `PRODUCT.md`
- `README.md`
- `completion-auditreview.md`

More doc churn is lower value than proof.

### 2. Promote proof over code-existence
For every remaining Layer 1 / Layer 2 feature, ask:
- where is the real-app proof?
- where is the client proof?
- where is the public contract proof?

### 3. Make one explicit shipped / verified / roadmap matrix
The repo needs one short authoritative matrix, not scattered overclaims.

### 4. Prove Layer 1 on a real supported app
This is the most important remaining product proof gap.

### 5. Prove Layer 2 honestly
Even if limited, it should be obviously real or obviously roadmap.

---

## Final summary

Reelink is already a **meaningful open-source dev tool**, not just a hackathon artifact.

But under the transcript-defined product, it is still:
- **Layer 0 complete enough to use**,
- **retrieval complete enough to matter**,
- **Layer 1 partially implemented but not yet fully proven**,
- **Layer 2 partially implemented but not yet fully proven**,
- and **still carrying contract/doc/completeness ambiguity** that a production OSS project should remove.

The biggest remaining work is not inventing new features.
It is making the advanced features already discussed and partially built **obviously real, obviously verified, and obviously coherent**.
