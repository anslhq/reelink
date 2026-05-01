## ADDED Requirements

### Requirement: Coding-Agent MCP Integration
The system SHALL expose Reck through a small local `reck_*` MCP tool surface suitable for coding/browser agents. Old `reelink_*` tools may exist only as temporary documented aliases.

#### Scenario: MCP server launched
- **WHEN** an agent launches Reck with `bunx -y @anslai/reck mcp` or an installed `reck mcp` command
- **THEN** the system SHALL start a Node 20+ TypeScript stdio MCP server by default
- **AND** the server SHALL expose a small set of `reck_*` tools with path-oriented returns
- **AND** old `reelink_*` tools SHALL be documented as temporary aliases if retained

#### Scenario: Reck MCP server launched
- **WHEN** an agent launches the published MCP server after the Reck rename
- **THEN** the command SHALL use `reck mcp` or `bunx -y @anslai/reck mcp` according to the final package behavior
- **AND** the MCP server SHALL identify itself as Reck

#### Scenario: Tool surface constrained
- **WHEN** the MCP server is available
- **THEN** it SHALL include the core tools `reck_analyze`, `reck_get_finding`, `reck_get_frame`, `reck_get_dom`, `reck_get_components`, `reck_query`, and `reck_run` as implemented by layer
- **AND** it SHALL avoid proliferating redundant tools beyond the 5-7 tool surface without a design update

#### Scenario: Reck tools are listed
- **WHEN** an agent calls `tools/list` after the Reck rename
- **THEN** public tools SHALL use the `reck_*` prefix as primary names
- **AND** old `reelink_*` tools SHALL be documented only as temporary aliases if retained

### Requirement: Install and Agent Registration DevX
The system SHALL provide one-line setup and troubleshooting for local coding-agent integrations.

#### Scenario: Init command run
- **WHEN** a user runs `bunx -y @anslai/reck init` or `reck init`
- **THEN** the system SHALL create or update non-secret config at `~/.reck/config.json`
- **AND** legacy `~/.reelink/config.json` reads SHALL be compatibility-only if retained
- **AND** it SHALL either safely register supported coding-agent clients or honestly print snippets for unsupported clients
- **AND** it SHALL detect or provide config snippets for Codex CLI, Cursor, Claude Code, Cline/Roo, and VS Code Copilot where possible without overclaiming auto-write support

#### Scenario: Reck init and doctor are run
- **WHEN** a user runs setup or diagnostics after the Reck rename
- **THEN** commands and generated snippets SHALL use `reck init`, `reck doctor`, and `reck mcp` naming
- **AND** docs SHALL use `reck-mcp` for local linked MCP binary references

#### Scenario: Codex config is generated for Reck
- **WHEN** Reck writes or prints Codex MCP config snippets
- **THEN** the MCP server key and command SHALL use Reck naming
- **AND** old Reelink snippets SHALL be removed or marked legacy

#### Scenario: Package command path needed
- **WHEN** the system writes MCP config snippets for a published package install
- **THEN** it SHALL center `bunx -y @anslai/reck mcp` or a global `reck mcp` command
- **AND** it SHALL preserve environment-variable-based API key configuration rather than writing secrets to config files

#### Scenario: Doctor command run
- **WHEN** a user runs `reck doctor`
- **THEN** the system SHALL check Node version, Bun/package resolution, Playwright browser install, MCP config, hosted model key presence, provider route readiness, and explicitly configured self-hosted Qwen fallback availability
- **AND** it SHALL report actionable fixes without printing API key values

#### Scenario: React-grab readiness is reported
- **WHEN** init or doctor reports React capture readiness
- **THEN** it SHALL separate `installed`, `initialized`, and `verified` readiness states
- **AND** dependency resolution alone SHALL NOT be reported as real browser capture verification

### Requirement: Agent Self-Recording Workflow
The system SHALL provide `reck_run(task_description, target_url)` so agents can record their own browser tasks and reuse the recording as state.

#### Scenario: Agent run succeeds
- **WHEN** an agent calls `reck_run` with a task description and target URL
- **THEN** the system SHALL drive or wrap a Playwright browser session and create a recording folder
- **AND** it SHALL return `{recording_id, success, summary}` plus any documented status, observation, and eval-evidence fields in the final public contract

#### Scenario: Next-action input requested
- **WHEN** an agent needs to decide what to do next during or after a recorded session
- **THEN** the system SHALL be able to provide recent-frame-plus-state context shaped as `{frame_path, dom_summary, component_map, network_since_last, console_since_last}` when available
- **AND** this context SHALL be derived from the recording rather than repeated unbounded screenshot/a11y-tree/DOM dumps

#### Scenario: Agent run fails partially
- **WHEN** the browser task fails, times out, or reaches an uncertain state
- **THEN** the system SHALL preserve the partial recording as evidence
- **AND** it SHALL summarize failure state and recommended next steps for the agent

#### Scenario: Production MCP server launched
- **WHEN** an end user installs or launches Reck from the published package
- **THEN** documentation and generated snippets SHALL center `bunx -y @anslai/reck` or `bun install -g @anslai/reck` plus installed `reck`
- **AND** linked `reelink-mcp` usage SHALL be documented as legacy local development/testing only if temporarily supported

#### Scenario: Browser gateway tools are public
- **WHEN** the public MCP server exposes browser-control tools
- **THEN** the public surface SHALL include `reck_browser_evaluate` and `reck_browser_take_screenshot` in addition to navigate/click/type/snapshot/wait controls
- **AND** the single child Playwright MCP gateway over CDP SHALL remain the intended architecture

#### Scenario: Agent run contract status is verified
- **WHEN** `reck_run` is marked complete
- **THEN** tests SHALL prove the public output includes `{recording_id, success, summary}`
- **AND** `recent_observation.frame_path` and `recent_observation.component_map` SHALL be populated when corresponding artifacts exist
- **AND** partial failures SHALL preserve recordings as evidence

#### Scenario: Real client onboarding is verified
- **WHEN** onboarding is marked complete
- **THEN** the Codex setup prompt SHALL be run end-to-end in a real Codex session or replaced with an equivalent current prompt that is run end-to-end
- **AND** the observed result SHALL verify MCP registration, analysis, retrieval, and final reporting

#### Scenario: Real app runbook is verified
- **WHEN** Layer 1 or onboarding is marked complete
- **THEN** the active integration runbook (`reck/docs/integration-testing-runbook.md` if the package folder rename lands in this change, otherwise the current implementation-path docs marked as non-final identity) SHALL be run end-to-end against `~/Documents/Github/landing`
- **AND** docs SHALL state that `landing` is the first verified real React app target, not universal framework proof
