# Reck Setup Prompt — paste into Codex

Use this prompt in a Codex session opened in the target repo where you want to test Reck. It configures a single MCP server named `reck`, verifies the public `reck_*` tools, runs Layer 0 analysis on a recording path you provide, and exercises retrieval tools.

This is an onboarding artifact, not proof by itself. Only mark client setup verified after it has been run in a real Codex session with a real recording and, if needed, a live `OPENROUTER_API_KEY`.

## Prerequisites

- Bun is installed if using the target `bunx` launch path.
- After publication, Reck is available through `bunx -y @anslai/reck mcp` or installed globally as `reck mcp` / `reck-mcp`. Until public npm availability is observed, use local built-package/dry-run and checkout smoke evidence instead of treating these commands as publication proof.
- `OPENROUTER_API_KEY` is available for live OpenRouter/Qwen analysis.
- A `.mov`, `.mp4`, or `.webm` recording exists at an absolute path.

## Prompt

```text
You are setting up Reck as an MCP server for this Codex session.

Reck is video-as-state for AI coding/browser agents. Its public Layer 0 contract is `reck_analyze(path, fps_sample=4, focus="any")`, returning `{recording_id, duration_sec, summary, findings, next_steps}`. `findings` is normative. If older `work_items` data appears, treat it as legacy compatibility/detail output only.

Use one MCP server named `reck`. Prefer the production package command:

[mcp_servers.reck]
command = "bunx"
args = ["-y", "@anslai/reck", "mcp"]

If Reck is already installed globally, this is also acceptable:

[mcp_servers.reck]
command = "reck"
args = ["mcp"]

Keep secrets only in the MCP env block or existing shell environment. Do not write API keys to source-controlled files. Reck-owned env vars use `RECK_*`; provider-owned vars such as `OPENROUTER_API_KEY` keep their provider names.

Steps:

1. Check whether a `[mcp_servers.reck]` block already exists in `~/.codex/config.toml`. If it does, show the current block and proposed diff before changing it. If only `[mcp_servers.reelink]` exists, label it legacy and migrate it to `[mcp_servers.reck]`.
2. Configure `reck` using either `bunx -y @anslai/reck mcp` or installed `reck mcp`. Do not register Playwright MCP separately.
3. Add env only as needed:
   - `OPENROUTER_API_KEY = "<user-provided-key>"`
   - `RECK_OPENROUTER_MODEL = "qwen/qwen3.6-flash"`
   - `RECK_LOG_LEVEL = "info"`
4. Restart or reload Codex MCP as needed.
5. Run `codex mcp list` and confirm `reck` is running or connected. If it fails, inspect `codex mcp logs reck` and report the exact error.
6. List tools and confirm the public names include `reck_analyze`, retrieval tools such as `reck_get_finding`, `reck_get_frame`, `reck_query`, and any available `reck_browser_*` or `reck_run` tools. Do not require old `reelink_*` names.
7. Ask me for the absolute recording path.
8. Call `reck_analyze` with `{ "path": "<path>", "focus": "any", "fps_sample": 4 }`.
9. Verify the response contains `recording_id`, `duration_sec`, `summary`, `findings`, and `next_steps`. If a live OpenRouter key was not available, report that live provider proof was not run instead of claiming success.
10. If `findings[0]` exists, call `reck_get_finding` for that id, call `reck_get_frame` at that timestamp, and call `reck_query` with `summary`. Report paths and summaries, not raw video bytes or large dumps.
11. If Layer 1 tools are available, verify missing streams are explicit. DOM, React/source, network, console, or eval evidence must not be fabricated.
12. Final report:
    - MCP configured as `[mcp_servers.reck]`: yes/no
    - Public `reck_*` tools visible: yes/no
    - `reck_analyze` returned `findings`: yes/no
    - Retrieval tools worked: yes/no
    - Live OpenRouter/Qwen smoke actually run: yes/no
    - Real Codex client proof completed in this session: yes/no
    - Any legacy Reelink names observed and whether they were compatibility-only

Do not modify Reck source code. Do not register a separate Playwright MCP server. Do not claim broad framework support, benchmark/token savings, self-host fallback support, rrweb support, or bundled agentation support.
```

## Compatibility Note

Old setup prompts used `[mcp_servers.reelink]`, `reelink-mcp`, `reelink_analyze`, `.reelink/`, `REELINK_*`, and `work_items`. Those names are historical or compatibility-only. New public setup uses `[mcp_servers.reck]`, `@anslai/reck`, `reck`, `reck-mcp`, `reck_analyze`, `.reck/`, `RECK_*`, and `findings`.
