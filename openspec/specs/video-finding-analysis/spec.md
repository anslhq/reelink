## ADDED Requirements

### Requirement: Codex-as-Client Onboarding Flow
The system SHALL provide a paste-ready Codex setup prompt (`docs/setup-prompt.md`) and an operator-mode integration runbook (`docs/integration-testing-runbook.md`) that together make Codex CLI the canonical v0.1 testing client.

#### Scenario: Setup prompt registers Reck in Codex
- **WHEN** a user pastes `docs/setup-prompt.md` into a Codex session opened in their target repo
- **THEN** the Codex agent SHALL verify Reck builds (`bun run typecheck` exits 0 or the final equivalent package check passes), write or propose a `[mcp_servers.reck]` block into `~/.codex/config.toml` using `bunx -y @anslai/reck mcp` or installed `reck mcp`, verify `codex mcp list` shows `reck` running, prompt the user for a recording path, and call `reck_analyze` with that path while surfacing the full JSON response
- **AND** the agent SHALL NOT embed the OpenRouter API key anywhere except the `mcp_servers.reck.env` block
- **AND** the agent SHALL surface a configuration diff for user approval before writing `~/.codex/config.toml`

#### Scenario: Legacy Codex config remains temporary
- **WHEN** an old `[mcp_servers.reelink]` block, `reelink` command, or `reelink_analyze` call is still supported during migration
- **THEN** that behavior SHALL be documented as temporary legacy compatibility
- **AND** tests or manual verification SHALL cover the alias behavior and its removal criteria before completion is claimed

#### Scenario: Integration runbook supports manual onboarding
- **WHEN** a user prefers manual configuration over the agentic setup prompt
- **THEN** `docs/integration-testing-runbook.md` SHALL document each step (verify build, write MCP config, register, record bug, run analyze, verify schema) with Reck commands, success criteria, and failure-mode remediation
- **AND** the runbook SHALL specify Codex as the primary client and Cursor as an alternative footnote

### Requirement: Path-Only Video Finding Analysis
The system SHALL analyze arbitrary local screen recordings as Layer 0 video findings without requiring browser, source, DOM, trace, or SDK context. This wedge must remain legible and useful to a non-technical reporter who only has a recording, especially for motion/time-based bugs that screenshots miss.

#### Scenario: Analyze supported recording path
- **WHEN** a user calls `reck_analyze(path, fps_sample=4, focus="any")` with a valid local `.mov`, `.mp4`, or `.webm` recording
- **THEN** the system SHALL return `{recording_id, duration_sec, summary, findings, next_steps}` as the headline Layer 0 response
- **AND** each finding SHALL include `id`, `ts`, `type`, `severity`, `title`, and `confidence`
- **AND** the response SHALL NOT include `work_items` by default in this change; if `work_items` is exposed at all, it SHALL be compatibility/detail output behind documented policy and tests, while `findings` remains normative in docs, tests, and examples

#### Scenario: CLI and MCP imported-video path are stable
- **WHEN** Layer 0 is marked complete
- **THEN** imported-video analysis SHALL work through both the public Reck MCP tool and documented Reck CLI surface
- **AND** the analysis SHALL persist artifacts that deterministic retrieval tools can read without requiring browser-recording streams

#### Scenario: Imported video is analyzed through Reck
- **WHEN** a user analyzes an imported `.mov`, `.mp4`, or `.webm` recording after the Reck rename
- **THEN** the public MCP tool SHALL be named `reck_analyze`
- **AND** docs and CLI examples SHALL refer to Reck, not Reelink
- **AND** new recording artifacts SHALL be written under `.reck/`

#### Scenario: Analyze without application context
- **WHEN** the user provides only a video path and no target URL, repository, browser session, or app SDK
- **THEN** the system SHALL still attempt video-only analysis
- **AND** the system SHALL not require DOM, network, source, trace, or Playwright artifacts to complete the Layer 0 workflow

#### Scenario: No confident finding
- **WHEN** the model cannot identify a visible UI issue with sufficient confidence
- **THEN** the system SHALL return an empty or low-confidence findings set with a concise summary
- **AND** the system SHALL include next steps such as providing a focus hint or inspecting specific timestamps

#### Scenario: Reporter wedge is protected
- **WHEN** docs, examples, or validation flows describe Layer 0
- **THEN** they SHALL preserve a path where a non-technical reporter can provide only a recording and still get useful output
- **AND** at least one real validation path SHALL preserve the recording-only reporter wedge
- **AND** docs SHALL NOT drift into generic QA-tooling language that hides the motion/time-based bug thesis

### Requirement: Deterministic Video Preprocessing
The system SHALL preprocess recordings deterministically for cached frame retrieval and future non-primary providers, but the OpenRouter/Qwen Layer 0 path SHALL use raw video input.

