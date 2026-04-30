# Improve Codebase Architecture Roadmap

This roadmap combines the improve-codebase-architecture exploration with an OpenSpec implementation status review. It is documentation only: no code changes, no new TypeScript Interfaces, and no change to current behavior.

The architecture goal is to make Reelink's Layer 0 wedge deeper without losing the hackathon-proven product shape: video path in, timestamped WorkItems and queryable recording state out. The recurring move is to keep MCP and CLI files Shallow as Adapters, then concentrate behavior behind Deep Modules with narrow Interfaces that increase Leverage and Locality.

## Source Materials Reviewed

### OpenSpec skill guidance

- Checked `/Users/harsha/Developer/hackathon/.agents/skills/openspec`: not present.
- Searched under `/Users/harsha/Developer/hackathon/.agents` for OpenSpec skill/docs paths: no matching files were present.
- Used the repository's actual OpenSpec files as the source of truth for the implementation map.

### OpenSpec files reviewed

- `openspec/config.yaml`
- `openspec/changes/build-reelink-mcp/.openspec.yaml`
- `openspec/changes/build-reelink-mcp/proposal.md`
- `openspec/changes/build-reelink-mcp/design.md`
- `openspec/changes/build-reelink-mcp/tasks.md`
- `openspec/changes/build-reelink-mcp/specs/video-finding-analysis/spec.md`
- `openspec/changes/build-reelink-mcp/specs/recording-state-package/spec.md`
- `openspec/changes/build-reelink-mcp/specs/timestamped-dom-timeline/spec.md`
- `openspec/changes/build-reelink-mcp/specs/react-fiber-source-map/spec.md`
- `openspec/changes/build-reelink-mcp/specs/agent-recording-workflow/spec.md`
- `openspec/changes/build-reelink-mcp/specs/eval-evidence-generation/spec.md`

### Code and docs reviewed

- `README.md`
- `reelink/README.md`
- `docs/reelink-query-algorithm.md`
- `docs/setup-prompt.md`
- `docs/integration-testing-runbook.md`
- `reelink/package.json`
- `reelink/src/cli.ts`
- `reelink/src/server.ts`
- `reelink/src/analyze.ts`
- `reelink/src/config/env.ts`
- `reelink/src/config/dotenv.ts`
- `reelink/src/recordings/store.ts`
- `reelink/src/video/preprocessor.ts`
- `reelink/src/vlm/router.ts`
- `reelink/src/schemas.ts`
- `reelink/src/schemas/layer0.ts`
- `reelink/src/schemas/recording.ts`
- `reelink/src/mcp/tools/analysis.ts`
- `reelink/src/mcp/tools/retrieval.ts`
- `reelink/src/mcp/tools/recording.ts`
- `reelink/src/mcp/tools/devx.ts`
- `reelink/src/mcp/tools/_helpers.ts`
- `reelink/src/utils/tool-middleware.ts`
- `reelink/scripts/smoketest-gateway.ts`
- `reelink/scripts/generate-playwright-fixture.ts`
- `reelink/scripts/smoketest-logger.ts`
- `reelink/scripts/smoketest-ffmpeg.ts`

## Current Codebase State Compared Against OpenSpec

