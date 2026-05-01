# Reck Codex Demo Script

Status: historical demo scaffold. This file used to describe the Reelink x Codex hackathon runner and old WorkItem-based branch spawning. It is retained only as historical execution context while Reck docs are reconciled. Do not use it as release guidance.

## Current Public Demo Path

1. Register one MCP server named `reck` using `[mcp_servers.reck]`.
2. Launch with `bunx -y @anslai/reck mcp` or installed `reck mcp`.
3. Call `reck_analyze` on a `.mov`, `.mp4`, or `.webm`.
4. Treat `findings` as the normative Layer 0 contract.
5. Use `reck_get_finding`, `reck_get_frame`, and `reck_query` for retrieval.
6. If showing browser recording, use the observed Reck child-gateway path with `reck_browser_*` tools and a `.reck/` package.

## Historical / Legacy Notes

Older drafts used Reelink names, `reelink_*` tools, `work_items`, and local source-path commands. Those are historical or compatibility-only. They should not appear in new public setup, demo, or release copy except inside migration notes.

The current observed evidence to cite is:

- Landing proof recording: external real-app recording `rec_molq08a6_dxwy9o` at `/Users/harsha/Documents/GitHub/landing/.reck/browser-recordings/rec_molq08a6_dxwy9o/`.
- Landing source dictionary marker: `next_prerender_stack`.
- Landing caveat: that artifact's manifest marks `react_grab_events` as `not_collected`, so do not present it as visible react-grab annotation or event-capture proof.
- Second target fixture proof: `reelink/tests/second-target-proof.test.ts` using fixture path `reelink/tests/fixtures/vite-react-second-target/`.
- Child gateway smoke and recording smoke: cite as smoke evidence, not broad framework support.
- Layer 2/eval evidence: cite exact tests or real-client proof that ran.

Do not claim live OpenRouter, real Codex client setup, final demo recording, benchmark/token savings, self-host fallback support, rrweb, or bundled agentation unless those were actually run or implemented.
