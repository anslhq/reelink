## Context

Reck is video-as-state for AI browser agents. It turns screen recordings and agent browser sessions into timestamp-aligned state packages: video, findings, DOM timeline, React component/source map, network/console, trace, and eval evidence.

Reelink was the previous working name. Reck is the target end-state public identity, not a partially shipped runtime fact until the rename is implemented in code, docs, package metadata, binaries, storage, and commands. The current implementation path may still be `reelink/` and old names may still appear in runtime surfaces; those references are current-implementation-only or legacy compatibility, never proof that the rename is complete.

The wedge is simple: arbitrary video path to structured findings. The thesis is broader: browser/coding agents need a persistent temporal observation primitive. Screenshot/eval/DOM loops force agents to repeatedly request fresh snapshots, spend tokens on state that immediately goes stale, and miss temporal causality. Video plus DOM/runtime timelines lets agents inspect motion, causality, and state at any timestamp.

## Authority and Completion Definition

Product intent comes from the latest settled user corrections in `transcript-combined.md`; this design and the task tracker encode that intent but do not outrank it. Current code, tests, smoke artifacts, and docs are evidence of implementation status only.

Reck is complete only when all three layers are real, user-facing, and verified:

- **Layer 0 complete** means imported videos can be analyzed through public Reck MCP and CLI surfaces, returning the final public schema with persisted artifacts and deterministic retrieval over those artifacts.
- **Layer 1 complete** means browser-driven recordings create timestamp-aligned state packages with video, trace, DOM/runtime, network, console, React/source evidence, and public Reck MCP retrieval over those artifacts.
- **Layer 2 complete** means `reck_run` is a stable public tool that records the agent's browser task, preserves partial-failure evidence, returns real observation state, and writes durable eval evidence.

No layer counts as complete based on docs, partial code, fixture tests, or smoke-only evidence alone. Layer 1 completion requires real-app verification on `~/Documents/Github/landing` plus one lightweight additional proof target. Layer 2 completion requires real workflow verification through the public Reck client/tooling path. Use proof levels consistently when updating status: `implemented`, `unit-tested`, `smoke-verified`, `real-app-verified`, `client-verified`, and `complete`. Docs and OpenSpec must not mark a layer complete ahead of observed proof.

## Reck Rename

Before final implementation locks public contracts and verification artifacts, the public identity changes from Reelink to Reck. Reck is in scope for this change, so execution must start with root promotion decision plus package/runtime/public-surface rename before remaining proof work.

Final identity:

- Product name: **Reck**.
- npm package: `@anslai/reck`.
- GitHub/release target: `anslhq/reck`.
- Primary domain: `tryreck.dev`; defensive secondary domain: `tryreck.app`.
- Binaries: `reck` and `reck-mcp`.
- Public MCP tool prefix: `reck_*`.
- Public Reck-owned environment variable prefix: `RECK_*`.
- New recording storage root: `.reck/`.
- Root package folder: `reck/` if a nested package remains, though a public single-product OSS repo should prefer promoting the runtime/package to the repository root unless the nested structure is intentionally justified.

Legacy compatibility policy:

- Old `reelink_*` tool names may exist only as temporary aliases. If retained, aliases must be documented, tested, and given removal criteria. They are not the primary public contract.
- Old `REELINK_*` environment variables may be read only as migration compatibility. `RECK_*` wins when both are present.
- Old `.reelink/` recordings may be read through documented legacy lookup or migration behavior. New writes go to `.reck/`.
- Old `reelink-mcp`, `reelink`, `bunx -y reelink`, and `reelink/` package-folder references are legacy/local-development-only unless explicitly identified as the current implementation path pending rename.
- Completion cannot be claimed while public docs say Reck but runtime/package/docs/storage still require Reelink names, unless each remaining old name is explicitly documented as a tested compatibility surface with removal criteria.

## Goals / Non-Goals

**Goals:**