| OpenSpec area | Current state | Evidence | Architecture read |
| --- | --- | --- | --- |
| Node 20+ TypeScript/Bun package | Done | `reelink/package.json` has `type: module`, Node `>=20`, Bun scripts, MCP deps, AI SDK, OpenRouter provider, Playwright, ffmpeg-static, react-grab, zod, pino. | Package scaffold exists; not the main source of architecture pain. |
| Stdio MCP default | Done | `reelink/src/server.ts` uses `StdioServerTransport`; `reelink/package.json` exposes `reelink-mcp`. | MCP transport is present. Tool files now need to become Shallow Adapters. |
| `reelink_analyze` path-only Layer 0 | Done | `reelink/src/mcp/tools/analysis.ts` registers `reelink_analyze`; `reelink/src/analyze.ts` accepts `.mov`, `.mp4`, `.webm` without browser/app context. | Working wedge, but orchestration is concentrated in `analyzeVideo`. |
| WorkItem schema with lifecycle fields | Done | `reelink/src/schemas/layer0.ts` defines `WorkItemSchema` with lifecycle, approval, routing, source, and intent fields. | Stable contract exists; pipeline should preserve it. |
| Deterministic preprocessing for cached frames | Done | `reelink/src/video/preprocessor.ts` uses `ffmpeg-static`, clamps effective fps to max 1, max 64 frames, long edge 896. | Preprocessing Module exists, but analysis pipeline still owns when and why it runs. |
| Raw-video OpenRouter/Qwen path | Done | `reelink/src/vlm/router.ts` sends a file part from `sourceVideoPath`, validates OpenRouter model video modality, and does not use frame paths as fallback. | Provider Implementation works but the Seam is shallow and duplicated by smoke script. |
| Missing API key behavior | Done but decision-sensitive | `analyzeFramesWithVlm` returns provider `none`, empty work items, and setup next steps when key is missing. | This is a structured not-run result, not a hard config failure; confirm as public behavior. |
| Null timestamp handling | Done | `reelink/src/vlm/router.ts` drops null timestamp findings with a warning. | Earlier OpenSpec risk appears fixed in current code. |
| Imported video recording package | Partially done | `reelink/src/recordings/store.ts` creates `.reelink/<id>/`; `analyze.ts` writes `analysis.json`, `manifest.json`, and `frames/`. | Storage has useful helpers, but package identity and browser-recording compatibility remain unresolved. |
| Agent-readable manifest | Partially done | `reelink/src/schemas/recording.ts` defines manifest fields and stream statuses; `analyze.ts` writes Layer 0 `not_collected` streams. Artifact paths are mixed relative/absolute. | Manifest is real, but storage Interface should own path policy and compatibility. |
| Retrieval tools | Partially done | `reelink_get_finding`, `reelink_get_frame`, and `reelink_query` exist in `reelink/src/mcp/tools/retrieval.ts`. | Good functional surface, but query engine is embedded inside MCP Adapter. |
| Deterministic query spec | Partially done | `docs/reelink-query-algorithm.md` describes v0.1 patterns; code implements core patterns plus browser artifact patterns. | The Module is missing; pattern compatibility needs a decision. |
| `reelink_get_dom` | Missing for Layer 1; placeholder present | Registered through `registerUnavailableTool` in `recording.ts`. | Correctly avoids fabrication, but OpenSpec runtime DOM retrieval is not implemented. |
| `reelink_get_components` | Missing; placeholder present | Registered through `registerUnavailableTool` in `recording.ts`. | React/fiber/source map OpenSpec is not implemented. |
| CLI `record <url>` | Partially done | `reelink/src/cli.ts` records a headed Chromium video to `demo-recordings/`. | Useful demo Adapter, not yet a Deep Browser Recording Module or package-store writer. |
| MCP browser recording lifecycle | Partially done | `reelink_record_start`, `reelink_record_stop`, `reelink_record_status`, and `reelink_browser_*` tools exist in `recording.ts`. | Valuable prototype, but logic and artifacts live inside MCP file and use `.reelink/browser-recordings/<session_id>`. |
| Single MCP gateway via Playwright MCP child and CDP attach | Missing | Current `recording.ts` uses Playwright directly; no Playwright MCP child process or CDP endpoint forwarding found. | Current browser tools are a direct Implementation, not the OpenSpec gateway pattern. |
| Layer 1 trace, bippy, react-grab capture | Missing | No `trace.zip`, `fiber-commits.jsonl`, `source-dictionary.json`, or `react-grab-events.jsonl` capture Implementation found. | Major remaining Layer 1 work. |
| Network/console runtime capture | Partially done | `recording.ts` captures network and console JSONL for browser recordings. | Useful but not yet canonical package streams or redaction-complete HAR behavior. |
| DevX `init` | Partially done | `cli.ts` creates `~/.reelink/config.json` and prints a simple MCP command. | Does not yet detect agents or generate Codex/Cursor/Claude/Cline/Copilot snippets. |
| DevX `doctor` | Partially done | `cli.ts` checks Node major, API key presence, and config path. | Needs a Deep diagnostics Module with classified checks. |
| MCP DevX tools | Missing by choice/current slice | `registerDevxTools` is empty and notes DevX is CLI-only. | Decision remains: CLI-only vs MCP-exposed DevX. |
| Codex setup prompt and runbook | Done as docs, not behavior | `docs/setup-prompt.md` and `docs/integration-testing-runbook.md` exist and are detailed. | Docs are useful, but the prompt and runbook disagree on linked binary vs `bun run cli.ts`. |
| Eval evidence generation | Mostly missing | Recordings persist artifacts; no verification artifact generation found. | Keep as v0.2 unless Layer 1/2 evidence is reliable. |
| Tests | Mostly missing | Only smoke scripts were found; no unit test directories or `*.test.ts` files found. | Main verification gap for refactors; future work should add Module-level tests before moving code. |

## What Is Done

- The Layer 0 path-only video finding workflow is implemented and exposed through `reelink_analyze`.
- The core WorkItem schema is present with timestamp, severity, confidence, description, lifecycle state, approval state, routing fields, source, and intent.
- Imported video analysis creates a `.reelink/<id>/` package with `analysis.json`, `manifest.json`, and sampled frames.
- The manifest schema and Layer 0 stream map exist, including explicit `not_collected` statuses for Layer 1 streams.
- The OpenRouter/Qwen raw-video route is implemented with live catalog validation and no silent frame fallback.
- Frame preprocessing exists for cached retrieval using `ffmpeg-static`.
- `reelink_get_finding`, `reelink_get_frame`, and `reelink_query` exist and read from persisted package artifacts.
- `reelink record <url>` exists as a CLI browser-video capture path.
- MCP browser recording lifecycle and basic browser tools exist as a prototype: start, stop, status, snapshot, click, type, navigate, wait.
- Logging middleware and AI SDK telemetry helpers exist; MCP tool handlers reviewed were wrapped with `withToolLogging`.
- `docs/setup-prompt.md` and `docs/integration-testing-runbook.md` exist for Codex-as-client onboarding.
- API keys are read from environment variables; `~/.reelink/config.json` stores non-secret config only.

