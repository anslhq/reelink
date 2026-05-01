# Reck

> Video-as-state for AI coding and browser agents.

Reck turns screen recordings and recorded browser sessions into timestamp-aligned state packages that agents can query over time. Layer 0 is the adoption wedge: give Reck a `.mov`, `.mp4`, or `.webm` path and get structured `findings` with timestamps. Layer 1 adds browser-recording state such as trace, DOM/runtime, React/source, network, console, frames, and manifest evidence. Layer 2 lets an agent record its own browser task through the same package model.

Reck was previously called Reelink. Old Reelink names remain only as historical context, migration compatibility, or local-development compatibility when explicitly labeled.

## Public Identity

- Product: Reck
- npm package: `@anslai/reck`
- Binaries: `reck` and `reck-mcp`
- MCP server name: `reck`
- MCP tools: `reck_*`
- Recording storage: `.reck/`
- Reck-owned environment variables: `RECK_*`
- Domains: `tryreck.dev` and defensive secondary `tryreck.app`
- Repository target: `anslhq/reck`

For v0.1, the implementation intentionally remains in the nested `reelink/` package folder while Reck public identity work proceeds. Root promotion or a folder rename to `reck/` is deferred because a broad filesystem move would touch package scripts, tests, docs, generated artifacts, and local checkout workflows; until that migration is completed and verified, `reelink/` is the package-local implementation path only, not the public product identity.

## Install

The public launch direction is `@anslai/reck`, with `bunx` for one-off use and installed `reck` for repeated use once the package is published:

```bash
bunx -y @anslai/reck init
bunx -y @anslai/reck doctor
```

For repeated use after publication:

```bash
bun install -g @anslai/reck
reck init
reck doctor
```

Current local verification does not prove public npm availability. Verifier evidence is from the local checkout, built package output, dry-run package checks, and local CLI/MCP smoke paths.

Local checkout testing uses the nested v0.1 implementation path:

```bash
cd /Users/harsha/Developer/hackathon/reelink
bun install
bun run typecheck
bun run build
bun link
reck init
reck doctor
```

`bun link` may expose local compatibility binaries. Public docs and demos should use `bunx -y @anslai/reck mcp`, installed `reck mcp`, or `reck-mcp`. Any `reelink`, `reelink-mcp`, `bunx -y reelink`, `reelink_*`, `REELINK_*`, or `.reelink/` behavior is legacy compatibility only.

## MCP Configuration

Codex CLI (`~/.codex/config.toml`):

```toml
[mcp_servers.reck]
command = "bunx"
args = ["-y", "@anslai/reck", "mcp"]

[mcp_servers.reck.env]
OPENROUTER_API_KEY = "<your-key>"
RECK_OPENROUTER_MODEL = "qwen/qwen3.6-flash"
RECK_LOG_LEVEL = "info"
```

If Reck is installed globally, use:

```toml
[mcp_servers.reck]
command = "reck"
args = ["mcp"]
```

Cursor (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "reck": {
      "command": "bunx",
      "args": ["-y", "@anslai/reck", "mcp"],
      "env": {
        "OPENROUTER_API_KEY": "<your-key>",
        "RECK_OPENROUTER_MODEL": "qwen/qwen3.6-flash"
      }
    }
  }
}
```

API keys stay in environment variables or MCP env blocks. `~/.reck/config.json` is for non-secret local defaults only.

## Tool Surface

The public target MCP surface is:

- `reck_analyze(path, fps_sample=4, focus="any")`
- `reck_get_finding(recording_id, finding_id)`
- `reck_get_frame(recording_id, ts)`
- `reck_get_dom(recording_id, ts)`
- `reck_get_components(recording_id, ts, x?, y?)`
- `reck_query(recording_id, question)`
- `reck_record_start(url)`
- `reck_record_stop(recording_id)`
- `reck_record_status(recording_id)`
- `reck_browser_snapshot`
- `reck_browser_click`
- `reck_browser_type`
- `reck_browser_navigate`
- `reck_browser_wait`
- `reck_browser_evaluate`
- `reck_browser_take_screenshot`
- `reck_run(task_description, target_url)`

Layer 0 returns `findings` as the normative public contract:

```json
{
  "recording_id": "...",
  "duration_sec": 8.4,
  "summary": "...",
  "findings": [
    {
      "id": "f1",
      "ts": 2.1,
      "type": "view-transition-overlap",
      "severity": "medium",
      "title": "Old route title overlaps new page title",
      "confidence": 0.72
    }
  ],
  "next_steps": ["..."]
}
```

If `work_items` appears in older output or legacy recordings, treat it as compatibility/detail data. It is not the headline Layer 0 response.

## Recording Package

New Reck packages write under `.reck/`:

```text
.reck/<recording_id>/
  manifest.json
  analysis.json
  frames/
  video reference or copy
