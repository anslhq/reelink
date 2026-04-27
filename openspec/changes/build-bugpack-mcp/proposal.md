## Why

BugPack is video-as-state for AI browser agents: the missing observation primitive for coding/browser agents that need to understand what happened over time, not just what one snapshot currently shows. It turns screen recordings and agent browser sessions into timestamp-aligned state packages containing video, findings, DOM timeline, React component/source map, network/console, trace, and eval evidence.

The current screenshot/eval/DOM loop is the bottleneck for AI browser agents. Playwright MCP-style observation repeatedly spends tokens on fresh accessibility or DOM state, and newer scoped/CLI approaches reduce the cost without changing the fact that agents are still reasoning over discrete snapshots. Video plus timestamped state makes motion bugs first-class, lets agents query state on demand by timestamp, and exposes temporal causality that is invisible in isolated screenshots.

Bug reporting is the Layer 0 wedge: paste an arbitrary video path and get useful structured findings. The larger product is the recording state package. MCP is the packaging and integration surface for Codex, Cursor, Claude Code, Cline/Roo, VS Code Copilot, and similar agents; it is important, but it is not the product.

## What Changes

- Introduce Layer 0 video finding analysis through `bugpack_analyze(path, fps_sample=4, focus="any")`, accepting `.mov`/`.mp4` with only a local path and returning `{recording_id, duration_sec, summary, findings, next_steps}`.
- Create Layer 1 BugPack recordings as folders, not files, with timestamp-aligned video, sampled frames, Playwright trace, rrweb DOM mutation stream, bippy fiber commits/source dictionary, network, console, manifest, and findings.
- Add query and retrieval tools that return paths and summaries rather than raw pixels/bytes: `bugpack_get_finding`, `bugpack_get_frame`, `bugpack_get_dom`, `bugpack_get_components`, and `bugpack_query`.
- Add Layer 2 agent recording with `bugpack_run(task_description, target_url)`, where the agent records its own browser session and uses the recording as both eval evidence and next-action input.
- Package the local integration as a Node 20+ TypeScript MCP server/package runnable by `npx -y bugpack`, with stdio MCP as the default transport and streamable HTTP as an optional later path.
- Use `ffmpeg-static` for deterministic preprocessing, OpenRouter/Qwen3-VL as the hosted open/model-agnostic default, LM Studio as a local fallback, Playwright as the browser engine, rrweb for DOM mutations, and bippy directly for React fiber/source context.
- Provide `npx bugpack init`, agent MCP config detection/registration, `~/.bugpack/config.json`, env-only API keys, and `bugpack doctor` troubleshooting.

## Capabilities

### New Capabilities
- `video-finding-analysis`: Analyze arbitrary screen recordings into timestamped structured findings without requiring app, browser, source, or SDK context.
- `recording-state-package`: Persist BugPack recordings as timestamp-aligned folders containing video, findings, frames, trace, DOM, React/fiber, network, console, and manifest artifacts as available.
- `timestamped-dom-timeline`: Capture and retrieve per-timestamp DOM, console, network, trace, and finding context from rrweb and Playwright timelines.
- `react-fiber-source-map`: Map timestamped UI state and optional coordinates to React components, source files, lines, and props using bippy fiber commits/source dictionaries.
- `agent-recording-workflow`: Let coding/browser agents invoke BugPack tools, initialize MCP configs, and record their own browser tasks through `bugpack_run`.
- `eval-evidence-generation`: Treat recordings as eval evidence and, where reliable, derive verification artifacts from timestamp-aligned video/state packages.

### Modified Capabilities

## Impact

- New local BugPack CLI/MCP planning surface centered on video-as-state, not video bug reporting alone.
- New Layer 0 arbitrary-video workflow for hackathon wedge demos.
- New Layer 1 recording folder architecture with Playwright trace, rrweb DOM events, bippy fiber/source events, network, console, frames, findings, and manifest.
- New Layer 2 agent recording workflow where recordings become both eval evidence and next-action input.
- Dependencies likely include Node 20+, TypeScript, MCP TypeScript SDK, Playwright, `ffmpeg-static`, OpenRouter/Qwen3-VL integration, LM Studio fallback support, rrweb, and bippy.