## What Is Partially Done

- **Recording Package Storage:** The store has useful helpers, but browser recordings still use a divergent `.reelink/browser-recordings/<session_id>` layout and retrieval has direct browser path reads.
- **Deterministic Query Module:** The functionality exists, but it lives inside `reelink/src/mcp/tools/retrieval.ts`, making the MCP file too Deep and the query engine hard to test independently.
- **Analysis Pipeline Module:** Layer 0 works, but `analyzeVideo` still owns config loading, storage creation, preprocessing, provider invocation, schema shaping, manifest defaults, and persistence.
- **Model Provider Selection Seam:** OpenRouter Qwen raw-video selection works, but selection, catalog fetch, provider invocation, prompt/file construction, media type mapping, and WorkItem mapping live together in `vlm/router.ts`; smoke validation duplicates parts of this.
- **Browser Recording Module:** Browser recording exists in CLI and MCP forms, but lifecycle, artifact writing, browser control, JSONL capture, manifest shape, and session state are mixed in Adapters.
- **DevX Configuration Module:** Config loading, dotenv loading, `init`, and `doctor` exist, but are not yet a Deep diagnostics Module and do not meet the full OpenSpec agent-registration scope.
- **MCP Tool Adapter Layer:** Tool registration exists and uses logging, but response envelope helpers are duplicated and domain logic still lives in retrieval and recording tools.
- **Codex onboarding docs:** The setup prompt and integration runbook both exist, but one prefers linked `reelink-mcp` and the other documents `bun run src/cli.ts mcp`; that discrepancy should be resolved.

## What Is Left

- Implement a real DevX Configuration Module for config precedence, setup recommendations, and classified doctor checks.
- Extract provider selection and invocation behind a provider Seam with OpenRouter Qwen raw-video and fake-model Adapters.
- Deepen Recording Package Storage so imported videos, browser recordings, and future agent runs share package rules and manifest vocabulary.
- Extract the Analysis Pipeline Module from `analyzeVideo` while preserving current behavior.
- Extract a Deterministic Query Module from `reelink/src/mcp/tools/retrieval.ts` and align tests with `docs/reelink-query-algorithm.md`.
- Convert MCP files into Shallow Adapters over Modules, with shared response envelopes, annotations, logging, and unavailable-tool behavior.
- Decide whether current direct `reelink_browser_*` tools are stable or a demo bridge before implementing the OpenSpec Playwright MCP child/CDP gateway.
- Implement Layer 1 capture only after package storage is settled: `trace.zip`, `fiber-commits.jsonl`, `source-dictionary.json`, `react-grab-events.jsonl`, `network.har`, `console.jsonl`, timestamp alignment, and redaction metadata.
- Implement `reelink_get_dom` and `reelink_get_components` when Layer 1 artifacts exist; keep placeholders honest until then.
- Implement `reelink_run` and eval evidence generation as Layer 2 work after browser recording and package storage are Deep enough.
- Add unit/integration tests. Current verification is mostly smoke-script based.

## Priority Map

| Priority | Candidate Module | Why now | Depends on |
| --- | --- | --- | --- |
| P0 | DevX Configuration Module | Configuration controls launch, secrets, model keys, and doctor validation. It must stop being scattered before other Modules rely on it. | None |
| P0 | Model Provider Selection Seam | Analysis quality and failure behavior currently leak through `analyzeFramesWithVlm`. Provider handling should be stable before deepening analysis. | DevX Configuration Module |
| P1 | Recording Package Storage | Imported videos and browser recordings need one persistence Interface before query, analysis, and recording can converge. | DevX Configuration Module |
| P1 | Analysis Pipeline Module | `analyzeVideo` should coordinate config, storage, preprocessing, VLM, schema shaping, and manifest writing through Adapters. | DevX, Provider Selection, Storage |
| P2 | Deterministic Query Module | Query logic depends on stable package layout, stream status, and artifact paths. | Storage, Analysis Pipeline |
| P2 | MCP Tool Adapter Layer | Tool schemas should adapt to named internal Modules instead of owning domain logic. | Storage, Analysis Pipeline, Query, Recording shape |
| P3 | Browser Recording Module | Browser recording currently creates a second recording shape; it should align after storage and lifecycle decisions are named. | Storage; can partially run beside Query after package decisions |
| P4 | Layer 1/2 OpenSpec Runtime Capture | Trace, React fiber/source, component lookup, agent runs, and eval generation need stable storage and recording lifecycle first. | Storage, Browser Recording, MCP Adapter Layer |

