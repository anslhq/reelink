## Learned User Preferences

- When launching subagents, inherit the parent model by omitting the `model` field entirely; never pass explicit Composer, an empty string, null, or a placeholder.
- After launching a background subagent, end the turn and wait for its completion notification instead of stacking foreground work or polling.
- Avoid leaking phase or process names into code and tests; tests should be named for behavior or modules.

## Learned Workspace Facts

- Architecture review for this workspace should currently infer domain vocabulary from code; no `CONTEXT.md`, `CONTEXT-MAP.md`, or `docs/adr/*.md` files were present during the initial architecture scan.
