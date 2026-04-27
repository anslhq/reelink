## ADDED Requirements

### Requirement: Thin BugPack Creation
The system SHALL create a BugPack folder that preserves the original recording and minimal timestamp-centered evidence required by coding agents.

#### Scenario: Create BugPack after analysis
- **WHEN** video bug analysis completes for a local recording
- **THEN** the system SHALL create a BugPack folder for the run
- **AND** the folder SHALL contain a manifest, bug analysis JSON, original video reference or copy, and evidence metadata

#### Scenario: Minimal evidence extraction
- **WHEN** the bug analysis includes a timestamp or timestamp range
- **THEN** the system SHALL extract a short evidence clip around the suspected bug moment
- **AND** the system SHALL extract before, at-bug, and after frames when possible

#### Scenario: Evidence unavailable
- **WHEN** a clip or frame cannot be extracted from the input video
- **THEN** the system SHALL preserve the original analysis
- **AND** the system SHALL record the failed evidence artifact and reason in metadata

### Requirement: Agent-Readable Manifest
The BugPack SHALL include a manifest describing the run, input, generated artifacts, and missing optional context.

#### Scenario: Manifest records generated files
- **WHEN** a BugPack is created
- **THEN** `manifest.json` SHALL list generated artifact paths relative to the BugPack folder
- **AND** it SHALL include the input video path, run identifier, creation timestamp, and analysis status

#### Scenario: Optional context not collected
- **WHEN** runtime, source, network, trace, or eval artifacts have not been collected
- **THEN** the BugPack SHALL mark those artifact groups as `not_collected`
- **AND** the absence of optional context SHALL not cause basic BugPack creation to fail

### Requirement: Evidence Package Extensibility
The BugPack folder structure SHALL allow enhanced and advanced artifacts to be added after the basic video analysis.

#### Scenario: Runtime artifacts appended
- **WHEN** a later runtime recapture creates DOM, console, network, trace, or screenshot artifacts
- **THEN** the system SHALL add those artifacts to the existing BugPack
- **AND** it SHALL update the manifest without overwriting the original video analysis

#### Scenario: Eval artifacts appended
- **WHEN** a regression eval is generated from the BugPack
- **THEN** the system SHALL store the eval path and expected failure status in the BugPack metadata
- **AND** it SHALL preserve any verification results produced later