## Dependency Ordering

1. **DevX Configuration Module** first because configuration determines launch, secrets, model keys, and `doctor` validation.
2. **Model Provider Selection Seam** before deeper analysis work because `analyzeVideo` depends on `analyzeFramesWithVlm`, and provider failures currently leak into the Layer 0 wedge.
3. **Recording Package Storage** before query and browser recording because it is the persistence Interface for imported video, retrieval, manifest streams, browser recordings, and future agent recordings.
4. **Analysis Pipeline Module** after provider and storage because it coordinates config, storage, preprocessing, VLM analysis, schema shaping, and manifest writing.
5. **Deterministic Query Module** after storage because it depends on stable `analysis.json`, `manifest.json`, stream status, browser artifact paths, and WorkItem helpers.
6. **MCP Tool Adapter Layer** after internal Modules are named because it should adapt tool schemas to internal Interfaces rather than define behavior in place.
7. **Browser Recording Module** after storage decisions because it currently creates a second recording shape under `.reelink/browser-recordings/<session_id>`.
8. **Layer 1/2 runtime capture and eval evidence** after browser recording and storage are Deep enough to append timestamp-aligned artifacts safely.

## Candidate Modules

### 1. Browser Recording Module

**Current files:** `reelink/src/mcp/tools/recording.ts`, `reelink/src/cli.ts`.

**Current pain:** Browser recording has two Implementations with mixed concerns: Playwright lifecycle, session state, artifact paths, JSONL writing, CLI interruption, MCP start/stop behavior, browser automation, and max-duration handling. The current shape is useful for a demo but Shallow: callers and maintainers need to know too much about how recording is performed and where artifacts land.

**Current status:** Partial. CLI recording writes a `.webm` to `demo-recordings/`. MCP recording writes network, console, DOM snapshots, and a manifest under `.reelink/browser-recordings/<session_id>`. It does not yet write canonical recording packages, capture Playwright trace, inject bippy/react-grab, or spawn Playwright MCP via CDP attach.

**Proposed Seam/Adapter direction:** Create a browser recording lifecycle Seam. The Deep Module should own session lifecycle, artifact manifest creation, state transitions, stop idempotency, max-duration behavior, and the mapping from browser events to recording-package artifacts. `reelink/src/cli.ts` and `reelink/src/mcp/tools/recording.ts` should become Adapters over that Module. A later `reelink_run` Adapter can reuse the same lifecycle without inventing a third recording path.

**Depth, Leverage, and Locality:** Depth comes from hiding Playwright/session/artifact details behind one recording lifecycle Interface. Leverage increases because CLI, MCP, and future agent self-recording can use the same Implementation. Locality improves because lifecycle bugs, artifact naming, and stop semantics live in one place.

**Fixes and improvements:**

- Consolidate CLI and MCP browser recording lifecycle behavior into one Module.
- Normalize browser recording output into the recording package store rather than `.reelink/browser-recordings/<session_id>` as an unrelated shape.
- Make stop behavior idempotent and observable through structured status.
- Write an artifact manifest that can be consumed by retrieval and deterministic query without special-case path rules.
- Decide whether current direct browser tools remain or are replaced by the OpenSpec Playwright MCP child gateway.
- Keep browser automation details out of the MCP tool registration file.

**Test strategy:** Use a fake browser Adapter for lifecycle tests. Cover start, stop, double stop, max duration, artifact manifest generation, console/network writing, DOM snapshot status, missing optional streams, and failure cleanup. Add one real Playwright smoke only after the Module is testable with fakes.

**Risks:** Recording lifecycle can become the largest Module if it absorbs browser automation primitives. Keep the Interface focused on recording sessions and artifacts; browser click/type/navigation forwarding belongs in the MCP Adapter layer or future browser gateway work.

### 2. Recording Package Storage

**Current files:** `reelink/src/recordings/store.ts`, `reelink/src/analyze.ts`, `reelink/src/mcp/tools/recording.ts`, `reelink/src/mcp/tools/retrieval.ts`.

**Current pain:** Imported videos and browser recordings use divergent layouts. Path rules leak into analysis, retrieval, and recording tools. The docs define a recording package as Reelink's durable unit, but the Implementation still requires callers to know layout details and legacy path conventions.

**Current status:** Partial. `recordings/store.ts` creates imported-video packages and has read helpers for analysis, manifest, work items, streams, prod build, and nearest frame. It also normalizes older `findings` fixtures. It does not own browser-recording packages, and `retrieval.ts` reads `.reelink/browser-recordings/<session_id>` directly.

**Proposed Seam/Adapter direction:** Deepen `recordings/store.ts` into the recording package store. Its Interface should cover package creation, package resolution, `analysis.json` and `manifest.json` loading, stream status reading, artifact path calculation, and package-safe writes. Imported-video and browser-recording paths should be Adapters that create or attach to packages through the same store.

