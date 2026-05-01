## Current State (reconciled 2026-04-30)

**Status authority:** this file is an in-progress OpenSpec checklist, not proof of completion. Product intent comes from the latest settled user corrections in `transcript-combined.md`; current code/tests/docs provide implementation evidence only. The old completion plan and `REELINK_COMPLETION_AUDIT.md` are historical inputs, not higher-order authority. Do not mark the overall change complete from this file alone.

**Proof levels used in this checklist:** `implemented`, `unit-tested`, `smoke-verified`, `real-app-verified`, `client-verified`, `complete`. Keep checkbox syntax intact because the OpenSpec workflow parses `- [ ]` and `- [x]`; use the status table and task annotations for proof detail instead of replacing checkboxes.

**Execution order:** Reck is in scope for this change. Build in this order to avoid churn: (1) root promotion decision and package/runtime/public-surface rename, (2) public contract finalization, (3) Layer 1 proof, (4) Layer 2 proof, (5) DevX/package/release cleanup. Do not claim product completion until the rename is real or every remaining old-name surface is documented as tested compatibility.


| Area                             | Honest status                                                        | Required remediation before completion                                                                                                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authority + status reset**     | In progress                                                          | Preserve checkbox mechanics while aligning status to Reck identity, transcript-first authority, and observed evidence.                                                                                                           |
| **Reck rename**                  | Public identity reconciled / nested package rename deferred / final launch still gated | Treat Reck as the public identity across package metadata, commands, storage, docs, and MCP surfaces. Current `reelink/` paths are accepted v0.1 implementation-path history per proposal/specs; root promotion or `reck/` folder rename is deferred to a dedicated migration, not claimed complete here. |
| **Layer 0 video analysis**       | Implemented in older naming / reporter wedge and contract proof pending | Public `reck_analyze` must expose `findings` as the normative Layer 0 response. `work_items` must not return by default unless documented/tested as compatibility/detail output. The recording-only reporter wedge must remain verified and legible. |
| **Layer 1 recording package**    | Substantially implemented / not yet real-app-verified / not complete | New writes must use `.reck/browser-recordings/<id>`. Real react-grab visible annotation/source capture must be proven on `~/Documents/Github/landing` and one additional lightweight target before broad support is claimed.   |
| **Layer 2 `reck_run`**           | Partially implemented / not yet workflow-verified / not complete     | Public output must include `{recording_id, success, summary}` and real artifact-backed recent observations. Partial failure evidence preservation must remain and be verified through the final Reck public workflow.           |
| **Provider strategy**            | Primary raw-video path implemented / drift policy pending enforcement | Product contract is behavior-first/provider-second. Provider or route-family changes must be explicit availability/compatibility decisions with documented trade-offs; no silent drift to whatever model currently exists.      |
| **Product DevX**                 | Snippets exist / inconsistent with final Reck identity / not ready    | `reck init` must either truly register supported clients or honestly describe snippet-only behavior. Codex is the first proven client, not the long-term product boundary; final Reck commands must be verified end-to-end.       |
| **Recording package / manifest** | Implemented in older storage / semantics need final proof             | Finalize relation metadata, package layouts, `.reck/` writes, legacy `.reelink/` reads if retained, frame lookup across package types, and `prod_build` detected/unknown semantics without unconditional fake values.          |
| **Docs/OpenSpec sync**           | In progress                                                          | Active specs and change-folder specs must remain paired. README/docs must center production `bunx -y @anslai/reck` / installed `reck`; linked `reck-mcp` is legacy/local-dev-only if temporarily supported.                 |
| **Final verification**           | Not complete                                                         | Completion requires implementation, tests, real-app/client/distribution verification, docs alignment, OpenSpec status sync from observed evidence, and tested compatibility or removal of every legacy Reelink surface.         |


**Production launch direction:**

```bash
bunx -y @anslai/reck init
bunx -y @anslai/reck doctor
# or install globally for repeated local use
bun install -g @anslai/reck
reck init
reck doctor
```