#### Scenario: Frame extraction for cached retrieval
- **WHEN** `reck_analyze` preprocesses a recording for cached frame access
- **THEN** the system SHALL use `ffmpeg-static` to sample frames at the configured policy, with the MVP policy of fps=1, max 64 frames, and long edge <=896px
- **AND** the system SHALL store sampled frame paths in the recording folder for later retrieval
- **AND** these frames SHALL NOT be used as a silent fallback when the configured OpenRouter/Qwen model lacks raw video support

#### Scenario: Caller requests fps sample
- **WHEN** the caller provides `fps_sample`
- **THEN** the system SHALL apply or clamp the requested sampling according to the preprocessing policy
- **AND** the response or manifest SHALL record the effective sampling strategy used

### Requirement: Model-Agnostic Finding Contract
The system SHALL expose a stable finding schema regardless of the underlying hosted or local vision model provider.

#### Scenario: Hosted default route
- **WHEN** a hosted model provider is available
- **THEN** the system SHALL route analysis through a configured OpenRouter/Qwen path whose live `input_modalities` include `video`
- **AND** the system SHALL fail loudly instead of falling back to ordered frames when the configured Qwen route is image-only
- **AND** the returned finding contract SHALL not expose provider-specific response shapes

#### Scenario: Last-resort self-host route
- **WHEN** the hosted OpenRouter/Qwen raw-video path is unavailable and a self-hosted Qwen endpoint is explicitly configured
- **THEN** the system MAY attempt a last-resort SGLang, Ollama, or Hugging Face endpoint route only if that route is implemented and verified
- **AND** the response SHALL record provider strategy metadata for traceability without changing the tool return schema

#### Scenario: Self-host route is not implemented
- **WHEN** docs or doctor output mention self-hosted fallback paths that are not implemented and verified
- **THEN** those paths SHALL be marked as roadmap or unavailable rather than supported behavior
- **AND** doctor output SHALL tell the user which provider path is actually ready

#### Scenario: Focus hint supplied
- **WHEN** the caller supplies `focus` such as a suspected transition, loading state, or component area
- **THEN** the system SHALL include the focus in the analysis prompt/context
- **AND** the system SHALL reflect relevant focus-specific next steps when confidence is low

### Requirement: Provider Route Drift Control
The product contract is behavior-first and provider-second. Provider route changes SHALL be explicit availability or compatibility decisions, not silent implementation drift.

#### Scenario: Provider route changes
- **WHEN** the implementation changes the primary provider, model, or route family used for video analysis
- **THEN** OpenSpec and public docs SHALL record why the route changed and what compatibility or availability issue motivated it
- **AND** the change SHALL state any trade-off changes in modalities, latency, cost, output quality, or supported capabilities
- **AND** completion SHALL NOT be claimed by silently substituting whatever model currently exists

### Requirement: Reconciliation Status Guardrails
The public Layer 0 MCP/CLI response SHALL return `findings` as the normative headline contract for this change. The richer long-term public product contract is the WorkItem protocol, but `work_items` SHALL NOT be returned by default from Layer 0 unless a documented compatibility/detail policy and tests cover it. Status artifacts SHALL NOT mark this requirement complete until code and tests prove `reck_analyze` returns `{recording_id, duration_sec, summary, findings, next_steps}` publicly and docs/examples/tests use `findings` as normative.

#### Scenario: Public analysis contract is verified
- **WHEN** completion status is updated for Layer 0 analysis
- **THEN** the status update SHALL cite observed code/test evidence that `reck_analyze` returns `{recording_id, duration_sec, summary, findings, next_steps}` publicly
- **AND** any retained public `work_items` field SHALL be documented as compatibility/detail output with tests and removal criteria, not the headline public contract
- **AND** docs, tests, and examples SHALL use `findings` as normative for Layer 0
- **AND** if `work_items` is promoted beyond compatibility/detail output, OpenSpec SHALL define the WorkItem protocol fields and lifecycle semantics first

#### Scenario: Legacy recording compatibility is verified
- **WHEN** historical recordings contain findings-only or work-items-only analysis files
- **THEN** retrieval tools SHALL continue to read them according to documented compatibility rules
- **AND** accidental dual contracts SHALL NOT remain undocumented

#### Scenario: Documentation references onboarding docs
- **WHEN** specs, tasks, or README reference Codex setup or integration runbooks
- **THEN** those docs SHALL exist under the active package/docs path for the current implementation
- **AND** if package folder rename is part of this change, the docs SHALL exist under `reck/docs/`; if folder rename is deferred, `reelink/docs/` SHALL be marked as current implementation path and not final public identity
- **AND** claims SHALL remain non-authoritative until the corresponding code and tests have passed

#### Scenario: Migration names are documented
- **WHEN** old `reelink_*`, `[mcp_servers.reelink]`, `.reelink/`, `REELINK_*`, or `reelink-mcp` behavior remains available
- **THEN** it SHALL be scoped as migration-only behavior
- **AND** completion SHALL NOT be claimed until that behavior is either removed or tested with documented removal criteria
