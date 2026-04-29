## ADDED Requirements

### Requirement: Coding-Agent MCP Integration
The system SHALL expose Reelink through a small local `reelink_*` MCP tool surface suitable for coding/browser agents.

#### Scenario: MCP server launched
- **WHEN** an agent launches Reelink with `npx -y reelink`
- **THEN** the system SHALL start a Node 20+ TypeScript stdio MCP server by default
- **AND** the server SHALL expose a small set of `reelink_*` tools with path-oriented returns

#### Scenario: Tool surface constrained
- **WHEN** the MCP server is available
- **THEN** it SHALL include the core tools `reelink_analyze`, `reelink_get_finding`, `reelink_get_frame`, `reelink_get_dom`, `reelink_get_components`, `reelink_query`, and `reelink_run` as implemented by layer
- **AND** it SHALL avoid proliferating redundant tools beyond the 5-7 tool surface without a design update

### Requirement: Install and Agent Registration DevX
The system SHALL provide one-line setup and troubleshooting for local coding-agent integrations.

#### Scenario: Init command run
- **WHEN** a user runs `npx reelink init`
- **THEN** the system SHALL create or update non-secret config at `~/.reelink/config.json`
- **AND** it SHALL detect or provide config snippets for Codex CLI, Cursor, Claude Code, Cline/Roo, and VS Code Copilot where possible

#### Scenario: Apple Silicon npx path needed
- **WHEN** the system writes MCP config snippets on Apple Silicon or another environment where the `npx` path may be ambiguous
- **THEN** it SHALL use an absolute `npx` path where needed
- **AND** it SHALL preserve environment-variable-based API key configuration rather than writing secrets to config files

#### Scenario: Doctor command run
- **WHEN** a user runs `reelink doctor`
- **THEN** the system SHALL check Node version, Reelink package resolution, Playwright browser install, MCP config, hosted model key presence, and explicitly configured self-hosted Qwen fallback availability
- **AND** it SHALL report actionable fixes without printing API key values

### Requirement: Agent Self-Recording Workflow
The system SHALL provide `reelink_run(task_description, target_url)` so agents can record their own browser tasks and reuse the recording as state.

#### Scenario: Agent run succeeds
- **WHEN** an agent calls `reelink_run` with a task description and target URL
- **THEN** the system SHALL drive or wrap a Playwright browser session and create a recording folder
- **AND** it SHALL return `{recording_id, success, summary}`

#### Scenario: Next-action input requested
- **WHEN** an agent needs to decide what to do next during or after a recorded session
- **THEN** the system SHALL be able to provide recent-frame-plus-state context shaped as `{frame_path, dom_summary, component_map, network_since_last, console_since_last}` when available
- **AND** this context SHALL be derived from the recording rather than repeated unbounded screenshot/a11y-tree/DOM dumps

#### Scenario: Agent run fails partially
- **WHEN** the browser task fails, times out, or reaches an uncertain state
- **THEN** the system SHALL preserve the partial recording as evidence
- **AND** it SHALL summarize failure state and recommended next steps for the agent
