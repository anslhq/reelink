## Why

Reelink is video-as-state for AI browser agents: the missing observation primitive for coding/browser agents that need to understand what happened over time, not just what one snapshot currently shows. It turns screen recordings and agent browser sessions into timestamp-aligned state packages containing video, findings, DOM timeline, React component/source map, network/console, trace, and eval evidence.

The current screenshot/eval/DOM loop is the bottleneck for AI browser agents. Playwright MCP-style observation repeatedly spends tokens on fresh accessibility or DOM state, and newer scoped/CLI approaches reduce the cost without changing the fact that agents are still reasoning over discrete snapshots. Video plus timestamped state makes motion bugs first-class, lets agents query state on demand by timestamp, and exposes temporal causality that is invisible in isolated screenshots.

Bug reporting is the Layer 0 wedge: paste an arbitrary video path and get useful structured findings. The larger product is the recording state package. MCP is the packaging and integration surface for Codex, Cursor, Claude Code, Cline/Roo, VS Code Copilot, and similar agents; it is important, but it is not the product.

## What Changes

- Introduce Layer 0 video finding analysis through `reelink_analyze(path, fps_sample=4, focus="any")`, accepting `.mov`/`.mp4`/`.webm` with only a local path and returning `{recording_id, duration_sec, summary, findings, next_steps}`.
- Create Layer 1 Reelink recordings as folders, not files, with timestamp-aligned video, sampled frames, Playwright trace (action-aligned DOM/network/console/sources), bippy fiber commits and source dictionary, react-grab element-pointer events, network HAR, console JSONL, manifest, and findings.
- Add query and retrieval tools that return paths and summaries rather than raw pixels/bytes: `reelink_get_finding`, `reelink_get_frame`, `reelink_get_dom`, `reelink_get_components`, and `reelink_query`.
- Add Layer 2 agent recording with `reelink_run(task_description, target_url)`, where the agent records its own browser session and uses the recording as both eval evidence and next-action input.
- Package the local integration as a Node 20+ TypeScript MCP server/package built on raw `@modelcontextprotocol/sdk`, runnable by `npx -y reelink`, with stdio MCP as the default transport and streamable HTTP as an optional later path.
- Single MCP gateway pattern: Reelink spawns Playwright MCP as a child stdio subprocess attached to Reelink's own Chromium instance via CDP, and forwards a curated subset of browser-automation tools through with a `reelink_browser_*` prefix. The user installs ONE MCP, no peer-MCP coexistence, no two-browser coordination.
- Use Vercel AI SDK v6 for all model calls. Qwen via the OpenRouter AI SDK provider is the primary raw-video VLM path because current AI Gateway model listings do not expose the needed Qwen video routes; AI Gateway remains the preferred path for gateway-listed models and the OpenAI GPT-5 family behind the internal `reelink_query` ToolLoopAgent. Self-hosted Qwen through SGLang, Ollama, or Hugging Face endpoints is a last-resort fallback, not the default demo path.
- Use `ffmpeg-static` for deterministic cached frame retrieval and future non-primary providers. The primary OpenRouter/Qwen Layer 0 path sends raw video only, validates the selected route against OpenRouter's live `input_modalities`, and fails loudly for image-only Qwen routes. Bundle bippy and react-grab as hard MIT dependencies — bippy for per-commit fiber capture (transitively pulled via react-grab), react-grab the library injected in normal mode so the toolbar UI is visible during recordings.
- Provide `npx reelink init`, agent MCP config detection/registration for Codex/Cursor/Claude Code/Cline/Roo/VS Code Copilot, `~/.reelink/config.json`, env-only API keys, and `reelink doctor` troubleshooting.

## Capabilities

### New Capabilities
- `video-finding-analysis`: Analyze arbitrary screen recordings into timestamped structured findings without requiring app, browser, source, or SDK context.
- `recording-state-package`: Persist Reelink recordings as timestamp-aligned folders containing video, findings, frames, trace, DOM, React/fiber, network, console, and manifest artifacts as available.
- `timestamped-dom-timeline`: Capture and retrieve per-timestamp DOM, console, network, trace, and finding context from Playwright trace snapshots plus bippy/react-grab timelines.
- `react-fiber-source-map`: Map timestamped UI state and optional coordinates to React components, source files, lines, and props using bippy fiber commits/source dictionaries.
- `agent-recording-workflow`: Let coding/browser agents invoke Reelink tools, initialize MCP configs, and record their own browser tasks through `reelink_run`.
- `eval-evidence-generation`: Treat recordings as eval evidence and, where reliable, derive verification artifacts from timestamp-aligned video/state packages.

### Modified Capabilities

## Impact

- New local Reelink CLI/MCP planning surface centered on video-as-state, not video bug reporting alone.
- New Layer 0 arbitrary-video workflow for hackathon wedge demos.
- New Layer 1 recording folder architecture with Playwright trace, bippy fiber/source events, react-grab element-pointer events, network HAR, console JSONL, frames, findings, and manifest. rrweb is NOT part of v0.1 — Playwright trace already captures DOM action-aligned and bippy fiber commits give the React-aware view.
- New Layer 2 agent recording workflow where recordings become both eval evidence and next-action input.
- Direct dependencies: Node 20+, TypeScript, raw `@modelcontextprotocol/sdk`, Vercel AI SDK v6 (`ai` package), `@openrouter/ai-sdk-provider`, Playwright the library, `ffmpeg-static`, react-grab (transitively pulls bippy). Runtime child spawn: Playwright MCP. OpenRouter routes to Qwen3-VL for VLM; AI Gateway routes to OpenAI for the internal query agent.
