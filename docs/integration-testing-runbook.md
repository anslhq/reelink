# Reelink Integration Testing Runbook

**Goal:** wire Reelink into Harsha's personal portfolio repo on the MacBook, register it as an MCP with Codex or Cursor, record a bug video, ask an agent to analyze it, and verify a `WorkItem[]` comes back end-to-end.

This is the real integration test. Unit tests and synthetic fixtures only prove isolated behavior; this runbook proves the product works in a real agent workflow.

---

## Prerequisites

- Reelink repo at `/Users/harsha/Developer/hackathon/reelink/`
- `OPENROUTER_API_KEY` set in `reelink/.env` for hosted VLM analysis
- Codex CLI installed and signed in (`codex --version`)
- Bun installed (`bun --version`)
- Personal portfolio repo on disk (the one with the view-transition bug). Substitute `<PORTFOLIO_PATH>` below.

## Step 1 - Confirm Reelink runs as an MCP server locally

Open a terminal:

```bash
cd /Users/harsha/Developer/hackathon/reelink
bun install
bun run typecheck
bun run build
bun link
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | OPENROUTER_API_KEY=test reelink-mcp
```

You should see a stderr log line like `{"level":"info",...,"transport":"stdio","msg":"reelink MCP server started"}` and a JSON-RPC response listing the Reelink tools. This matches the canonical local launch path from `docs/setup-prompt.md`: build locally, link with Bun, then launch the linked `reelink-mcp` binary.

If this fails: run `bun run typecheck` from `/Users/harsha/Developer/hackathon/reelink/` and post the error.

## Step 2 - Register Reelink as an MCP in Codex CLI

Edit `~/.codex/config.toml`. Add or update:

```toml
[mcp_servers.reelink]
command = "reelink-mcp"

[mcp_servers.reelink.env]
OPENROUTER_API_KEY = "<your-key-here>"
REELINK_OPENROUTER_MODEL = "qwen/qwen3.6-flash"
REELINK_LOG_LEVEL = "info"
```

Important notes:

- `command = "reelink-mcp"` assumes Step 1 succeeded and `~/.bun/bin` is on Codex's PATH. If Codex cannot resolve it, add the absolute linked binary path reported by `which reelink-mcp`; do not point MCP config at `src/cli.ts`.
- The `OPENROUTER_API_KEY` value must match what's in `reelink/.env`. Don't commit this config file.
- If you're using Cursor instead of Codex, the file is `~/.cursor/mcp.json` and the structure is JSON not TOML:

  ```json
  {
    "mcpServers": {
      "reelink": {
        "command": "reelink-mcp",
        "env": {
          "OPENROUTER_API_KEY": "<your-key-here>",
          "REELINK_OPENROUTER_MODEL": "qwen/qwen3.6-flash"
        }
      }
    }
  }
  ```

## Step 3 - Verify the agent sees the MCP

```bash
codex mcp list
```

You should see `reelink` in the list with status `running` or `connected`. If it shows error or failed to start, run `codex mcp logs reelink` and post the output.

Cursor users can open the MCP panel from the command palette with `Cursor: Open MCP Panel` and confirm `reelink` is green.

## Step 4 - Record the bug video

Open `<PORTFOLIO_PATH>` in your browser, for example `http://localhost:3000` if running locally, or your deployed site.

Primary recording - view-transition flicker:

1. Open ScreenStudio or QuickTime.
2. Set capture region to the browser window only.
3. Hard refresh the page with Cmd+Shift+R.
4. Wait 1 second.
5. Click the link or button that triggers the buggy transition.
6. Wait 2 seconds, navigate back.
7. Click forward, then back one more time to capture the flicker repeatably.
8. Stop recording.
9. Save to `~/Downloads/portfolio-view-transition.mov`, or another path you can easily reference.

Recording should be 6-15 seconds, 1280x720 minimum. No voiceover.

