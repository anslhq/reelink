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

### P0.3 [Demo] Demo Recordings

- [ ] 0.3.1 Record the founder's portfolio view-transition flicker as `demo-recordings/portfolio-view-transition.mov` (the bug from the Granola transcript).
- [ ] 0.3.2 Record the portfolio FOUC as `demo-recordings/portfolio-fouc.mov` (the "green overlay before main shell" bug).
- [ ] 0.3.3 Keep synthetic Playwright fixtures for smoketests only. They are not the demo narrative.
- [ ] 0.3.4 Each real demo recording: 6-15 seconds, QuickTime or CleanShot, 1280x720 or higher, no voiceover.

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
- [ ] 0.6.7 During Layer 1 capture: write a per-recording `logs.jsonl` alongside `manifest.json` so finding-debugging has a co-located log trail.
- [ ] 0.6.8 Defer to v0.2: Langfuse / OpenTelemetry exporter / Sentry. The v0.1 scope is local stderr + JSONL files only.

### P0.7 [Layer0] Layer 0 Video Finding Baseline

- [x] 0.7.1 Create the Node 20+ TypeScript package scaffold runnable by `npx -y reelink`. Use raw `@modelcontextprotocol/sdk`.
- [x] 0.7.2 Add the stdio MCP server entry point with `reelink_*` tool names and path-oriented returns.
- [x] 0.7.3 Install Vercel AI SDK v6 (`ai` package) and wire OpenRouter provider selection through AI SDK. Fetch model IDs at runtime from `https://openrouter.ai/api/v1/models` rather than hardcoding paid model assumptions.
- [x] 0.7.4 Implement config loading from `~/.reelink/config.json` while reading API keys from environment variables only (`OPENROUTER_API_KEY` for current testing).
- [x] 0.7.5 Implement `VideoPreprocessor` with `ffmpeg-static`, fps=1 baseline, max 64 frames, and long edge <=896px. Used for cached frame retrieval and future non-primary providers, not as a silent fallback for the OpenRouter/Qwen raw-video path.
- [x] 0.7.6 Implement `VLMRouter` on AI SDK v6: OpenRouter/Qwen raw-video route only for the primary path. Fetch `https://openrouter.ai/api/v1/models`, require the selected route's `input_modalities` to include `video`, and fail loudly for image-only Qwen routes. Structured output via `generateText` + `Output.object` so the VLM returns strict JSON in one round-trip.
- [x] 0.7.7 Implement `reelink_analyze(path, fps_sample=4, focus="any")` for `.mov`/`.mp4`/`.webm` path-only input.
- [x] 0.7.8 Return `{recording_id, duration_sec, summary, findings: [{id, ts, type, severity, title, confidence}], next_steps}`.
- [x] 0.7.9 Verify the Layer 0 raw-video smoke on `qwen/qwen3.6-flash` via OpenRouter with no frame fallback. Evidence: `.reelink/page-469cd67be477d6b3582c00140b5ca998-webm-d2c25fb94f/` from the Mac Studio smoke at commit `8d60cfa`.
- [x] 0.7.10 Verify persistence creates `manifest.json`, `analysis.json`, `frames/`, source video reference, and a `streams` map with explicit `not_collected` reasons for Layer 1+ streams. Evidence: `.reelink/page-469cd67be477d6b3582c00140b5ca998-webm-d2c25fb94f/` from the Mac Studio smoke at commit `8d60cfa`.

## P1A: [Retrieval][DevX] Deterministic Retrieval and DevX

