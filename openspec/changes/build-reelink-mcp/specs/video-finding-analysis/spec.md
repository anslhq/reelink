## ADDED Requirements

### Requirement: Codex-as-Client Onboarding Flow
The system SHALL provide a paste-ready Codex setup prompt (`docs/setup-prompt.md`) and an operator-mode integration runbook (`docs/integration-testing-runbook.md`) that together make Codex CLI the canonical v0.1 testing client.

#### Scenario: Setup prompt registers Reelink in Codex
- **WHEN** a user pastes `docs/setup-prompt.md` into a Codex session opened in their target repo
- **THEN** the Codex agent SHALL verify Reelink builds (`bun run typecheck` exits 0), write a `[mcp_servers.reelink]` block into `~/.codex/config.toml` with absolute bun path, verify `codex mcp list` shows `reelink` running, prompt the user for a recording path, and call `reelink_analyze` with that path while surfacing the full JSON response
- **AND** the agent SHALL NOT embed the OpenRouter API key anywhere except the `mcp_servers.reelink.env` block
- **AND** the agent SHALL surface a configuration diff for user approval before writing `~/.codex/config.toml`

#### Scenario: Integration runbook supports manual onboarding
- **WHEN** a user prefers manual configuration over the agentic setup prompt
- **THEN** `docs/integration-testing-runbook.md` SHALL document each step (verify build, write MCP config, register, record bug, run analyze, verify schema) with explicit commands, success criteria, and failure-mode remediation
- **AND** the runbook SHALL specify Codex as the primary client and Cursor as an alternative footnote

### Requirement: Path-Only Video Finding Analysis
The system SHALL analyze arbitrary local screen recordings as Layer 0 video findings without requiring browser, source, DOM, trace, or SDK context.

#### Scenario: Analyze supported recording path
- **WHEN** a user calls `reelink_analyze(path, fps_sample=4, focus="any")` with a valid local `.mov`, `.mp4`, or `.webm` recording
- **THEN** the system SHALL return `{recording_id, duration_sec, summary, findings, next_steps}`
- **AND** each finding SHALL include `id`, `ts`, `type`, `severity`, `title`, and `confidence`

#### Scenario: Analyze without application context
- **WHEN** the user provides only a video path and no target URL, repository, browser session, or app SDK
- **THEN** the system SHALL still attempt video-only analysis
- **AND** the system SHALL not require DOM, network, source, trace, or Playwright artifacts to complete the Layer 0 workflow

#### Scenario: No confident finding
- **WHEN** the model cannot identify a visible UI issue with sufficient confidence
- **THEN** the system SHALL return an empty or low-confidence findings set with a concise summary
- **AND** the system SHALL include next steps such as providing a focus hint or inspecting specific timestamps

### Requirement: Deterministic Video Preprocessing
The system SHALL preprocess recordings deterministically for cached frame retrieval and future non-primary providers, but the OpenRouter/Qwen Layer 0 path SHALL use raw video input.

#### Scenario: Frame extraction for cached retrieval
- **WHEN** `reelink_analyze` preprocesses a recording for cached frame access
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
- **THEN** the system MAY attempt a last-resort SGLang, Ollama, or Hugging Face endpoint route that preserves raw-video semantics
- **AND** the response SHALL record provider strategy metadata for traceability without changing the tool return schema

#### Scenario: Focus hint supplied
- **WHEN** the caller supplies `focus` such as a suspected transition, loading state, or component area
- **THEN** the system SHALL include the focus in the analysis prompt/context
- **AND** the system SHALL reflect relevant focus-specific next steps when confidence is low