- Ship Layer 0 first: `reck_analyze(path)` accepts `.mov`/`.mp4`/`.webm` and returns `{recording_id, duration_sec, summary, findings: [{id, ts, type, severity, title, confidence}], next_steps}` with only a video path.
- Define Layer 1 as a recording folder that aligns video, frames, Playwright trace snapshots, bippy fiber/source data, react-grab element-pointer events, network, console, and findings by timestamp.
- Define Layer 2 as agent self-recording: `reck_run(task_description, target_url)` records a browser task, stores eval evidence, and feeds next-action observation.
- Keep the MCP tool surface small, path-oriented, and usable by Codex, Cursor, Claude Code, Cline/Roo, VS Code Copilot, and related agents.
- Use open/model-agnostic defaults: OpenRouter/Qwen hosted raw-video path first, AI Gateway where the target model exists, and self-hosted Qwen via SGLang, Ollama, or Hugging Face endpoints only as last-resort escape hatches behind stable schemas.
- Treat Layer 0 as the adoption wedge, Layer 1 as the architectural unlock, and Layer 2 as the agentic primitive.
- Protect the wedge: Reck must remain legible and useful to a reporter who only has a recording, especially for motion/time-based bugs that screenshots miss.

**Non-Goals:**

- Do not frame Reck as mainly a video bug reporter.
- Do not frame Reck as mainly an MCP server.
- Do not require a browser, source repo, Chrome extension, SaaS recorder, or app SDK for Layer 0.
- Do not make Gemini the primary model path; it may be used only as benchmark/reference/fallback context if mentioned.
- Do not overclaim exact token savings or benchmark numbers as requirements.
- Do not let docs or examples drift into generic QA-tooling language that obscures the recording-only reporter wedge.
- Do not require every recording to contain every Layer 1 artifact; absent streams must be explicit in the manifest.
- Synthetic Playwright fixtures are smoketest fixtures only, not release completion evidence.
- v0.1 does not provide a `reck_attach_live(url)` MCP tool for opening a Playwright browser with optional third-party annotation tools injected. This is queued for v0.2 contingent on optional peer-dependency relationships maturing.
- v0.1 does not bundle agentation. agentation's PolyForm Shield 1.0.0 license, integration patterns, and peer-detect approach have been researched and parked for v0.2 pending direct outreach to the agentation maintainer.

## Product Layers

### Layer 0: Video finding wedge

`reck_analyze(path, fps_sample=4, focus="any")` accepts `.mov`/`.mp4`/`.webm` and requires only a local video path. It returns:

```text
{recording_id, duration_sec, summary, findings: [{id, ts, type, severity, title, confidence}], next_steps}
```

The public Layer 0 MCP/CLI surface returns `findings` as the normative headline contract: `{recording_id, duration_sec, summary, findings, next_steps}`. Public docs, tests, and examples must treat `findings` as normative for Layer 0. `work_items` must not be returned by default from the public Layer 0 surface during this change; if it is exposed at all, it is compatibility/detail output behind documented policy and tests, never half-primary. The broader long-term product contract is the WorkItem protocol: a richer agent-readable work object that can carry lifecycle fields such as `state`, `approval_state`, `routed_to`, and `completed_at`. Current layers may populate only a truthful subset once the protocol is explicitly promoted and verified.

No browser, source code, DOM, Playwright run, or app SDK is required. The primary OpenRouter/Qwen path sends the raw `.mov`/`.mp4`/`.webm` video. The MVP may still preprocess with `ffmpeg-static` for cached frame retrieval and follow-up inspection; `fps_sample` is part of that public retrieval contract and may be clamped through the preprocessor policy.

### Layer 1: Recording state package

A Reck recording is a folder, not a single file:

```text
my-bug.reck/
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

The implementation should store new browser-generated sessions under `.reck/browser-recordings/<id>`. Imported videos should use `.reck/<id>/` or sibling folders such as `recording.mov.reck/`. Legacy `.reelink/<id>/`, `.reelink/browser-recordings/<id>`, or `recording.mov.reelink/` layouts may be read only through documented compatibility behavior. Layer 1 uses Playwright `trace.zip`, bippy fiber commits/source dictionaries, react-grab element-pointer events, HAR, and console JSONL, all timestamp-aligned. rrweb is out of scope for v0.1.

### Layer 2: Agent self-recording

`reck_run(task_description, target_url)` records an agent's own browser session. The recording becomes both eval evidence and next-action input. Instead of repeatedly dumping screenshot/a11y tree/DOM state, the agent should be able to read a recent frame plus merged state:

```text
{frame_path, dom_summary, component_map, network_since_last, console_since_last}
```

The recording is then queryable by timestamp and usable as durable proof of what the agent attempted.

## Architecture Decisions

### Decision 1: Node 20+ TypeScript package with MCP stdio default

Reck should be a Node 20+ TypeScript package runnable through `bunx -y @anslai/reck` in production or an installed `reck` command for repeated use. If this repository is intended to be a public single-product OSS repo, the preferred final shape is to promote the runtime/package out of the nested `reelink/` folder and into the repository root; keeping a nested package permanently requires an explicit monorepo-style justification. The default integration surface is a stdio MCP server because coding agents already know how to launch local stdio MCP tools. Streamable HTTP via `--http` can be added later without changing the product model.

Build on raw `@modelcontextprotocol/sdk` (matches Chrome DevTools MCP and Playwright MCP, both ship raw SDK). Use Vercel AI SDK v6 (`ai` package) as the model-call abstraction. Use AI Gateway for models it currently exposes, and use the OpenRouter AI SDK provider directly for Qwen3-VL until AI Gateway exposes the relevant Qwen IDs.

Rationale: Playwright the library, bippy, and react-grab are TypeScript-native. Local file-path workflows fit MCP stdio. AI SDK v6 keeps Qwen/OpenRouter and OpenAI/Gateway behind one `generateText` contract without locking the schema to a single provider. MCP is the packaging/integration layer, not the product thesis.

### Decision 2: Stable `reck_*` public API surface

The MCP surface should stay path-oriented and stable. It includes the core recording/query tools plus curated browser gateway tools when Layer 1 is enabled:

```text
reck_analyze(path, fps_sample=4, focus="any")
  -> {recording_id, duration_sec, summary, findings[], next_steps}

reck_get_finding(recording_id, finding_id)
  -> {full description, stack, surrounding console, dom_diff, suggested_fix, frame_paths[]}

reck_get_frame(recording_id, ts)
  -> {path}

reck_get_dom(recording_id, ts)
  -> {path, tree_summary}

reck_get_components(recording_id, ts, x?, y?)
  -> {component, file, line, props}

reck_query(recording_id, question)
  -> free-form answer

reck_record_start(url)
reck_record_stop(recording_id)
reck_record_status(recording_id)

reck_run(task_description, target_url)
  -> {recording_id, success, summary}
