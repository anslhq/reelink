## 0. Pre-Hackathon Setup (TONIGHT, before 9:50 AM Sydney)

**Goal: scope-resilient setup work that survives any plausible day-of theme shift. NO Reelink core logic written tonight. If the scope pivots tomorrow, all of this is still useful.**

### 0.1 Repository scaffold

- [x] 0.1.1 Initialize Node 20+ TypeScript package: `package.json` with `"type": "module"`, `tsconfig.json` strict mode, `.gitignore`, `.envrc`/`.env.example`, `README.md` skeleton.
- [x] 0.1.2 Install direct dependencies: `@modelcontextprotocol/sdk`, `ai` (v6), `@openrouter/ai-sdk-provider`, `playwright`, `ffmpeg-static`, `react-grab`, `zod`, `pino`, `pino-pretty`. Dev deps: `@types/node`, `@types/bun`, `typescript`. Do NOT install `rrweb` (dropped per Decision 4).
- [x] 0.1.3 Add `bunx playwright install chromium` to a postinstall script. Run it tonight to download Chromium.
- [x] 0.1.4 Verify `ffmpeg-static` binary downloads cleanly and is executable.
- [x] 0.1.5 Run a TypeScript type-check pass to confirm all imports resolve. Do not write product code.

### 0.2 API key provisioning (env-only)

- [x] 0.2.1 Provision `OPENROUTER_API_KEY` for current testing. Do not use OpenAI/GPT models in this phase.
- [ ] 0.2.2 Add to `~/.envrc` or `.env` (gitignored) only if needed for repeated local runs. Never commit keys.
- [x] 0.2.3 Smoke test: hand-craft one OpenRouter `generateText` call through AI SDK to a video-capable Qwen route. Discard the result, just verify the round-trip.

### 0.3 Demo recordings (DO NOT SKIP — most scope-resilient artifact)

- [ ] 0.3.1 Record the founder's portfolio view-transition flicker as `demo-recordings/portfolio-view-transition.mov` (the bug from the Granola transcript).
- [ ] 0.3.2 Record the portfolio FOUC as `demo-recordings/portfolio-fouc.mov` (the "green overlay before main shell" bug).
- [ ] 0.3.3 Record three backup bugs from a sample app: modal animation glitch, infinite spinner on 200 OK, layout shift on hero image. All under `demo-recordings/`.
- [ ] 0.3.4 Each recording: 6-15 seconds, QuickTime or CleanShot, 1280x720 or higher, no voiceover.

### 0.4 Sample buggy app

- [ ] 0.4.1 Scaffold `samples/buggy-app/` as Vite + React 18 (NOT Next.js — RSC reduces fiber introspection coverage per Decision 5 follow-up).
- [ ] 0.4.2 Install react-grab in the sample app via `npx grab init` to confirm the framework-detection injection works against Vite + React 18.
- [ ] 0.4.3 Create four bug branches: `bug-1-modal-animation`, `bug-2-infinite-spinner`, `bug-3-layout-shift`, `bug-4-zindex-overlap`. Each reproduces one bug class.
- [ ] 0.4.4 Run the sample app once to confirm bippy hooks are active (verify via `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` in DevTools console).

### 0.5 Codex CLI verification

- [ ] 0.5.1 Confirm Codex CLI installed: `codex --version`. Pin tonight's version, do not auto-update tomorrow morning.
- [ ] 0.5.2 Confirm Codex Pro plans are signed in on the demo laptop.
- [ ] 0.5.3 Test `codex mcp add reelink-mcp -- npx -y reelink-mcp@latest` against a placeholder package; confirm `codex mcp list` shows the registration. Roll back the placeholder.

### 0.6 Pre-stage agent configs (ready for tomorrow)

