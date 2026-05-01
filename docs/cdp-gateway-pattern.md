# Reck CDP Gateway Pattern

Status: historical engineering note, reconciled for Reck. The current public guidance is one registered MCP server named `reck`; Reck may spawn Playwright MCP as a child stdio subprocess attached to the same Chromium instance via CDP. Users should not register Playwright MCP separately.

## Current Invariants

- Public MCP server name: `reck`.
- Public browser gateway tools use the `reck_browser_*` prefix.
- Reck owns browser recording and writes `.reck/` packages.
- Playwright MCP, when used, is a child process of Reck and attaches via CDP to Reck-owned Chromium.
- Forwarded tools are curated browser operations such as navigate, click, type, wait, evaluate, snapshot, and screenshot.
- Child gateway smoke evidence is smoke evidence only; do not treat it as final client proof unless run through the public Reck package/client path.

## Observed Evidence to Cite

- Child gateway smoke: use as evidence that the single-MCP child pattern can work.
- Landing proof: external real-app recording `rec_molq08a6_dxwy9o` at `/Users/harsha/Documents/GitHub/landing/.reck/browser-recordings/rec_molq08a6_dxwy9o/` with source dictionary marker `next_prerender_stack`; its manifest marks `react_grab_events` as `not_collected`, so it is not visible react-grab annotation/event-capture proof.
- Second target fixture: `reelink/tests/second-target-proof.test.ts` using fixture path `reelink/tests/fixtures/vite-react-second-target/`.

## Legacy Context

Older drafts used `reelink_browser_*`, `reelink_run`, `reelink record`, and the nested `reelink/` source path. Those names are historical or migration/local-development compatibility only. New public docs and setup use `reck_browser_*`, `reck_run`, `reck record`, `@anslai/reck`, `.reck/`, and `[mcp_servers.reck]`.

## Non-Claims

This note does not claim broad framework support, exact benchmark/token savings, rrweb support, bundled agentation, self-host fallback support, live OpenRouter proof, or real Codex client proof.
