## ADDED Requirements

### Requirement: Bippy-Based React Fiber Timeline
The system SHALL use bippy directly to capture React fiber commits and source dictionaries for Layer 1 React/source context.

#### Scenario: React fiber capture available
- **WHEN** a supported React development app is recorded with the BugPack instrumentation installed
- **THEN** the system SHALL persist `fiber-commits.jsonl` and `source-dictionary.json` in the recording folder when available
- **AND** entries SHALL be timestamp-aligned to the recording timeline

#### Scenario: React Grab considered
- **WHEN** implementing visible UI to source-context UX
- **THEN** the system SHALL treat React Grab as inspiration or reference only
- **AND** it SHALL not require React Grab as the core dependency for automated Layer 1 commit capture

### Requirement: Component Retrieval Tool
The system SHALL provide component/source lookup through `bugpack_get_components(recording_id, ts, x?, y?)`.

#### Scenario: Component context available
- **WHEN** a timestamp and optional coordinates map to React fiber/source context
- **THEN** the system SHALL return `{component, file, line, props}` when available
- **AND** the response SHALL include enough component/source context for a coding agent to inspect likely source files

#### Scenario: Multiple component candidates
- **WHEN** a timestamp or coordinate maps to multiple possible components
- **THEN** the system SHALL return the best candidate or ranked candidates with confidence/rationale when available
- **AND** it SHALL preserve paths and line numbers as file references rather than embedding large source excerpts

### Requirement: Graceful Source Mapping Degradation
The system SHALL treat React/fiber/source mapping as optional and environment-sensitive.

#### Scenario: React context unavailable
- **WHEN** the app is not React, is not in a supported development mode, lacks source maps, or uses incompatible internals
- **THEN** the system SHALL degrade to DOM-only or video-only context
- **AND** it SHALL mark React source mapping as `not_collected`, `unavailable`, or `failed` with a reason

#### Scenario: Props may contain sensitive values
- **WHEN** component props are captured
- **THEN** the system SHALL avoid exposing obvious secrets or credentials in returned props
- **AND** it SHALL summarize or redact sensitive values where possible
