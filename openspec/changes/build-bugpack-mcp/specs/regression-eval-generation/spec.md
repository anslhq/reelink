## ADDED Requirements

### Requirement: Bug-Type-Specific Eval Generation
The system SHALL generate Playwright regression evals from BugPack evidence using strategies appropriate to the detected bug type.

#### Scenario: Reliable invariant bug
- **WHEN** the BugPack describes a bug with a stable invariant such as a stuck spinner, missing element, incorrect route state, or persistent overlay
- **THEN** the system SHALL generate a Playwright test with assertions expected to fail before the fix
- **AND** the generated eval SHALL include the repro steps used to reach the bug state

#### Scenario: Motion or animation bug
- **WHEN** the BugPack describes a transient motion, transition, or animation bug
- **THEN** the system SHALL prefer stable DOM, style, or state invariants when available
- **AND** it SHALL mark visual screenshot assertions as optional or experimental unless deterministic timing is established

#### Scenario: Insufficient context for eval
- **WHEN** the BugPack does not contain enough repro or runtime context to generate a reliable eval
- **THEN** the system SHALL generate a draft eval or codex-ready repro prompt instead of claiming a deterministic regression test
- **AND** it SHALL explain what additional context is needed

### Requirement: Eval Metadata
The system SHALL record metadata describing generated eval reliability and expected behavior.

#### Scenario: Eval generated
- **WHEN** an eval file is generated
- **THEN** the system SHALL record eval path, bug type, assertion strategy, expected pre-fix result, and confidence
- **AND** this metadata SHALL be stored in the BugPack

#### Scenario: Verification result captured
- **WHEN** a generated eval is run before or after a fix
- **THEN** the system SHALL record pass/fail status and relevant output summary
- **AND** it SHALL preserve the result as verification evidence

### Requirement: Red-to-Green Demo Support
The system SHALL support at least one reliable demo path where a generated eval fails before a known fix and passes after the fix.

#### Scenario: Demo eval selected
- **WHEN** a BugPack bug type is suitable for a reliable demo eval
- **THEN** the system SHALL generate an eval optimized for red-to-green verification
- **AND** it SHALL avoid relying solely on brittle animation timing unless explicitly configured