- [ ] 0.6.1 Draft `~/.codex/config.toml` MCP entry pointing at the future reelink stdio command (commented out, ready to uncomment tomorrow).
- [ ] 0.6.2 Draft `~/.cursor/mcp.json` with the same.
- [ ] 0.6.3 Draft `~/.claude.json` with the same.
- [ ] 0.6.4 Use absolute `npx` paths (`/opt/homebrew/bin/npx` on Apple Silicon) to defend against launchd PATH issues.

### 0.7 Model-path smoke test

- [x] 0.7.1 Hand-craft one AI SDK call: pass a raw `.mov`/`.webm` recording directly to a video-capable OpenRouter Qwen route with a structured-output JSON schema enforcing `{bug_detected: bool, ts: number, type: string, description: string}`.
- [x] 0.7.2 Verify the response parses as strict JSON in one round-trip. Verify total latency under 20 seconds.
- [x] 0.7.3 Verify native video input against OpenRouter's live model catalog. `qwen/qwen3-vl-30b-a3b-instruct` is text+image only and MUST fail for raw video; default to `qwen/qwen3.6-flash` or another Qwen route whose `input_modalities` includes `video`.

### 0.8 OpenSpec workflow refresh

- [x] 0.8.1 Read `openspec --help` once to internalize the CLI surface (status, list, show, validate, instructions, archive, sync, view).
- [x] 0.8.2 Verify `openspec validate build-reelink-mcp` returns clean. Confirm 4/4 artifacts complete via `openspec status --change build-reelink-mcp`.
- [ ] 0.8.3 Bookmark this tasks.md file for tomorrow morning. Read Section 1 first, then start at Task 1.1.

### 0.9 Final pre-hackathon checks

- [ ] 0.9.1 Charged: laptop, AirPods (for stage), backup battery.
- [ ] 0.9.2 At least 10GB free disk for video traces and Playwright artifacts.
- [ ] 0.9.3 Wifi backup plan: hotspot from phone if hackathon wifi flakes.
- [ ] 0.9.4 r/codex draft post written, queued for same-day publish.
- [ ] 0.9.5 Reelink repo `reelink-mcp` initialized as public on GitHub (empty except scaffold).

### 0.10 Observability scaffold (must land before any product code)

- [x] 0.10.1 Install `pino` plus `pino-pretty` as direct dependencies. Pino is the structured JSON logger; pino-pretty is dev-only readable output.
- [x] 0.10.2 Implement `src/utils/logger.ts`: stdio MCP forbids stdout writes (corrupts JSON-RPC), so all logs go to stderr. `REELINK_LOG_PRETTY=1` switches to pino-pretty transport in dev. `REELINK_LOG_LEVEL` controls verbosity.
- [x] 0.10.3 Implement `src/utils/tool-middleware.ts`: `withToolLogging(toolName, handler)` wraps any tool handler with structured enter/exit logging including duration, arg summary, result summary, and error stack. Auto-redacts keys matching `/key|secret|token|password|authorization/i`.
- [x] 0.10.4 Implement `src/gateway/telemetry.ts`: `telemetryFor(functionId, metadata)` returns the `experimental_telemetry` option for AI SDK v6 calls. Spans emit `ai-call` log lines with provider, model, latency, token counts, errors. No external observability service required for v0.1.
- [x] 0.10.5 Verify the smoke test at `scripts/smoketest-logger.ts` emits structured JSON to stderr and confirms secret redaction in tool middleware.
- [ ] 0.10.6 Tomorrow during implementation: every MCP tool handler MUST be wrapped in `withToolLogging`. Every AI SDK call MUST pass `experimental_telemetry: telemetryFor(...)`. No silent failures.
- [ ] 0.10.7 Tomorrow during Layer 1 capture: write a per-recording `logs.jsonl` alongside `manifest.json` so finding-debugging has a co-located log trail.
- [ ] 0.10.8 Defer to v0.2: Langfuse / OpenTelemetry exporter / Sentry. The hackathon scope is local stderr + JSONL files only.

---