```

Browser-generated packages may include:

```text
.reck/browser-recordings/<recording_id>/
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

The manifest must be honest. Optional streams are marked `available`, `not_collected`, `unavailable`, or `failed` with reasons. Retrieval tools must not invent DOM, React/source, network, console, eval, or component evidence when a stream was not collected.

## Observed Evidence

Current docs should describe proof at the level actually observed:

- Layer 0: implemented and exercised through observed local raw-video analysis tests and smokes; public docs now center `reck_analyze` and `findings` without treating this as public-package proof.
- Layer 1: external real-app landing proof exists via recording `rec_molq08a6_dxwy9o` at `/Users/harsha/Documents/GitHub/landing/.reck/browser-recordings/rec_molq08a6_dxwy9o/`, including source dictionary evidence from `next_prerender_stack`. That artifact's manifest marks `react_grab_events` as `not_collected`, so it is not proof of visible react-grab annotation or event capture.
- Layer 1: second-target proof is covered by `reelink/tests/second-target-proof.test.ts` using fixture path `reelink/tests/fixtures/vite-react-second-target/`.
- Layer 1 gateway: child Playwright MCP smoke evidence exists for the single registered Reck MCP pattern.
- Layer 1 recording: recording smoke evidence exists for browser recording artifacts.
- Layer 2/eval: agent-run/eval evidence has been reported by implementation agents, but final public workflow claims still need to stay tied to the commands and artifacts actually run.

External caveats remain: do not claim a live OpenRouter smoke passed without a live key and observed run; do not claim a real Codex client setup passed unless the setup prompt was run in a real Codex session; do not claim a final edited demo video exists until recorded.

## Non-Goals and Caveats

- No rrweb in v0.1.
- No bundled agentation runtime in v0.1.
- No second user-registered Playwright MCP server; users register one MCP server named `reck`.
- No exact token-saving, benchmark, or broad performance claims until measured.
- No broad framework support claims beyond observed targets. React/source evidence is best described as observed on the landing app and the second target fixture, with graceful degradation elsewhere.
- No self-hosted Qwen fallback support claim unless implemented and verified. Mention SGLang, Ollama, and Hugging Face only as roadmap or explicitly verified fallback work.

## Compatibility and Migration

Reck may temporarily read or expose legacy Reelink names during migration:

- `reelink_*` MCP tools: compatibility aliases only, not public examples.
- `[mcp_servers.reelink]`: old config block; migrate to `[mcp_servers.reck]`.
- `reelink` / `reelink-mcp` / `bunx -y reelink`: local-development or legacy command paths only.
- `REELINK_*`: legacy env vars. `RECK_*` wins when both are set.
- `.reelink/`: legacy recording storage. New writes go to `.reck/`; old recordings may be read through documented compatibility behavior.
- `reelink/`: intentionally retained nested v0.1 implementation path; root promotion or `reck/` folder rename is deferred until a dedicated migration can update and verify scripts, tests, docs, generated artifacts, and local checkout workflows.

## Status

Pre-release. The OpenSpec change id `build-reelink-mcp` and some internal paths preserve the historical name. Public-facing docs, setup, demos, and release copy should use Reck unless discussing migration or historical context.

Apache-2.0. See `LICENSE` and `NOTICE`.
