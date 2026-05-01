# Reck Layer 1 Recording Notes

Status: historical skeleton note, reconciled for Reck. Earlier versions contained paste-ready Reelink code sketches. Those sketches are no longer public release guidance and should not be copied without revalidating against current Reck code.

## Current Layer 1 Contract

A browser recording package writes under `.reck/` and may include:

```text
.reck/browser-recordings/<recording_id>/
  video.webm
  trace.zip
  fiber-commits.jsonl
  source-dictionary.json
  react-grab-events.jsonl
  network.har
  console.jsonl
  manifest.json
  frames/
```

The manifest must record stream availability honestly. Missing DOM, React/source, network, console, or eval streams must be reported as `not_collected`, `unavailable`, or `failed` with reasons. Retrieval tools must not fabricate missing streams.

## Observed Proof

- Landing proof: external real-app recording `rec_molq08a6_dxwy9o` at `/Users/harsha/Documents/GitHub/landing/.reck/browser-recordings/rec_molq08a6_dxwy9o/`.
- Landing source dictionary marker: `next_prerender_stack`.
- Landing caveat: that artifact's manifest marks `react_grab_events` as `not_collected`, so cite it for landing/source-dictionary evidence, not visible react-grab annotation or event capture.
- Second target fixture proof: `reelink/tests/second-target-proof.test.ts` using fixture path `reelink/tests/fixtures/vite-react-second-target/`.
- Recording and child-gateway smokes are useful smoke evidence, not broad framework support.

## Legacy Context

Old skeletons used `.reelink/` and `reelink_*` names. Treat those as historical or compatibility-only. New public docs use `.reck/`, `reck_*`, `RECK_*`, `@anslai/reck`, and `[mcp_servers.reck]`.

## Non-Goals

No rrweb, no bundled agentation, no broad framework support claim, no exact token-saving/benchmark claim, and no self-host fallback support claim unless that route is implemented and verified.
