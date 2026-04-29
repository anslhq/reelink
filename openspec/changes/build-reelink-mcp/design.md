## Context

Reelink is video-as-state for AI browser agents. It turns screen recordings and agent browser sessions into timestamp-aligned state packages: video, findings, DOM timeline, React component/source map, network/console, trace, and eval evidence.

The wedge is still simple: arbitrary video path to structured findings. The thesis is broader: browser/coding agents need a persistent temporal observation primitive. Screenshot/eval/DOM loops force agents to repeatedly request fresh snapshots, spend tokens on state that immediately goes stale, and miss temporal causality. Playwright MCP and similar tools are valuable, and newer CLI/scoped approaches reduce observation cost, but they still operate over discrete snapshots. Video plus DOM/runtime timelines lets agents inspect motion, causality, and state at any timestamp.

## Goals / Non-Goals

**Goals:**
- Ship Layer 0 first: `reelink_analyze(path)` accepts `.mov`/`.mp4`/`.webm` and returns `{recording_id, duration_sec, summary, findings: [{id, ts, type, severity, title, confidence}], next_steps}` with only a video path.
- Define Layer 1 as a recording folder that aligns video, frames, Playwright trace snapshots, bippy fiber/source data, react-grab element-pointer events, network, console, and findings by timestamp.
- Define Layer 2 as agent self-recording: `reelink_run(task_description, target_url)` records a browser task, stores eval evidence, and feeds next-action observation.
- Keep the MCP tool surface small, path-oriented, and usable by Codex, Cursor, Claude Code, Cline/Roo, VS Code Copilot, and related agents.
- Use open/model-agnostic defaults: OpenRouter/Qwen hosted raw-video path first, AI Gateway where the target model exists, and self-hosted Qwen via SGLang, Ollama, or Hugging Face endpoints only as last-resort escape hatches behind stable schemas.
- Provide a hackathon plan that can demo video-to-finding quickly, then add cached folders/query tools, then stretch into runtime/agent recording.

**Non-Goals:**
- Do not frame Reelink as mainly a video bug reporter.
- Do not frame Reelink as mainly an MCP server.
- Do not require a browser, source repo, Chrome extension, SaaS recorder, or app SDK for Layer 0.
- Do not make Gemini the primary model path; it may be used only as benchmark/reference/fallback context if mentioned.
- Do not overclaim exact token savings or benchmark numbers as requirements.
- Do not require every recording to contain every Layer 1 artifact; absent streams must be explicit in the manifest.
- v0.1 does not provide a `reelink_attach_live(url)` MCP tool for opening a Playwright browser with optional third-party annotation tools injected. This is researched and queued for v0.2 contingent on optional peer-dependency relationships maturing.
- v0.1 does not bundle agentation. agentation's PolyForm Shield 1.0.0 license, integration patterns, and peer-detect approach have been researched (see project dossier) and parked for v0.2 pending direct outreach to the agentation maintainer.

## Product Layers

### Layer 0: Video finding wedge

`reelink_analyze(path, fps_sample=4, focus="any")` accepts `.mov`/`.mp4`/`.webm` and requires only a local video path. It returns:

```text
{recording_id, duration_sec, summary, findings: [{id, ts, type, severity, title, confidence}], next_steps}
```

No browser, source code, DOM, Playwright run, or app SDK is required. The primary OpenRouter/Qwen path sends the raw `.mov`/`.mp4`/`.webm` video. The MVP may still preprocess with `ffmpeg-static` for cached frame retrieval and follow-up inspection; `fps_sample` is part of that public retrieval contract and may be clamped through the preprocessor policy.

### Layer 1: Recording state package

A Reelink recording is a folder, not a single file:

```text
my-bug.reelink/
  video.webm
  trace.zip
  fiber-commits.jsonl
  source-dictionary.json
  react-grab-events.jsonl
  network.har
  console.jsonl
  manifest.json
  frames/
```

The implementation should store recordings under `.reelink/<id>/` for generated sessions and may create sibling folders such as `recording.mov.reelink/` for imported videos. Layer 1 uses Playwright `trace.zip`, bippy fiber commits/source dictionaries, react-grab element-pointer events, HAR, and console JSONL, all timestamp-aligned. rrweb is out of scope for v0.1.

### Layer 2: Agent self-recording

`reelink_run(task_description, target_url)` records an agent’s own browser session. The recording becomes both eval evidence and next-action input. Instead of repeatedly dumping screenshot/a11y tree/DOM state, the agent should be able to read a recent frame plus merged state:

```text
{frame_path, dom_summary, component_map, network_since_last, console_since_last}
```

