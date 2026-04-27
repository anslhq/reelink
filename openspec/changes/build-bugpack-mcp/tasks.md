## 1. Project Scaffold

- [ ] 1.1 Create the TypeScript package structure for the BugPack local tool and agent bridge.
- [ ] 1.2 Add package scripts and dependencies for MCP server runtime, Playwright, schema validation, and TypeScript execution.
- [ ] 1.3 Add configuration loading for model/API providers without hardcoding secrets.
- [ ] 1.4 Add filesystem utilities for resolving local video paths and creating run-specific BugPack directories.

## 2. Video Bug Analysis

- [ ] 2.1 Define the `bug_analysis.json` schema for bug_found, summary, timestamps, confidence, bug type, repro hint, provider strategy, and errors.
- [ ] 2.2 Implement local video input validation for `.mov`, `.mp4`, and `.webm` files.
- [ ] 2.3 Implement the primary video-analysis path that produces structured bug analysis from timestamped visual evidence.
- [ ] 2.4 Implement fallback analysis support for timestamped frames or contact sheets when direct video ingestion is unavailable.
- [ ] 2.5 Add clear no-bug and low-confidence result handling.

## 3. Thin BugPack Evidence Package

- [ ] 3.1 Define the BugPack folder layout and `manifest.json` schema.
- [ ] 3.2 Implement BugPack creation after video analysis with original video reference or copy.
- [ ] 3.3 Use FFmpeg/ffprobe to extract video metadata, a short evidence clip, and before/at/after frames around the bug timestamp.
- [ ] 3.4 Add `metadata_status.json` or equivalent manifest fields for optional context groups marked `not_collected`.
- [ ] 3.5 Ensure evidence extraction failures are recorded without failing the basic analysis workflow.

## 4. Local Agent Bridge

- [ ] 4.1 Implement a local agent bridge exposing `analyze_video_file(video_file_path, hint?, app_url?, repo_root?)`.
- [ ] 4.2 Expose `create_bugpack(video_file_path, analysis)` or integrate BugPack creation into `analyze_video_file` with stable returned paths.
- [ ] 4.3 Return coding-agent-friendly summaries with bug description, timestamp, evidence paths, available context, missing context, and next action.
- [ ] 4.4 Add safe path resolution and clear errors for missing or unsupported files.

## 5. Runtime Context Capture

- [ ] 5.1 Implement `record_instrumented_session(app_url, steps, bugpack_path?)` using Playwright.
- [ ] 5.2 Capture browser video or screenshots, DOM snapshots, console logs, network/HAR data, and traces where available.
- [ ] 5.3 Append runtime artifacts to an existing BugPack and update the manifest.
- [ ] 5.4 Implement graceful failure handling when app load or repro step execution fails.
- [ ] 5.5 Add basic redaction or omission support for sensitive network headers and tokens.

## 6. Timestamp-to-Context Mapping

- [ ] 6.1 Implement `map_timestamp_to_context(bugpack_path, timestamp_ms)`.
- [ ] 6.2 Return the nearest available runtime context for DOM, console, network, and screenshot/frame evidence.
- [ ] 6.3 Include time deltas when exact timestamp alignment is unavailable.
- [ ] 6.4 Store mapped context artifacts in the BugPack without overwriting original video analysis.

## 7. React Source Mapping

- [ ] 7.1 Add React Grab-style context capture for selected or inferred relevant UI elements.
- [ ] 7.2 Add bippy/react-grep-style best-effort source candidate extraction for React development builds.
- [ ] 7.3 Return ranked component/source candidates with selector, component name, source file, line, bounding box, and confidence where available.
- [ ] 7.4 Degrade gracefully to DOM-only context when React source mapping is unavailable.

## 8. Regression Eval Generation

- [ ] 8.1 Implement `generate_regression_eval(bugpack_path, issue_id?, eval_type?)`.
- [ ] 8.2 Add eval templates for stable bug classes such as loading state, persistent overlay, missing element, and route/state invariant failures.
- [ ] 8.3 Add cautious support for motion/animation bugs using stable DOM/style invariants before visual screenshot assertions.
- [ ] 8.4 Record eval metadata including path, assertion strategy, expected pre-fix result, and confidence.
- [ ] 8.5 Store verification results when generated evals are run.

## 9. Codex Skill and Demo Workflow

- [ ] 9.1 Create a Codex skill workflow that starts from a local video path and invokes the local BugPack tools.
- [ ] 9.2 Document the basic workflow: video path to bug analysis to thin BugPack.
- [ ] 9.3 Document the enhanced workflow: video path plus app URL/repro steps to runtime/source context.
- [ ] 9.4 Document the advanced workflow: BugPack to generated eval to patch guidance and verification.
- [ ] 9.5 Prepare a demo bug flow that proves video catches a transient UI issue that screenshots miss.

## 10. Verification

- [ ] 10.1 Verify the basic video-only workflow on at least one local screen recording.
- [ ] 10.2 Verify BugPack contains the manifest, analysis, evidence clip, frames, and context status fields.
- [ ] 10.3 Verify the local agent bridge can be invoked from a coding-agent-compatible command path.
- [ ] 10.4 Verify Playwright recapture appends runtime artifacts when app URL and repro steps are provided.
- [ ] 10.5 Verify at least one generated eval fails before a known fix and passes after the fix.
