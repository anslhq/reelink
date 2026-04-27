## ADDED Requirements

### Requirement: Recording as Eval Evidence
The system SHALL treat BugPack recordings as durable eval evidence for what a user or agent observed during a browser task.

#### Scenario: Recording evidence created
- **WHEN** a video analysis, browser recording, or agent run completes
- **THEN** the system SHALL preserve the recording ID and artifact paths as eval evidence
- **AND** it SHALL make the evidence queryable by timestamp and finding ID

#### Scenario: Agent recording used as evidence
- **WHEN** `bugpack_run` creates a recording for an agent task
- **THEN** the recording SHALL be usable to demonstrate what the agent attempted and observed
- **AND** the result SHALL not depend on a deterministic test being generated

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
