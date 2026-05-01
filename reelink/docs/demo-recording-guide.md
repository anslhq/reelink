# Reck Demo Recording Guide

Capture clean visual artifacts for Reck demos. This guide is about the external recording material; it is not proof that the full product is complete until the recording is analyzed through the public Reck surface and retrieval evidence is captured.

## Recording Criteria

- Format: `.mov`, `.mp4`, or `.webm`.
- Duration: 6-15 seconds for most UI bugs.
- Resolution: 1280x720 minimum; 1920x1080 preferred.
- Audio: no microphone or voiceover in source footage.
- Browser: Chrome or Chromium preferred for browser UI consistency.
- Scope: show the real user-visible bug, not DevTools, unless the bug requires visible network throttling.

## Primary Demo Path

1. Capture the UI issue clearly.
2. Save it outside source-controlled docs or under a gitignored demo-recordings directory.
3. Analyze it through the public Reck command or MCP tool:

```bash
bunx -y @anslai/reck analyze /path/to/recording.mov
```

or from an agent through `reck_analyze`.

4. Confirm the output uses the public Layer 0 contract: `recording_id`, `duration_sec`, `summary`, `findings`, and `next_steps`.
5. Use `reck_get_finding`, `reck_get_frame`, and `reck_query` for follow-up evidence.

If a live OpenRouter key is unavailable, record that the live provider path was not externally run. Do not claim the raw-video OpenRouter smoke passed without observing it.

## Layer 1 Demo Evidence

For browser-state demos, use evidence that was actually observed:

- Landing proof: external real-app recording `rec_molq08a6_dxwy9o` at `/Users/harsha/Documents/GitHub/landing/.reck/browser-recordings/rec_molq08a6_dxwy9o/`.
- Landing source dictionary marker: `next_prerender_stack`.
- Landing caveat: that artifact's manifest marks `react_grab_events` as `not_collected`, so it is not evidence of visible react-grab annotation or event capture.
- Second target fixture proof: `reelink/tests/second-target-proof.test.ts` using fixture path `reelink/tests/fixtures/vite-react-second-target/`.
- Child gateway smoke: show one registered MCP named `reck` and curated `reck_browser_*` tools, not a separate user-registered Playwright MCP.
- Recording smoke: show the `.reck/` package and manifest stream availability.

Do not generalize this into broad framework support. Say React/source evidence was observed on the tested targets and may degrade honestly elsewhere.

## Storage Notes

New Reck recordings use `.reck/`. Legacy `.reelink/` sidecars may exist from earlier Reelink runs and should be labeled legacy/migration evidence. Do not rename old artifacts in docs unless the compatibility behavior is being tested.

## Avoid These Claims

- Exact token savings or benchmark improvements.
- rrweb support.
- Bundled agentation runtime.
- Self-hosted Qwen fallback support unless that route was implemented and verified.
- Real Codex client setup or final demo video completion unless actually run and recorded.
