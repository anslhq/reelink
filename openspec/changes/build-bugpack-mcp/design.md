## Context

BugPack is video-as-state for AI browser agents. It turns screen recordings and agent browser sessions into timestamp-aligned state packages: video, findings, DOM timeline, React component/source map, network/console, trace, and eval evidence.

The wedge is still simple: arbitrary video path to structured findings. The thesis is broader: browser/coding agents need a persistent temporal observation primitive. Screenshot/eval/DOM loops force agents to repeatedly request fresh snapshots, spend tokens on state that immediately goes stale, and miss temporal causality. Playwright MCP and similar tools are valuable, and newer CLI/scoped approaches reduce observation cost, but they still operate over discrete snapshots. Video plus DOM/runtime timelines lets agents inspect motion, causality, and state at any timestamp.

## Goals / Non-Goals

**Goals:**
- Ship Layer 0 first: `bugpack_analyze(path)` accepts `.mov`/`.mp4`/`.webm` and returns `{recording_id, duration_sec, summary, findings: [{id, ts, type, severity, title, confidence}], next_steps}` with only a video path.
- Define Layer 1 as a recording folder that aligns video, frames, Playwright trace, rrweb DOM events, bippy fiber/source data, network, console, and findings by timestamp.
- Define Layer 2 as agent self-recording: `bugpack_run(task_description, target_url)` records a browser task, stores eval evidence, and feeds next-action observation.
- Keep the MCP tool surface small, path-oriented, and usable by Codex, Cursor, Claude Code, Cline/Roo, VS Code Copilot, and related agents.
- Use open/model-agnostic defaults: OpenRouter/Qwen3-VL hosted path, LM Studio local fallback, and provider routing behind stable schemas.
- Provide a hackathon plan that can demo video-to-finding quickly, then add cached folders/query tools, then stretch into runtime/agent recording.

**Non-Goals:**
- Do not frame BugPack as mainly a video bug reporter.
- Do not frame BugPack as mainly an MCP server.
- Do not require a browser, source repo, Chrome extension, SaaS recorder, or app SDK for Layer 0.
- Do not make Gemini the primary model path; it may be used only as benchmark/reference/fallback context if mentioned.
- Do not overclaim exact token savings or benchmark numbers as requirements.
- Do not require every recording to contain every Layer 1 artifact; absent streams must be explicit in the manifest.

## Product Layers

### Layer 0: Video finding wedge

`bugpack_analyze(path, fps_sample=4, focus="any")` accepts `.mov`/`.mp4`/`.webm` and requires only a local video path. It returns:

```text
{recording_id, duration_sec, summary, findings: [{id, ts, type, severity, title, confidence}], next_steps}
```

No browser, source code, DOM, Playwright run, or app SDK is required. The MVP should preprocess videos with `ffmpeg-static` at 1 fps, cap to 64 frames, and resize the long edge to <=896px for model affordability. `fps_sample` is part of the public tool contract; the MVP may clamp it through the preprocessor policy.

### Layer 1: Recording state package

A BugPack recording is a folder, not a single file:

```text
my-bug.bugpack/
  video.webm
  trace.zip
  rrweb-events.jsonl
  fiber-commits.jsonl
  source-dictionary.json
  network.har
  console.jsonl
  manifest.json
  frames/
```

The implementation should store recordings under `.bugpack/<id>/` for generated sessions and may create sibling folders such as `recording.mov.bugpack/` for imported videos. Layer 1 uses Playwright `trace.zip`, rrweb incremental DOM mutation events, and bippy fiber commits/source dictionaries, all timestamp-aligned. React Grab remains an inspiration and UX reference; bippy is the core dependency for React/fiber commit streams.

### Layer 2: Agent self-recording

`bugpack_run(task_description, target_url)` records an agent’s own browser session. The recording becomes both eval evidence and next-action input. Instead of repeatedly dumping screenshot/a11y tree/DOM state, the agent should be able to read a recent frame plus merged state:

```text
{frame_path, dom_summary, component_map, network_since_last, console_since_last}
```

The recording is then queryable by timestamp and usable as durable proof of what the agent attempted.

## Architecture Decisions

### Decision 1: Node 20+ TypeScript package with MCP stdio default

BugPack should be a Node 20+ TypeScript package runnable through `npx -y bugpack`. The default integration surface is a stdio MCP server because coding agents already know how to launch local stdio MCP tools. Streamable HTTP via `--http` can be added later without changing the product model.

Rationale: Playwright, rrweb, and React/fiber instrumentation are naturally TypeScript-oriented, and local file-path workflows fit MCP stdio. MCP is the packaging/integration layer, not the product thesis.

### Decision 2: Small `bugpack_*` tool surface

The MCP surface should stay small, with 5-7 tools and stable path-oriented returns:

```text
bugpack_analyze(path, fps_sample=4, focus="any")
  -> {recording_id, duration_sec, summary, findings[], next_steps}

bugpack_get_finding(recording_id, finding_id)
  -> {full description, stack, surrounding console, dom_diff, suggested_fix, frame_paths[]}

bugpack_get_frame(recording_id, ts)
  -> {path}

bugpack_get_dom(recording_id, ts)
  -> {path, tree_summary}

bugpack_get_components(recording_id, ts, x?, y?)
  -> {component, file, line, props}

bugpack_query(recording_id, question)
  -> free-form answer

bugpack_run(task_description, target_url)
  -> {recording_id, success, summary}
```

