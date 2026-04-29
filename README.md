# Reelink

> Temporal memory for AI coding agents.

Coding agents are snapshot-bound. They see one screenshot, one DOM dump, one tool call. **Reelink turns screen recordings into queryable, timestamped WorkItems** that Codex (and any MCP-aware agent) can cite, retrieve, and act on across time.

Bug findings are the first WorkItem source. Email is next.

Built at the **OpenAI Codex Hackathon Sydney**, April 29 2026 at UTS Tech Central. Fourth Codex hackathon in the world, after San Francisco, Singapore, and Bengaluru.

---

## The brief

The morning briefing from Gabriel Chua (host) and Satya (OpenAI ANZ lead) framed the day around a single question:

> "Why are you going to build what was practically impossible before Codex?"

Judging rubric (verbatim from the brief):
- **Clarity of idea**
- **Technical execution**
- **Completeness**
- **Impact / insight** (social impact considered)
- **Creative / correct uses of Codex**

Reelink answers the brief directly:
**Couldn't be built before Codex** because the demo flow requires a coding agent that reads MCP tool output, retrieves a `WorkItem` by id, and reasons over a real codebase to find the responsible file. That entire chain — agent loop + MCP + threads + computer use — is the Codex harness, not a wrapper around it. We built *on top of* the harness, exactly as the brief invited.

---

## Why this matters

Screen recording is the most accessible bug-reporting medium humans have. Coding agents can't natively reason over time-varying UI: motion bugs (transition flicker, FOUC, layout shift mid-animation, race conditions in optimistic updates) are invisible to a single screenshot. Reelink closes that gap with a tiny MCP server that:

1. Accepts an arbitrary `.mov`/`.mp4`/`.webm` path,
2. Sends raw video to a video-native VLM (`qwen/qwen3.6-flash` via OpenRouter),
3. Returns a structured `WorkItem[]` with timestamps, severity, confidence, and a 6-state lifecycle,
4. Persists the recording as a queryable folder so the agent can retrieve frames, findings, and deterministic answers without re-running the model.

---

## The wedge

Most "AI bug report" tools today (Jam.dev, Disbug, FlowLens, etc.) either require a Chrome extension on the live site, a custom recording harness, a SaaS account, or all three. None of them write a verified regression and none expose video as agent state.

Reelink's positioning is **temporal memory for coding agents** — recordings as queryable state, not as opaque artifacts. The output schema is a `WorkItem[]` with a 6-state lifecycle (the public seed of a broader work-state primitive). The wedge product is a single MCP tool: `reelink_analyze(path)`.

---

## What's shipped

| Tool | Status | What it does |
|---|---|---|
| `reelink_analyze(path, focus, fps_sample)` | ✅ | Raw video → `WorkItem[]` via `qwen/qwen3.6-flash`. ~10–20s wall, structured JSON one round-trip. |
| `reelink_get_finding(rid, finding_id)` | ✅ | Retrieve a specific WorkItem by id from cached analysis. |
| `reelink_get_frame(rid, ts)` | ✅ | Get the nearest sampled frame path for a timestamp; returns `{path, frame_index, frame_ts, delta_sec, exists}`. |
| `reelink_query(rid, question)` | ✅ | Deterministic Q&A over the recording — 12 patterns (summary, list work items, by ts, by severity, by type, by id, streams, prod_build, etc.). Returns `null + patterns_tried` for unmatched questions. |
| `reelink record <url>` | ✅ | CLI subcommand: opens headed Chromium at the URL, captures a `.webm`, stops on ENTER / Ctrl+C / `--max-seconds`. |
| `reelink_get_dom`, `reelink_get_components`, `reelink_run` | ⬜ roadmap | Reserved for the recording-state-package and agent-self-recording layers. |

**Stack:** TypeScript + Bun + Node 20+. Raw `@modelcontextprotocol/sdk`. Vercel AI SDK v6. `@openrouter/ai-sdk-provider`. Playwright the library. `ffmpeg-static`. `react-grab` (for the recording-state layer). Apache 2.0.

---

## Architecture

Three layers of value, each strictly more capable than the last:

- **Layer 0 (shipped):** paste a video, get structured findings with timestamps. The wedge.
- **Layer 1 (roadmap):** each recording becomes a folder of timestamp-aligned state — video, Playwright trace (action-aligned DOM/network/console/sources), bippy fiber commits, react-grab element-pointer events, network HAR, console logs, source dictionary. Single-MCP gateway: Reelink spawns Playwright MCP as a child via CDP attach.
- **Layer 2 (roadmap):** agent records its own browser session via `reelink_run`. The recording is both the eval evidence and the next-action input.

---

## WorkItem schema

