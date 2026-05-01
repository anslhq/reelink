## ADDED Requirements

### Requirement: Reck Public Identity
The system SHALL use Reck as the public project identity across package, repository, docs, CLI, MCP, recording storage, and release surfaces.

#### Scenario: Public identity is rendered
- **WHEN** public docs, package metadata, release notes, or setup instructions refer to the product
- **THEN** they SHALL use `Reck` as the product name
- **AND** they SHALL use `@anslai/reck` as the npm package name
- **AND** they SHALL use `anslhq/reck` as the GitHub repository target
- **AND** they SHALL use `tryreck.dev` as the primary domain and `tryreck.app` as defensive secondary domain when domains are mentioned

#### Scenario: Historical Reelink references remain
- **WHEN** docs or specs mention Reelink for migration or history
- **THEN** the reference SHALL be clearly marked as previous naming or legacy compatibility
- **AND** it SHALL NOT be presented as the current product identity

### Requirement: Public Repo Package Layout
The system SHALL define whether the final repository layout is a public single-product OSS root package or an explicitly justified nested-package structure. For v0.1, the nested implementation package remains intentionally deferred rather than promoted: `reelink/` is the current package-local implementation path, public identity is Reck, and root promotion or a folder rename to `reck/` requires a dedicated migration that updates and verifies package scripts, tests, docs, generated artifacts, and local checkout workflows.

#### Scenario: Public single-product repository layout is finalized
- **WHEN** the repository is intended to be a public single-product OSS repo
- **THEN** the runtime/package SHOULD be promoted from `reelink/` to the repository root unless a long-term nested-package structure is explicitly justified
- **AND** completion SHOULD NOT be claimed while the nested layout remains unexplained

#### Scenario: Nested v0.1 implementation layout is justified
- **WHEN** v0.1 docs or OpenSpec references retain `reelink/` as a path
- **THEN** they SHALL label it as the package-local implementation path, not public product identity
- **AND** they SHALL state that root promotion or `reck/` folder rename is deferred to a dedicated migration with full script, test, docs, generated artifact, and local workflow verification
- **AND** they SHALL NOT claim root promotion or package-folder rename is complete

### Requirement: Reck CLI And Binary Names
The system SHALL expose Reck through `reck` and `reck-mcp` binaries.

#### Scenario: CLI command is documented
- **WHEN** docs, setup snippets, or OpenSpec examples show the primary CLI command
- **THEN** they SHALL use `reck`
- **AND** production package execution SHALL use `bunx -y @anslai/reck` or an installed `reck` command according to the final package behavior

#### Scenario: MCP binary is documented
- **WHEN** local linked development or MCP server command snippets refer to the server binary
- **THEN** they SHALL use `reck-mcp`
- **AND** old `reelink-mcp` references SHALL be removed or marked legacy

### Requirement: Reck MCP Tool Prefix
The public MCP tool surface SHALL use the `reck_*` prefix.

#### Scenario: Tool list is returned
- **WHEN** a coding agent calls `tools/list` on the Reck MCP server
- **THEN** public tools SHALL use names beginning with `reck_`
- **AND** `reelink_*` tool names SHALL NOT be the primary public names

#### Scenario: Temporary tool aliases exist
- **WHEN** old `reelink_*` aliases are retained for compatibility
- **THEN** they SHALL be documented as temporary aliases
- **AND** tests SHALL cover both alias behavior and the planned removal condition

### Requirement: Reck Environment Variables
The system SHALL use `RECK_*` environment variables for public configuration.

#### Scenario: Environment variable is documented
- **WHEN** docs, examples, or doctor output mention environment variables
- **THEN** they SHALL use the `RECK_*` prefix for Reck-owned variables
- **AND** provider-owned variables such as `OPENROUTER_API_KEY` MAY retain provider names when they are not Reck-owned

#### Scenario: Legacy environment variable is read
- **WHEN** an old `REELINK_*` variable is supported during migration
- **THEN** the system SHALL document that compatibility explicitly
- **AND** it SHALL prefer `RECK_*` when both old and new variables are present

### Requirement: Reck Recording Storage
The system SHALL store new Reck recordings under `.reck/`.

#### Scenario: New recording is created
- **WHEN** Reck analyzes an imported video, records a browser session, or runs an agent task
- **THEN** new recording artifacts SHALL be stored under `.reck/` according to the final package layout
- **AND** new docs and manifests SHALL use `.reck/`, not `.reelink/`, as the current storage root

#### Scenario: Legacy recording is read
- **WHEN** an existing `.reelink/` recording is present
- **THEN** the system SHALL either read it through a documented legacy lookup path or provide a documented migration path
- **AND** completion SHALL NOT be claimed until the chosen behavior is tested