Tools should return file paths, summaries, IDs, and structured metadata rather than embedding pixels, large DOM dumps, video bytes, or trace bytes in responses.

### Decision 3: Model routing stays behind stable schemas

Internal modules should include:

- `VideoPreprocessor`: `ffmpeg-static`, fps=1, max 64 frames, long edge <=896px.
- `VLMRouter`: hosted demo default `qwen/qwen3-vl-30b-a3b-instruct` via OpenRouter, with provider preference `DeepInfra`, `Alibaba`, then `Parasail`; LM Studio local fallback uses `Qwen3-VL-8B-Instruct-MLX-4bit` through the local OpenAI-compatible API.
- `RecordingStore`: `.bugpack/<id>/` and sibling `recording.mov.bugpack/` folder layouts.
- `PlaywrightHarness`: Layer 1 recording and Layer 2 agent-run browser control.
- Init scripts for bippy `install-hook-only` and rrweb record.

The result schema must not depend on one provider. The hackathon demo default is pinned to OpenRouter/Qwen3-VL so implementers do not drift to Gemini/OpenAI by convenience. Avoid SGLang-backed providers for the OCR-heavy demo path due to known OCR discrepancy risk from the dossier. Gemini can be useful as a reference benchmark/oracle, but the dossier default is the Qwen3-VL family and model-agnostic routing.

### Decision 4: Timestamp alignment is the architectural unlock

Layer 1 should align all collected streams by recording timestamp: video frames, findings, rrweb events, fiber commits, source dictionary entries, network requests, console events, trace events, and eval artifacts. The manifest should make missing streams explicit instead of pretending every recording has full context.

Rationale: the value is not just “find a bug in a video.” The value is that an agent can ask what DOM, component, network, and console state surrounded a frame or finding without re-observing the browser from scratch.

### Decision 5: Use bippy directly for React/fiber source context

React/fiber source mapping should use bippy directly for commit streams and source dictionaries. React Grab is a strong UX inspiration for selecting UI and surfacing component/file context, but it should not be the core dependency for the automated Layer 1 capture path.

Rationale: bippy aligns with the needed per-commit timeline and source mapping. The implementation must remain best-effort because React internals, build modes, and source maps vary.

### Decision 6: DevX is part of the product surface

The CLI should support one-line setup:

```text
npx bugpack init
```

Init should detect and register available agents where possible: Codex CLI, Cursor, Claude Code, Cline/Roo, and VS Code Copilot. It should write MCP config snippets with absolute `npx` paths on Apple Silicon where needed. Persistent non-secret config belongs in `~/.bugpack/config.json`; API keys must come from environment variables only. `bugpack doctor` should diagnose missing Node version, ffmpeg, Playwright browser install, MCP config, model API keys, and local LM Studio availability.

### Decision 7: Lock the demo around Harsha’s real transition bug

The primary hackathon demo SHALL use Harsha’s portfolio view-transition flicker from the Granola transcript: words/text are not seamless and warp or overlap during navigation, making the issue hard to cleanly capture with a screenshot. The backup demo SHALL be the hard-refresh FOUC/green-gray overlay before the main shell from the same transcript.

Rationale: these are real bugs Harsha lived, not contrived fixtures. They are authentic, emotionally stronger, and prove the exact bug class BugPack exists for: transient visual state that disappears before a screenshot or normal DOM inspection captures it. This locks the 2-minute demo direction and emotional hook.

## Hackathon Build Order

- Hours 0-1.5: Layer 0 minimum must ship: TypeScript MCP scaffold, `bugpack_analyze`, `ffmpeg-static` frame extraction at fps=1/max 64, OpenRouter Qwen3-VL structured prompt, Codex config, and one demoable video-to-finding flow.
- Hours 1.5-3: Add `bugpack_get_frame`, `bugpack_query`, cached recording folders, tool annotations, and validate four demo bugs.
- Hours 3-5: Stretch into Layer 1: `npx bugpack record <url>`, Playwright headed recorder, bippy and rrweb init scripts, trace.zip capture, folder merge, `bugpack_get_dom`, and `bugpack_get_components`.
- Hours 5-6: Add Layer 2 only if time: `bugpack_run` with the recording as eval evidence and next-action input.
- Final polish: README/demo script and agent config instructions after the working demo path is stable.

## Risks / Trade-offs

- Video-only models may miss subtle or sub-second findings -> Mitigation: deterministic frame extraction, user focus hints, confidence scores, and queryable frames around candidate timestamps.
- Frame preprocessing can make the product look like screenshot sampling -> Mitigation: present it as an affordability layer behind video-as-state, not the product thesis.
- OpenRouter/Qwen3-VL availability may vary -> Mitigation: keep `VLMRouter` provider-agnostic and support LM Studio local fallback.
- Layer 1 capture may not reproduce imported videos -> Mitigation: preserve imported Layer 0 evidence and store generated sessions as separate recordings or merged attempts.
- rrweb/bippy/source maps are development-mode and framework-version sensitive -> Mitigation: make streams optional and explicit in the manifest.
- Browser traces, HARs, and console logs can contain secrets -> Mitigation: redact/omit sensitive headers and tokens, never store API keys in config, and summarize before exposing large artifacts.
- Token savings claims are easy to overstate -> Mitigation: describe the qualitative bottleneck and avoid normative benchmark claims until measured.
