# Codex Demo Script

Status: draft script for the intended demo flow; final demo evidence is still external/manual until a recording and verification run are observed.

1. Show the target UI bug recording.
2. Ask Codex to call Reck through the single `reck` MCP server.
3. Run `reck_analyze` on the recording path.
4. Inspect the returned `findings` and retrieve nearby frame/runtime context.
5. If browser recording is used, demonstrate that Reck owns the browser session and forwards curated browser tools through the child gateway.
6. State missing streams honestly when React/source, DOM, console, network, or eval evidence is unavailable.

Do not claim deterministic regression tests for motion-only findings unless stable runtime invariants have been captured and verified.
