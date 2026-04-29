# Reelink Integration Testing Runbook

**Goal:** wire Reelink into Harsha's personal portfolio repo on the MacBook, register it as an MCP with Codex (or Cursor), record a bug video, ask an agent to analyze it, and verify a `WorkItem[]` comes back end-to-end.

**Time budget:** ~10–15 minutes.

This is the *real* integration test. Everything we've done so far (Layer 0 verified on synthetic Playwright fixture on Mac Studio) only proves the unit. This runbook proves the product works in the world.

---

## Prerequisites

- Reelink repo at `/Users/harsha/Developer/hackathon/reelink/`
- `OPENROUTER_API_KEY` set in `reelink/.env` (verified working)
- Codex CLI installed and signed in (`codex --version`)
- Bun installed (`bun --version`)
- Personal portfolio repo on disk (the one with the view-transition bug). Substitute `<PORTFOLIO_PATH>` below.

## Step 1 — Confirm Reelink runs as an MCP server locally

Open a terminal:

```bash
cd /Users/harsha/Developer/hackathon/reelink
bun run src/cli.ts mcp
```

You should see a stderr log line like `{"level":"info",...,"transport":"stdio","msg":"reelink MCP server started"}` and the process should hang (waiting for stdio input).

Kill it with Ctrl+C. Don't worry about `EOF` — the server is just confirming it can boot.

If this fails: run `bun run typecheck` from `/Users/harsha/Developer/hackathon/reelink/` and post the error.

## Step 2 — Register Reelink as an MCP in Codex CLI

Edit `~/.codex/config.toml`. Add (or update):

```toml
[mcp_servers.reelink]
command = "/opt/homebrew/bin/bun"
args = [
  "run",
  "/Users/harsha/Developer/hackathon/reelink/src/cli.ts",
  "mcp",
]

[mcp_servers.reelink.env]
OPENROUTER_API_KEY = "<your-key-here>"
REELINK_OPENROUTER_MODEL = "qwen/qwen3.6-flash"
REELINK_LOG_LEVEL = "info"
```

**Important:**
- Use the absolute path to `bun` (`/opt/homebrew/bin/bun` on Apple Silicon). Codex's launchd PATH is not your shell PATH.
- The `OPENROUTER_API_KEY` value must match what's in `reelink/.env`. Don't commit this config file.
- If you're using Cursor instead of Codex, the file is `~/.cursor/mcp.json` and the structure is JSON not TOML:

  ```json
  {
    "mcpServers": {
      "reelink": {
        "command": "/opt/homebrew/bin/bun",
        "args": [
          "run",
          "/Users/harsha/Developer/hackathon/reelink/src/cli.ts",
          "mcp"
        ],
        "env": {
          "OPENROUTER_API_KEY": "<your-key-here>",
          "REELINK_OPENROUTER_MODEL": "qwen/qwen3.6-flash"
        }
      }
    }
  }
  ```

## Step 3 — Verify Codex sees the MCP

```bash
codex mcp list
```

You should see `reelink` in the list with status `running` or `connected`. If it shows error / failed to start, run `codex mcp logs reelink` and post the output.

(Cursor: open the MCP panel from the command palette — `Cursor: Open MCP Panel` — and confirm `reelink` is green.)

## Step 4 — Record the bug video

Open `<PORTFOLIO_PATH>` in your browser (e.g., `http://localhost:3000` if running locally, or your deployed site).

