# Reelink Setup Prompt — paste into Codex

**Purpose:** when pasted into a Codex session opened in your target repo (or any repo where you want to test Reelink), this prompt makes the Codex agent autonomously build Reelink, link it globally as `reelink-mcp`, wire it up as an MCP server in `~/.codex/config.toml`, verify the connection, and run a Layer 0 analysis on a recording you provide.

**Codex is the client.** This is not a Cursor or Claude Code prompt. The flow assumes you're running Codex CLI or the Codex desktop app.

**Prerequisites:**
- Reelink repo cloned at `/Users/harsha/Developer/hackathon/reelink/` (or another absolute path you'll substitute below)
- `bun` is installed and on PATH (run `which bun` to confirm)
- You have `OPENROUTER_API_KEY` available — keep it ready, the agent will ask
- You have a recording of a UI bug at a known absolute path on disk (e.g., `~/Downloads/portfolio-view-transition.mov`)

---

## The prompt

Copy everything between the two `---PASTE---` markers below into your Codex session.

```
---PASTE---

You are setting up Reelink as an MCP server for me to test in this Codex session.
Reelink is a TypeScript/Bun MCP server that takes screen recordings of UI bugs
and returns timestamped WorkItem[] via Qwen3.6-flash on OpenRouter.

Reelink is already cloned at /Users/harsha/Developer/hackathon/reelink/ on this
machine. You will BUILD it locally, LINK it globally as `reelink-mcp`, and
register the global binary as the Codex MCP entry point. Do NOT use any
`npx`, `bunx`, or path-to-cli.ts patterns — only the linked global binary.

Execute the following steps in order. Do NOT skip steps. Do NOT ask permission
for read-only checks; only ask for permission on file writes and process spawns.

STEP 1 — Verify Reelink builds
  cd /Users/harsha/Developer/hackathon/reelink
  bun install
  bun run typecheck
  Expected: typecheck exits 0.
  If this fails: stop and show me the error.

STEP 2 — Build the dist
  cd /Users/harsha/Developer/hackathon/reelink
  rm -rf dist
  bun run build
  Verify dist/ contains cli.js and server.js:
  ls dist/cli.js dist/server.js
  Both must exist. If not: stop and show me the error.

STEP 3 — Link reelink globally
  cd /Users/harsha/Developer/hackathon/reelink
  bun link
  Verify the binaries are on PATH now:
  which reelink reelink-mcp
  Both must resolve, typically to ~/.bun/bin/reelink and ~/.bun/bin/reelink-mcp.
  If either is missing: confirm ~/.bun/bin is on PATH (`echo $PATH`) and stop
  if it isn't — instruct me to add it to my shell profile.

STEP 4 — Sanity-check the binary spins up an MCP server
  Run this exact command (it sends one tools/list JSON-RPC and exits):
  echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | OPENROUTER_API_KEY=test reelink-mcp 2>&1 | head -30
  Expected: a JSON line with "reelink MCP server started", followed by a JSON
  response listing 7 tools: reelink_analyze, reelink_get_finding, reelink_get_frame,
  reelink_get_dom, reelink_get_components, reelink_query, reelink_run.
  If you see fewer than 7 tools or no startup line: stop and show me the output.

STEP 5 — Ask me for the OPENROUTER_API_KEY
  Ask: "Paste your OPENROUTER_API_KEY. I will write it to ~/.codex/config.toml
  in the [mcp_servers.reelink.env] block only — nowhere else."
  Wait for my answer. Do NOT echo the key back to chat after I paste it.

STEP 6 — Write the Codex MCP config
  Read ~/.codex/config.toml (create it if missing).
  If a [mcp_servers.reelink] block already exists, show me a diff of what
  you'd change and wait for my approval. Otherwise, append this block
  EXACTLY (substituting <my-api-key> with what I gave you in Step 5):

    [mcp_servers.reelink]
    command = "reelink-mcp"

    [mcp_servers.reelink.env]
    OPENROUTER_API_KEY = "<my-api-key>"
    REELINK_OPENROUTER_MODEL = "qwen/qwen3.6-flash"
    REELINK_LOG_LEVEL = "info"

  Note: `command = "reelink-mcp"` resolves via PATH (we just linked it in
  Step 3). No bun, no node, no absolute paths to cli.ts.

  Show me the diff before writing. Wait for my approval. Then write.

STEP 7 — Restart the Codex MCP host so it picks up the new server
  Tell me: "Close and reopen Codex now (or run `codex mcp reload` if your
  version supports it). I'll wait."
  Wait for me to say "done" or "ready" before continuing.

STEP 8 — Verify Reelink is registered and connected
  Run: codex mcp list
  Expected: a row for `reelink` with status `running` or `connected`.
  If it shows `error` or `failed`: run `codex mcp logs reelink` and show
  the last 20 lines. Common causes:
    - reelink-mcp not on PATH → re-do Step 3, restart shell
    - OPENROUTER_API_KEY env block malformed → fix the TOML quoting
    - dist not built → re-do Step 2

STEP 9 — Ask me for the recording path
  Ask: "What's the absolute path to the recording you want analyzed?"
  Wait for my answer. Validate the path exists with `ls -la <path>`.
  If the path doesn't exist: ask me again.

STEP 10 — Call reelink_analyze via MCP
  Use the reelink_analyze MCP tool with arguments:
    { "path": "<the-absolute-path-from-step-9>", "focus": "any", "fps_sample": 4 }
  Wait for the tool to return (10–30 seconds — Qwen processes raw video).

STEP 11 — Verify the response shape
  The response must contain:
    - recording_id: string
    - duration_sec: number
    - summary: non-empty string
    - work_items: array (may be empty if no bug detected)
    - next_steps: array of strings

  Each work_items[i] (if present) must have all of:
    id, ts (>0), type, severity (low|medium|high), title,
    confidence (0.0–1.0), description,
    state ("detected"), approval_state ("pending"), routed_to (null),
    completed_at (null), source ("video"), intent ("fix")

  If any required field is missing: report which one and stop.

STEP 12 — Pretty-print and summarize
  Show me the full JSON response.
  Then summarize in plain English:
    - What was the bug (if any)?
    - At what timestamp?
    - What's the suggested next step?
    - What's the recording_id (I'll need it for follow-up tool calls)?

STEP 13 — Test retrieval tools
  Call reelink_get_finding({ recording_id: "<from step 12>", finding_id: "f1" })
  Show the full WorkItem returned. Confirm it matches work_items[0] from Step 12.

  Call reelink_get_frame({ recording_id: "<from step 12>", ts: <ts of work_items[0]> })
  Show the path. Verify the file exists with `ls -la <path>`. Verify exists==true.

  Call reelink_query({ recording_id: "<from step 12>", question: "summary" })
  Show the answer. Confirm patterns_matched contains "summary".

  Call reelink_query({ recording_id: "<from step 12>", question: "list work items" })
  Show the answer. Confirm patterns_matched contains "list_findings".

  Call reelink_query({ recording_id: "<from step 12>", question: "what's the airspeed velocity of an unladen swallow" })
  Confirm answer is null and patterns_matched is empty.

STEP 14 — Final report
  Confirm:
    - Build succeeded: yes/no
    - Link succeeded: yes/no
    - MCP registered: yes/no
    - reelink_analyze works on real video: yes/no
    - WorkItem schema correct: yes/no
    - reelink_get_finding works: yes/no
    - reelink_get_frame works (file exists on disk): yes/no
    - reelink_query deterministic patterns work: yes/no
    - reelink_query null fallback works: yes/no
  
  If anything failed, list the failure with file:line or command output.
  If everything passes, say "Reelink is wired and verified end-to-end."

DO NOT:
- Modify anything under /Users/harsha/Developer/hackathon/reelink/src/
- Modify the recording file
- Embed OPENROUTER_API_KEY anywhere except ~/.codex/config.toml's mcp_servers.reelink.env block
- Skip the OPENROUTER_API_KEY redaction check before showing me the config diff
- Use `bun run`, `bunx`, `npx`, or paths to cli.ts in the MCP config — only the linked global binary `reelink-mcp`
- Run `bun link` more than once unless I explicitly ask (re-linking is harmless but signals confusion)

---PASTE---
```

---

## After the agent finishes

If Step 14 says "Reelink is wired and verified end-to-end," capture this for the demo:

1. Take a screen recording of the Codex session showing Steps 10-13 (the actual tool calls + JSON responses + plain-English summary).
2. That recording is your 2-min demo video material — narrate it per `docs/submission-pack.md`.

If anything fails, paste the failure output into Slack `#codex-hackathon` and we triage.

---

## Why this shape

- **Built binary, not `bun run cli.ts`:** the MCP config stays clean (`command = "reelink-mcp"`), works the same as how `npx -y reelink-mcp` would post-publish, and removes the bun-runtime-on-the-MCP-spawn dependency. Codex spawns the linked binary which is a Node ESM file with a Node shebang.
- **`bun link` instead of `npm install -g`:** matches the project's bun-first toolchain, faster, doesn't touch global node_modules.
- **No `reelink init` step:** init/doctor are deferred (P1A.7-P1A.11 in tasks.md). Manual MCP registration through the agent is enough for v0.1.
- **Codex is the client:** the canonical demo path. Cursor support is in `docs/integration-testing-runbook.md` as an alternative footnote, not the primary flow.

---

## Notes for future-you

- This prompt assumes Codex CLI on macOS with bun on PATH. For Linux, replace path expectations.
- The key-redaction step (Step 5/6) is to prevent the agent from accidentally pasting your OpenRouter key into chat history.
- Steps 9–12 are the demo flow. Steps 13 are the retrieval flex (Faction A's work).
- If Codex's MCP UI shows a permission prompt for `reelink_analyze`, click approve once and add to `permissions.allow` in your Codex config to skip future prompts.