`bun link` / `reelink-mcp` / `reelink` is a legacy local development and testing path only if temporarily supported, not the production install story. Linked/local legacy commands must be documented as legacy and covered by compatibility tests or removed.

**Required public MCP surface target:** `reck_analyze`, `reck_get_finding`, `reck_get_frame`, `reck_get_dom`, `reck_get_components`, `reck_query`, `reck_record_start`, `reck_record_stop`, `reck_record_status`, `reck_browser_snapshot`, `reck_browser_click`, `reck_browser_type`, `reck_browser_navigate`, `reck_browser_wait`, `reck_browser_evaluate`, `reck_browser_take_screenshot`, `reck_run`. Any temporary `reelink_*` aliases are compatibility-only and are not part of the primary public target.

**Final rename target:** Product `Reck`; npm `@anslai/reck`; GitHub `anslhq/reck`; domains `tryreck.dev` and defensive `tryreck.app`; binaries `reck` / `reck-mcp`; MCP prefix `reck_*`; env prefix `RECK_*`; recording root `.reck/`; root package folder `reck/`. Old Reelink names are legacy/compatibility only if explicitly documented, scoped, tested, and assigned removal criteria.

**Non-goals preserved:** no rrweb, no bundled agentation, no second Playwright MCP registration for users, no fabricated DOM/source/network/console/eval streams, and no silent frame fallback when the raw-video model path fails.

---

## Active Remediation Tasks