The recording is then queryable by timestamp and usable as durable proof of what the agent attempted.

## Architecture Decisions

### Decision 1: Node 20+ TypeScript package with MCP stdio default

Reelink should be a Node 20+ TypeScript package runnable through `npx -y reelink`. The default integration surface is a stdio MCP server because coding agents already know how to launch local stdio MCP tools. Streamable HTTP via `--http` can be added later without changing the product model.

Build on raw `@modelcontextprotocol/sdk` (matches Chrome DevTools MCP and Playwright MCP, both ship raw SDK). Use Vercel AI SDK v6 (`ai` package) as the model-call abstraction. Use AI Gateway for models it currently exposes, and use the OpenRouter AI SDK provider directly for Qwen3-VL until AI Gateway exposes the relevant Qwen IDs.

Rationale: Playwright the library, bippy, and react-grab are TypeScript-native. Local file-path workflows fit MCP stdio. AI SDK v6 keeps Qwen/OpenRouter and OpenAI/Gateway behind one generateText contract without locking the schema to a single provider. MCP is the packaging/integration layer, not the product thesis.

### Decision 2: Small `reelink_*` tool surface

The MCP surface should stay small, with 5-7 tools and stable path-oriented returns:

```text
reelink_analyze(path, fps_sample=4, focus="any")
  -> {recording_id, duration_sec, summary, findings[], next_steps}

reelink_get_finding(recording_id, finding_id)
  -> {full description, stack, surrounding console, dom_diff, suggested_fix, frame_paths[]}

reelink_get_frame(recording_id, ts)
  -> {path}

reelink_get_dom(recording_id, ts)
  -> {path, tree_summary}

reelink_get_components(recording_id, ts, x?, y?)
  -> {component, file, line, props}

reelink_query(recording_id, question)
  -> free-form answer

reelink_run(task_description, target_url)
  -> {recording_id, success, summary}
```

Tools should return file paths, summaries, IDs, and structured metadata rather than embedding pixels, large DOM dumps, video bytes, or trace bytes in responses.

In addition, Reelink forwards a curated subset of browser-automation tools from a spawned Playwright MCP child subprocess with a `reelink_browser_*` prefix (see Decision 9). These give the agent navigate / click / evaluate / snapshot / screenshot primitives without Reelink reimplementing them. Total external tool count stays under twelve.

### Decision 3: Model routing through AI SDK v6

Internal modules should include:

- `VideoPreprocessor`: `ffmpeg-static`, fps=1 baseline, max 64 frames, long edge <=896px. Used for cached frame retrieval and future non-primary providers, not as a silent fallback for OpenRouter/Qwen raw-video analysis.
- `VLMRouter`: AI SDK v6 client. The primary OpenRouter/Qwen path sends raw video via AI SDK file parts and validates the selected route against OpenRouter's live `input_modalities`. Image-only Qwen routes or unknown support fail loudly. Same tool surface and response schema across model routes. Structured output through `generateText` + `Output.object` is enabled so the model returns strict JSON without a downstream normalizer.
- `RecordingStore`: `.reelink/<id>/` and sibling `recording.mov.reelink/` folder layouts.
- `PlaywrightLibraryHarness`: Layer 1 recording and Layer 2 agent-run browser control. Uses Playwright the library directly, NOT Playwright MCP. Owns `addInitScript` ordering for bippy injection.
- Init scripts (in addInitScript order): bippy `install-hook-only` first, then full bippy + react-grab the library + per-commit recorder. react-grab is injected in normal mode (toolbar visible).

Qwen through OpenRouter's AI SDK provider is the primary raw-video VLM path. AI Gateway is used for gateway-listed models, especially the OpenAI GPT-5 family behind the internal `reelink_query` ToolLoopAgent (see Decision 11). Self-hosted Qwen via SGLang, Ollama, or Hugging Face endpoints is a last-resort fallback if OpenRouter video routing becomes unavailable. The result schema does not depend on any provider. Gemini may be used as a reference benchmark only, never as a default code path.

### Decision 4: Timestamp alignment is the architectural unlock

Layer 1 should align all collected streams by recording timestamp: video frames, findings, Playwright trace snapshots (action-aligned DOM, network, console, sources), bippy fiber commits, source dictionary entries from `bippy/source`, react-grab element-pointer events, network HAR, console JSONL, and eval artifacts. The manifest should make missing streams explicit instead of pretending every recording has full context. rrweb is NOT part of the v0.1 stack — Playwright trace already captures DOM/network/console action-aligned, and bippy fiber commits give us the React-aware sub-action view we actually need for component-at-timestamp lookups.