```ts
type WorkItem = {
  id: string;
  ts: number;                                       // seconds into recording
  type: string;                                     // bug taxonomy (Qwen-classified)
  severity: "low" | "medium" | "high";
  title: string;
  confidence: number;                               // 0..1
  description?: string;

  // work-state lifecycle
  state: "detected" | "prepared" | "approved" | "routed" | "executed" | "completed";
  approval_state: "pending" | "approved" | "rejected" | null;
  routed_to: string | null;
  completed_at: string | null;
  source: "video";                                  // first source; future: "email", "log"
  intent: "fix" | "investigate" | "track";
};
```

Layer 0 emits `state: "detected"`, `approval_state: "pending"`, `intent: "fix"`, `source: "video"`. Future sources (email triage, log triage) plug into the same lifecycle without changing downstream consumers.

---

## Recording package

Each `reelink_analyze` call writes a self-contained recording package under `.reelink/<id>/`:

```
.reelink/<recording_id>/
  manifest.json     # recording_id, duration, model metadata, streams map, prod_build flag
  analysis.json     # AnalyzeResult { recording_id, summary, work_items[], next_steps[] }
  frames/           # sampled JPEGs (default 1 fps, capped at 64)
  source video reference (or copy if --copy-imported-videos is set)
```

The `streams` map is **honest**: each optional stream (`trace`, `fiber_commits`, `source_dictionary`, `react_grab_events`, `network`, `console`, `eval`) is marked `available` / `not_collected` / `unavailable` / `failed` with a reason. Retrieval tools never invent data — `reelink_get_dom` returns `{ status: "not_collected" }` until the recording-state layer ships. Honest absence beats fabricated presence.

---

## Install

```bash
git clone https://github.com/anslhq/reelink.git
cd reelink/reelink
bun install
bun run build
bun link
```

That puts `reelink` and `reelink-mcp` on your `$PATH` (typically `~/.bun/bin/`).

### Configure as MCP server

**Codex CLI** (`~/.codex/config.toml`):

```toml
[mcp_servers.reelink]
command = "reelink-mcp"

[mcp_servers.reelink.env]
OPENROUTER_API_KEY = "<your-key>"
REELINK_OPENROUTER_MODEL = "qwen/qwen3.6-flash"
REELINK_LOG_LEVEL = "info"
```

**Cursor** (`~/.cursor/mcp.json`):

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

---

## Use

### Capture + analyze (CLI)

```bash
# 1. Open your buggy app, capture the bug
reelink record https://your-site.com
# headed Chrome opens — reproduce the bug — press ENTER to stop
# saves to demo-recordings/reelink-<timestamp>.webm

# 2. Analyze
reelink analyze demo-recordings/reelink-<timestamp>.webm "view-transition flicker"
# returns AnalyzeResult JSON, persists package to .reelink/<id>/
```

### Or, from your coding agent

In Codex CLI or Cursor:

```
Use the reelink MCP to analyze ~/Downloads/portfolio-bug.mov, then
identify the source file most likely to contain the bug.
```

The agent calls `reelink_analyze` via MCP, gets back a `WorkItem[]`, then reasons over your codebase to find the responsible file. Follow up with `reelink_get_finding`, `reelink_get_frame`, or `reelink_query` to drill in by id, timestamp, or natural-language pattern.

---

## Acknowledgements

**OpenAI Codex Hackathon Sydney organizers**
- **Gabriel Chua** — hackathon host, OpenAI
- **Satya** — OpenAI ANZ Lead
- **Murray Herbs** — Director of Entrepreneurship, UTS Startups; co-host
- **Alex** and the **UTS Startups team** — venue and ops at UTS Tech Central
- **Aaron, James, Sharon, Tom** — UTS volunteer crew across the day
- **OpenAI Australia engineering and DevRel** — technical judges and mentors throughout the day

**Codex platform features that made the build possible**
- **GPT-5.5** as the default Codex model
- **Codex App Server** and **`@openai/codex-sdk`**
- **MCP support across Codex CLI, Codex desktop app, and Codex Web** — single Reelink server serves all three
- **Codex Skills** and **Codex Plugins**

**Open-source primitives Reelink builds on**
- **Aiden Bai** — `bippy` and `react-grab`; the React-introspection primitives the recording-state layer is built on
- **Microsoft Playwright team** — `@playwright/mcp` and the underlying Playwright library
- **Anthropic** — `@modelcontextprotocol/sdk` and the MCP spec
- **Vercel** — AI SDK v6
- **Alibaba Qwen team** — `qwen3.6-flash` (and the `qwen3-vl-*` family) for video-native VLM
- **OpenRouter** — single-endpoint hosting that lets us pick a video-capable Qwen route at runtime via the live model catalog

---

## License

Apache 2.0. See [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE) for full text and third-party attribution.

---

## Status

**v0.1 — submitted to OpenAI Codex Hackathon Sydney April 29 2026.**

GitHub: <https://github.com/anslhq/reelink>
ANSL: <https://github.com/anslhq>

Issues and PRs welcome.