- [x] Reconcile this status file so it no longer overclaims final completion while preserving OpenSpec checkbox mechanics.
- [x] Rename public product identity from Reelink to Reck across package metadata, README/docs, OpenSpec text, setup prompts, scripts, and release-facing files while preserving historical/migration references where explicitly needed; until this lands, keep all Reck wording labeled as target end state rather than shipped runtime fact.
- [x] Promote `reelink/` package to the repo root and remove the nested package folder, or document why the nested layout remains the intended long-term structure. If deferred, label `reelink/` as the current implementation path pending rename, not the public identity.
- [x] Accept the dedicated-migration deferral for the nested package folder rename: v0.1 keeps `reelink/` as package-local implementation history, not public identity, and root promotion or `reck/` folder rename requires a later migration with script, test, docs, generated artifact, and local workflow verification.
- [x] Change npm package metadata to `@anslai/reck`, binaries to `reck` / `reck-mcp`, GitHub/release references to `anslhq/reck`, and domain references to `tryreck.dev` / `tryreck.app`.
- [x] Rename public MCP tools from `reelink_*` to `reck_*`; if temporary aliases are retained, document/test them with removal criteria.
- [x] Rename Reck-owned environment variables from `REELINK_*` to `RECK_*`; preserve provider-owned variables such as `OPENROUTER_API_KEY`.
- [x] Rename new recording storage from `.reelink/` to `.reck/` and define tested legacy behavior for existing `.reelink/` recordings.
- [x] Decide alias compatibility policy for every old surface: `reelink_*`, `REELINK_*`, `.reelink/`, `reelink-mcp`, `reelink`, `bunx -y reelink`, and `reelink/` package path.
- [x] Test legacy behavior for any retained alias or storage/config lookup, including conflict precedence where old and new names both exist.
- [x] Update onboarding docs and examples to use `reck`, `reck-mcp`, `[mcp_servers.reck]`, `reck_analyze`, `.reck/`, and `RECK_*` as primary names.
- [x] Update final verification commands to use `bunx -y @anslai/reck`, installed `reck`, and the `reck_*` MCP surface.
- [x] Update the required OpenSpec change-folder and active canonical spec pairs in lockstep for video findings, recording packages, timestamped DOM timeline, React/source mapping, agent workflow, eval evidence, and Reck product identity.
- [x] Resolve missing or stale doc claims by creating current docs under the active package/docs path (`reck/docs/` if the folder rename lands in this change), updating root docs, or downgrading/removing claims.
- [x] Finalize Layer 0 public contract so `reck_analyze` returns `findings` as the normative reporter-friendly response in docs, tests, and examples; do not return `work_items` by default in this change unless it is explicitly documented/tested as compatibility/detail output; keep WorkItem as the richer long-term protocol direction with lifecycle fields such as `state`, `approval_state`, `routed_to`, and `completed_at`.
- [ ] Complete Layer 0 imported-video behavior through CLI and MCP, including persisted package shape, deterministic retrieval, invalid-route failures, legacy recording compatibility, and at least one real validation path where a non-technical reporter provides only a recording. Current docs/specs preserve the reporter wedge, but final real reporter validation remains unobserved/manual.
- [x] Verify public `reck_browser_evaluate` and `reck_browser_take_screenshot` through the same recorded child-gateway browser session, not registration tests alone.
- [ ] Implement or verify real react-grab capture, visible annotation events, rich component schema, and markdown/XML projections on `~/Documents/Github/landing` plus one lightweight additional proof target. Current real-app evidence may record `react_grab_events: not_collected`; that is honest missing-stream proof, not completion of visible annotation/source capture.
- [x] Preserve timestamped DOM timeline and honest missing-stream behavior while verifying nearest-context runtime evidence from real browser recordings.
- [x] Complete provider strategy: primary OpenRouter/Qwen raw-video route, fail-loud unsupported routes, explicit roadmap language for unverified self-hosted fallback paths, and a documented provider/model drift policy for any route-family change.
- [x] Keep deterministic query primary; any GPT/OpenAI or other LLM fallback must be opt-in, AI SDK-backed, bounded to persisted artifacts, disabled by default unless explicitly configured, documented, and tested.
- [x] Preserve eval evidence as durable artifacts and only generate deterministic verification artifacts where stable invariants exist.
- [x] Complete production DevX so docs/init/doctor center `bunx -y @anslai/reck` and installed `reck`; keep linked `reck-mcp` legacy/local-only if temporarily supported.
- [x] Make `reck init` safe to rerun/update without storing secrets and verify whether it truly registers Codex or only prints snippets.
- [x] Add react-grab readiness states to init/doctor: installed, initialized, verified.
- [x] Replace hardcoded or misleading `prod_build` semantics with detected or explicitly unknown/unavailable status.
- [x] Add and verify relation/linkage metadata between imported video packages, browser recordings, and agent runs where applicable.
- [x] Verify `reck_run` as a stable public workflow with `{recording_id, success, summary}`, artifact-backed recent observations, durable eval evidence, and partial-failure preservation.
- [ ] Run unit/integration tests, smoke coverage, real Codex setup, `landing` runbook verification, distribution checks, `openspec validate build-reelink-mcp`, and only then update completion checkboxes from observed evidence. This aggregate gate remains blocked by unobserved real reporter validation, real react-grab/landing proof, Codex/public package proof, and final distribution/demo verification.

---

## P0: [Arch][Layer0] Architecture Lock and Verified Layer 0 Baseline

### P0.1 [Arch] Repository Scaffold

- 0.1.1 Initialize Node 20+ TypeScript package: `package.json` with `"type": "module"`, `tsconfig.json` strict mode, `.gitignore`, `.envrc`/`.env.example`, `README.md` skeleton.
- 0.1.2 Install direct dependencies: `@modelcontextprotocol/sdk`, `ai` (v6), `@openrouter/ai-sdk-provider`, `playwright`, `ffmpeg-static`, `react-grab`, `zod`, `pino`, `pino-pretty`. Dev deps: `@types/node`, `@types/bun`, `typescript`. Do NOT install `rrweb` (dropped per Decision 4).
- 0.1.3 Use Bun-backed package scripts for TypeScript and Playwright install so local scripts do not depend on a broken Homebrew Node shim.
- 0.1.4 Verify `ffmpeg-static` binary downloads cleanly and is executable.
- 0.1.5 Run a TypeScript type-check pass to confirm all imports resolve.

### P0.2 [Arch] API Key Provisioning (env-only)

