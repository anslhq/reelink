## ADDED Requirements

### Requirement: React Component Source Context
The system SHALL optionally map visible UI context to React component and source information when running against a supported React development environment.

#### Scenario: Source context available
- **WHEN** a timestamped DOM element or selected visible element can be mapped to React source context
- **THEN** the system SHALL return component name, selector or element summary, source file path, and line information when available
- **AND** the system SHALL store source candidates in the BugPack

#### Scenario: Source context unavailable
- **WHEN** the app is not React, is not running in a supported development mode, or source internals are unavailable
- **THEN** the system SHALL return best-effort DOM and selector context
- **AND** it SHALL mark React source mapping as `not_collected` or `unavailable` with a reason

### Requirement: React Grab-Style Context Capture
The system SHALL support a React Grab-style context model for mapping selected UI elements to coding-agent-friendly source context.

#### Scenario: Element context selected
- **WHEN** a user or automated probe identifies a relevant visible UI element
- **THEN** the system SHALL attempt to capture the element HTML summary, component name, file/source context, and bounding box
- **AND** the output SHALL be readable by coding agents without requiring manual screenshots

#### Scenario: Multiple candidates
- **WHEN** a timestamp maps to multiple possible components or source files
- **THEN** the system SHALL return ranked source candidates
- **AND** each candidate SHALL include confidence or ranking rationale when available

### Requirement: Version-Aware React Mapping
The system SHALL treat React source mapping as best-effort and version-sensitive.

#### Scenario: React internals differ by version
- **WHEN** the mapping adapter detects React-version or build-mode limitations
- **THEN** it SHALL degrade gracefully to enclosing component or DOM context
- **AND** it SHALL not fail the overall BugPack workflow
