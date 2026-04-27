## Why

Transient UI bugs in motion-heavy web apps are painful to report and debug because screenshots miss the exact failure state: view transitions warp text, hard-refresh loading shells flash for a few frames, animations race, and QA has to describe timing-sensitive behavior in prose. BugPack turns a screen recording into a bug-testing artifact that coding agents can understand: timestamped visual evidence first, then runtime/source context and regression proof when available.

## What Changes

- Introduce a video-based UI bug analysis workflow that accepts a local screen recording and returns a structured bug summary, timestamp/range, confidence, and repro hint.
- Create a thin BugPack evidence package for each recording containing the original video reference/copy, bug analysis JSON, and minimal timestamp-centered evidence clips/frames.
- Add an optional instrumented browser recapture path that uses Playwright to collect runtime evidence around the suspected timestamp, including DOM, console, network, and trace artifacts.
- Add React source-context mapping for React/Next.js development apps using React Grab/bippy/react-grep-style component and source lookup where available.
- Generate Playwright regression evals from BugPack evidence for selected bug types, prioritizing reliable red-to-green checks over brittle animation screenshot claims.
- Provide a Codex/coding-agent workflow through a local bridge so agents can operate on local video files and BugPack folders even when the chat harness cannot ingest videos directly.
- Keep MCP/transport, FFmpeg, and model-provider choices as implementation details; the product is the bug testing/reporting system, not the transport layer.

## Capabilities

### New Capabilities
- `video-bug-analysis`: Analyze a UI screen recording and identify visible transient bugs with timestamped structured output.
- `bugpack-evidence-package`: Persist the recording, bug analysis, and minimal timestamp-centered evidence in an agent-readable folder.
- `runtime-context-capture`: Recapture a reported flow in a browser and collect runtime evidence such as DOM snapshots, console logs, network data, traces, and screenshots.
- `react-source-mapping`: Map visible UI elements or timestamped DOM context to React components, source files, selectors, and relevant styles when a React development environment is available.
- `regression-eval-generation`: Generate Playwright regression tests from BugPack evidence and context, with strategies matched to bug type and reliability.
- `agent-bugfix-workflow`: Orchestrate the end-to-end coding-agent flow from video path to BugPack, context, eval, patch guidance, and verification result.

### Modified Capabilities

## Impact

- New local tooling for video-based bug analysis and BugPack generation.
- New browser/runtime capture integration using Playwright.
- New optional React/Next.js source-context adapter using React Grab/bippy/react-grep-style techniques.
- New generated Playwright eval artifacts for regression proof.
- New Codex skill/agent workflow files for running the bug-testing flow from a local video path.
- Dependencies likely include TypeScript, MCP TypeScript SDK, Playwright, FFmpeg binary access, OpenAI vision/Responses APIs, and optional model/provider fallbacks for validation.
