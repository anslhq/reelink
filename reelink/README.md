Reelink — temporal memory for coding agents.

Coding agents are snapshot-bound. They see a single screenshot, a single DOM dump, a single tool call. Reelink turns screen recordings into queryable, timestamped WorkItems that Codex (and any MCP-aware agent) can cite, retrieve, and act on across time.

Bug findings are the first WorkItem source. Email is next.

## Why this matters



## Status

Pre-release. Scaffolded for OpenAI Codex Hackathon Sydney, April 29 2026. See `openspec/changes/build-reelink-mcp/` in the parent repo for the full plan.

## Install

```bash
npx reelink init
```

## Smoke Test

```bash
cp .env.example .env
# fill OPENROUTER_API_KEY, then keep the default qwen/qwen3.6-flash raw-video route
bun run smoketest:recording
bun run smoketest:gateway
```

`smoketest:recording` generates a fresh Playwright `.webm` under `demo-recordings/`. `smoketest:gateway` sends that raw video to a live OpenRouter Qwen route and fails before inference if the configured model does not advertise `video` in OpenRouter's live model catalog.

## Architecture

- Layer 0: paste a video, get structured findings with timestamps
- Layer 1: each recording is a folder of timestamp-aligned state (video, trace, fiber, react-grab events, HAR, console)
- Layer 2: agent records its own browser session, recording IS the eval evidence

Single MCP gateway pattern: Reelink spawns Playwright MCP as a child via CDP attach. The user installs ONE MCP. AI SDK v6 routes raw-video Qwen through OpenRouter for the primary VLM path. Self-hosting Qwen-VL with SGLang, Ollama, or a Hugging Face endpoint is a last-resort escape hatch, not the default demo path.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