- 0.2.1 Provision `OPENROUTER_API_KEY` for current testing. Do not use OpenAI/GPT models in the v0.1 primary path.
- 0.2.2 Add to `~/.envrc` or `.env` (gitignored) only if needed for repeated local runs. Never commit keys. Verified local `.env` exists and `bun run smoketest:gateway` loads it without printing the key.
- 0.2.3 Smoke test one OpenRouter `generateText` call through AI SDK to a video-capable Qwen route.

### P0.3 [Validation] Historical Demo Artifacts and Real Evidence

- 0.3.1 Treat the founder portfolio view-transition flicker as a historical validation artifact, not the normative product goal. P0 does not require recording capture.
- 0.3.2 Treat the portfolio FOUC as a backup historical validation artifact only. P0 does not require recording capture.
- 0.3.3 Keep synthetic Playwright fixtures for smoketests only. They are not release completion evidence.
- 0.3.4 Use any retained portfolio recordings as real-world evidence examples; completion still requires the real-app, client, distribution, and Reck public-surface verification gates above.

### P0.4 [Layer0] Model-Path Smoke Test

- 0.4.1 Hand-craft one AI SDK call: pass a raw `.mov`/`.webm` recording directly to a video-capable OpenRouter Qwen route with a structured-output JSON schema enforcing `{bug_detected: bool, ts: number, type: string, description: string}`.
- 0.4.2 Verify the response parses as strict JSON in one round-trip.
- 0.4.3 Verify native video input against OpenRouter's live model catalog. `qwen/qwen3-vl-30b-a3b-instruct` is text+image only and MUST fail for raw video; default to `qwen/qwen3.6-flash` or another Qwen route whose `input_modalities` includes `video`.

### P0.5 [Arch] OpenSpec Workflow Refresh

- 0.5.1 Read `openspec --help` once to internalize the CLI surface (status, list, show, validate, instructions, archive, sync, view).
- 0.5.2 Verify `openspec validate build-reelink-mcp` returns clean. Confirm artifacts complete via `openspec status --change build-reelink-mcp`.

### P0.6 [Observability] Observability Scaffold

- 0.6.1 Install `pino` plus `pino-pretty` as direct dependencies. Pino is the structured JSON logger; pino-pretty is dev-only readable output.
- 0.6.2 Implement `src/utils/logger.ts`: stdio MCP forbids stdout writes (corrupts JSON-RPC), so all logs go to stderr. `RECK_LOG_PRETTY=1` switches to pino-pretty transport in dev. `RECK_LOG_LEVEL` controls verbosity. Legacy `REELINK_LOG_*` reads are compatibility-only if retained and must prefer `RECK_LOG_*` when both exist.
- 0.6.3 Implement `src/utils/tool-middleware.ts`: `withToolLogging(toolName, handler)` wraps any tool handler with structured enter/exit logging including duration, arg summary, result summary, and error stack. Auto-redacts keys matching `/key|secret|token|password|authorization/i`.
- 0.6.4 Implement `src/gateway/telemetry.ts`: `telemetryFor(functionId, metadata)` returns the `experimental_telemetry` option for AI SDK v6 calls.
- 0.6.5 Verify the smoke test at `scripts/smoketest-logger.ts` emits structured JSON to stderr and confirms secret redaction in tool middleware.
- 0.6.6 During implementation: every MCP tool handler MUST be wrapped in `withToolLogging`. Every AI SDK call MUST pass `experimental_telemetry: telemetryFor(...)`. No silent failures. Verified current registered tool handlers and gateway/VLM smoke calls use logging/telemetry.
- 0.6.7 During Layer 1 capture: write a per-recording `logs.jsonl` alongside `manifest.json` so finding/runtime debugging has a co-located log trail. Existing smoke evidence is useful but does not complete final `.reck/` verification on its own.
- 0.6.8 Defer to v0.2: Langfuse / OpenTelemetry exporter / Sentry. The v0.1 scope is local stderr + JSONL files only.

### P0.7 [Layer0] Layer 0 Video Finding Baseline