Rationale: the value is not just “find a bug in a video.” The value is that an agent can ask what DOM, component, network, and console state surrounded a frame or finding without re-observing the browser from scratch.

### Decision 5: Bundle bippy and react-grab as hard MIT dependencies; park agentation

bippy and react-grab are bundled as hard `dependencies` in `package.json`. Both are MIT-licensed and can be redistributed inside Reelink with notice preservation.

- **bippy**: per-commit React fiber capture for Layer 1. Used in headed-script mode via Playwright `addInitScript`. Provides `install-hook-only`, `instrument`, `secure`, `traverseRenderedFibers`, `getFiberId`, `getFiberFromHostInstance`, `getFiberStack`. This is the primitive that makes timestamp-aligned fiber commits possible.
- **react-grab**: component-stack-with-source enrichment for element-pointer events, used in normal toolbar mode during Layer 1 recording so the user can point at elements and see selection affordances. Surfaces component name, file path, line, and column for agent consumption.

Rationale: bippy alone gives per-commit fiber topology but does not surface the component-stack-plus-source format coding agents already know how to consume. react-grab provides exactly that format on element-pointer events, and visible toolbar mode makes the recording UX debuggable. Together they cover Reelink's Layer 1 React/source needs.

**agentation is researched and parked.** Full license analysis of agentation's PolyForm Shield 1.0.0 was completed prior to the hackathon (see project research dossier). Findings: Shield's broad "competing product" definition creates real exposure when an MCP server bundles agentation and surfaces its functionality through MCP tools. The cost of being wrong (32-day cure clock, downstream compliance friction) materially exceeds the value of bundling for v0.1. agentation is not a v0.1 dependency. Optional peer-detect via dynamic `await import("agentation")` and a `reelink_attach_live` MCP tool are explicit non-goals for the hackathon (see Non-Goals). Founder outreach to Benji Taylor is queued for after launch with a v0.2 hard-bundle path conditional on his blessing.

### Decision 6: DevX is part of the product surface

The CLI should support one-line setup:

```text
npx reelink init
```

Init should detect and register available agents where possible: Codex CLI, Cursor, Claude Code, Cline/Roo, and VS Code Copilot. It should write MCP config snippets with absolute `npx` paths on Apple Silicon where needed. Persistent non-secret config belongs in `~/.reelink/config.json`; API keys must come from environment variables only. `reelink doctor` should diagnose missing Node version, ffmpeg, Playwright browser install, MCP config, hosted model API keys, and explicitly configured self-hosted Qwen fallback availability.

### Decision 7: Apache 2.0 with NOTICE pass-through

Reelink ships under Apache 2.0. The repository's `LICENSE` contains the full Apache 2.0 text only. `NOTICE` attributes bippy and react-grab MIT licenses with verbatim copyright preservation. `THIRD_PARTY_LICENSES.md` contains full MIT texts for both. `package.json` declares `"license": "Apache-2.0"`.

PolyForm Shield 1.0.0 text never appears in Reelink's distributed artifact at v0.1.

Rationale: Apache 2.0 is compatible with bundling MIT dependencies, provides patent grant for corporate adoption, and leaves the path open for later optional agentation integration without forcing Shield onto downstream users. MIT loses the patent grant. BSD-style licenses are similarly permissive but less corporate-recognized. Shield-anywhere-in-the-tree blocks installation in many corporate environments running FOSSA, Snyk, or Black Duck.

If v0.2 later adopts agentation as an optional peer-detect dependency, NOTICE will gain a section pointing to the canonical Shield URL with pass-through language. Shield text still does not concatenate into LICENSE.

### Decision 8: Demo bugs are real artifacts from the founder's portfolio

Primary demo: portfolio view-transition flicker on the founder's personal site (the bug originally identified in the project's Granola transcript: "the words here, they are not seamless"). Backup: hard-refresh FOUC on the same site (the "green overlay before main shell" bug from the same transcript).

Both are real bugs the founder has lived with for months. Recording these as the demo videos tonight gives the 2-minute hackathon video narrative coherence: the founder demonstrates a tool that solves a problem the founder actually has, on a site the founder actually owns, against bugs the founder actually wants fixed.

Rationale: contrived demo bugs are a tell. Judges and the open-source launch audience can pattern-match a hackathon demo recorded against a synthetic test app within the first 15 seconds. Recording against a real portfolio with real motion bugs aligns the demo with the product thesis (video-as-state for real motion bugs that screenshots cannot capture) and converts the demo from "here is what the tool does" to "here is the bug that has been bothering me, watch me fix it."

Implementation: capture the two demo recordings tonight before the hackathon start. Store under `demo-recordings/` in the repo. Validate at least one produces a structured finding via the Layer 0 wedge before locking the demo script.