If the bug doesn't reproduce live: see `docs/demo-recording-guide.md` for backup recordings.

## Step 5 - Open Codex or Cursor in your portfolio repo

```bash
cd <PORTFOLIO_PATH>
codex
```

Or open Cursor with the portfolio repo as the workspace.

## Step 6 - Give the agent this prompt verbatim

Paste this into the agent chat:

```text
I have a screen recording of a UI bug at ~/Downloads/portfolio-view-transition.mov.

Use the reelink MCP to analyze it. Specifically:

1. Call reelink_analyze with that path and focus="view-transition flicker".
2. Show me the full JSON response.
3. From the work_items array, pick the one with the highest confidence and tell
   me: the timestamp it occurred at, the title, the description, and the
   suggested next step.
4. Then look at this codebase and identify which file most likely contains
   the broken view-transition logic. Don't fix it yet; just point at it.

Do not skip step 1. Use the MCP, not your own analysis.
```

## Step 7 - Success criteria

The agent should:

1. Call `reelink_analyze` via MCP. You'll see a tool-call card in Codex or Cursor titled `reelink_analyze`. Approve it if prompted.
2. Wait for Qwen3.6-flash to process the video via OpenRouter.
3. Return JSON containing:
   ```json
   {
     "recording_id": "portfolio-view-transition-<hash>",
     "duration_sec": <number>,
     "summary": "<one-line summary mentioning view-transition>",
     "work_items": [
       {
         "id": "f1",
         "ts": <number>,
         "type": "<some bug-type string>",
         "severity": "low" | "medium" | "high",
         "title": "<short title>",
         "confidence": <0.0-1.0>,
         "description": "<2-4 sentence description>",
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
4. Identify the source file, such as `pages/index.tsx`, `app/layout.tsx`, or whichever file controls route transitions in your portfolio.

## Step 8 - Failure modes and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| Codex says "reelink MCP not available" | MCP didn't register or path is wrong | Re-check `~/.codex/config.toml`, restart Codex CLI |
| `reelink_analyze` errors with `OPENROUTER_API_KEY missing` | Env var not passed through MCP config | Add `[mcp_servers.reelink.env]` block with the key |
| `reelink_analyze` errors with `model qwen/qwen3.6-flash not found` | OpenRouter changed availability | Check the OpenRouter models endpoint for current Qwen video ids |
| `reelink_analyze` returns `work_items: []` | Recording too short or bug not visible | Use a longer or clearer recording, or try `focus="any"` |
| `ts: 0` for a finding | Timestamp evidence is ambiguous | Prefer findings with timestamps after visible user action |
| Agent doesn't call the MCP at all | Agent is doing image analysis itself | Re-prompt with: "Don't analyze yourself. Use the reelink MCP tool." |

## Step 9 - What this proves

If Step 7 succeeds, you have proof that:

1. Reelink builds and runs as a stdio MCP server.
2. The Codex or Cursor MCP integration works.
3. `qwen/qwen3.6-flash` raw-video analysis via OpenRouter works in the target environment.
4. The WorkItem schema round-trips through hosted VLM analysis.
5. A coding agent can consume the response and reason about the codebase.

## Step 10 - Post the JSON output

Once Step 7 succeeds, paste the full JSON response into the `#codex-hackathon` Slack channel for validation against the schema and follow-up planning.

---

## Open questions you may hit

These are worth flagging before submission, but they do not block the integration test:

1. **Submission needs the `.mov` in the repo or as an attached file?** The `demo-recordings/*.mov` glob is gitignored. If submission wants it inline, allow-list one small recording after Step 7 succeeds.
2. **Permission prompts on first MCP call.** Codex will ask you to approve the `reelink_analyze` tool the first time. Approve it, or add it to `permissions.allow` in your Codex config to skip future prompts.
3. **`recording_id` changes between calls.** Each call to `reelink_analyze` produces a new `recording_id`. Use the id from the most recent JSON response when querying that recording.
