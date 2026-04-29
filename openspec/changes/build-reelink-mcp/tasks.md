## Current State (auto-updated 2026-04-29 ~15:58 AEST)

**Where we are:**

| Phase | Status | Notes |
|---|---|---|
| **P0** Architecture Lock + Layer 0 Baseline | ✅ **COMPLETE** | Verified end-to-end on Mac Studio. WorkItem schema round-trips through `qwen/qwen3.6-flash` raw video. |
| **P1A** Deterministic Retrieval + DevX | 🟡 **IN PROGRESS** | Cursor agent on `feat/faction-a-retrieval-devx` branch, just unblocked from rebase. Expecting first commits ~16:15 AEST. |
| **P1B** Demo + Submission Path | 🟡 **TESTABLE NOW** (the parts that don't depend on P1A) | Integration runbook written: `docs/integration-testing-runbook.md`. Harsha needs to execute Steps 4-7 to capture the portfolio bug video and run the agent against it. |
| **P2** Layer 1 Recording State Package | ⬜ **NOT STARTED** | Faction B not spawned. Recommend skipping for v0.1, scoping to v0.2 roadmap. |
| **P3** Layer 2 + Eval Evidence + Hardening | ⬜ **OUT OF SCOPE** | v0.2+. |

**What you can test RIGHT NOW** (no more code required):
- ✅ **Step into `docs/integration-testing-runbook.md`** — wire Reelink to your portfolio repo, register MCP in Codex CLI, record the bug, run the agent prompt, verify WorkItem JSON.
- This validates: P0.7 baseline in the real world, P1B.1 (bug capture), P1B.4 (MCP from Codex CLI).
- Does NOT test: P1A.x retrieval tools (still being implemented), P2.x Layer 1.

**What's blocked on P1A landing:**
- P1B.5 (`reelink_get_finding` from a coding agent)
- The "agent retrieves a specific WorkItem by id" demo flow

**Demo-path completeness when P1A lands** (~30 min from now):
- Run `bun run reelink/src/cli.ts analyze <bug.mov>` → get WorkItem[]
- Codex calls `reelink_get_finding(recording_id, "f1")` → enriched WorkItem returned
- Codex calls `reelink_query(recording_id, "summary")` → deterministic answer
- Codex calls `reelink_query(recording_id, "list work items")` → WorkItem array
- That's enough surface area for a coherent v0.1 demo.

---

## Active Risks (per `docs/workitem-schema-validation.md`)

1. **Lifecycle fields are stamped, not classified.** Decorative for v0.1. Acceptable.
2. **Old `findings`-shaped fixture exists locally.** Faction A retrieval helpers must tolerate or repair.
3. **Silent `ts: 0` coercion at `reelink/src/vlm/router.ts:105`.** P1A.0 (pre-retrieval) fix proposed.

---

## P0: [Arch][Layer0] Architecture Lock and Verified Layer 0 Baseline

### P0.1 [Arch] Repository Scaffold

- [x] 0.1.1 Initialize Node 20+ TypeScript package: `package.json` with `"type": "module"`, `tsconfig.json` strict mode, `.gitignore`, `.envrc`/`.env.example`, `README.md` skeleton.
- [x] 0.1.2 Install direct dependencies: `@modelcontextprotocol/sdk`, `ai` (v6), `@openrouter/ai-sdk-provider`, `playwright`, `ffmpeg-static`, `react-grab`, `zod`, `pino`, `pino-pretty`. Dev deps: `@types/node`, `@types/bun`, `typescript`. Do NOT install `rrweb` (dropped per Decision 4).
- [x] 0.1.3 Use Bun-backed package scripts for TypeScript and Playwright install so local scripts do not depend on a broken Homebrew Node shim.
- [x] 0.1.4 Verify `ffmpeg-static` binary downloads cleanly and is executable.
- [x] 0.1.5 Run a TypeScript type-check pass to confirm all imports resolve.

### P0.2 [Arch] API Key Provisioning (env-only)

- [x] 0.2.1 Provision `OPENROUTER_API_KEY` for current testing. Do not use OpenAI/GPT models in the v0.1 primary path.
- [ ] 0.2.2 Add to `~/.envrc` or `.env` (gitignored) only if needed for repeated local runs. Never commit keys.
- [x] 0.2.3 Smoke test one OpenRouter `generateText` call through AI SDK to a video-capable Qwen route.

### P0.3 [Demo] Demo Requirements Lock

- [x] 0.3.1 Lock the founder portfolio view-transition flicker as the primary demo target (the bug from the Granola transcript: "the words here, they are not seamless"). P0 does not require recording capture.
- [x] 0.3.2 Lock the portfolio FOUC as the backup demo target (the "green overlay before main shell" bug). P0 does not require recording capture.
- [x] 0.3.3 Keep synthetic Playwright fixtures for smoketests only. They are not the demo narrative.
- [x] 0.3.4 Lock real demo recording criteria for P1B/P3 capture: 6-15 seconds, QuickTime or CleanShot, 1280x720 or higher, no voiceover.

### P0.4 [Layer0] Model-Path Smoke Test

- [x] 0.4.1 Hand-craft one AI SDK call: pass a raw `.mov`/`.webm` recording directly to a video-capable OpenRouter Qwen route with a structured-output JSON schema enforcing `{bug_detected: bool, ts: number, type: string, description: string}`.
- [x] 0.4.2 Verify the response parses as strict JSON in one round-trip.
- [x] 0.4.3 Verify native video input against OpenRouter's live model catalog. `qwen/qwen3-vl-30b-a3b-instruct` is text+image only and MUST fail for raw video; default to `qwen/qwen3.6-flash` or another Qwen route whose `input_modalities` includes `video`.

### P0.5 [Arch] OpenSpec Workflow Refresh

- [x] 0.5.1 Read `openspec --help` once to internalize the CLI surface (status, list, show, validate, instructions, archive, sync, view).
- [x] 0.5.2 Verify `openspec validate build-reelink-mcp` returns clean. Confirm artifacts complete via `openspec status --change build-reelink-mcp`.

### P0.6 [Observability] Observability Scaffold

- [x] 0.6.1 Install `pino` plus `pino-pretty` as direct dependencies. Pino is the structured JSON logger; pino-pretty is dev-only readable output.
- [x] 0.6.2 Implement `src/utils/logger.ts`: stdio MCP forbids stdout writes (corrupts JSON-RPC), so all logs go to stderr. `REELINK_LOG_PRETTY=1` switches to pino-pretty transport in dev. `REELINK_LOG_LEVEL` controls verbosity.
- [x] 0.6.3 Implement `src/utils/tool-middleware.ts`: `withToolLogging(toolName, handler)` wraps any tool handler with structured enter/exit logging including duration, arg summary, result summary, and error stack. Auto-redacts keys matching `/key|secret|token|password|authorization/i`.
- [x] 0.6.4 Implement `src/gateway/telemetry.ts`: `telemetryFor(functionId, metadata)` returns the `experimental_telemetry` option for AI SDK v6 calls.
- [x] 0.6.5 Verify the smoke test at `scripts/smoketest-logger.ts` emits structured JSON to stderr and confirms secret redaction in tool middleware.
- [ ] 0.6.6 During implementation: every MCP tool handler MUST be wrapped in `withToolLogging`. Every AI SDK call MUST pass `experimental_telemetry: telemetryFor(...)`. No silent failures.
- [ ] 0.6.7 During Layer 1 capture: write a per-recording `logs.jsonl` alongside `manifest.json` so work-item debugging has a co-located log trail.
- [ ] 0.6.8 Defer to v0.2: Langfuse / OpenTelemetry exporter / Sentry. The v0.1 scope is local stderr + JSONL files only.

### P0.7 [Layer0] Layer 0 Video Finding Baseline

- [x] 0.7.1 Create the Node 20+ TypeScript package scaffold runnable by `npx -y reelink`. Use raw `@modelcontextprotocol/sdk`.
- [x] 0.7.2 Add the stdio MCP server entry point with `reelink_*` tool names and path-oriented returns.
- [x] 0.7.3 Install Vercel AI SDK v6 (`ai` package) and wire OpenRouter provider selection through AI SDK. Fetch model IDs at runtime from `https://openrouter.ai/api/v1/models` rather than hardcoding paid model assumptions.
- [x] 0.7.4 Implement config loading from `~/.reelink/config.json` while reading API keys from environment variables only (`OPENROUTER_API_KEY` for current testing).
- [x] 0.7.5 Implement `VideoPreprocessor` with `ffmpeg-static`, fps=1 baseline, max 64 frames, and long edge <=896px. Used for cached frame retrieval and future non-primary providers, not as a silent fallback for the OpenRouter/Qwen raw-video path.
- [x] 0.7.6 Implement `VLMRouter` on AI SDK v6: OpenRouter/Qwen raw-video route only for the primary path. Fetch `https://openrouter.ai/api/v1/models`, require the selected route's `input_modalities` to include `video`, and fail loudly for image-only Qwen routes. Structured output via `generateText` + `Output.object` so the VLM returns strict JSON in one round-trip.
- [x] 0.7.7 Implement `reelink_analyze(path, fps_sample=4, focus="any")` for `.mov`/`.mp4`/`.webm` path-only input.
- [x] 0.7.8 Return `{recording_id, duration_sec, summary, work_items: [{id, ts, type, severity, title, confidence}], next_steps}`.
- [x] 0.7.9 Verify the Layer 0 raw-video smoke on `qwen/qwen3.6-flash` via OpenRouter with no frame fallback. Evidence: `.reelink/page-469cd67be477d6b3582c00140b5ca998-webm-d2c25fb94f/` from the Mac Studio smoke at commit `8d60cfa`.
- [x] 0.7.10 Verify persistence creates `manifest.json`, `analysis.json`, `frames/`, source video reference, and a `streams` map with explicit `not_collected` reasons for Layer 1+ streams. Evidence: `.reelink/page-469cd67be477d6b3582c00140b5ca998-webm-d2c25fb94f/` from the Mac Studio smoke at commit `8d60cfa`.

## P1A: [Retrieval][DevX] Deterministic Retrieval and DevX

**Owner:** Faction A (Cursor agent on `feat/faction-a-retrieval-devx`). **Status: IN PROGRESS as of 16:00 AEST.**

- [ ] 1A.0 [PROPOSED — pre-retrieval] Fix silent `ts: 0` coercion at `reelink/src/vlm/router.ts:105`. Filter null-`ts` findings with a stderr warn log; do not let them through as `ts: 0`. Single ~10 LOC commit before the rest of P1A. Reason: timestamp grounding is the entire video-as-state premise.
- [ ] 1A.1 Implement `RecordingStore` read helpers for `.reelink/<id>/` and sibling `recording.mov.reelink/` layouts: `loadAnalysis(id)`, `loadManifest(id)`, `listFrames(id)`, and `findFrameNearTimestamp(id, ts)`. Tolerate pre-rename fixtures with `findings` key by mapping to `work_items`.
- [ ] 1A.2 Persist or read `manifest.json`, original/imported video reference or copy, sampled frames, analysis output, and stream availability status. Manifest carries `prod_build` boolean and `streams` map per existing spec scenarios.
- [ ] 1A.3 Implement `reelink_get_frame(recording_id, ts)` returning `{path}`. **[Testable from integration runbook once shipped.]**
- [ ] 1A.4 Implement `reelink_get_finding(recording_id, work_item_id)` retrieving the identified work item and returning description, stack when known, surrounding console, DOM diff, suggested fix, and frame paths when available. **[Testable from integration runbook once shipped — unblocks P1B.5.]**
- [ ] 1A.5 Implement deterministic `reelink_query(recording_id, question)` over `analysis.json`, `manifest.json`, work_items, summary, next_steps, and manifest streams. No GPT and no ToolLoopAgent in v0.1. Use `docs/reelink-query-algorithm.md` as the matcher spec. **[Testable from integration runbook once shipped.]**
- [ ] 1A.6 Keep `reelink_get_dom(recording_id, ts)` honest before Layer 1: return `{ status: "not_collected", reason: "Layer 1 streams not present" }`; do not synthesize tree structure from frames.
- [ ] 1A.5b [v0.2 — DO NOT IMPLEMENT IN HACKATHON v0.1] Hybrid `reelink_query` GPT fallback. OpenAI API key is now available, so the architectural deferral is lifted. Implementation deferred to v0.2 because of submission time pressure (40 min to submit at 16:08 AEST). Deterministic matcher (P1A.5) is sufficient for the v0.1 demo. When implemented in v0.2: GPT-5-class ToolLoopAgent (AI SDK v6) with read-only tools (`loadAnalysis`, `loadManifest`, `findWorkItemById`, `findFrameNearTimestamp`), `@ai-sdk/openai` provider with `OPENAI_API_KEY`, `withToolLogging` + `experimental_telemetry`. Per Decision 11 of `design.md`.
- [ ] 1A.7 [Defer] Implement `npx reelink init` as the one-line setup flow for agent config registration. **Manual MCP registration is documented in `docs/integration-testing-runbook.md` Step 2 — that's enough for v0.1 demo. `init` is a polish item.**
- [ ] 1A.8 [Defer] Detect and generate MCP config snippets for Codex CLI, Cursor, Claude Code, Cline/Roo, and VS Code Copilot where possible.
- [ ] 1A.9 [Defer] Write MCP config snippets with absolute `npx` paths on Apple Silicon when required.
- [ ] 1A.10 [Defer] Implement `reelink doctor` checks for Node version, package resolution, Playwright browser install, hosted model API key presence, and agent config.
- [ ] 1A.11 [Defer] Ensure troubleshooting output never prints API keys or sensitive environment values.

## P1B: [Demo] Demo and Submission Path

**Owner:** Harsha (manual capture + verification on the MacBook). **Status: PARTIALLY TESTABLE NOW.**

- [ ] 1B.1 **[TESTABLE NOW]** Capture the founder's portfolio view-transition flicker as `demo-recordings/portfolio-view-transition.mov` and verify the Layer 0 path-only workflow against it. **Step 4 of `docs/integration-testing-runbook.md`.**
- [ ] 1B.2 Capture the portfolio FOUC as `demo-recordings/portfolio-fouc.mov` if the primary demo needs backup material.
- [ ] 1B.3 **[TESTABLE NOW after 1B.1]** Verify the cached recording folder contains manifest, frames, analysis output, `streams` map, and explicit missing-stream statuses. Inspect `.reelink/<id>/` after running `reelink_analyze`.
- [ ] 1B.4 **[TESTABLE NOW]** Verify the Reelink MCP can be invoked from a coding-agent-compatible stdio command path (Codex CLI primary). **Steps 1-7 of `docs/integration-testing-runbook.md`.** Pre-prepared: manual MCP config for `~/.codex/config.toml` documented.
- [ ] 1B.4a **[TESTABLE NOW]** Run `docs/setup-prompt.md` end-to-end inside a Codex session opened in the user's portfolio repo. The Codex agent autonomously: registers reelink MCP, calls `reelink_analyze` against the user-provided bug recording, validates the WorkItem[] schema fields, exercises retrieval tools when available, and reports end-to-end status. This is the canonical v0.1 demo onboarding flow per Decision 12.
- [ ] 1B.5 **[BLOCKED on P1A.4]** Verify `reelink_get_finding(recording_id, "f1")` works from a coding agent against the real demo recording.
- [ ] 1B.6 [Defer to v0.2 stretch] Codex-native flex demo script `reelink/scripts/demo-codex.ts`: analyze the founder portfolio video, read `WorkItem[]`, spawn Codex parallel sub-agents on git worktrees, demonstrate App Server mid-execution injection, and end with a PR URL. **Skeleton already shipped at `docs/codex-demo-script.md`. Implementation deferred — out of v0.1 critical path.**
- [ ] 1B.7 Prepare submission deliverables: 2-minute demo video, public repo, r/codex post, and Codex-native setup narrative. **Drafts shipped at `docs/submission-pack.md`.**
- [ ] 1B.8 Polish README/demo instructions only after the working demo path passes.

## P2: [Layer1][Observability] Layer 1 Recording State Package

- [ ] 2.1 Implement the MCP gateway pattern (Decision 9): spawn Playwright MCP as a child stdio subprocess, attach it to Reelink's launched Chromium via `--cdp-endpoint`, list its tools via the MCP client SDK.
- [ ] 2.2 Forward a curated subset of Playwright MCP tools with `reelink_browser_*` prefix: `reelink_browser_navigate`, `reelink_browser_click`, `reelink_browser_type`, `reelink_browser_evaluate`, `reelink_browser_snapshot`, `reelink_browser_take_screenshot`. Do NOT forward video / trace tools (Reelink-native owns recording).
- [ ] 2.3 Implement `npx reelink record <url>` using the Playwright library directly.
- [ ] 2.4 Launch Chromium with `--remote-debugging-port=<port>`. Start Playwright MCP child with `--cdp-endpoint=ws://localhost:<port>` so both attach to the same browser.
- [ ] 2.5 Capture `video.webm` via Playwright `recordVideo` and `trace.zip` via `context.tracing.start({ screenshots: true, snapshots: true, sources: true })`.
- [ ] 2.6 Inject bippy `install-hook-only` via the FIRST `addInitScript` so it runs before React boots. Then inject the full bippy bundle, react-grab the library, and a per-commit recorder via a second `addInitScript`. Order is mandatory.
- [ ] 2.7 Persist `fiber-commits.jsonl` plus `source-dictionary.json`.
- [ ] 2.8 Persist `react-grab-events.jsonl` from element-pointer events when available.
- [ ] 2.9 Capture `network.har` and `console.jsonl` with redaction/omission for sensitive headers and tokens.
- [ ] 2.10 Merge captured streams into the recording folder with timestamp alignment recorded in `manifest.json`.
- [ ] 2.11 Implement `reelink_get_dom(recording_id, ts)` returning `{path, tree_summary}` derived from Playwright trace snapshots plus fiber-commit topology.
- [ ] 2.12 Implement `reelink_get_components(recording_id, ts, x?, y?)` returning `{component, file, line, props}` when available, projectable to agentation-style and react-grab-XML formats.
- [ ] 2.13 Normalize timestamps across video frames, work items, fiber commits, react-grab events, network events, console events, and Playwright trace metadata using a shared `performance.now()` origin.
- [ ] 2.14 Store time deltas and stream availability so queries can distinguish exact, nearest, and missing context.
- [ ] 2.15 Build DOM summaries from Playwright trace snapshots plus fiber topology instead of returning large raw DOM dumps through MCP.
- [ ] 2.16 Attach nearby console and network events to work items without embedding large HAR or trace payloads in MCP responses.
- [ ] 2.17 Ensure all query tools return file paths and concise summaries rather than pixels, bytes, or unbounded logs.
- [ ] 2.18 Use bippy directly for per-commit fiber capture; use react-grab the library headless-or-toolbar mode for element-pointer enrichment.
- [ ] 2.19 Capture component names, source files, line numbers, props, and bounding/DOM association when available.
- [ ] 2.20 `secure()` wrapping is mandatory; set `dangerouslyRunInProduction: true` only when explicitly recording a prod build.
- [ ] 2.21 Degrade gracefully to DOM-only context when React, source maps, development mode, or compatible internals are unavailable. Mark source-map stream status and failure reasons in `manifest.json`.

## P3: [Layer2][Observability] Layer 2, Eval Evidence, and Post-v0.1 Hardening

- [ ] 3.1 Implement `PlaywrightLibraryHarness` for agent-controlled browser task recording.
- [ ] 3.2 Implement `reelink_run(task_description, target_url)` returning `{recording_id, success, summary}`.
- [ ] 3.3 Store the resulting recording as eval evidence in the same folder architecture.
- [ ] 3.4 Provide recent-frame-plus-state observations shaped as `{frame_path, dom_summary, component_map, network_since_last, console_since_last}` for next-action input.
- [ ] 3.5 Ensure failed or partial agent runs preserve the recording and explain failure state.
- [x] 3.6 ~~Defer GPT/OpenAI ToolLoopAgent query reasoning to v0.2 unless explicitly re-approved.~~ **RE-APPROVED 2026-04-29 ~16:05 AEST: OpenAI API key available. GPT-5-class fallback for `reelink_query` re-enabled as P1A.5b stretch in v0.1 scope.**
- [ ] 3.7 Represent recordings and agent runs as eval evidence before attempting to generate deterministic tests.
- [ ] 3.8 Generate Playwright checks only for work items with reliable runtime/repro context.
- [ ] 3.9 Prefer stable DOM, style, route, loading, or network invariants over brittle animation screenshot assertions.
- [ ] 3.10 Store eval artifact paths, expected pre-fix behavior, confidence, and verification results in the recording folder.
- [ ] 3.11 Avoid making unverified benchmark or token-saving claims in generated docs or output.
- [ ] 3.12 If Layer 1 is implemented, verify Playwright trace, bippy fiber commits, react-grab events, network HAR, console JSONL, DOM retrieval, and component retrieval on one recorded app.
- [ ] 3.13 If Layer 2 is implemented, verify `reelink_run` records the session and returns a reusable recording ID via `reelink_browser_*` ops on the shared CDP-attached Chromium.
- [ ] 3.14 Verify the gateway pattern: only ONE MCP server is registered in the user's coding-agent config (`reelink`), and `reelink_browser_*` tools route through the spawned Playwright MCP child without a second registration.
