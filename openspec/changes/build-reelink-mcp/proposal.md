## Why

Reck is video-as-state for AI browser agents: the missing observation primitive for coding/browser agents that need to understand what happened over time, not just what one snapshot currently shows. It turns screen recordings and agent browser sessions into timestamp-aligned state packages containing video, findings, DOM timeline, React component/source map, network/console, trace, and eval evidence.

Reelink was the previous working name. This change keeps Reck in scope as the end-state public identity. For v0.1, the implementation remains in the nested `reelink/` package folder as a deliberate deferred-layout decision rather than claiming root promotion is complete: `reelink/` is package-local implementation history, while public docs, commands, storage, and MCP surfaces use Reck. Root promotion or a folder rename to `reck/` is deferred to a dedicated migration that updates and verifies package scripts, tests, docs, generated artifacts, and local checkout workflows.

The current screenshot/eval/DOM loop is the bottleneck for AI browser agents. Playwright MCP-style observation repeatedly spends tokens on fresh accessibility or DOM state, and newer scoped/CLI approaches reduce the cost without changing the fact that agents are still reasoning over discrete snapshots. Video plus timestamped state makes motion bugs first-class, lets agents query state on demand by timestamp, and exposes temporal causality that is invisible in isolated screenshots.

Bug reporting is the Layer 0 wedge: paste an arbitrary video path and get useful structured findings. The larger product is the recording state package. MCP is the packaging and integration surface for Codex, Cursor, Claude Code, Cline/Roo, VS Code Copilot, and similar agents; it is important, but it is not the product.

## What Changes

- Introduce Layer 0 video finding analysis through `reck_analyze(path, fps_sample=4, focus="any")`, accepting `.mov`/`.mp4`/`.webm` with only a local path and returning `{recording_id, duration_sec, summary, findings, next_steps}`.
- Make `findings` the canonical public Layer 0 contract. Any retained `work_items` field is compatibility/detail output only, with tests and removal criteria.
- Create Layer 1 Reck recordings as folders, not files, with timestamp-aligned video, sampled frames, Playwright trace (action-aligned DOM/network/console/sources), bippy fiber commits and source dictionary, react-grab element-pointer events, network HAR, console JSONL, manifest, and findings.
- Add query and retrieval tools that return paths and summaries rather than raw pixels/bytes: `reck_get_finding`, `reck_get_frame`, `reck_get_dom`, `reck_get_components`, and `reck_query`.
- Add Layer 2 agent recording with `reck_run(task_description, target_url)`, where the agent records its own browser session and uses the recording as both eval evidence and next-action input.
- **BREAKING / Wave 1** Rename the public product identity from Reelink to **Reck** before final implementation locks public contracts, docs, setup, and release assets.
- **BREAKING / Wave 1** Keep the current nested `reelink/` runtime/package as the explicitly justified v0.1 implementation layout while Reck public identity work proceeds; do not claim root promotion or `reck/` folder rename is complete. Package metadata, GitHub/release target, binaries, MCP tool prefix, environment variable prefix, and recording storage still move toward `@anslai/reck`, `anslhq/reck`, `reck` / `reck-mcp`, `reck_*`, `RECK_*`, and `.reck/`, with root promotion or folder rename deferred to a dedicated migration.
- Update public domain references to `tryreck.dev`, with `tryreck.app` as defensive secondary domain.
- Package the local integration as a Node 20+ TypeScript MCP server/package built on raw `@modelcontextprotocol/sdk`, runnable by `bunx -y @anslai/reck` in production or an installed `reck` command for repeated use, with stdio MCP as the default transport and streamable HTTP as an optional later path.
- Single MCP gateway pattern: Reck spawns Playwright MCP as a child stdio subprocess attached to Reck's own Chromium instance via CDP, and forwards a curated subset of browser-automation tools through with a `reck_browser_*` prefix. The user installs ONE MCP, no peer-MCP coexistence, no two-browser coordination.
- Use Vercel AI SDK v6 for model calls, with `@openrouter/ai-sdk-provider` for the v0.1 Qwen raw-video path. The verified default is `qwen/qwen3.6-flash` via OpenRouter because live catalog data shows `text,image,video` modalities. Self-hosted Qwen through SGLang, Ollama, or Hugging Face endpoints is a last-resort fallback only if implemented and verified; otherwise it remains roadmap. Query is deterministic-first, with any LLM fallback opt-in and AI SDK-backed.
- Use `ffmpeg-static` for deterministic cached frame retrieval and future non-primary providers. The primary OpenRouter/Qwen Layer 0 path sends raw video only, validates the selected route against OpenRouter's live `input_modalities`, and fails loudly for image-only Qwen routes. Bundle bippy and react-grab as hard MIT dependencies.
- Provide `bunx -y @anslai/reck init`, agent MCP config detection/registration or truthful snippets for Codex/Cursor/Claude Code/Cline/Roo/VS Code Copilot, `~/.reck/config.json`, env-only API keys, and `reck doctor` troubleshooting that distinguishes installed, initialized, and verified readiness.
- Ship a Codex-as-client setup prompt and a manual integration testing runbook so users can wire Reck into a real coding-agent session and verify end-to-end Layer 0, Layer 1, and Layer 2 paths against real evidence. `~/Documents/Github/landing` is the first required real React app verification target; docs must not overclaim broader framework support beyond observed verification.