- [ ] 1A.1 Implement `RecordingStore` read helpers for `.reelink/<id>/` and sibling `recording.mov.reelink/` layouts: `loadAnalysis(id)`, `loadManifest(id)`, `listFrames(id)`, and `findFrameNearTimestamp(id, ts)`.
- [ ] 1A.2 Persist or read `manifest.json`, original/imported video reference or copy, sampled frames, analysis output, and stream availability status. Manifest carries `prod_build` boolean and `streams` map per existing spec scenarios.
- [ ] 1A.3 Implement `reelink_get_frame(recording_id, ts)` returning `{path}`.
- [ ] 1A.4 Implement `reelink_get_finding(recording_id, finding_id)` returning description, stack when known, surrounding console, DOM diff, suggested fix, and frame paths when available.
- [ ] 1A.5 Implement deterministic `reelink_query(recording_id, question)` over `analysis.json`, `manifest.json`, findings, summary, next_steps, and manifest streams. No GPT and no ToolLoopAgent in v0.1.
- [ ] 1A.6 Keep `reelink_get_dom(recording_id, ts)` honest before Layer 1: return `{ status: "not_collected", reason: "Layer 1 streams not present" }`; do not synthesize tree structure from frames.
- [ ] 1A.7 Implement `npx reelink init` as the one-line setup flow for agent config registration.
- [ ] 1A.8 Detect and generate MCP config snippets for Codex CLI, Cursor, Claude Code, Cline/Roo, and VS Code Copilot where possible.
- [ ] 1A.9 Write MCP config snippets with absolute `npx` paths on Apple Silicon when required.
- [ ] 1A.10 Implement `reelink doctor` checks for Node version, package resolution, Playwright browser install, hosted model API key presence, and agent config.
- [ ] 1A.11 Ensure troubleshooting output never prints API keys or sensitive environment values.

## P1B: [Demo] Demo and Submission Path

- [ ] 1B.1 Verify the Layer 0 path-only workflow on the founder's portfolio view-transition recording.
- [ ] 1B.2 Verify the cached recording folder contains manifest, frames, analysis output, `streams` map, and explicit missing-stream statuses.
- [ ] 1B.3 Verify the Reelink MCP can be invoked from a coding-agent-compatible stdio command path (Codex CLI primary).
- [ ] 1B.4 Verify `reelink_get_finding(recording_id, "f1")` works from a coding agent against the real demo recording.
- [ ] 1B.5 Prepare submission deliverables: 2-minute demo video, public repo, r/codex post, and Codex-native setup narrative.
- [ ] 1B.6 Polish README/demo instructions only after the working demo path passes.

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
- [ ] 2.13 Normalize timestamps across video frames, findings, fiber commits, react-grab events, network events, console events, and Playwright trace metadata using a shared `performance.now()` origin.
- [ ] 2.14 Store time deltas and stream availability so queries can distinguish exact, nearest, and missing context.
- [ ] 2.15 Build DOM summaries from Playwright trace snapshots plus fiber topology instead of returning large raw DOM dumps through MCP.
- [ ] 2.16 Attach nearby console and network events to findings without embedding large HAR or trace payloads in MCP responses.
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
- [ ] 3.6 Defer GPT/OpenAI ToolLoopAgent query reasoning to v0.2 unless explicitly re-approved.
- [ ] 3.7 Represent recordings and agent runs as eval evidence before attempting to generate deterministic tests.
- [ ] 3.8 Generate Playwright checks only for findings with reliable runtime/repro context.
- [ ] 3.9 Prefer stable DOM, style, route, loading, or network invariants over brittle animation screenshot assertions.
- [ ] 3.10 Store eval artifact paths, expected pre-fix behavior, confidence, and verification results in the recording folder.
- [ ] 3.11 Avoid making unverified benchmark or token-saving claims in generated docs or output.
- [ ] 3.12 If Layer 1 is implemented, verify Playwright trace, bippy fiber commits, react-grab events, network HAR, console JSONL, DOM retrieval, and component retrieval on one recorded app.
- [ ] 3.13 If Layer 2 is implemented, verify `reelink_run` records the session and returns a reusable recording ID via `reelink_browser_*` ops on the shared CDP-attached Chromium.
- [ ] 3.14 Verify the gateway pattern: only ONE MCP server is registered in the user's coding-agent config (`reelink`), and `reelink_browser_*` tools route through the spawned Playwright MCP child without a second registration.