```

Tools should return file paths, summaries, IDs, and structured metadata rather than embedding pixels, large DOM dumps, video bytes, or trace bytes in responses.

In addition, Reck forwards a curated subset of browser-automation tools from a spawned Playwright MCP child subprocess with a `reck_browser_*` prefix (see Decision 9): `reck_browser_navigate`, `reck_browser_click`, `reck_browser_type`, `reck_browser_wait`, `reck_browser_evaluate`, `reck_browser_snapshot`, and `reck_browser_take_screenshot`. Total external tool count stays under twelve unless a later design update expands it.

Final public API decisions must be explicit before release: final response shapes for each `reck_*` tool; legacy `reelink_*` alias behavior; legacy recording compatibility for findings-only and work-items-only analysis files; and manifest schema stability/migration behavior.

### Decision 3: Model routing through AI SDK v6

Internal modules should include:

- `VideoPreprocessor`: `ffmpeg-static`, fps=1 baseline, max 64 frames, long edge <=896px. Used for cached frame retrieval and future non-primary providers, not as a silent fallback for OpenRouter/Qwen raw-video analysis.
- `VLMRouter`: AI SDK v6 client. The primary OpenRouter/Qwen path defaults to `qwen/qwen3.6-flash`, verified on Apr 29 2026 via OpenRouter live catalog with `text,image,video` input modalities and an end-to-end raw-video smoke. It sends raw video via AI SDK file parts and validates the selected route against OpenRouter's live `input_modalities`. Image-only Qwen routes or unknown support fail loudly. Same tool surface and response schema across model routes. Structured output through `generateText` + `Output.object` is enabled so the model returns strict JSON without a downstream normalizer.
- `RecordingStore`: new `.reck/<id>/`, `.reck/browser-recordings/<id>`, and sibling `recording.mov.reck/` folder layouts, plus documented legacy read support for `.reelink/` layouts if retained.
- `PlaywrightLibraryHarness`: Layer 1 recording and Layer 2 agent-run browser control. Uses Playwright the library directly, NOT Playwright MCP. Owns `addInitScript` ordering for bippy injection.
- Init scripts (in addInitScript order): bippy `install-hook-only` first, then full bippy + react-grab the library + per-commit recorder. react-grab is injected in normal mode (toolbar visible).

`qwen/qwen3.6-flash` through OpenRouter's AI SDK provider is the primary raw-video VLM path for v0.1. Frame extraction is reserved for cached retrieval and explicitly labeled non-primary providers; it must not become a silent fallback on the primary path. Self-hosted Qwen via SGLang, Ollama, or Hugging Face endpoints is a last-resort fallback only if implemented and verified. The result schema does not depend on any provider. Gemini may be used as a reference benchmark only, never as a default code path.

Provider/model drift policy: the product contract is behavior-first and provider-second. Route-family shifts are allowed only when documented as explicit availability or compatibility decisions. The implementation must not silently drift from the researched route family to whatever model currently exists. If a route change alters trade-offs, input modalities, latency, cost, output quality, or supported capabilities, update OpenSpec and public docs immediately before treating the new route as the supported path.

### Decision 4: Timestamp alignment is the architectural unlock

Layer 1 should align all collected streams by recording timestamp: video frames, findings, Playwright trace snapshots (action-aligned DOM, network, console, sources), bippy fiber commits, source dictionary entries from `bippy/source`, react-grab element-pointer events, network HAR, console JSONL, and eval artifacts. The manifest should make missing streams explicit instead of pretending every recording has full context. rrweb is NOT part of the v0.1 stack.

Rationale: the value is not just finding a bug in a video. The value is that an agent can ask what DOM, component, network, and console state surrounded a frame or finding without re-observing the browser from scratch.

### Decision 5: Bundle bippy and react-grab as hard MIT dependencies; park agentation

bippy and react-grab are bundled as hard `dependencies` in `package.json`. Both are MIT-licensed and can be redistributed inside Reck with notice preservation.

- **bippy**: per-commit React fiber capture for Layer 1. Used in headed-script mode via Playwright `addInitScript`. Provides `install-hook-only`, `instrument`, `secure`, `traverseRenderedFibers`, `getFiberId`, `getFiberFromHostInstance`, `getFiberStack`.
- **react-grab**: component-stack-with-source enrichment for element-pointer events, used in normal toolbar mode during Layer 1 recording so the user can point at elements and see selection affordances. Surfaces component name, file path, line, and column for agent consumption.

agentation is researched and parked. Optional peer-detect via dynamic `await import("agentation")` and a `reck_attach_live` MCP tool are explicit non-goals for v0.1.

### Decision 6: DevX is part of the product surface

The CLI should support one-line setup:

```text
bunx -y @anslai/reck init
reck init
```

Init should detect and register available agents where possible: Codex CLI, Cursor, Claude Code, Cline/Roo, and VS Code Copilot. It should write MCP config snippets with production package paths (`bunx -y @anslai/reck mcp` or a global `reck mcp` command) on Apple Silicon where needed. Persistent non-secret config belongs in `~/.reck/config.json`; API keys must come from environment variables only. `reck doctor` should diagnose missing Node version, ffmpeg, Playwright browser install, MCP config, hosted model API keys, and explicitly configured self-hosted Qwen fallback availability.

### Decision 7: Apache 2.0 with NOTICE pass-through

Reck ships under Apache 2.0. The repository's `LICENSE` contains the full Apache 2.0 text only. `NOTICE` attributes bippy and react-grab MIT licenses with verbatim copyright preservation. `THIRD_PARTY_LICENSES.md` contains full MIT texts for both. `package.json` declares `"license": "Apache-2.0"`.

PolyForm Shield 1.0.0 text never appears in Reck's distributed artifact at v0.1.

### Decision 8: Historical Execution Context

The original hackathon demo context used the founder's portfolio view-transition flicker and hard-refresh FOUC as real bugs for early validation. That context is historical execution material, not the normative product definition. Current product direction is production-grade open-source dev tooling: Layer 0 is the adoption wedge, Layer 1 is the architectural unlock, and Layer 2 is the agentic primitive.

### Decision 9: Single MCP gateway pattern with Playwright MCP child via CDP attach

The user installs ONE MCP: Reck. Reck does NOT proxy a separately registered Playwright MCP or Chrome DevTools MCP. Instead Reck spawns Playwright MCP as a stdio child subprocess inside its own process and forwards a curated subset of its tools through with a `reck_browser_*` prefix.

The gateway only works because both Reck's recording layer AND the spawned Playwright MCP child attach to the SAME Chromium browser instance via CDP. Concretely: Reck uses Playwright the library to launch Chromium with `--remote-debugging-port=<port>`, then passes that CDP endpoint to the spawned Playwright MCP child via its `--cdp-endpoint` flag. The child connects to the existing browser instead of launching a new one. Every navigate / click / evaluate call from the agent operates on the same Chromium instance that Reck is recording.

Forwarded tools (curated): `reck_browser_navigate`, `reck_browser_click`, `reck_browser_type`, `reck_browser_wait`, `reck_browser_evaluate`, `reck_browser_snapshot`, `reck_browser_take_screenshot`. We do not forward Playwright MCP's video / trace tools because the Reck-native recording tools own that path via the library.

### Decision 10: AI SDK v6 as the model abstraction

All model calls go through Vercel AI SDK v6 (`ai` package). Use the built-in AI Gateway provider for gateway-listed models and `@openrouter/ai-sdk-provider` for Qwen3-VL models that are currently present on OpenRouter but not on AI Gateway. This replaces raw HTTP calls and keeps multimodal content, structured output, telemetry, and provider fallback behind one SDK shape.

Structured output is implemented with `generateText` + `Output.object`. Qwen returns strict JSON conforming to our finding schema in one round-trip. No second-model normalizer.

Per the AI SDK skill: do not hardcode gateway model IDs in source; fetch the current set from `https://ai-gateway.vercel.sh/v1/models` and select the highest-versioned model in the family at call time. For OpenRouter-only VLMs, fetch `https://openrouter.ai/api/v1/models` and prefer configured models first, then the current Qwen3-VL family.