- 0.7.1 Create the Node 20+ TypeScript package scaffold runnable by `bunx -y @anslai/reck` or installed `reck`. Use raw `@modelcontextprotocol/sdk`.
- 0.7.2 Add the stdio MCP server entry point with `reck_*` tool names and path-oriented returns. Any `reelink_*` aliases are temporary compatibility-only behavior if retained.
- 0.7.3 Install Vercel AI SDK v6 (`ai` package) and wire OpenRouter provider selection through AI SDK. Fetch model IDs at runtime from `https://openrouter.ai/api/v1/models` rather than hardcoding paid model assumptions.
- 0.7.4 Implement config loading from `~/.reck/config.json` while reading API keys from environment variables only (`OPENROUTER_API_KEY` for current testing). Legacy `~/.reelink/config.json` reads are compatibility-only if retained and must be documented/tested.
- 0.7.5 Implement `VideoPreprocessor` with `ffmpeg-static`, fps=1 baseline, max 64 frames, and long edge <=896px. Used for cached frame retrieval and future non-primary providers, not as a silent fallback for the OpenRouter/Qwen raw-video path.
- 0.7.6 Implement `VLMRouter` on AI SDK v6: OpenRouter/Qwen raw-video route only for the primary path. Fetch `https://openrouter.ai/api/v1/models`, require the selected route's `input_modalities` to include `video`, and fail loudly for image-only Qwen routes. Structured output via `generateText` + `Output.object` so the VLM returns strict JSON in one round-trip.
- 0.7.7 Implement `reck_analyze(path, fps_sample=4, focus="any")` for `.mov`/`.mp4`/`.webm` path-only input.
- 0.7.8 Return `{recording_id, duration_sec, summary, findings: [{id, ts, type, severity, title, confidence}], next_steps}` as the canonical public contract. Any `work_items` output is compatibility/detail-only and must be documented/tested with removal criteria.
- 0.7.9 Verify the Layer 0 raw-video smoke on `qwen/qwen3.6-flash` via OpenRouter with no frame fallback. Existing evidence under `.reelink/page-469cd67be477d6b3582c00140b5ca998-webm-d2c25fb94f/` is legacy smoke evidence only; final completion requires `.reck/` write verification through the public Reck surface.
- 0.7.10 Verify persistence creates `manifest.json`, `analysis.json`, `frames/`, source video reference, and a `streams` map with explicit `not_collected` reasons for Layer 1+ streams under `.reck/`. Legacy `.reelink/` evidence remains migration-read evidence only if retained.

## P1A: [Retrieval][DevX] Deterministic Retrieval and DevX

**Owner:** current branch. **Status: older-name implementation exists; final Reck contract, `.reck/` writes, and real-client proof are not complete.**

- 1A.0 Fix silent timestamp coercion before retrieval. Timestamp grounding must remain explicit.
- 1A.1 Implement `RecordingStore` read helpers for `.reck/<id>/` and sibling package layouts, plus documented legacy `.reelink/<id>/` reads if compatibility is retained.
- 1A.2 Persist/read manifest, frames, analysis output, source video reference, and stream availability status.
- 1A.3 Implement `reck_get_frame(recording_id, ts)` returning path-oriented frame evidence.
- 1A.4 Implement `reck_get_finding(recording_id, finding_id)` with structured finding retrieval and nearby frame context when available. `work_item_id` is legacy/detail naming only if compatibility is retained.
- 1A.5 Implement deterministic `reck_query(recording_id, question)` over persisted analysis/manifest/findings. `work_items` may be read only as compatibility/detail data if retained. No GPT fallback in the primary path.
- 1A.6 Keep `reck_get_dom(recording_id, ts)` honest before Layer 1 by returning missing/not-collected stream status instead of synthesized DOM.
- 1A.5b [v0.2] Hybrid GPT fallback remains deferred unless separately implemented and verified.
- 1A.7 Implement `reck init` as the one-line setup helper for non-secret user config plus MCP snippets.
- 1A.8 Generate MCP config snippets for Codex first and Cursor as an alternate path.
- 1A.9 Keep production MCP snippets on `bunx -y @anslai/reck mcp` or installed `reck mcp`. Linked `reelink-mcp` is legacy/local-dev-only if temporarily supported.
- 1A.10 Implement `reck doctor` checks for Node, Bun, package resolution, Playwright Chromium, hosted model key/model status, Codex MCP config, and explicit self-hosted fallback status.
- 1A.11 Ensure init/doctor troubleshooting output never prints API keys or sensitive environment values.

