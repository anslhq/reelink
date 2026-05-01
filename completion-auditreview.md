# Completion Audit Review

Last updated: 2026-04-30

## Scope of this review

This review treats the **combined session transcript supplied by the user** as the highest source of truth for the intended end state of the repository, then checks the current repository state against that intended end state.

This is not a rehash of the hackathon-time scoping decisions. The user's stated goal now is a **real working open-source GitHub project with every single feature**, no gates, no checkpoints. So the question is:

- What did the transcript say the repo was supposed to become?
- What does the repo actually contain today?
- Where are the biggest mismatches, shortcuts, or overclaims?

The review is grounded in:

- the transcript content the user pasted into this chat,
- the current `reelink/` codebase,
- the current `openspec/changes/build-reelink-mcp/` artifacts,
- and the current public-facing docs.

## Executive verdict

The repo is in a **strong partial-completion state**, not a complete open-source project.

What is genuinely solid today:

- Layer 0 raw-video analysis exists and works.
- Retrieval now exists and is materially useful.
- The CLI and MCP surfaces are coherent enough to demo.
- The repo has been cleaned up enough to publish.
- There is a credible public story for Reelink as "temporal memory for coding agents."

What is **not** complete relative to the transcript's intended end state:

- The Layer 1 recording state package is still substantially unfinished in code.
- The single-MCP forwarded browser gateway is specified, partially exposed, but not end-to-end proven as the primary user path.
- `reelink_run` and the eval-evidence path are not at the transcript's intended maturity.
- Docs and OpenSpec still contain internal contradictions about `findings` vs `work_items`, local-link vs production install, and completeness claims.
- The repo is still carrying hackathon-era compromises in places where the current goal is supposed to be full open-source completion.

Bottom line: **not fake, not vapor, but still not the full product the transcript described.**

## Authority order used in this review

When sources disagree, this review uses:

1. The user's pasted combined transcript in this chat.
2. The current code under `reelink/`.
3. The current OpenSpec change under `openspec/changes/build-reelink-mcp/`.
4. The current public docs (`README.md`, `docs/`).

## What the transcript clearly established as the intended product

Across the planning and correction turns in the transcript, these points are very clear:

1. **The real product is not "AI bug reports."**
  It is a video/state primitive for coding agents.
2. **Layer 0 is path-only video analysis.**
  The user can point at a local `.mov` / `.mp4` / `.webm` and get structured output without requiring app instrumentation.
3. **Layer 1 is the real unlock.**
  A recording should become a state package that binds:
  - video
  - DOM state
  - React/component/source mapping
  - network
  - console
  - trace
  - and later eval artifacts
   to the same timeline.
4. **Layer 2 is agent self-recording.**
  The agent should be able to drive the browser, record its own session, and use the resulting recording as both evidence and next-step state.
5. **Single MCP is mandatory.**
  Users should not have to register multiple MCP servers. Reelink should be the one installed MCP.
6. **Qwen raw video is the primary VLM path.**
  No silent fallback that weakens the thesis. If a model route is image-only, it should fail loudly.
7. **react-grab is not optional fluff.**
  Visible annotation, source-path exposure, and component context are part of the intended user value.
8. **Codex is the canonical client for demo/testing.**
  Other clients may exist, but the transcript explicitly pulled the flow toward Codex-as-client.
9. **The project should be an actually usable open-source repo after the hackathon.**
  Not a dead demo.

## Current codebase reality

### What is implemented and real

#### 1. Layer 0 analyze path is real

Current files:

- `reelink/src/analyze.ts`
- `reelink/src/vlm/router.ts`
- `reelink/src/analysis/pipeline.ts`
- `reelink/src/vlm/openrouter.ts`
- `reelink/src/video/preprocessor.ts`
- `reelink/src/mcp/tools/analysis.ts`

Current reality:

- Raw video analysis is implemented.
- OpenRouter/Qwen route selection and modality checking exist.
- The analyze tool returns structured output.
- The current public tool schema includes **both** `findings` and `work_items` in `reelink/src/mcp/tools/analysis.ts`.
- The pipeline currently materializes `findings` publicly while preserving `work_items` internally via `reelink/src/analysis/pipeline.ts`.

This is good and is materially closer to the intended product than the earlier states in the transcript.

#### 2. Persistence and retrieval are real

Current files:

- `reelink/src/recordings/store.ts`
- `reelink/src/mcp/tools/retrieval.ts`
- `reelink/src/query/`*

Current reality:

- Analysis artifacts are stored under `.reelink/<id>/`.
- Read-side helpers exist for loading manifest / analysis / work items / nearest frames.
- `reelink_get_finding`, `reelink_get_frame`, and `reelink_query` are implemented.
- Deterministic query covers a useful set of patterns.
- There is explicit browser-recording support in the store for `.reelink/browser-recordings/<id>` and associated paths.

This is a real advance beyond the transcript checkpoint and makes the product materially more usable.

#### 3. `reelink record` exists

Current file:

- `reelink/src/cli.ts`

Current reality:

- The CLI now includes `record`.
- It opens a headed Playwright browser session and writes a `.webm`.
- This narrows a major gap between demo-only and actually usable tool.

#### 4. Layer 1/Layer 2 code has been scaffolded much further than the early audit state

Current files indicate substantial implementation work exists now, including:

- `reelink/src/browser-recording/lifecycle.ts`
- `reelink/src/browser-recording/playwright-driver.ts`
- `reelink/src/runtime-artifacts/retrieval.ts`
- `reelink/src/agent-run/run.ts`
- `reelink/src/mcp/tools/recording.ts`

The current public MCP tool surface already includes:

- `reelink_record_start`
- `reelink_record_stop`
- `reelink_record_status`
- `reelink_browser_snapshot`
- `reelink_browser_click`
- `reelink_browser_type`
- `reelink_browser_navigate`
- `reelink_browser_wait`
- `reelink_browser_evaluate`
- `reelink_browser_take_screenshot`
- `reelink_run`

That is materially beyond the earlier "stubs only" state.

### What is still incomplete or mismatched

## Findings

### 1. High: OpenSpec still contradicts the code on the Layer 0 public contract

Current code:

- `reelink/src/mcp/tools/analysis.ts` exposes **both** `findings` and `work_items`.
- `reelink/src/analysis/pipeline.ts` builds `findings` from internal work items.
- `reelink/src/schemas/layer0.ts` defines both `findings` and `work_items`.

Current OpenSpec:

- `openspec/changes/build-reelink-mcp/specs/video-finding-analysis/spec.md` still says the public contract authority is `findings` and warns that `work_items` must not be the only public contract.
- `openspec/changes/build-reelink-mcp/tasks.md` simultaneously marks Layer 0 implementation items complete using `work_items` language.

Why this matters:
The code has clearly moved to a dual-shape compromise. The spec still treats this as an unresolved remediation item. That means one of two things is true:

- either the spec is stale,
- or the code has taken a compatibility shortcut without fully reconciling the public contract.

This is not catastrophic, but it means the repo is still not cleanly coherent.

### 2. High: The public docs currently overstate implementation completion

Files:

- `reelink/README.md`
- `openspec/changes/build-reelink-mcp/tasks.md`

Examples:

- `reelink/README.md` lists `reelink_browser_evaluate`, `reelink_browser_take_screenshot`, and `reelink_run` as part of the tool surface, which is true, but it also frames large parts of the architecture as if the intended single-MCP forwarded path is already a stable finished story.
- `openspec/changes/build-reelink-mcp/tasks.md` currently marks large portions of P2 and P3 complete, including `reelink_run`, eval evidence, and child gateway verification.

Why this matters:
The transcript's end state was "make this a real open-source project with every single feature," not "declare victory when the code is in a plausible intermediate state." The repo still reads like it has crossed the finish line when it hasn't.

### 3. High: The Layer 1 and Layer 2 implementation exists, but the repo still lacks a clean, trustworthy proof that the single-MCP gateway path is the canonical tested path

Current code strongly suggests it exists:

- `reelink/src/mcp/tools/recording.ts` includes all the browser and run tools.
- `reelink/src/recordings/store.ts` has explicit browser-recording package support.
- `reelink/src/runtime-artifacts/retrieval.ts` has logic for browser artifacts and runtime context.
- `reelink/src/agent-run/run.ts` is present and exports a real path, not just a stub.

What is missing:

- In the current repo state available in this session, I do not yet have matching current tests proving those paths to the same standard as Layer 0.
- The docs and tasks read as if all of that is already verified and settled.

Why this matters:
For the transcript-defined end state, "it exists in code" is not enough. The repo needs the same confidence level on Layer 1/2 that Layer 0 now has.

### 4. Medium: `reelink init` / `doctor` and install guidance still reflect unresolved product-policy tension

Current code/docs:

- `reelink/src/cli.ts` still contains local-config-centric `init`/`doctor` behavior.
- `reelink/docs/integration-testing-runbook.md` pushes both production-oriented and local linked flows.
- `docs/setup-prompt.md` was explicitly rewritten around `bun link` + linked `reelink-mcp` binary for current testing.
- `openspec/changes/build-reelink-mcp/design.md` says production should center `bunx -y reelink` / global install, while Codex docs now pivot to linked-binary testing for actual working setup.

Why this matters:
This is a real unresolved tension between:

- what is the correct production install story,
- and what is the only working/testing path today.

The transcript made it clear that local hackathon expediency was acceptable then, but the user's current goal is a real open-source repo. That means this split still needs to be resolved cleanly in docs and code.

### 5. Medium: The transcript wanted raw video + rich state linkage as the heart of the product, but the current demoable path is still heavily Layer 0 centered

What is true today:

- Layer 0 is the only path I can say with high confidence is proven.
- Retrieval over Layer 0 artifacts is proven.
- `reelink record` is present.

What is not equally proven in this review:

- Full Layer 1 browser recording + runtime linkage + component/source retrieval on a real app.
- Full Layer 2 agent self-recording behavior as a polished product path.

Why this matters:
The transcript clearly elevated Layer 1 as the actual differentiator. The repo may have much of that code, but until the proof and docs align, the public face of the project still behaves like "strong Layer 0 plus promising roadmap."

### 6. Medium: `completion` messaging in OpenSpec is still too aggressive for the repo's current maturity

The top of `openspec/changes/build-reelink-mcp/tasks.md` shows a reconciled status table, but the active remediation list itself is marked fully done, including items that earlier review work identified as still needing verification.

This is likely overcorrection from the hackathon rush.

Why this matters:
Now that the user's goal is long-lived open source, the repo needs a stricter distinction between:

- implemented,
- verified,
- and roadmap.

### 7. Low: The repo root is now publishable, but still carries a lot of process/doc weight relative to the actual shipped product

The root now contains:

- `README.md`
- `LICENSE`
- `NOTICE`
- `docs/`
- `openspec/`
- `reelink/`

This is much cleaner than before. But it also means:

- the public repo still has a large amount of planning and coordination content,
- while the actual shipped runtime remains nested under `reelink/`.

This is not wrong, but if the user's current goal is a durable OSS repo, moving the `reelink/` package to the root remains a valid future cleanup after the implementation stabilizes.

## Strong patterns / consensus from the transcript that the repo still follows correctly

These are the transcript patterns that survived and should not be reopened:

1. **Qwen raw-video first.**
  The current router still centers OpenRouter/Qwen raw video, and the OpenSpec `design.md` reflects the live-catalog pivot to `qwen/qwen3.6-flash`.
2. **Single MCP server.**
  The design still holds the one-server rule. This is one of the strongest consistent decisions across the transcript.
3. **No rrweb in v0.1.**
  The code/spec direction remains aligned here.
4. **react-grab + bippy as the Layer 1 React/source path.**
  That remains clearly encoded in the design.
5. **Codex as canonical client.**
  The repo now has `docs/setup-prompt.md` and `docs/integration-testing-runbook.md` to support that.

## What changed meaningfully from the transcript that is probably correct

These are transcript deviations that I think were justified by live implementation reality, not random shortcutting:

1. **The Qwen route changed from research-era Qwen3-VL SKUs to `qwen/qwen3.6-flash`.**
  This is explicitly justified in `design.md` by live catalog data. That is a valid implementation-era correction.
2. **The docs shifted from pure `bunx -y reelink` production path to linked-binary testing for the actual demo flow.**
  Ugly, but realistic.
3. **The repo gained deterministic retrieval earlier than full Layer 1 hardening.**
  This is the right call for a working v0.1 story.

## Recommendation

The codebase is **past hackathon vapor** and is already a meaningful open-source project, but it is **not yet at the transcript's fully realized end state**.

If the goal is "real working open-source GitHub project with every single feature," the next action should be:

1. Stop rewriting planning docs.
2. Create a short public-facing roadmap section that explicitly says:
  - shipped now,
  - verified now,
  - in progress,
  - roadmap.
3. Put all remaining effort into proving the Layer 1 and Layer 2 paths end-to-end and making docs/install/client setup consistent with the actual tested path.

## Final verdict

**Current repo quality:** good hackathon project, decent OSS seed, not full completion.

**Main gap:** not enough trustworthy proof and coherence for the advanced Layer 1/2 features the transcript defined as core.

**Most important unfinished work:** make the Layer 1/2 state-linkage path as real and as obviously verified as Layer 0 already is.