**Depth, Leverage, and Locality:** Depth comes from making package layout a storage concern rather than caller knowledge. Leverage is high because analysis, query, retrieval, recording, and future Layer 1 streams all need this Interface. Locality improves because package migrations, legacy normalization, and path calculation happen once.

**Fixes and improvements:**

- Establish one package identity model before expanding features.
- Normalize imported-video packages and browser-recording packages under one manifest and artifact vocabulary.
- Move all browser artifact resolution out of `retrieval.ts` and into storage/package helpers.
- Keep frame path calculation, manifest stream defaults, and root resolution in storage.
- Preserve read compatibility for existing `.reelink/<id>/` packages and current browser artifacts until migration is decided.
- Make missing streams explicit through manifest status instead of fallback path guessing.

**Test strategy:** Use fixture package directories. Cover root resolution, `analysis.json` and `manifest.json` loading, frame path calculation, legacy normalization, missing streams, unavailable streams, browser artifact references, absolute/relative artifact paths, and relocatable package assumptions once decided.

**Risks:** The biggest risk is treating current divergent layouts as permanent public Interface. Decide whether to normalize eagerly or support a short compatibility layer before implementation.

### 3. Deterministic Query Module

**Current files:** `reelink/src/mcp/tools/retrieval.ts`, `docs/reelink-query-algorithm.md`.

**Current pain:** `answerDeterministicQuery` is embedded in an MCP tool file alongside pattern ordering, storage reads, browser artifact reads, response shaping, and fallback behavior. This makes the MCP tool file too Deep in the wrong place and too Shallow as an Adapter. The query docs are clear, but the executable test surface is coupled to tool registration.

**Current status:** Partial. Core deterministic query behavior exists for summary, list, severity, next steps, frame at timestamp, type, confidence, streams, prod build, finding by id, duration, and null fallback. Browser artifact query branches also exist but are outside the original deterministic query spec and read direct paths.

**Proposed Seam/Adapter direction:** Create a deterministic query engine Module. Its Interface should accept a recording identity and question, then return the documented query result shape using storage and artifact Adapters. `reelink_query` should only validate input, call the Module, and wrap MCP response content.

**Depth, Leverage, and Locality:** Depth comes from concentrating pattern order, slot extraction, fallback behavior, and stream-aware answers in one Module. Leverage increases because the same query engine can serve MCP, CLI, tests, and future local debugging tools. Locality improves because regex changes and compatibility decisions happen in one place.

**Fixes and improvements:**

- Move deterministic query matching out of `reelink/src/mcp/tools/retrieval.ts`.
- Keep the pattern catalog aligned with `docs/reelink-query-algorithm.md`.
- Decide whether browser artifact patterns are part of deterministic v0.1 or a browser-recording extension.
- Use storage helpers instead of direct file reads for manifest, analysis, streams, and artifacts.
- Return explicit deterministic null or `not_collected` answers rather than synthesizing from missing streams.

**Test strategy:** Add table-driven tests from `docs/reelink-query-algorithm.md`. Cover summary, list findings, severity, type, timestamp, confidence, frame lookup, stream availability, production-build query, browser artifacts if retained, null fallback, empty deterministic result sets, and unknown finding ids.

**Risks:** Regex pattern IDs and order may become public compatibility promises. If they are public, tests should lock ordering. If not, the public Interface should promise answer semantics rather than internal matcher order.

### 4. Analysis Pipeline Module

**Current files:** `reelink/src/analyze.ts`, `reelink/src/video/preprocessor.ts`, `reelink/src/vlm/router.ts`, `reelink/src/recordings/store.ts`.

**Current pain:** `analyzeVideo` owns config loading, input validation, copy/preprocess policy, model route invocation, WorkItem shaping, stream defaults, manifest schema construction, persistence, and output. That gives Layer 0 working behavior but weak Locality: provider bugs, storage bugs, preprocessing bugs, and schema bugs meet in one function.

**Current status:** Done functionally for Layer 0, partial architecturally. It produces the expected package and output, but the Module boundary is not Deep enough yet.

**Proposed Seam/Adapter direction:** Create a Layer 0 analysis pipeline Module. It should orchestrate config, storage, preprocessor, VLM provider, schema shaping, and manifest writing through Adapters. The Module stays Deep by defining the pipeline's order and invariants while leaving provider, storage, and filesystem details behind their own seams.

**Depth, Leverage, and Locality:** Depth comes from exposing one analysis operation while hiding many steps. Leverage increases because MCP, CLI, smoketests, and future batch/import flows can use the same pipeline. Locality improves because output schema and manifest defaults are no longer scattered across tool and storage files.

**Fixes and improvements:**

- Separate orchestration from provider selection and storage layout.
- Make raw-video analysis the primary model path and frame preprocessing the cached retrieval path unless a non-primary provider explicitly needs frames.
- Keep manifest stream defaults honest: available frames, not-collected Layer 1 streams, and explicit eval status.
- Keep null timestamp dropping consistent and tested.
- Classify unsupported extension, missing key, provider unavailable, and model output failures in a stable way.