**Primary recording — view-transition flicker:**
1. Open ScreenStudio (or QuickTime if ScreenStudio not installed).
2. Set capture region to the browser window only.
3. Hard refresh the page (Cmd+Shift+R).
4. Wait 1 second.
5. Click the link/button that triggers the buggy transition.
6. Wait 2 seconds, navigate back.
7. Click forward → back one more time to capture the flicker repeatably.
8. Stop recording.
9. Save to `~/Downloads/portfolio-view-transition.mov` (or any path you'll remember).

Recording should be 6–15 seconds, 1280×720 minimum. No voiceover.

If the bug doesn't reproduce live: see `docs/demo-recording-guide.md` for backup recordings.

## Step 5 — Open Codex in your portfolio repo

```bash
cd <PORTFOLIO_PATH>
codex
```

(Or open Cursor with the portfolio repo as the workspace.)

## Step 6 — Give the agent this prompt VERBATIM

Paste this into the Codex chat:

```
I have a screen recording of a UI bug at ~/Downloads/portfolio-view-transition.mov.

Use the reelink MCP to analyze it. Specifically:

1. Call reelink_analyze with that path and focus="view-transition flicker".
2. Show me the full JSON response.
3. From the work_items array, pick the one with the highest confidence and tell
   me: the timestamp it occurred at, the title, the description, and the
   suggested next step.
4. Then look at this codebase and identify which file most likely contains
   the broken view-transition logic. Don't fix it yet — just point at it.

Do not skip step 1. Use the MCP, not your own analysis.
```

## Step 7 — What you should see (success criteria)

The agent should:

1. **Call `reelink_analyze`** via MCP. You'll see a tool-call card in Codex/Cursor titled `reelink_analyze`. Approve it (one-time permission).
2. **Wait ~10–20 seconds** for Qwen3.6-flash to process the video via OpenRouter.
3. **Return JSON** containing:
   ```json
   {
     "recording_id": "portfolio-view-transition-<hash>",
     "duration_sec": <number>,
     "summary": "<one-line summary mentioning view-transition>",
     "work_items": [
       {
         "id": "f1",
         "ts": <number — should be > 0>,
         "type": "<some bug-type string>",
         "severity": "low" | "medium" | "high",
         "title": "<short title>",
         "confidence": <0.0–1.0>,
         "description": "<2–4 sentence description>",
         "state": "detected",
         "approval_state": "pending",
         "routed_to": null,
         "completed_at": null,
         "source": "video",
         "intent": "fix"
       }
     ],
     "next_steps": ["<actionable string>", ...]
   }
   ```
4. **Identify the source file** (something like `pages/index.tsx`, `app/layout.tsx`, or whichever controls the route transitions in your portfolio).

## Step 8 — Failure modes and what to do

| Symptom | Likely cause | Fix |
|---|---|---|
| Codex says "reelink MCP not available" | MCP didn't register or path is wrong | Re-check `~/.codex/config.toml`, restart Codex CLI |
| `reelink_analyze` errors with `OPENROUTER_API_KEY missing` | Env var not passed through MCP config | Add `[mcp_servers.reelink.env]` block with the key |
| `reelink_analyze` errors with `model qwen/qwen3.6-flash not found` | OpenRouter changed availability | Check `curl https://openrouter.ai/api/v1/models | jq '.data[].id' | grep qwen3.6` to find current ids |
| `reelink_analyze` returns `work_items: []` (empty) | Recording too short or bug not visible | Use a longer/clearer recording, or try `focus="any"` |
| `ts: 0` for a finding | Known issue per `docs/workitem-schema-validation.md` Risk #3 | Faction A is fixing this in P1A.0; for now ignore findings at exact ts=0 |
| Agent doesn't call the MCP at all | Agent is doing image analysis itself | Re-prompt with: "Don't analyze yourself. Use the reelink MCP tool." |

## Step 9 — What this proves

If Step 7 succeeds, you have proof that:

1. Reelink builds and runs as a stdio MCP server (Phase 0 architecture)
2. The Codex CLI MCP integration works (DevX path)
3. `qwen/qwen3.6-flash` raw-video analysis via OpenRouter works in the wild
4. The WorkItem schema (with all 6 lifecycle fields) round-trips through Qwen
5. A coding agent can consume the response and reason about the codebase

That's the entire v0.1 wedge demonstrated in your real environment.

## Step 10 — Post the JSON output

Once Step 7 succeeds, paste the full JSON response into the `#codex-hackathon` Slack channel. Mac Studio will validate it against the schema, then green-light the next move (Faction A retrieval implementation, or recording deeper integration if anything looks off).

---

## Open questions you may hit

These are real and worth flagging before submission. Not blockers for the integration test:

1. **Submission needs the `.mov` in the repo or as an attached file?** The `demo-recordings/*.mov` glob is gitignored. If submission wants it inline, we'll allow-list one ≤2MB version. Decide after Step 7 succeeds.
2. **Permission prompts on first MCP call.** Codex will ask you to approve the `reelink_analyze` tool the first time. Click approve. Add to `permissions.allow` in your Codex config to skip future prompts.
3. **`recording_id` mismatch between Layer 0 calls.** Each call to `reelink_analyze` produces a new `recording_id` (it's hashed with `Date.now()`). Faction A's retrieval tools (P1A) will need this to query a specific recording — for the integration test, just grab the id from the most recent JSON response.