### Decision 11: Deterministic v0.1 query; model fallback opt-in only

`reck_query(recording_id, question)` is deterministic-first in v0.1. It answers from persisted recording artifacts before considering any model-backed reasoning. If the question does not match deterministic patterns and an AI SDK fallback is explicitly enabled and configured, the fallback may answer from bounded recording artifacts with citations; otherwise it returns `{ answer: null, reason }`.

No GPT/OpenAI path may be treated as the primary implementation. Any LLM-backed fallback must be opt-in, AI SDK-backed, documented, tested, and disabled by default unless a later product decision changes this explicitly.

### Decision 12: Codex-as-client setup flow

Codex is the canonical first proven client because it made the v0.1 integration loop concrete during the hackathon path; it is not the end-state product boundary. The long-term product must stay broader than Codex and support other coding/browser agents through the same public Reck contract. Reck ships on-disk artifacts to make the integration loop concrete and reproducible, but production onboarding should center the published package command rather than source-path commands:

- `docs/setup-prompt.md` or `reck/docs/setup-prompt.md` — paste-ready prompt that, when dropped into a Codex session, makes the Codex agent verify setup, configure `[mcp_servers.reck]` using the production package command where possible, confirm `codex mcp list` shows `reck` running, call `reck_analyze` against a user-provided recording path, exercise retrieval tools, and report end-to-end status.
- `docs/integration-testing-runbook.md` or `reck/docs/integration-testing-runbook.md` — operator-mode manual runbook covering the same flow step-by-step for cases where the user prefers manual configuration or needs to debug a step the agent cannot.

If the implementation package folder is temporarily still `reelink/`, docs under that path are implementation-path artifacts only; public identity and commands remain Reck. Support must not be claimed beyond observed verification. `reck init` must either truly update supported client configs safely or describe snippet-only behavior honestly.