**Test strategy:** Use fake config, storage, preprocessor, and VLM Adapters. Cover no API key, model success, invalid extension, preprocessing failure, provider failure, null timestamp dropped, manifest stream defaults, source video copy/reference policy, and schema output stability.

**Risks:** Over-deepening the pipeline could hide useful policy decisions. Keep policy visible in tests and docs, but keep implementation mechanics local to Adapters.

### 5. Model Provider Selection Seam

**Current files:** `reelink/src/vlm/router.ts`, `reelink/scripts/smoketest-gateway.ts`, `openspec/changes/build-reelink-mcp/design.md`.

**Current pain:** `analyzeFramesWithVlm` ignores `framePaths` and sends raw video, while the name implies frame analysis. Selection, catalog validation, OpenRouter invocation, prompt/file reading, structured output, media type mapping, fallback behavior, and WorkItem mapping are all in one Implementation. The smoke script duplicates validation concerns.

**Current status:** Done functionally for OpenRouter Qwen raw-video, partial architecturally. Live catalog validation, modality checks, media type mapping, and null timestamp filtering exist. A provider Seam with multiple Adapters and shared smoke/doctor validation does not.

**Proposed Seam/Adapter direction:** Create a provider selection and invocation Module with a stable invocation Seam. The first Adapter is OpenRouter Qwen raw-video. Future Adapters can cover AI Gateway-listed models, self-hosted Qwen, or a fake model for tests. Catalog validation should be shared by the Module and smoke/doctor paths rather than copied.

**Depth, Leverage, and Locality:** Depth comes from making provider complexity disappear behind one invocation Interface. Leverage increases because analysis, smoke tests, doctor checks, and future provider work can reuse selection and validation. Locality improves because media type mapping and model catalog rules stop leaking into pipeline code.

**Fixes and improvements:**

- Rename or restructure the current `analyzeFramesWithVlm` path so raw-video behavior is explicit.
- Share model catalog validation between runtime selection, `doctor`, and `smoketest-gateway`.
- Keep configured model preference, fallback order, and video modality checks in one Module.
- Separate prompt construction and WorkItem mapping from provider transport where practical.
- Add a fake model Adapter so analysis pipeline tests do not call hosted providers.

**Test strategy:** Use sample model catalogs. Cover configured model found, configured model missing, model without video modality, fallback order, no key, media type mapping, provider error classification, and WorkItem mapping from strict JSON output.

**Risks:** Live catalog validation every call may make local analysis slower or less reliable during provider outages. Decide validation cadence before implementation.

### 6. MCP Tool Adapter Layer

**Current files:** `reelink/src/mcp/tools/analysis.ts`, `reelink/src/mcp/tools/retrieval.ts`, `reelink/src/mcp/tools/recording.ts`, `reelink/src/mcp/tools/_helpers.ts`, `reelink/src/utils/tool-middleware.ts`.

**Current pain:** Tool registration, annotations, structured content, JSON text, logging, and unavailable-tool behavior are repeated. Domain logic lives in retrieval and recording tool files. That makes MCP files too hard to scan and too risky to edit when changing internal behavior.

**Current status:** Partial. Tool files have useful schemas and logging. `_helpers.ts` handles unavailable tools. Response wrapping is duplicated, and retrieval/recording contain domain Implementation logic.

**Proposed Seam/Adapter direction:** Treat MCP as an Adapter layer only. MCP tool files should own schemas, annotations, response envelope, logging, redaction/truncation, and unavailable-tool behavior. Internal Modules should own analysis, query, storage, recording, and DevX behavior.

**Depth, Leverage, and Locality:** Depth does not belong in tool files. The Leverage here is consistency: every tool gets the same structured response, logging, and error behavior. Locality improves because MCP protocol concerns are isolated from Reelink domain Modules.

**Fixes and improvements:**

- Consolidate JSON tool result helpers, structured content wrapping, and text content formatting.
- Standardize tool annotations and unavailable-tool responses.
- Move deterministic query and browser recording logic behind Modules.
- Keep logging redaction and truncation in middleware rather than tool bodies.
- Add fake Module Adapters for tool registration tests.

**Test strategy:** Test tool registration, input schemas, output schemas, annotations, structured response shape, unavailable-tool behavior, fake Module invocation, and logging redaction/truncation. Avoid hosted model or real browser calls in MCP Adapter tests.

**Risks:** Over-abstracting tool registration can make the raw MCP SDK harder to reason about. Keep the Adapter helpers small and visible; do not create a framework.

### 7. DevX Configuration Module

**Current files:** `reelink/src/cli.ts`, `reelink/src/config/env.ts`, `reelink/src/config/dotenv.ts`, `reelink/src/mcp/tools/devx.ts`, `docs/integration-testing-runbook.md`, `docs/setup-prompt.md`.