## Compatibility Scope

Legacy `reelink_*`, `REELINK_*`, `.reelink/`, `reelink-mcp`, `reelink`, and `bunx -y reelink` behavior may be retained only as transitional compatibility behavior. OpenSpec and implementation must specify:

- where each legacy name still works;
- which surfaces are already Reck-only;
- what tests validate compatibility;
- what removes the compatibility path later.

Legacy linked/local testing may mention old binaries temporarily only when marked legacy/dev-only. The proposal's public end state is Reck. For v0.1, the root-layout decision is documented as deferred nested implementation rather than completed promotion. Final completion still cannot be claimed until remaining old-name runtime surfaces are either implemented as tested compatibility with removal criteria or removed.

## Capabilities

### New Capabilities

- `reck-product-identity`: Define the Reck public identity, package, CLI, binary, MCP prefix, environment prefix, recording directory, domain, and compatibility policy.
- `video-finding-analysis`: Analyze arbitrary screen recordings into timestamped structured findings without requiring app, browser, source, or SDK context.
- `recording-state-package`: Persist Reck recordings as timestamp-aligned folders containing video, findings, frames, trace, DOM, React/fiber, network, console, and manifest artifacts as available.
- `timestamped-dom-timeline`: Capture and retrieve per-timestamp DOM, console, network, trace, and finding context from Playwright trace snapshots plus bippy/react-grab timelines.
- `react-fiber-source-map`: Map timestamped UI state and optional coordinates to React components, source files, lines, and props using bippy fiber commits/source dictionaries.
- `agent-recording-workflow`: Let coding/browser agents invoke Reck tools, initialize MCP configs, and record their own browser tasks through `reck_run`.
- `eval-evidence-generation`: Treat recordings as eval evidence and, where reliable, derive verification artifacts from timestamp-aligned video/state packages.

### Modified Capabilities

- Existing video-analysis and recording-package specs move from previous Reelink naming to Reck public naming, with old names treated only as compatibility or historical references.

## Impact

- New local Reck CLI/MCP planning surface centered on video-as-state, not video bug reporting alone.
- New Reck public identity across package metadata, CLI, MCP tool names, environment variables, recording storage, docs, OpenSpec, and release assets.
- New Layer 0 arbitrary-video workflow as the adoption wedge for production open-source dev tooling.
- New Layer 1 recording folder architecture with Playwright trace, bippy fiber/source events, react-grab element-pointer events, network HAR, console JSONL, frames, findings, and manifest. rrweb is NOT part of v0.1.
- New Layer 2 agent recording workflow where recordings become both eval evidence and next-action input.
- Direct dependencies: Node 20+, TypeScript/Bun, raw `@modelcontextprotocol/sdk`, Vercel AI SDK v6 (`ai` package), `@openrouter/ai-sdk-provider`, Playwright the library, `ffmpeg-static`, react-grab, and bippy. Runtime child spawn: Playwright MCP. OpenRouter routes to `qwen/qwen3.6-flash` for the v0.1 raw-video VLM path; deterministic retrieval answers from local artifacts without GPT/OpenAI in the primary path.
- Completion risk moves from code presence to proof quality: Layer 1 must be real-app-verified, Layer 2 must be workflow-verified, and final docs must match observed client/distribution evidence.
