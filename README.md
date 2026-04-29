# Reelink

> Temporal memory for AI coding agents.

Coding agents are snapshot-bound. They see a single screenshot, a single DOM dump, a single tool call. Reelink turns screen recordings into queryable, timestamped WorkItems that Codex (and any MCP-aware agent) can cite, retrieve, and act on across time.

Bug findings are the first WorkItem source. Email is next.

## Why this matters



## Status

v0.1 — built at the OpenAI Codex Hackathon Sydney, April 29 2026. Apache 2.0.

## Install

```bash
git clone https://github.com/anslhq/reelink.git
cd reelink/reelink
bun install
bun run build
bun link
```

That puts `reelink` and `reelink-mcp` on your PATH (typically `~/.bun/bin/`).

## Configure as MCP server

Codex CLI (`~/.codex/config.toml`):

```toml
[mcp_servers.reelink]
command = "reelink-mcp"

[mcp_servers.reelink.env]
OPENROUTER_API_KEY = "<your-key>"
REELINK_OPENROUTER_MODEL = "qwen/qwen3.6-flash"
REELINK_LOG_LEVEL = "info"
```

Cursor (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "reelink": {
      "command": "reelink-mcp",
      "env": {
        "OPENROUTER_API_KEY": "<your-key>",
        "REELINK_OPENROUTER_MODEL": "qwen/qwen3.6-flash"
      }
    }
  }
}
```

Restart your client. `codex mcp list` should show `reelink` running.

## Use

```bash
# 1. Capture a UI bug from your live app
reelink record https://your-site.com
# headed Chrome opens, reproduce the bug, hit ENTER to stop
# saves to demo-recordings/reelink-<timestamp>.webm

# 2. Analyze it
reelink analyze demo-recordings/reelink-<timestamp>.webm "view-transition flicker"
# returns AnalyzeResult JSON with WorkItem[] and timestamps
```

Or, from your coding agent:

```
Use the reelink MCP to analyze ~/Downloads/portfolio-bug.mov,
then identify the source file most likely to contain the bug.
```

The agent calls `reelink_analyze` via MCP, gets back a `WorkItem[]`, then reasons over your codebase to find the responsible file.

## MCP tool surface

| Tool | What it does |
|---|---|
| `reelink_analyze(path, focus, fps_sample)` | Raw video → `WorkItem[]` via `qwen/qwen3.6-flash` on OpenRouter |
| `reelink_get_finding(rid, finding_id)` | Retrieve a specific WorkItem by id |
| `reelink_get_frame(rid, ts)` | Get the nearest sampled frame path for a timestamp |
| `reelink_query(rid, question)` | Deterministic Q&A over the recording (12 patterns, no GPT) |
| `reelink_get_dom`, `reelink_get_components`, `reelink_run` | v0.2 stubs (Layer 1 + agent self-recording) |

## WorkItem schema

```ts
type WorkItem = {
  id: string;
  ts: number;                                       // seconds into recording
  type: string;                                     // bug taxonomy
  severity: "low" | "medium" | "high";
  title: string;
  confidence: number;                               // 0..1
  description?: string;
  // ANSL work-state lifecycle
  state: "detected" | "prepared" | "approved" | "routed" | "executed" | "completed";
  approval_state: "pending" | "approved" | "rejected" | null;
  routed_to: string | null;
  completed_at: string | null;
  source: "video";                                  // first source; future: "email", "log"
  intent: "fix" | "investigate" | "track";
};
```

## Recording package

Each `reelink_analyze` call writes a recording package under `.reelink/<id>/`:

```
.reelink/<id>/
  manifest.json     // recording_id, duration, model, streams map, prod_build flag
  analysis.json     // AnalyzeResult with work_items[]
  frames/           // sampled JPEGs (1 fps default, capped at 64)
  source video reference (or copy)
```

Streams map honestly reports `available` / `not_collected` per stream so retrieval tools never invent data.

## Architecture

- **Layer 0 (shipped)**: paste a video, get structured findings with timestamps
- **Layer 1 (v0.2)**: each recording becomes a folder of timestamp-aligned state — video, Playwright trace, bippy fiber commits, react-grab element-pointer events, network HAR, console logs
- **Layer 2 (v0.2)**: agent records its own browser session via `reelink_run`; the recording is both the eval evidence and the next-action input

Single MCP gateway pattern: Reelink spawns Playwright MCP as a child via CDP attach. You install ONE MCP. AI SDK v6 routes raw-video Qwen through OpenRouter for the primary VLM path.

## License

Apache 2.0. See `LICENSE` and `NOTICE` for third-party attribution (bippy MIT, react-grab MIT, Playwright Apache-2.0).