**Current pain:** Setup, diagnosis, env parsing, docs, and config expectations are split across CLI, docs, and config helpers. `doctor` checks only a few values, and `registerDevxTools` is empty. This weakens the product surface because a local MCP tool lives or dies by installation, config, and hosted model availability.

**Current status:** Partial. `.env` loading, file config, `init`, and `doctor` exist. Full OpenSpec registration and doctor checks do not.

**Proposed Seam/Adapter direction:** Create a DevX configuration and diagnostics Module. CLI `init`/`doctor` become Adapters. A future MCP DevX tool can also adapt to it if DevX should be available to agents. Filesystem, environment, and MCP-client config locations are Adapters behind the Module.

**Depth, Leverage, and Locality:** Depth comes from one Module that understands config precedence, defaults, diagnostics, and recommendations. Leverage increases because CLI, docs validation, smoke tests, and future MCP DevX tooling share the same checks. Locality improves because setup behavior is not reimplemented in prompts, docs, and scripts.

**Fixes and improvements:**

- Define config precedence across env vars, `.env.local`, `.env`, project config, and user config.
- Keep API keys in environment variables only; never write secrets to project config files.
- Classify doctor checks as pass, warn, fail, skipped, or not configured.
- Include Node version, Bun availability, package resolution, Playwright browser install, ffmpeg availability, MCP config, OpenRouter key, configured model, and optional provider checks.
- Reconcile setup prompt and runbook command strategy: linked `reelink-mcp` vs absolute `bun run src/cli.ts mcp`.
- Decide whether `registerDevxTools` should expose read-only setup/doctor tooling through MCP or remain CLI-only.

**Test strategy:** Test dotenv parsing, env precedence, defaults, config-file parsing, missing file behavior, doctor check classification, setup recommendations, no-secret persistence, and Codex/Cursor config snippet generation if retained.

**Risks:** DevX can drift into writing user config files too eagerly. Keep destructive or global config writes explicit and test dry-run output first.

## Implementation Sequence

### Phase 0: Behavior lock and tests inventory

- Preserve the current Layer 0 `reelink_analyze` behavior.
- Record current public tool names and response shapes.
- Add a lightweight test harness before moving Modules; current smoke scripts are not enough to protect refactors.
- Resolve doc inconsistency between `docs/setup-prompt.md` and `docs/integration-testing-runbook.md`.

### Phase 1: DevX Configuration Module

- Extract config loading, defaults, and doctor classification behind a Deep Module.
- Keep CLI behavior as an Adapter over the new Module.
- Share model catalog checks with provider selection rather than duplicating them in `doctor` and smoke scripts.
- Add focused tests for env precedence, dotenv parsing, defaults, and doctor classification.

### Phase 2: Model Provider Selection Seam

- Rename or reshape raw-video provider invocation so the Interface matches behavior.
- Add OpenRouter Qwen raw-video Adapter and fake model Adapter.
- Share model catalog validation with doctor/smoke paths.
- Add tests for catalog selection, fallback order, no key, modality mismatch, media type mapping, and WorkItem mapping.

### Phase 3: Recording Package Storage

- Deepen `recordings/store.ts` into the package storage Module.
- Move root resolution, manifest/analysis loading, stream status, artifact paths, browser artifact lookup, and frame lookup into storage.
- Normalize imported-video and browser-recording layout decisions without breaking current packages.
- Add fixture-based package tests.

### Phase 4: Analysis Pipeline Module

- Move `analyzeVideo` orchestration behind a pipeline Module that uses config, provider, preprocessor, and storage Adapters.
- Preserve raw-video primary behavior and cached frame retrieval.
- Add pipeline tests with fake Adapters before touching hosted provider behavior.
- Verify current MCP/CLI analysis output remains compatible.

### Phase 5: Deterministic Query Module

- Move `answerDeterministicQuery` out of MCP retrieval tools into a query engine Module.
- Align executable tests with `docs/reelink-query-algorithm.md`.
- Decide whether browser artifact query patterns are core v0.1 or browser-recording extension behavior.
- Keep `reelink_query` as a Shallow Adapter.

### Phase 6: MCP Tool Adapter Layer

- Consolidate response envelope, structured content, annotations, logging, redaction, and unavailable-tool behavior.
- Convert `analysis.ts`, `retrieval.ts`, `recording.ts`, and `devx.ts` to Shallow Adapters over Modules.
- Add tool registration and response-shape tests with fake Modules.

### Phase 7: Browser Recording Module

- Move browser recording lifecycle out of CLI/MCP files.
- Store browser sessions through the package store or through an explicitly compatible package Adapter.
- Add fake browser lifecycle tests and one real Playwright smoke.
- Decide direct browser tools vs OpenSpec Playwright MCP child gateway before expanding the browser surface.
- Prepare the same lifecycle for future `reelink_run` without implementing Layer 2 prematurely.

