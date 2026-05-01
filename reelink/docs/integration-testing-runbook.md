# Reck Integration Testing Runbook

Goal: verify Reck in a real coding-agent workflow without overstating what was observed. This runbook centers the public Reck identity and marks legacy Reelink names only as compatibility/local-development paths.

## Prerequisites

- A target repo for the agent session. The first required real React target is `~/Documents/Github/landing`.
- A second lightweight target fixture when validating Layer 1 beyond the landing app.
- Bun installed for the `bunx` path.
- `OPENROUTER_API_KEY` only if running live hosted OpenRouter/Qwen analysis.
- A `.mov`, `.mp4`, or `.webm` recording for Layer 0, unless the test starts from a browser recording.

## Step 1 - Install or Launch Reck

Target production launch once `@anslai/reck` is published:

```bash
bunx -y @anslai/reck init
bunx -y @anslai/reck doctor
bunx -y @anslai/reck mcp
```

Target installed use after publication:

```bash
bun install -g @anslai/reck
reck init
reck doctor
reck mcp
```

Current local verification does not prove public npm availability; use the checkout path below for observed local build/package/smoke evidence.

Current checkout/local development path:

```bash
cd /Users/harsha/Developer/hackathon/reelink
bun install
bun run typecheck
bun run build
bun link
reck init
reck doctor
reck mcp
```

For v0.1, `reelink/` is intentionally retained as the nested implementation package path. Root promotion or a folder rename to `reck/` is deferred to a dedicated migration because it must update and verify scripts, tests, docs, generated artifacts, and local checkout workflows. Do not present `reelink/` as the public product identity.

## Step 2 - Register One MCP Server

Codex CLI (`~/.codex/config.toml`):

```toml
[mcp_servers.reck]
command = "bunx"
args = ["-y", "@anslai/reck", "mcp"]

[mcp_servers.reck.env]
OPENROUTER_API_KEY = "<your-key-here>"
RECK_OPENROUTER_MODEL = "qwen/qwen3.6-flash"
RECK_LOG_LEVEL = "info"
```

Installed binary alternative:

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
        "OPENROUTER_API_KEY": "<your-key-here>",
        "RECK_OPENROUTER_MODEL": "qwen/qwen3.6-flash"
      }
    }
  }
}
```

Do not register Playwright MCP separately. Reck owns the single registered MCP surface and may spawn Playwright MCP as a child attached to Reck-owned Chromium via CDP.

## Step 3 - Verify the Agent Sees Reck

```bash
codex mcp list
```

Expected: `reck` is running or connected. On failure, inspect `codex mcp logs reck` and fix the config or PATH.

## Step 4 - Layer 0: Analyze a Recording

Prompt the agent:

```text
I have a screen recording of a UI issue at /absolute/path/to/recording.mov.

Use the Reck MCP. Call `reck_analyze` with focus="any" and fps_sample=4. Show the full JSON response. Confirm it contains `recording_id`, `duration_sec`, `summary`, `findings`, and `next_steps`. Then call `reck_get_finding`, `reck_get_frame`, and `reck_query` against the returned recording id.

Use `findings` as the normative contract. If old `work_items` data appears, label it compatibility/detail output and do not treat it as the primary public response.
```

Success criteria:

- `reck_analyze` is called through MCP.
- The response shape is `{recording_id, duration_sec, summary, findings, next_steps}`.
- Retrieval tools return paths and summaries.
- Missing Layer 1 streams are explicit, not fabricated.
- Live OpenRouter/Qwen proof is marked passed only if a real key was present and the call actually ran.

## Step 5 - Layer 1: Browser Recording State

Use `~/Documents/GitHub/landing` as the required real React app target. The observed landing proof is external real-app evidence from recording `rec_molq08a6_dxwy9o` at `/Users/harsha/Documents/GitHub/landing/.reck/browser-recordings/rec_molq08a6_dxwy9o/`, with source dictionary evidence from `next_prerender_stack`. Keep that evidence tied to this external target and do not describe it as package-local `reelink/.reck` evidence or generalize it into broad framework support.

Validate:

- The recording writes under `.reck/browser-recordings/<id>` or another documented `.reck/` package layout.
- `video.webm`, `trace.zip`, `manifest.json`, frames, network/console artifacts, and available React/source streams are reflected honestly in the manifest.
- Source dictionary evidence is present when claimed; for the landing proof, cite `next_prerender_stack`.
- Second-target proof is covered by `reelink/tests/second-target-proof.test.ts` using fixture path `reelink/tests/fixtures/vite-react-second-target/`.
- `reck_get_dom` and `reck_get_components` return actual persisted evidence or explicit missing-stream status.
- Child gateway smoke verifies the one-MCP pattern: Reck spawns Playwright MCP as a child attached via CDP and forwards curated `reck_browser_*` tools.

## Step 6 - Layer 2 and Eval Evidence

Validate `reck_run(task_description, target_url)` only through observed public behavior:

- It returns `{recording_id, success, summary}`.
- It preserves partial-failure recordings.
- It writes durable eval evidence and recent observation state when available.
- It uses the same `.reck/` recording package model.

If this was verified only by agent-reported tests or smokes, say so. Do not claim real external client proof unless run through the configured `reck` MCP in Codex or another real client.

## Step 7 - Evidence to Record

Capture these facts in the final report:

- Exact MCP server name and command used.
- Whether the run used `bunx -y @anslai/reck mcp`, installed `reck mcp`, or local checkout compatibility.
- Recording id(s), including `rec_molq08a6_dxwy9o` when referencing the landing proof.
- Source dictionary marker `next_prerender_stack` for the landing proof, plus the caveat that this artifact's manifest marks `react_grab_events` as `not_collected` and is not visible react-grab annotation/event-capture proof.
- Second-target test/fixture evidence: `reelink/tests/second-target-proof.test.ts` and `reelink/tests/fixtures/vite-react-second-target/`.
- Which tests or smokes passed: child gateway smoke, recording smoke, Layer 2/eval tests, and any live provider smoke.
- Any external caveats: missing OpenRouter key, real Codex client not run, final recording/demo not captured.

## Compatibility and Migration

Legacy docs used `[mcp_servers.reelink]`, `reelink-mcp`, `reelink_analyze`, `.reelink/`, `REELINK_*`, and `work_items`. These are allowed only as migration or local-dev compatibility. New public docs, demos, and release materials must use `[mcp_servers.reck]`, `@anslai/reck`, `reck`, `reck-mcp`, `reck_analyze`, `.reck/`, `RECK_*`, and `findings`.

## Non-Goals

- No rrweb.
- No bundled agentation.
- No exact benchmark or token-saving claims.
- No self-hosted fallback support claims unless SGLang, Ollama, or Hugging Face routes were implemented and verified.
- No broad framework support claims beyond the observed landing app and second target fixture.
