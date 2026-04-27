## 1. Hours 0-1.5: Layer 0 Video Finding MVP

- [ ] 1.1 Create the Node 20+ TypeScript package scaffold runnable by `npx -y bugpack`.
- [ ] 1.2 Add the stdio MCP server entry point with `bugpack_*` tool names and path-oriented returns.
- [ ] 1.3 Implement config loading from `~/.bugpack/config.json` while reading API keys from environment variables only.
- [ ] 1.4 Implement `VideoPreprocessor` with `ffmpeg-static`, fps=1 extraction, max 64 frames, and long edge <=896px.
- [ ] 1.5 Implement `VLMRouter` with OpenRouter/Qwen3-VL hosted analysis and LM Studio local fallback plumbing.
- [ ] 1.6 Implement `bugpack_analyze(path, fps_sample=4, focus="any")` for `.mov`/`.mp4` path-only input.
- [ ] 1.7 Return `{recording_id, duration_sec, summary, findings: [{id, ts, type, severity, title, confidence}], next_steps}`.
- [ ] 1.8 Add Codex-compatible MCP config output for the demo path.
- [ ] 1.9 Validate one demo video produces at least one structured finding.

## 2. Hours 1.5-3: Cached Recording Folders and Query Tools

- [ ] 2.1 Implement `RecordingStore` for `.bugpack/<id>/` and sibling `recording.mov.bugpack/` layouts.
- [ ] 2.2 Persist `manifest.json`, original/imported video reference or copy, sampled frames, analysis output, and stream availability status.
- [ ] 2.3 Implement `bugpack_get_frame(recording_id, ts)` returning `{path}`.
- [ ] 2.4 Implement `bugpack_query(recording_id, question)` over cached findings, frames, and manifest metadata.
- [ ] 2.5 Implement `bugpack_get_finding(recording_id, finding_id)` returning description, stack when known, surrounding console, DOM diff, suggested fix, and frame paths when available.
- [ ] 2.6 Add MCP tool annotations/descriptions optimized for coding agents.
- [ ] 2.7 Validate four demo bugs across motion, loading, layout, and navigation/state categories.

## 3. DevX and Agent Registration

- [ ] 3.1 Implement `npx bugpack init` as the one-line setup flow.
- [ ] 3.2 Detect and generate MCP config snippets for Codex CLI, Cursor, Claude Code, Cline/Roo, and VS Code Copilot where possible.
- [ ] 3.3 Write MCP config snippets with absolute `npx` paths on Apple Silicon when required.
- [ ] 3.4 Implement `bugpack doctor` checks for Node version, package resolution, Playwright browser install, model keys, LM Studio availability, and agent config.
- [ ] 3.5 Ensure troubleshooting output never prints API keys or sensitive environment values.

## 4. Hours 3-5: Layer 1 Recording State Package Stretch

- [ ] 4.1 Implement `npx bugpack record <url>` using a Playwright headed recorder.
- [ ] 4.2 Capture `video.webm` and Playwright `trace.zip` for recorded sessions.
- [ ] 4.3 Add rrweb init script injection and persist incremental DOM mutations to `rrweb-events.jsonl`.
- [ ] 4.4 Add bippy `install-hook-only` instrumentation and persist `fiber-commits.jsonl` plus `source-dictionary.json`.
- [ ] 4.5 Capture `network.har` and `console.jsonl` with redaction/omission for sensitive headers and tokens.
- [ ] 4.6 Merge captured streams into the recording folder with timestamp alignment recorded in `manifest.json`.
- [ ] 4.7 Implement `bugpack_get_dom(recording_id, ts)` returning `{path, tree_summary}`.
- [ ] 4.8 Implement `bugpack_get_components(recording_id, ts, x?, y?)` returning `{component, file, line, props}` when available.

## 5. Timestamp-Aligned State Querying

- [ ] 5.1 Normalize timestamps across video frames, findings, rrweb events, fiber commits, network events, console events, and trace metadata.
- [ ] 5.2 Store time deltas and stream availability so queries can distinguish exact, nearest, and missing context.
- [ ] 5.3 Build DOM summaries from rrweb state instead of returning large raw DOM dumps through MCP.
- [ ] 5.4 Attach nearby console and network events to findings without embedding large HAR or trace payloads in MCP responses.
- [ ] 5.5 Ensure all query tools return file paths and concise summaries rather than pixels, bytes, or unbounded logs.

## 6. React Fiber Source Map

- [ ] 6.1 Use bippy directly as the Layer 1 React/fiber dependency rather than React Grab.
- [ ] 6.2 Treat React Grab as inspiration for UX and coding-agent-readable source context only.
- [ ] 6.3 Capture component names, source files, line numbers, props, and bounding/DOM association when available.
- [ ] 6.4 Degrade gracefully to DOM-only context when React, source maps, development mode, or compatible internals are unavailable.
- [ ] 6.5 Mark source-map stream status and failure reasons in `manifest.json`.

## 7. Hours 5-6: Layer 2 Agent Recording Workflow

- [ ] 7.1 Implement `PlaywrightHarness` for agent-controlled browser task recording.
- [ ] 7.2 Implement `bugpack_run(task_description, target_url)` returning `{recording_id, success, summary}`.
- [ ] 7.3 Store the resulting recording as eval evidence in the same folder architecture.
- [ ] 7.4 Provide recent-frame-plus-state observations shaped as `{frame_path, dom_summary, component_map, network_since_last, console_since_last}` for next-action input.
- [ ] 7.5 Ensure failed or partial agent runs preserve the recording and explain failure state.

## 8. Eval Evidence Generation

- [ ] 8.1 Represent recordings and agent runs as eval evidence before attempting to generate deterministic tests.
- [ ] 8.2 Generate Playwright checks only for findings with reliable runtime/repro context.
- [ ] 8.3 Prefer stable DOM, style, route, loading, or network invariants over brittle animation screenshot assertions.
- [ ] 8.4 Store eval artifact paths, expected pre-fix behavior, confidence, and verification results in the recording folder.
- [ ] 8.5 Avoid making unverified benchmark or token-saving claims in generated docs or output.

## 9. Demo and Verification

- [ ] 9.1 Verify the Layer 0 path-only workflow on at least one local `.mov` or `.mp4` recording.
- [ ] 9.2 Verify the cached recording folder contains manifest, frames, analysis output, and explicit missing-stream statuses.
- [ ] 9.3 Verify the MCP tools can be invoked from a coding-agent-compatible stdio command path.
- [ ] 9.4 Verify four demo videos produce structured findings or clear low-confidence/no-finding results.
- [ ] 9.5 If Layer 1 is implemented, verify Playwright trace, rrweb events, bippy fiber events, network, console, DOM retrieval, and component retrieval on one recorded app.
- [ ] 9.6 If Layer 2 is implemented, verify `bugpack_run` records the session and returns a reusable recording ID.
- [ ] 9.7 Polish README/demo instructions only after the working demo path passes.