## P1B: [Validation] Historical Demo Artifacts and Evidence Path

**Owner:** Harsha for any manual real-world recording capture. **Status: historical validation path only; not a substitute for final Reck verification.**

- 1B.1 **[EXTERNAL/MANUAL CAPTURE]** Capture the founder's portfolio view-transition flicker as `demo-recordings/portfolio-view-transition.mov` and verify the Layer 0 path-only workflow against it. The capture itself requires the user's portfolio/browser and final demo recording; the exact runbook path is documented in Step 4 of `docs/integration-testing-runbook.md`.
- 1B.2 **[EXTERNAL/MANUAL BACKUP]** Capture the portfolio FOUC as `demo-recordings/portfolio-fouc.mov` only if primary demo material fails. Backup capture criteria are documented in `docs/demo-recording-guide.md`.
- 1B.3 **[DOCUMENTED TEST PATH]** Verify the cached recording folder contains manifest, frames, analysis output, `streams` map, and explicit missing-stream statuses after `reck_analyze`. This is covered by `docs/integration-testing-runbook.md` and existing Layer 0 persistence tests; final portfolio evidence waits on 1B.1's external recording.
- 1B.4 **[AUTOMATED LOCALLY + MANUAL CLIENT REGISTRATION]** Verify the Reck MCP can be invoked from a coding-agent-compatible stdio command path. `reck init`/`doctor`, linked `reck-mcp`, and JSON-RPC tools/list are documented; editing `~/.codex/config.toml` remains user-owned external config.
- 1B.4a **[FIRST PROVEN CLIENT PROMPT DOCUMENTED]** Run `docs/setup-prompt.md` end-to-end inside a Codex session opened in a real target repo. This requires a live Codex session, user API key, and user's recording; the prompt now covers registration, analysis, retrieval, and final reporting. Codex-native proof is historical/first-client evidence, not a Codex-only product boundary.
- 1B.5 **[READY AFTER EXTERNAL RECORDING]** Verify `reck_get_finding(recording_id, "f1")` from a coding agent against the real demo recording. Retrieval implementation is complete; final portfolio verification waits on the external demo recording id.
- 1B.6 **[HISTORICAL SCRIPT DOCUMENTED]** Codex-native flex demo script material may remain as historical context only if it is clearly separated from release requirements and Reck onboarding docs.
- 1B.7 Remove or relabel submission-era deliverables so they do not define the current product bar. Evidence commands remain useful only when updated to the final Reck public surface.
- 1B.8 Polish README and validation instructions after the working automated path: setup/runbook docs must match the Reck child-gateway implementation, keep Codex as the first proven client, keep the long-term product broader than Codex, and no longer point at stale missing drafts.

## P2: [Layer1][Observability] Layer 1 Recording State Package