### Decision 9: Single MCP gateway pattern with Playwright MCP child via CDP attach

The user installs ONE MCP — `reelink`. Reelink does NOT proxy a separately-registered Playwright MCP or Chrome DevTools MCP. Instead Reelink spawns Playwright MCP as a stdio child subprocess inside its own process and forwards a curated subset of its tools through with a `reelink_browser_*` prefix.

The gateway only works because both Reelink's recording layer AND the spawned Playwright MCP child attach to the SAME Chromium browser instance via CDP. Concretely: Reelink uses Playwright the library to launch Chromium with `--remote-debugging-port=<port>`, then passes that CDP endpoint to the spawned Playwright MCP child via its `--cdp-endpoint` flag. The child connects to the existing browser instead of launching a new one. Every navigate / click / evaluate call from the agent operates on the same Chromium instance that Reelink is recording.

Forwarded tools (curated, max ~7): `reelink_browser_navigate`, `reelink_browser_click`, `reelink_browser_type`, `reelink_browser_evaluate`, `reelink_browser_snapshot`, `reelink_browser_take_screenshot`. We do not forward Playwright MCP's video / trace tools (`browser_start_video`, `browser_start_tracing`) because the Reelink-native recording tools own that path via the library.

Rationale: single MCP registration matches user expectation ("if one dies the user shouldn't have to manually restart three things"). Forwarding-instead-of-rewriting means we don't reinvent browser-automation primitives Microsoft already polished. CDP attach solves the two-browser coordination problem that plain peer-MCP coexistence would have. react-grab is bundled as a library and injected via Playwright `addInitScript` in normal mode (toolbar visible) — it does NOT need a separate child MCP.

### Decision 10: AI SDK v6 as the model abstraction

All model calls go through Vercel AI SDK v6 (`ai` package). Use the built-in AI Gateway provider for gateway-listed models and `@openrouter/ai-sdk-provider` for Qwen3-VL models that are currently present on OpenRouter but not on AI Gateway. This replaces raw HTTP calls and keeps multimodal content, structured output, telemetry, and provider fallback behind one SDK shape.

Structured output is implemented with `generateText` + `Output.object`. Qwen returns strict JSON conforming to our finding schema in one round-trip. No second-model normalizer.

Per the AI SDK skill: do not hardcode gateway model IDs in source — fetch the current set from `https://ai-gateway.vercel.sh/v1/models` and select the highest-versioned model in the family at call time. For OpenRouter-only VLMs, fetch `https://openrouter.ai/api/v1/models` and prefer configured models first, then the current Qwen3-VL family.

### Decision 11: Internal `reelink_query` ToolLoopAgent for cross-recording reasoning

`reelink_query(recording_id, question)` and the broader cross-recording / cross-bug reasoning surface are implemented internally as an AI SDK v6 `ToolLoopAgent` backed by an OpenAI GPT-5-class model via AI Gateway. The internal agent has access to Reelink's PRIVATE tool surface — internal versions of `get_dom`, `get_components`, `get_frame`, `list_recordings`, `search_findings`, etc. — that are NOT exposed to the parent coding agent.

Boundary: simple per-recording or per-bug lookup → parent coding agent calls top-level `reelink_*` tools directly. Complex multi-recording or multi-bug reasoning → parent calls `reelink_query` with a natural-language question; the internal sub-agent loops through the private tools and returns a single synthesized answer. Parent saves tokens because it does not see the intermediate tool calls.

Rationale: this is the Codex-hackathon angle for OpenAI usage — we use an OpenAI model where it is genuinely better than Qwen (text-heavy reasoning over recording metadata and findings) without compromising the open-model thesis (Qwen remains primary VLM for raw video). The two providers do different jobs through the same AI Gateway.

## Hackathon Build Order

- Hours 0-1.5: Layer 0 minimum must ship: TypeScript MCP scaffold on raw `@modelcontextprotocol/sdk`, AI SDK v6 model router, `reelink_analyze`, raw-video Qwen via OpenRouter with live `input_modalities` gating and structured-output JSON enforcement, cached frame extraction for retrieval, Codex MCP config, and one demoable video-to-finding flow on a portfolio recording.
- Hours 1.5-3: Add `reelink_get_frame`, native browser tools forwarded from a spawned Playwright MCP child via CDP attach (`reelink_browser_navigate` etc.), cached recording folders, tool annotations, validate four demo bugs.
- Hours 3-5: Layer 1: `npx reelink record <url>` headed Playwright session, bippy install-hook-only injected first via `addInitScript`, full bippy + react-grab library injected after with toolbar visible, Playwright trace + network HAR + console JSONL captured, folder merged with timestamp alignment in manifest, `reelink_get_dom` and `reelink_get_components` exposed.
- Hours 5-6: Add Layer 2 if time: `reelink_run` with the recording as eval evidence and next-action input. Optionally wire `reelink_query` as an internal ToolLoopAgent (Decision 11) — defer to v0.2 if Layer 1 is wobbly.
- Final polish: README/demo script and agent config instructions after the working demo path is stable.