## Current Implementation Order

- **P0: Authority and OpenSpec reconciliation.** Keep checkbox mechanics intact while aligning status to Reck identity, transcript-first product intent, and observed evidence.
- **P1: Public contract finalization and Layer 0 completion.** Lock `findings` as the headline Layer 0 response, define the WorkItem protocol direction and any `work_items` compatibility/detail output, imported-video package shape, deterministic retrieval, provider route failures, legacy recording compatibility, and Reck public naming.
- **P2: Layer 1 completion.** Prove browser recording, single-MCP gateway, real react-grab visible annotation/source capture, runtime retrieval, and manifest semantics on `~/Documents/Github/landing` plus one lightweight additional proof target.
- **P3: Provider strategy and Layer 2 completion.** Finalize primary OpenRouter/Qwen behavior, document unverified fallback paths as roadmap, prove `reck_run`, durable eval evidence, partial failures, and artifact-backed observations.
- **P4: Init/doctor, docs/package/release, and full verification.** Prove real Codex onboarding, distribution paths, setup prompt, runbook, public docs, and OpenSpec final status sync from observed evidence.

## Risks / Trade-offs

- Video-only models may miss subtle or sub-second findings -> Mitigation: user focus hints, confidence scores, and cached/queryable frames around candidate timestamps for follow-up inspection.
- Frame preprocessing can make the product look like screenshot sampling -> Mitigation: keep it out of the primary OpenRouter/Qwen Layer 0 analysis path; use it for cached retrieval and explicitly labeled non-primary routes only.
- OpenRouter/Qwen video availability may vary -> Mitigation: validate `input_modalities` from the live OpenRouter catalog, fail loudly for image-only routes, and preserve HF/self-hosted raw-video routes as follow-up provider work.
- Layer 1 capture may not reproduce imported videos -> Mitigation: preserve imported Layer 0 evidence and store generated sessions as separate recordings or merged attempts.
- bippy/react-grab/source maps are development-mode and framework-version sensitive -> Mitigation: make streams optional and explicit in the manifest.
- Browser traces, HARs, and console logs can contain secrets -> Mitigation: redact/omit sensitive headers and tokens, never store API keys in config, and summarize before exposing large artifacts.
- Token savings claims are easy to overstate -> Mitigation: describe the qualitative bottleneck and avoid normative benchmark claims until measured.

## Current Risk Management

The immediate risk is overclaiming completion from code presence, docs, or fixture-only tests. Existing browser gateway, recording, retrieval, store, and `reck_run` code should be verified before rewritten. Rewrite only where transcript-defined requirements are unmet, public contracts are inconsistent, behavior is misleading, or implementation is untrustworthy.

### Hard Non-Starters

- Do not switch the language away from TypeScript/Bun.
- Do not reintroduce rrweb. Decision 4 explicitly drops it; Playwright trace plus bippy plus react-grab covers the later runtime timeline.
- Do not split the MCP into multiple registered servers. Decision 9's gateway pattern remains single Reck MCP registered, Playwright MCP spawned as child via CDP attach if/when Layer 1/2 happens.
- Do not bundle agentation. Decision 5 + Non-Goals park it for v0.2 pending Benji Taylor blessing.
- Do not silently fall back to frame extraction on the primary VLM path.
- Do not synthesize DOM structure from Layer 0 frames; return `not_collected` until Layer 1 streams exist.

## Reconciliation Status

This design is product intent, not proof of current completion. Public contracts and docs are still being reconciled: `findings` remains the headline Layer 0 response; WorkItem is the richer long-term public protocol; any public `work_items` field must be deliberate compatibility/detail output until the protocol is documented and verified; public browser `evaluate`/`take_screenshot` require smoke proof; `reck_run` must expose `success` and artifact-backed observations; real react-grab annotation remains required; provider fallback claims and route-family changes must be verified or moved to roadmap; timeline/eval evidence remain first-class; and missing-stream behavior must stay honest.

Status files and README claims are non-authoritative until code/tests/docs verification has completed. Legacy `reelink-mcp` instructions are local-development/testing guidance only; production docs should center `bunx -y @anslai/reck`, `reck`, and `reck-mcp`.