- 2.1 Implement the exact MCP gateway pattern (Decision 9): spawn Playwright MCP as a child stdio subprocess, attach it to Reck-owned Chromium via CDP, and list its tools via the MCP client SDK. Verified by `scripts/smoketest-child-gateway.ts`, manifest child tool listing, and `gateway.jsonl` forwarded events.
- 2.2 Forward a curated subset of real child Playwright MCP tools with `reck_browser_`* prefix. `playwright-driver.ts` maps snapshot, navigate, click/xy click, type, evaluate, and screenshot to listed child tools when available; smoke evidence asserts forwarded snapshot/click events.
- 2.3 Implement `reck record <url>` / `bunx -y @anslai/reck record <url>` using the Playwright library directly. Existing `npx reelink record <url>` smoke evidence is legacy-name smoke evidence and does not complete the final Reck launch path on its own.
- 2.4 Launch Chromium with `--remote-debugging-port=<port>`. Start Playwright MCP child with `--cdp-endpoint=<cdp endpoint>` so both attach to the same browser. Implemented in `playwright-driver.ts` with `@playwright/mcp` installed and verified by `scripts/smoketest-child-gateway.ts`.
- 2.5 Capture `video.webm` via Playwright `recordVideo` and `trace.zip` via `context.tracing.start({ screenshots: true, snapshots: true, sources: true })`. Implemented and smoke-verified by tests/browser recording smokes; does not satisfy real-app verification or final completion on its own.
- 2.6 Inject bippy `install-hook-only` via the FIRST `addInitScript` so it runs before React boots. The second `addInitScript` injects the installed `react-grab/dist/index.global.js` browser bundle and Reck's secure per-commit/element recorder. Verified by `tests/browser-recording-lifecycle.test.ts`.
- 2.7 Persist `fiber-commits.jsonl` plus `source-dictionary.json`. Verified synthetic package writes both; live `harsha.link` wrote fiber commits but marked source dictionary `not_collected`.
- 2.8 Persist `react-grab-events.jsonl` from element-pointer events when available. Verified synthetic package writes events; live `harsha.link` marked react-grab events `not_collected`.
- 2.9 Capture `network.har` and `console.jsonl` with redaction/omission for sensitive headers and tokens. Implemented and smoke-verified by tests/browser recording smokes; does not satisfy real-app verification or final completion on its own.
- 2.10 Merge captured streams into the recording folder with timestamp alignment recorded in `manifest.json`. Implemented and smoke-verified by tests/browser recording smokes; does not satisfy real-app verification or final completion on its own.
- 2.11 Implement `reck_get_dom(recording_id, ts)` returning path and tree summary from persisted DOM snapshots with honest missing-stream status when absent. Trace/fiber topology enrichment remains future hardening.
- 2.12 Implement `reck_get_components(recording_id, ts, x?, y?)` returning component/source evidence when persisted react-grab/fiber evidence is available, with missing-stream status otherwise.
- 2.13 Normalize timestamps across video frames, findings, fiber commits, react-grab events, network events, console events, and Playwright trace metadata using a shared recording-start/performance origin. `manifest.timeline_alignment` now records origin, unit, event count, and artifact per stream; current test evidence does not satisfy real-app completion on its own.
- 2.14 Store time deltas and stream availability so queries can distinguish exact, nearest, and missing context. Implemented and smoke-verified by tests/browser recording smokes; does not satisfy real-app verification or final completion on its own.
- 2.15 Build concise DOM summaries from persisted browser DOM snapshots instead of returning large raw DOM dumps through MCP. Trace/fiber topology enrichment remains future hardening.
- 2.16 Attach nearby console and network events to findings without embedding large HAR or trace payloads in MCP responses. `getRuntimeFindingContext` returns bounded nearby `console`/`network` arrays plus `runtime_summary.omitted_large_payloads`; current implementation-test evidence does not satisfy real-app completion on its own.
- 2.17 Ensure all query tools return file paths and concise summaries rather than pixels, bytes, or unbounded logs. Implemented and smoke-verified by tests/browser recording smokes; does not satisfy real-app verification or final completion on its own.
- 2.18 Use bippy directly where package APIs allow for per-commit fiber capture; use react-grab the library headless-or-toolbar mode for element-pointer enrichment. The installed `react-grab/dist/index.global.js` browser bundle is injected directly; bippy is available only through react-grab's bundled browser/runtime internals in this package shape, so Reck installs a compatible hook-only DevTools hook first and records graceful degradation when React internals are unavailable. Verified by lifecycle tests and child-gateway smoke artifacts.
- 2.19 Capture component names, source files, line numbers, props, and bounding/DOM association when available. Verified fixture/synthetic capture paths; live production pages may degrade to `not_collected`.
- 2.20 `secure()` wrapping is mandatory; set `dangerouslyRunInProduction: true` only when explicitly recording a prod build. Reck's second init script applies the secure recorder path, keeps `dangerouslyRunInProduction = false`, records the flags in `manifest.react_capture`, and tests assert both flags. Direct bippy `secure()` import is not exposed by the installed package, so the feasible secure behavior is enforced in the browser recorder and documented in artifacts.
- 2.21 Degrade gracefully to DOM-only context when React, source maps, development mode, or compatible internals are unavailable. Mark source-map stream status and failure reasons in `manifest.json`. Verified on live `harsha.link` source/react-grab degradation.