## Risks / Trade-offs

- Video-only models may miss subtle or sub-second findings -> Mitigation: user focus hints, confidence scores, and cached/queryable frames around candidate timestamps for follow-up inspection.
- Frame preprocessing can make the product look like screenshot sampling -> Mitigation: keep it out of the primary OpenRouter/Qwen Layer 0 analysis path; use it for cached retrieval and explicitly labeled non-primary routes only.
- OpenRouter/Qwen video availability may vary -> Mitigation: validate `input_modalities` from the live OpenRouter catalog, fail loudly for image-only routes, and preserve HF/self-hosted raw-video routes as follow-up provider work.
- Layer 1 capture may not reproduce imported videos -> Mitigation: preserve imported Layer 0 evidence and store generated sessions as separate recordings or merged attempts.
- bippy/react-grab/source maps are development-mode and framework-version sensitive -> Mitigation: make streams optional and explicit in the manifest.
- Browser traces, HARs, and console logs can contain secrets -> Mitigation: redact/omit sensitive headers and tokens, never store API keys in config, and summarize before exposing large artifacts.
- Token savings claims are easy to overstate -> Mitigation: describe the qualitative bottleneck and avoid normative benchmark claims until measured.

## Risk Management and Pre-Hackathon Plan

The hackathon doors open at 9:50 AM Sydney on April 29, 2026 with a 6.5-hour build window. Multimodal Intelligence track is locked, but the exact day-of prompt or theme may shift. To insulate against day-of scope drift, work is split into two phases:

### Pre-hackathon (TONIGHT, Apr 28)

Tonight's work is SETUP ONLY — no Reelink core logic written. Everything tonight survives any plausible scope shift:

- Repository scaffold and dependency install (Section 0.1 of tasks.md).
- API key provisioning for AI Gateway, OpenRouter, OpenAI (Section 0.2).
- Demo recordings: portfolio view-transition flicker, FOUC, plus three sample-app backups (Section 0.3). Most scope-resilient artifact — every plausible track direction needs demo material.
- Sample buggy app: Vite + React 18 with four bug branches (Section 0.4).
- Codex CLI verification (Section 0.5).
- Pre-staged agent configs ready to uncomment (Section 0.6).
- Model-path smoke test through AI SDK to confirm a VLM responds with strict JSON (Section 0.7).
- OpenSpec workflow refresh (Section 0.8).
- Final hardware / wifi / disk checks (Section 0.9).

### During-hackathon (Apr 29, 9:50 AM onward)

All Reelink core logic happens here. Sections 1-9 of tasks.md execute in build-order. If the day-of scope shift requires reframing, the existing sections still constitute the foundation.

### Hedge plans by scope-shift direction

| Day-of theme shift | Reelink adaptation |
| --- | --- |
| Generic multimodal video-to-text | Layer 0 wedge wins as-is; emphasize `reelink_analyze` returning structured findings. |
| Codex agentic workflow | Promote Layer 2 (`reelink_run`) and the internal ToolLoopAgent (Decision 11) to the demo lead. |
| Knowledge graph / RAG | Frame Reelink as a recording-knowledge-base; demo cross-recording querying via `reelink_query`. |
| Live agent automation | Layer 2 + the gateway-pattern Playwright MCP forwarding becomes the centerpiece — agent drives the browser through `reelink_browser_*` tools while recording captures everything. |

In all four directions, tonight's setup work is reusable. Only the building happens day-of.

### Hard non-starters even on day-of pivot

- Do not switch the language to Python tomorrow morning. The TypeScript decision (Decision 1) is locked. If a day-of theme requires Python, frame Reelink as the TypeScript companion to a Python deliverable, do not rewrite.
- Do not reintroduce rrweb. Decision 4 explicitly drops it; Playwright trace plus bippy plus react-grab covers the runtime timeline.
- Do not split the MCP into multiple registered servers. Decision 9's gateway pattern is non-negotiable — single reelink registered, Playwright MCP spawned as child via CDP attach.
- Do not bundle agentation. Decision 5 + Non-Goals park it for v0.2 pending Benji Taylor blessing.
