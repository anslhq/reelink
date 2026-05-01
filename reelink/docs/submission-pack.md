# Reck Submission Pack

Working checklist for release/demo materials. This document records what to show and what must remain caveated until externally verified.

## Demo Narrative

Reck gives AI coding/browser agents temporal memory. A user provides a screen recording, Reck returns timestamped `findings`, persists a `.reck/` state package, and lets the agent retrieve frame, finding, DOM/runtime, component/source, network, console, and eval evidence when those streams were actually collected.

The public wedge is `reck_analyze`. Browser recording and agent self-recording build on the same package model through `reck_record_*`, `reck_browser_*`, and `reck_run`.

## Two-Minute Video Outline

1. Show the problem: a real UI recording.
2. Show `reck_analyze` returning `recording_id`, `summary`, `findings`, and `next_steps`.
3. Show `reck_get_finding`, `reck_get_frame`, and `reck_query` retrieving evidence without rerunning the model.
4. If showing Layer 1, use external real-app landing proof: `rec_molq08a6_dxwy9o` at `/Users/harsha/Documents/GitHub/landing/.reck/browser-recordings/rec_molq08a6_dxwy9o/` and source dictionary `next_prerender_stack`; do not use that artifact as visible react-grab annotation/event-capture proof because its manifest marks `react_grab_events` as `not_collected`.
5. If showing the gateway, show one registered MCP server named `reck` and curated `reck_browser_*` tools through the child gateway smoke path.
6. If showing Layer 2/eval, label it with the exact test or client proof that ran.

## Public Repo Checklist

- README centers Reck, `@anslai/reck`, `reck`, `reck-mcp`, `reck_*`, `.reck/`, `RECK_*`, `tryreck.dev`, and `tryreck.app`.
- Setup prompt uses `[mcp_servers.reck]` and `bunx -y @anslai/reck mcp` or installed `reck mcp`.
- Integration runbook uses `reck_analyze`, retrieval tools, and `findings` as the normative contract.
- Old Reelink names are labeled historical, migration, or legacy/local-development compatibility only.
- Docs do not claim rrweb, bundled agentation, exact token savings, benchmark wins, broad framework support, or self-host fallback support.

## Evidence to Include

- Layer 0: public `reck_analyze` response with `findings`.
- Layer 1 landing: external real-app recording `rec_molq08a6_dxwy9o` at `/Users/harsha/Documents/GitHub/landing/.reck/browser-recordings/rec_molq08a6_dxwy9o/` and source dictionary `next_prerender_stack`; `react_grab_events` is `not_collected` in that artifact's manifest.
- Layer 1 second target fixture: `reelink/tests/second-target-proof.test.ts` using fixture path `reelink/tests/fixtures/vite-react-second-target/`.
- Child gateway smoke: one registered Reck MCP with Playwright MCP spawned as a child via CDP.
- Recording smoke: `.reck/` package, manifest, and stream availability.
- Layer 2/eval: exact tests or real-client run that produced eval evidence.

## External Caveats

Do not mark these passed unless actually observed:

- Live OpenRouter/Qwen smoke with a real `OPENROUTER_API_KEY`.
- Real Codex client setup using `[mcp_servers.reck]`.
- Final edited demo recording.
- Public repository/submission URL.
- Any SGLang, Ollama, or Hugging Face self-hosted fallback route.

## Evidence Commands

Run from the parent repo when preparing release evidence:

```bash
cd /Users/harsha/Developer/hackathon
openspec status --change build-reelink-mcp --json
openspec validate build-reelink-mcp
openspec validate --specs --json

cd /Users/harsha/Developer/hackathon/reelink
bun run typecheck
bun test
bun run build
bun run smoketest:gateway
bun run smoketest:recording
bun run smoketest:ffmpeg
bun run scripts/smoketest-child-gateway.ts
```

If a command is skipped because it needs an external key, recording, or client session, say so in the submission notes.

## Draft Copy

Title: Reck: video-as-state for AI coding agents

Reck turns UI recordings into timestamped findings and queryable state packages for AI coding/browser agents. Instead of making an agent reason from one screenshot, Reck lets it inspect what happened over time, retrieve frame and runtime evidence, and preserve the recording as eval proof.

The current public contract is Reck-first: once published, launch `@anslai/reck`, register one MCP server named `reck`, call `reck_analyze`, and use `findings` plus retrieval tools for follow-up. Until publication is observed, cite local built-package/dry-run and CLI/MCP smoke evidence instead of public npm install proof. Legacy Reelink names are migration history, not the release identity.