## P3: [Layer2][Observability] Layer 2, Eval Evidence, and Post-v0.1 Hardening

- 3.1 Implement `PlaywrightLibraryHarness` for agent-controlled browser task recording. Implemented and smoke-verified by agent-run tests and recording/retrieval smokes; does not satisfy workflow verification or final completion on its own.
- 3.2 Implement `reck_run(task_description, target_url)` returning `{recording_id, success, summary}`. Implemented and smoke-verified by agent-run tests and recording/retrieval smokes; does not satisfy workflow verification or final completion on its own.
- 3.3 Store the resulting recording as eval evidence in the same folder architecture. Implemented and smoke-verified by agent-run tests and recording/retrieval smokes; does not satisfy workflow verification or final completion on its own.
- 3.4 Provide recent-frame-plus-state observations shaped as `{frame_path, dom_summary, component_map, network_since_last, console_since_last}` for next-action input. Implemented and smoke-verified by agent-run tests and recording/retrieval smokes; does not satisfy workflow verification or final completion on its own.
- 3.5 Ensure failed or partial agent runs preserve the recording and explain failure state. Implemented and smoke-verified by agent-run tests and recording/retrieval smokes; does not satisfy workflow verification or final completion on its own.
- 3.6 Keep `reck_query` deterministic-first. Any GPT/OpenAI or other LLM fallback is opt-in only, not primary, AI SDK-backed, bounded to persisted recording artifacts, documented, tested, and disabled by default unless explicitly configured.
- 3.7 Represent recordings and agent runs as eval evidence before attempting to generate deterministic tests. Implemented and smoke-verified by agent-run tests and recording/retrieval smokes; does not satisfy workflow verification or final completion on its own.
- 3.8 Generate Playwright checks only for findings with reliable runtime/repro context. Implemented and smoke-verified by agent-run tests and recording/retrieval smokes; does not satisfy workflow verification or final completion on its own.
- 3.9 Prefer stable DOM, style, route, loading, or network invariants over brittle animation screenshot assertions. Implemented and smoke-verified by agent-run tests and recording/retrieval smokes; does not satisfy workflow verification or final completion on its own.
- 3.10 Store eval artifact paths, expected pre-fix behavior, confidence, and verification results in the recording folder. Implemented and smoke-verified by agent-run tests and recording/retrieval smokes; does not satisfy workflow verification or final completion on its own.
- 3.11 Avoid making unverified benchmark or token-saving claims in generated docs or output. Implemented and smoke-verified by agent-run tests and recording/retrieval smokes; does not satisfy workflow verification or final completion on its own.
- 3.12 If Layer 1 is implemented, verify Playwright trace, bippy fiber commits, react-grab events, network HAR, console JSONL, DOM retrieval, and component retrieval on one recorded app. Implemented and smoke-verified by agent-run tests and recording/retrieval smokes; does not satisfy workflow verification or final completion on its own.
- 3.13 If Layer 2 is implemented, verify `reck_run` records the session and returns a reusable recording ID via `reck_browser_`* ops on the shared CDP-attached Chromium. Current child-gateway smoke evidence is useful but does not satisfy final workflow/client verification on its own.
- 3.14 Verify the exact child gateway pattern: only ONE MCP server is registered in the user's coding-agent config (`reck`), and `reck_browser_*` tools route through the spawned Playwright MCP child without a second registration. Current docs/config snippets plus `scripts/smoketest-child-gateway.ts` evidence are smoke/client-prep evidence, not final completion, until run through the final public Reck package path.