## 1. Hours 0-1.5: Layer 0 Video Finding MVP

- [x] 1.1 Create the Node 20+ TypeScript package scaffold runnable by `npx -y reelink`. Use raw `@modelcontextprotocol/sdk` (matches Chrome DevTools MCP and Playwright MCP).
- [x] 1.2 Add the stdio MCP server entry point with `reelink_*` tool names and path-oriented returns.
- [x] 1.3 Install Vercel AI SDK v6 (`ai` package) and wire OpenRouter provider selection through AI SDK. Fetch model IDs at runtime from `https://openrouter.ai/api/v1/models` for Nemotron/Qwen VLMs rather than hardcoding paid model assumptions.
- [x] 1.4 Implement config loading from `~/.reelink/config.json` while reading API keys from environment variables only (`OPENROUTER_API_KEY` for current testing).
- [x] 1.5 Implement `VideoPreprocessor` with `ffmpeg-static`, fps=1 baseline, max 64 frames, and long edge <=896px. Used for cached frame retrieval and future non-primary providers, not as a silent fallback for the OpenRouter/Qwen raw-video path.
- [x] 1.6 Implement `VLMRouter` on AI SDK v6: OpenRouter/Qwen raw-video route only for the primary path. Fetch `https://openrouter.ai/api/v1/models`, require the selected route's `input_modalities` to include `video`, and fail loudly for image-only Qwen routes. Structured output via `generateText` + `Output.object` so the VLM returns strict JSON in one round-trip.
- [x] 1.7 Implement `reelink_analyze(path, fps_sample=4, focus="any")` for `.mov`/`.mp4`/`.webm` path-only input.
- [x] 1.8 Return `{recording_id, duration_sec, summary, findings: [{id, ts, type, severity, title, confidence}], next_steps}`.
- [ ] 1.9 Add Codex-compatible MCP config output for the demo path.
- [ ] 1.10 Validate one demo video produces at least one structured finding (use the founder's portfolio view-transition flicker per Decision 8).

## 2. Hours 1.5-3: Cached Recording Folders, Forwarded Browser Tools, and Query Tools

- [ ] 2.1 Implement `RecordingStore` for `.reelink/<id>/` and sibling `recording.mov.reelink/` layouts.
- [ ] 2.2 Persist `manifest.json`, original/imported video reference or copy, sampled frames, analysis output, and stream availability status. Manifest carries `prod_build` boolean and `streams` map per existing spec scenarios.
- [ ] 2.3 Implement `reelink_get_frame(recording_id, ts)` returning `{path}`.
- [ ] 2.4 Implement `reelink_query(recording_id, question)` over cached findings, frames, and manifest metadata. v0.1 ships the simple lookup path; the internal ToolLoopAgent for cross-recording reasoning (Decision 11) is deferred to task 7.x or v0.2.
- [ ] 2.5 Implement `reelink_get_finding(recording_id, finding_id)` returning description, stack when known, surrounding console, DOM diff, suggested fix, and frame paths when available.
- [ ] 2.6 Implement the MCP gateway pattern (Decision 9): spawn Playwright MCP as a child stdio subprocess, attach it to Reelink's launched Chromium via `--cdp-endpoint`, list its tools via the MCP client SDK.
- [ ] 2.7 Forward a curated subset of Playwright MCP tools with `reelink_browser_*` prefix: `reelink_browser_navigate`, `reelink_browser_click`, `reelink_browser_type`, `reelink_browser_evaluate`, `reelink_browser_snapshot`, `reelink_browser_take_screenshot`. Do NOT forward video / trace tools (Reelink-native owns recording).
- [ ] 2.8 Add MCP tool annotations/descriptions optimized for coding agents.
- [ ] 2.9 Validate four demo bugs across motion, loading, layout, and navigation/state categories.

## 3. Hours 0-3 parallel: DevX and Agent Registration

- [ ] 3.1 Implement `npx reelink init` as the one-line setup flow. Calls `npx grab init` first (react-grab framework detection plus script-tag injection into `layout.tsx` / `_document.tsx` / `main.tsx`), then registers ONLY the Reelink MCP server in detected agent configs. Single MCP registered per Decision 9.
- [ ] 3.2 Detect and generate MCP config snippets for Codex CLI, Cursor, Claude Code, Cline/Roo, and VS Code Copilot where possible.
- [ ] 3.3 Write MCP config snippets with absolute `npx` paths on Apple Silicon when required.
- [ ] 3.4 Implement `reelink doctor` checks for Node version, package resolution, Playwright browser install, AI Gateway / model API keys, react-grab/bippy presence in target app, and agent config.
- [ ] 3.5 Ensure troubleshooting output never prints API keys or sensitive environment values.

## 4. Hours 3-5: Layer 1 Recording State Package

- [ ] 4.1 Implement `npx reelink record <url>` using the Playwright LIBRARY directly (NOT Playwright MCP — Playwright MCP is the spawned forwarding child, the library is what Reelink uses for recording with full `addInitScript` control).
- [ ] 4.2 Launch Chromium with `--remote-debugging-port=<port>`. Start Playwright MCP child with `--cdp-endpoint=ws://localhost:<port>` so both attach to the same browser (Decision 9).
- [ ] 4.3 Capture `video.webm` via Playwright `recordVideo` and `trace.zip` via `context.tracing.start({ screenshots: true, snapshots: true, sources: true })`.
- [ ] 4.4 Inject bippy `install-hook-only` (~79 bytes) via the FIRST `addInitScript` so it runs before React boots. Then inject the full bippy bundle, react-grab the library in normal mode (toolbar visible), and a per-commit recorder via a second `addInitScript`. Order is mandatory.
- [ ] 4.5 Persist `fiber-commits.jsonl` (bippy `onCommitFiberRoot` walking `traverseRenderedFibers`) plus `source-dictionary.json` (post-hoc resolved via `bippy/source` `getSource`, cached by `fiber.type` identity).
- [ ] 4.6 Persist `react-grab-events.jsonl` from the visible toolbar's element-pointer events (capture component stack with source via `window.__REACT_GRAB__.getSource(element)` and `getStackContext(element)`).
- [ ] 4.7 Capture `network.har` and `console.jsonl` with redaction/omission for sensitive headers and tokens.
- [ ] 4.8 Merge captured streams into the recording folder with timestamp alignment recorded in `manifest.json`. Detect production build via bippy's `detectReactBuildType` and set `prod_build: true` when minified.
- [ ] 4.9 Implement `reelink_get_dom(recording_id, ts)` returning `{path, tree_summary}` derived from Playwright trace snapshots plus fiber-commit topology.
- [ ] 4.10 Implement `reelink_get_components(recording_id, ts, x?, y?)` returning `{component, file, line, props}` when available, projectable to agentation-style and react-grab-XML formats per the existing schema-compatible-component-output Requirement.

## 5. Hours 3-5 parallel: Timestamp-Aligned State Querying

- [ ] 5.1 Normalize timestamps across video frames, findings, fiber commits, react-grab events, network events, console events, and Playwright trace metadata using a shared `performance.now()` origin.
- [ ] 5.2 Store time deltas and stream availability so queries can distinguish exact, nearest, and missing context.
- [ ] 5.3 Build DOM summaries from Playwright trace snapshots plus fiber topology instead of returning large raw DOM dumps through MCP.
- [ ] 5.4 Attach nearby console and network events to findings without embedding large HAR or trace payloads in MCP responses.
- [ ] 5.5 Ensure all query tools return file paths and concise summaries rather than pixels, bytes, or unbounded logs.

## 6. Hours 3-5 parallel: React Fiber Source Map and react-grab UX

- [ ] 6.1 Use bippy directly (transitively bundled via react-grab) for per-commit fiber capture; use react-grab the library headless-or-toolbar mode for element-pointer enrichment.
- [ ] 6.2 react-grab's toolbar UI MUST be visible during Layer 1 recordings (normal mode, not headless) so the user sees the glow and can click components live; the recorder ALSO captures element context on every fiber commit programmatically.
- [ ] 6.3 Capture component names, source files, line numbers, props, and bounding/DOM association when available.
- [ ] 6.4 `secure()` wrapping is mandatory; set `dangerouslyRunInProduction: true` only when explicitly recording a prod build.
- [ ] 6.5 Degrade gracefully to DOM-only context when React, source maps, development mode, or compatible internals are unavailable. Mark source-map stream status and failure reasons in `manifest.json`.

## 7. Hours 5-6: Layer 2 Agent Recording Workflow

- [ ] 7.1 Implement `PlaywrightLibraryHarness` for agent-controlled browser task recording (uses Playwright the library directly, not Playwright MCP — Playwright MCP child handles agent's general nav/click/eval ops via the forwarded `reelink_browser_*` tools on the same browser).
- [ ] 7.2 Implement `reelink_run(task_description, target_url)` returning `{recording_id, success, summary}`.
- [ ] 7.3 Store the resulting recording as eval evidence in the same folder architecture.
- [ ] 7.4 Provide recent-frame-plus-state observations shaped as `{frame_path, dom_summary, component_map, network_since_last, console_since_last}` for next-action input.
- [ ] 7.5 Ensure failed or partial agent runs preserve the recording and explain failure state.
- [ ] 7.6 OPTIONAL (defer to v0.2 if Layer 1 wobbly): wire `reelink_query` as an internal AI SDK v6 `ToolLoopAgent` backed by an OpenAI GPT-5-class model via AI Gateway for cross-recording / cross-bug reasoning. Internal agent has access to PRIVATE versions of `get_dom`, `get_components`, `list_recordings`, `search_findings` that are NOT exposed to the parent coding agent (Decision 11).

## 8. Hours 5-6 parallel: Eval Evidence Generation

- [ ] 8.1 Represent recordings and agent runs as eval evidence before attempting to generate deterministic tests.
- [ ] 8.2 Generate Playwright checks only for findings with reliable runtime/repro context.
- [ ] 8.3 Prefer stable DOM, style, route, loading, or network invariants over brittle animation screenshot assertions.
- [ ] 8.4 Store eval artifact paths, expected pre-fix behavior, confidence, and verification results in the recording folder.
- [ ] 8.5 Avoid making unverified benchmark or token-saving claims in generated docs or output.

## 9. Hours 6-6.5: Demo and Verification

- [ ] 9.1 Verify the Layer 0 path-only workflow on the founder's portfolio view-transition recording captured tonight per Decision 8.
- [ ] 9.2 Verify the cached recording folder contains manifest, frames, analysis output, `streams` map, and explicit missing-stream statuses.
- [ ] 9.3 Verify the Reelink MCP can be invoked from a coding-agent-compatible stdio command path (Codex CLI primary).
- [ ] 9.4 Verify four demo videos produce structured findings or clear low-confidence/no-finding results.
- [ ] 9.5 If Layer 1 is implemented, verify Playwright trace, bippy fiber commits, react-grab events, network HAR, console JSONL, DOM retrieval, and component retrieval on one recorded app.
- [ ] 9.6 If Layer 2 is implemented, verify `reelink_run` records the session and returns a reusable recording ID via `reelink_browser_*` ops on the shared CDP-attached Chromium.
- [ ] 9.7 Verify the gateway pattern: only ONE MCP server is registered in the user's coding-agent config (`reelink`), and `reelink_browser_*` tools route through the spawned Playwright MCP child without a second registration.
- [ ] 9.8 Polish README/demo instructions only after the working demo path passes.
