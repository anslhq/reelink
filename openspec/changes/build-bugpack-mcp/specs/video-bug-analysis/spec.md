## ADDED Requirements

### Requirement: Local Video Bug Analysis
The system SHALL analyze a local UI screen recording and return structured information about visible transient UI bugs without requiring source-code access.

#### Scenario: Detect transient motion bug
- **WHEN** a user provides a valid local `.mov`, `.mp4`, or `.webm` recording showing a transient UI bug
- **THEN** the system SHALL return `bug_found: true`
- **AND** the system SHALL return a bug summary, timestamp or timestamp range, confidence score, bug type, and repro hint

#### Scenario: Analyze without app context
- **WHEN** a user provides only a local video path and no app URL or repo path
- **THEN** the system SHALL still attempt video-only analysis
- **AND** the system SHALL not require DOM, network, source, or Playwright artifacts to complete the basic analysis

#### Scenario: No visible bug found
- **WHEN** the recording does not contain a visible UI bug
- **THEN** the system SHALL return `bug_found: false`
- **AND** the system SHALL include a short explanation and confidence score

### Requirement: Timestamped Bug Evidence
The system SHALL identify the point in time where the visible bug occurs so downstream tools can inspect evidence and context around that moment.

#### Scenario: Bug timestamp returned
- **WHEN** a video model identifies a visible UI bug
- **THEN** the system SHALL return `bug_timestamp_ms` or `bug_start_ms` and `bug_end_ms`
- **AND** the timestamp values SHALL be relative to the start of the provided recording

#### Scenario: Timestamp uncertainty
- **WHEN** the model can describe a bug but cannot confidently isolate an exact timestamp
- **THEN** the system SHALL return the best available timestamp range
- **AND** the system SHALL mark the timestamp confidence separately from the overall bug confidence

### Requirement: Model-Agnostic Analysis Contract
The system SHALL expose a stable bug analysis contract independent of the underlying vision model or preprocessing path.

#### Scenario: Primary and fallback providers
- **WHEN** analysis uses different provider strategies such as direct video understanding, frame/contact-sheet fallback, or a local/open model
- **THEN** the returned `bug_analysis.json` SHALL use the same schema
- **AND** the result SHALL record the provider strategy used for traceability

#### Scenario: User hint included
- **WHEN** a user provides a hint such as "view transition glitch on Blog click"
- **THEN** the system SHALL pass the hint into analysis
- **AND** the system SHALL include any derived repro hint in the output
