# Reelink

> Video-as-state for AI browser agents. Re-link a recording's frames to your code's runtime state at any timestamp.

Reelink is a single-MCP gateway plus CLI for AI coding agents (Codex, Cursor, Claude Code, Cline, Roo, VS Code Copilot). It turns screen recordings and agent browser sessions into timestamp-aligned state packages — video plus Playwright trace plus bippy fiber commits plus react-grab element-pointer events plus network HAR plus console JSONL — and analyzes them with Qwen3-VL through AI SDK provider routing.

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
