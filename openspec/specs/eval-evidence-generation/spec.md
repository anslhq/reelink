## ADDED Requirements

### Requirement: Recording as Eval Evidence
The system SHALL treat Reck recordings as durable eval evidence for what a user or agent observed during a browser task. Legacy `.reelink` evidence may be read only through documented compatibility if retained.

#### Scenario: Recording evidence created
- **WHEN** a video analysis, browser recording, or agent run completes
- **THEN** the system SHALL preserve the recording ID and artifact paths as eval evidence
- **AND** it SHALL make the evidence queryable by timestamp and finding ID

#### Scenario: Agent recording used as evidence
- **WHEN** `reck_run` creates a recording for an agent task
- **THEN** the recording SHALL be usable to demonstrate what the agent attempted and observed
- **AND** the result SHALL not depend on a deterministic test being generated

#### Scenario: Recent observation is artifact-backed
- **WHEN** `reck_run` returns recent observation state
- **THEN** `frame_path`, `dom_summary`, `component_map`, `network_since_last`, and `console_since_last` SHALL be derived from actual browser-recording artifacts when available
- **AND** missing observation fields SHALL be explicit rather than fabricated

### Requirement: Reliable Verification Artifact Generation
The system SHALL generate deterministic verification artifacts only when the recording and runtime context support reliable assertions.

#### Scenario: Stable invariant available
- **WHEN** a finding maps to stable DOM, route, loading, style, network, or state invariants
- **THEN** the system MAY generate a Playwright verification artifact expected to fail before the fix and pass after the fix
- **AND** it SHALL record artifact path, assertion strategy, expected pre-fix behavior, and confidence

#### Scenario: Motion-only issue
- **WHEN** a finding is primarily a motion, transition, animation, or temporal rendering issue without stable runtime invariants
- **THEN** the system SHALL preserve video/state evidence as the primary eval artifact
- **AND** it SHALL mark screenshot or timing-based assertions as optional or experimental unless deterministic timing is established

#### Scenario: Insufficient context for deterministic eval
- **WHEN** a recording lacks enough repro, runtime, or source context to generate a reliable check
- **THEN** the system SHALL return evidence-based next steps or a draft verification prompt instead of claiming a deterministic regression test
- **AND** it SHALL state what additional context is needed

### Requirement: Avoid Unverified Benchmark Claims
The system SHALL avoid presenting unmeasured token savings or benchmark improvements as normative requirements.

#### Scenario: Rationale references agent observation cost
- **WHEN** docs or generated output discuss screenshot/a11y/DOM observation bottlenecks
- **THEN** they SHALL frame token and benchmark numbers as research or dossier context unless measured in the project
- **AND** they SHALL not assert exact savings as guaranteed product behavior

### Requirement: Eval Evidence Status Guardrails
Timeline and eval evidence are first-class product outputs, but deterministic verification SHALL only be claimed where stable evidence exists.

#### Scenario: Eval evidence status is reported
- **WHEN** tasks or docs describe eval evidence generation as complete
- **THEN** they SHALL distinguish durable recording/evidence preservation from deterministic test generation
- **AND** they SHALL cite observed verification before claiming deterministic artifacts are generated

#### Scenario: Layer 2 completion is claimed
- **WHEN** `reck_run` or Layer 2 is marked complete
- **THEN** positive, partial-failure, insufficient-context, stable-invariant, and motion-only scenarios SHALL be tested or explicitly scoped out in status
- **AND** public docs SHALL match whether the system preserves evidence only or also generates and runs deterministic tests

#### Scenario: Reck run creates eval evidence
- **WHEN** `reck_run` creates eval evidence after the Reck rename
- **THEN** evidence paths for new recordings SHALL live under `.reck/`
- **AND** docs SHALL refer to Reck run/evidence tools rather than Reelink tools

#### Scenario: Legacy eval evidence is read
- **WHEN** eval evidence references a legacy `.reelink` recording
- **THEN** the system SHALL handle it according to the documented legacy recording compatibility policy
- **AND** migration behavior SHALL be tested before release completion is claimed

#### Scenario: Motion-only evidence is preserved
- **WHEN** a finding is motion-only or lacks stable runtime invariants
- **THEN** the system SHALL preserve recording evidence and mark deterministic screenshot/timing assertions as optional, experimental, or not collected
- **AND** docs SHALL avoid unverified benchmark, token-saving, or deterministic-regression claims