### Phase 8: Layer 1/2 OpenSpec runtime work

- Implement trace capture, bippy/react-grab capture, runtime stream alignment, DOM retrieval, component retrieval, and redaction metadata.
- Implement `reelink_run` only after recording lifecycle and package storage are stable.
- Treat eval generation as evidence-first: generate deterministic Playwright artifacts only when stable invariants exist.

## Risks, Verification Gaps, and Suggested Tests

### Risks

- **Scope drift from Layer 0:** Deepening Modules could accidentally pull Layer 1/2 behavior into v0.1 paths. Preserve current wedge behavior before runtime capture work.
- **Public Interface uncertainty:** Recording IDs, manifest shape, pattern IDs, browser artifacts, and current `reelink_browser_*` tools may already be semi-public.
- **Provider availability:** OpenRouter/Qwen video support can change. Centralize catalog validation and make doctor/smoke outputs clear.
- **Artifact secrecy:** Browser traces, HARs, console logs, props, and config files can include secrets. Redaction must be a first-class runtime capture requirement.
- **Adapter overgrowth:** MCP helper consolidation could become a private framework. Keep tool Adapters thin and concrete.
- **Layout migration risk:** Existing packages under `.reelink/<id>/` and browser recordings under `.reelink/browser-recordings/<session_id>` may need read compatibility.
- **Docs drift:** Setup prompt and runbook currently recommend different MCP launch styles.

### Verification gaps

- No unit test files were found for `reelink/src`.
- No table-driven deterministic query tests were found.
- No fixture-based recording package tests were found.
- No fake-provider tests were found for model selection and WorkItem mapping.
- No fake-browser lifecycle tests were found for MCP recording start/stop/idempotency.
- Layer 1 OpenSpec requirements are not behaviorally verified because the Implementations are not present.
- Layer 2 `reelink_run` and eval evidence generation are placeholders or future work.

### Suggested tests

- **Config tests:** dotenv parsing, env precedence, user config defaults, missing config, no-secret persistence, doctor classification.
- **Provider tests:** sample OpenRouter catalogs, configured model missing, configured model without video, fallback order, no key, media type mapping, strict JSON mapping, null timestamp dropping.
- **Storage tests:** imported package creation, manifest read/write, frame path calculation, legacy `findings` normalization, missing streams, browser-recording compatibility fixtures.
- **Pipeline tests:** fake config/storage/preprocessor/provider orchestration; invalid extension; no key; provider failure; manifest defaults; source video copy/reference policy.
- **Query tests:** table-driven tests from `docs/reelink-query-algorithm.md`, plus browser artifact extension cases if retained.
- **MCP Adapter tests:** schemas, annotations, structured response envelope, unavailable-tool behavior, logging redaction/truncation, fake Module invocation.
- **Browser recording tests:** fake browser lifecycle, max duration, stop idempotency, artifact manifest, network/console capture, snapshot save, failure cleanup.
- **Smoke tests:** keep one hosted OpenRouter/Qwen raw-video smoke and one real Playwright browser recording smoke.

## Decision Questions

1. Is `recording_id` the source video, an import attempt, or the full package identity?
2. Should imported videos and browser recordings share one `ManifestSchema`?
3. Should packages be relocatable, or can absolute source paths be part of the public Interface?
4. Should a missing API key produce the current structured not-run result or become a hard config failure?
5. Is frame preprocessing mandatory for every Layer 0 call, or only for cached retrieval and non-primary providers?
6. Should live model catalog validation happen every call, once per process, or only in doctor/smoke flows?
7. For missing streams, should query return a null fallback or an explicit `not_collected` answer?
8. Are regex pattern IDs and matcher order public compatibility promises?
9. Should MCP tool files be strictly Shallow Adapters?
10. Are recording/browser tools a stable v0.1 surface, demo bridge, or v0.2 surface?
11. Should DevX be CLI-only or exposed through MCP?
12. Should the browser automation surface keep the current direct Playwright Implementation or move to the OpenSpec Playwright MCP child/CDP gateway?
13. Should browser artifact query patterns remain inside deterministic query, or become a browser-recording query extension?
14. Which MCP launch path is canonical for docs: linked `reelink-mcp`, `npx -y reelink`, or absolute `bun run src/cli.ts mcp` during local development?
15. Should eval evidence generation stay v0.2-only until Layer 1 streams exist, or should Layer 0 packages record minimal eval metadata now?

## Review Checklist For Future Implementation

- Each new Module has a smaller Interface than its Implementation.
- Each Seam has at least two meaningful Adapters before it is treated as stable, or it is marked as provisional.
- MCP and CLI files remain Shallow Adapters over Modules.
- Storage owns paths; query owns deterministic matching; provider selection owns model catalogs; analysis pipeline owns orchestration.
- Tests exercise the Interface and protect current tool behavior.
- No implementation phase stores secrets, fabricates missing streams, or silently changes the Layer 0 raw-video path.
