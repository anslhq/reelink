## ADDED Requirements

### Requirement: Instrumented Browser Recapture
The system SHALL optionally recapture a reported UI flow in a browser to collect runtime evidence around a known bug timestamp or repro sequence.

#### Scenario: Recapture with app URL and steps
- **WHEN** a user provides an app URL and repro steps for an existing BugPack
- **THEN** the system SHALL run the flow in a browser automation context
- **AND** it SHALL collect runtime artifacts such as video, screenshots, DOM snapshots, console logs, and network data where available

#### Scenario: Recapture without timestamp
- **WHEN** repro steps are provided but no reliable bug timestamp exists
- **THEN** the system SHALL still record the browser session
- **AND** it SHALL mark runtime artifacts as unaligned to a video bug timestamp until mapping is available

#### Scenario: Recapture failure
- **WHEN** the browser cannot load the app URL or execute a repro step
- **THEN** the system SHALL record the failure reason
- **AND** it SHALL preserve existing BugPack video evidence without treating the entire run as failed

### Requirement: Timestamp-Aligned Runtime Context
The system SHALL map captured runtime artifacts to the bug timestamp when enough timing data is available.

#### Scenario: Context at bug timestamp
- **WHEN** a BugPack contains a bug timestamp and a recaptured browser session timeline
- **THEN** the system SHALL return runtime context nearest to the bug timestamp
- **AND** the context SHALL include available DOM state, relevant console events, relevant network events, and screenshot/frame references

#### Scenario: Nearest available context
- **WHEN** exact timestamp alignment is unavailable
- **THEN** the system SHALL return the nearest available runtime context
- **AND** it SHALL include the time delta between requested timestamp and returned context

### Requirement: Runtime Evidence Safety
The system SHALL avoid exposing unnecessary secrets or sensitive runtime data in generated BugPack artifacts.

#### Scenario: Network data collected
- **WHEN** network request or HAR data is collected
- **THEN** the system SHALL provide a mechanism to redact or omit sensitive headers and tokens
- **AND** the manifest SHALL record whether redaction was applied
