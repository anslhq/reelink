# Reelink Setup Prompt — paste into Codex

**Purpose:** when pasted into a Codex session opened in your portfolio repo (or any repo where you want to test Reelink), this prompt makes the Codex agent autonomously wire up Reelink as an MCP, verify the connection, and run a Layer 0 analysis on a recording you provide.

**Codex is the client.** This is not a Cursor or Claude Code prompt. The flow assumes the user is running Codex CLI or the Codex desktop app.

**Prerequisites you must satisfy before pasting:**
- Reelink repo is at `/Users/harsha/Developer/hackathon/reelink/` on this machine
- `bun` is installed at `/opt/homebrew/bin/bun` (Apple Silicon)
- You have `OPENROUTER_API_KEY` available (paste it inline when the agent asks, or set it in `~/.codex/env` first)
- You have a recording of a UI bug at a known absolute path on disk (e.g., `~/Downloads/portfolio-view-transition.mov`)

---

## The prompt

Copy everything between the two `---PASTE---` markers below into your Codex session.

```
---PASTE---

You are setting up Reelink as an MCP server for me to test in this Codex session.
Reelink is a TypeScript/Bun MCP server that takes screen recordings of UI bugs
and returns timestamped WorkItem[] via Qwen3.6-flash on OpenRouter. Documentation
in /Users/harsha/Developer/hackathon/docs/integration-testing-runbook.md.

Execute the following steps in order. Do NOT skip steps. Do NOT ask permission for
read-only checks; only ask for permission on file writes and process spawns.

STEP 1 — Verify Reelink builds and runs locally
  Run: cd /Users/harsha/Developer/hackathon/reelink && /opt/homebrew/bin/bun run typecheck
  Expected: exits 0, no errors.
  If this fails: stop here and show me the error. Do not proceed.

STEP 2 — Check OPENROUTER_API_KEY availability
  Read /Users/harsha/Developer/hackathon/reelink/.env (if it exists).
  Confirm OPENROUTER_API_KEY is set to a non-empty value.
  If missing: stop and ask me to provide it. Do NOT inline the key in any file
  you create — only reference it via env.

STEP 3 — Locate my coding-agent config and write the MCP entry
  Detect which Codex config file applies:
    - Codex CLI: ~/.codex/config.toml
    - If absent: create ~/.codex/config.toml
  Read the file. If a [mcp_servers.reelink] block already exists, SKIP the write
  and tell me. Otherwise, append this block:

    [mcp_servers.reelink]
    command = "/opt/homebrew/bin/bun"
    args = [
      "run",
      "/Users/harsha/Developer/hackathon/reelink/src/cli.ts",
      "mcp",
    ]

    [mcp_servers.reelink.env]
    OPENROUTER_API_KEY = "<value-from-reelink-env>"
    REELINK_OPENROUTER_MODEL = "qwen/qwen3.6-flash"
    REELINK_LOG_LEVEL = "info"

  Replace <value-from-reelink-env> with the actual key value you read from
  reelink/.env in Step 2. Show me the diff before writing. Wait for my approval.

STEP 4 — Restart the Codex MCP host so it picks up the new server
  This usually requires me to close and reopen Codex, or run `codex mcp reload`.
  Tell me which restart action to take based on the Codex version available.
  Run `codex --version` to detect.

STEP 5 — Verify Reelink is registered and connected
  Run: codex mcp list
  Expected: a row for `reelink` with status `running` or `connected`.
  If it shows `error` or `failed`: run `codex mcp logs reelink` and show the
  output. Common causes:
    - bun path wrong (verify `which bun`)
    - OPENROUTER_API_KEY not propagated (check the env block)
    - Reelink typecheck fails (re-run Step 1)

STEP 6 — Ask me for the recording path
  Ask me: "What's the absolute path to the recording you want analyzed?"
  Wait for my answer. Validate the path exists with `ls -la <path>`.
  If the path doesn't exist: ask me again.

STEP 7 — Call reelink_analyze via MCP
  Use the reelink_analyze MCP tool with arguments:
    { "path": "<the-absolute-path-from-step-6>", "focus": "any", "fps_sample": 4 }
  Wait for the tool to return (10–30 seconds — Qwen processes raw video).

STEP 8 — Verify the response shape
  The response must contain:
    - recording_id: string
    - duration_sec: number
    - summary: non-empty string
    - work_items: array (may be empty if no bug detected)
    - next_steps: array of strings

  Each work_items[i] (if present) must have all of:
    id, ts, type, severity, title, confidence, description,
    state ("detected"), approval_state ("pending"), routed_to (null),
    completed_at (null), source ("video"), intent ("fix")

  If any required field is missing: report which one and stop.

STEP 9 — Pretty-print and summarize
  Show me the full JSON response.
  Then summarize in plain English:
    - What was the bug (if any)?
    - At what timestamp?
    - What's the suggested next step?
    - What's the recording_id (I'll need it for follow-up tool calls)?

STEP 10 — Test retrieval tools (only if reelink_get_finding/reelink_get_frame/reelink_query are available)
  If the MCP exposes reelink_get_finding (check via `codex mcp tools reelink`):
    Call reelink_get_finding({ recording_id: "<from step 9>", finding_id: "f1" })
    Show the full WorkItem returned.
  If reelink_get_frame is available:
    Call reelink_get_frame({ recording_id: "<from step 9>", ts: <ts of work_item from step 9> })
    Show the path. Verify the file exists with `ls -la <path>`.
  If reelink_query is available:
    Call reelink_query({ recording_id: "<from step 9>", question: "summary" })
    Show the answer.

STEP 11 — Final report
  Confirm:
    - MCP registered: yes/no
    - reelink_analyze works on real video: yes/no
    - WorkItem schema correct: yes/no
    - Retrieval tools (if present): pass/fail per tool
  
  If anything failed, list the failure with file:line or command output.
  If everything passes, say "Reelink is wired and verified end-to-end."

DO NOT:
- Modify anything under /Users/harsha/Developer/hackathon/reelink/src/
- Modify the recording file
- Embed OPENROUTER_API_KEY anywhere except ~/.codex/config.toml's mcp_servers.reelink.env block
- Skip the OPENROUTER_API_KEY redaction check before showing me the config diff

---PASTE---
```

---

## After the agent finishes

If Step 11 says "Reelink is wired and verified end-to-end," you have a working integration. Capture this for the demo:

1. Take a screen recording of the Codex session showing Steps 7–11 (the actual tool call + the JSON response + the agent's plain-English summary).
2. That recording is your 2-min demo video material — narrate it per `docs/submission-pack.md`.

If anything fails, paste the failure output into Slack `#codex-hackathon` and we triage from there.

---

## Notes for future-you

- This prompt assumes Codex CLI on macOS. For other OSes, the bun path and config path differ.
- The key-redaction step (Step 3) is to prevent the agent from accidentally pasting your OpenRouter key into chat history.
- Steps 6–9 are the demo flow. Steps 10 are bonus surface area once Faction A retrieval lands.
- If Codex's MCP UI shows a permission prompt for `reelink_analyze`, click approve once and add to your `permissions.allow` list.
