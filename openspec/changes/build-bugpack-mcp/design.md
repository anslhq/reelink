## Context

This change builds a video-based UI bug testing/reporting system for transient web UI failures: view-transition glitches, Framer Motion or CSS animation jank, hard-refresh flashes, loading-state races, and other failures that screenshots routinely miss. The product is BugPack: a workflow and evidence package that starts from a local screen recording, identifies the visible bug and timestamp, then progressively adds runtime/source/eval context when the app and repo are available.

The implementation must respect the source hierarchy established during exploration: the Granola transcript and original submission define the product as a bug/testing system; MCP is a bridge/tool, not the headline. The minimum useful product is video bug understanding and evidence packaging. Runtime recapture, React source mapping, and generated evals are layered capabilities that deepen the result without blocking basic video-only analysis.

The hackathon constraint favors a local, Codex-friendly workflow that can run from a file path because coding agents generally cannot ingest raw video directly. The implementation should optimize for a reliable 2-minute demo and a 6.5-hour build window.

## Goals / Non-Goals

**Goals:**
- Accept a local screen recording path and produce structured bug analysis with timestamp/range, description, confidence, bug type, and repro hint.
- Create a thin BugPack folder that preserves the recording and timestamp-centered evidence without overbuilding the artifact bundle.
- Provide a local agent bridge so Codex or another coding agent can invoke analysis using local file paths and read BugPack outputs.
- Add an optional Playwright recapture path for app URL + repro steps that records browser video, DOM/runtime snapshots, console logs, network data, and traces.
- Add React/Next.js source mapping when a development app is available, prioritizing React Grab-style component/file context and using bippy/react-grep-style internals where helpful.
- Generate Playwright regression evals where the bug type supports a reliable red-to-green check.
- Keep the demo focused on video catching transient bugs that screenshots miss.

**Non-Goals:**
- Do not make MCP the product. It is an integration mechanism.
- Do not require a Chrome extension, SaaS recorder, or SDK install for the basic video-only flow.
- Do not build video-RAG over historical recordings for MVP.
- Do not make FFmpeg/frame-diff/scene detection the headline or P0 intelligence layer.
- Do not promise deterministic animation screenshot evals for every motion bug.
- Do not require full trace/HAR/React tree/computed styles/eval artifacts for every BugPack.

## Decisions

### Decision 1: Product-first layering

BugPack is designed as a layered testing system:

```text
Basic
  local video path -> bug analysis -> timestamp -> thin BugPack

Enhanced
  timestamp + app URL + repro steps -> Playwright recapture -> runtime evidence

Advanced
  runtime evidence + React source mapping -> generated eval -> agent fix workflow
```

Rationale: the transcript’s lowest quality bar is video-only analysis. The deeper browser/source/eval loop is valuable, but it should not block the core demo.

Alternative considered: implement the full Compass-style BugPack bundle up front. Rejected because it overweights implementation plumbing and risks missing the core value under hackathon time pressure.

### Decision 2: Local bridge as implementation detail

The system will expose local tooling through a local agent bridge, preferably a TypeScript MCP server for the hackathon path, because the workflow starts from local video files and Playwright/React tooling is naturally Node/TypeScript-oriented.

Rationale: Codex/coding agents can pass file paths even when they cannot directly ingest video attachments. A local bridge lets agents call tools like `analyze_video_file` and read BugPack outputs.

Alternative considered: Python FastMCP as the default. FastMCP is valid, but it adds cross-runtime complexity because Playwright, React Grab, and source tooling are already TypeScript-native. Python remains reasonable for later packaging or model-specific helpers.

### Decision 3: Direct video/evidence intelligence before FFmpeg-heavy analysis

The analysis flow should be presented as video bug understanding. FFmpeg is used for deterministic support operations: metadata inspection, evidence clip extraction, key frame extraction near known timestamps, and optional contact sheets for model fallbacks.

Rationale: the user explicitly identified random frame splitting/sampling as the naive path. The product should not be “FFmpeg plus random screenshots.”

Alternative considered: scene-change/frame-diff prefilter as P0. Rejected for MVP because it changes the story and introduces tuning risk. It can be a later cost/latency optimization.

### Decision 4: Thin BugPack by default

The default BugPack should contain:

```text
manifest.json
original video reference or copy
bug_analysis.json
evidence_clip.mp4
frames/before.jpg
frames/at_bug.jpg
frames/after.jpg
metadata_status.json
```

Enhanced/advanced artifacts are added only when collected:

```text
dom_snapshot.html
console.log
network.har
trace.zip
source_candidates.json
react_context.json
generated_eval.spec.ts
verification_result.json
```

Rationale: a thin package preserves the product promise while avoiding mandatory collection of brittle or unavailable context.

### Decision 5: React source mapping uses pragmatic adapters

For React/Next.js development apps, source mapping should prioritize React Grab-style context because it directly maps visible UI elements to component/file/source context and matches the desired visual selection UX. bippy/react-grep-style internals can support automated fiber/source lookup during Playwright recapture.

Rationale: React Grab aligns with the transcript’s reference examples and offers a usable UX model. bippy is useful for automated instrumentation, but dev-mode and React-version caveats must be respected.

### Decision 6: Eval generation must match reliability, not spectacle

Generated evals should be selected by bug type:

- loading/infinite-spinner: invariant assertion such as spinner hides after response
- hard-refresh flash/FOUC: screenshot or color/style invariant at a controlled load point
- route/view-transition glitch: bounded visual evidence plus a safer DOM/style invariant when possible
- animation glitch: optional visual regression, but not guaranteed deterministic

Rationale: Playwright screenshot assertions and clocks can be brittle for animation timing. The demo should still show video catching motion bugs, but the final red-to-green eval should be reliable.

## Risks / Trade-offs

- Direct video model quality may miss sub-second glitches -> Mitigation: use user hint, ask for timestamp fallback, and extract evidence around suspected times for fallback image analysis.
- OpenAI/Codex-native APIs may require frame/contact-sheet preprocessing instead of raw video -> Mitigation: keep provider behind `analyze_video_file` and preserve model-agnostic BugPack schema.
- Gemini may be useful as an oracle but not acceptable as primary demo path -> Mitigation: treat Gemini as validation/fallback, not the core architecture.
- React source mapping is dev-mode and React-version sensitive -> Mitigation: make it optional and return `not_collected` or best-effort source candidates when unavailable.
- Full runtime recapture may not reproduce user-submitted video exactly -> Mitigation: preserve original video evidence and make repro steps/hints explicit.
- Animation visual evals may be flaky -> Mitigation: prefer stable invariant tests for generated evals and label visual evals as evidence or optional checks.
- Local file access creates security boundaries -> Mitigation: require explicit local paths, keep processing local, avoid uploading source or secrets, and redact logs where needed.
- Overbuilding the BugPack bundle could kill hackathon velocity -> Mitigation: ship Basic first, then add Enhanced and Advanced layers only after the video-to-BugPack path works.
