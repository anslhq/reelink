## ADDED Requirements

### Requirement: Bippy and React-Grab React Capture
The system SHALL use bippy directly for per-commit React fiber capture and react-grab in visible toolbar mode for element-pointer component-stack enrichment in Layer 1.

#### Scenario: React fiber capture available
- **WHEN** a supported React development app is recorded with the Reelink instrumentation installed
- **THEN** the system SHALL persist `fiber-commits.jsonl` and `source-dictionary.json` in the recording folder when available
- **AND** entries SHALL be timestamp-aligned to the recording timeline

#### Scenario: Element-pointer enrichment
- **WHEN** the user or agent points to or selects an element during a recording
- **THEN** the system SHALL emit a finding entry containing component stack, display names, and source location (file, line, column when available) using react-grab's element selection hooks
- **AND** the entry SHALL include the recording timestamp and DOM coordinates

#### Scenario: Init script ordering
- **WHEN** Layer 1 instrumentation injects bippy into a recorded browser session
- **THEN** the system SHALL inject bippy's `install-hook-only` via Playwright `page.addInitScript()` before any host page script executes
- **AND** the full bippy bundle, react-grab toolbar integration, and per-commit recorder SHALL be injected via subsequent `addInitScript` calls only after the hook is established

#### Scenario: agentation considered
- **WHEN** designing visible UI for live-page annotation or element-coordinate selection UX
- **THEN** the system SHALL treat agentation as researched-but-out-of-scope for v0.1
- **AND** any optional peer-detect integration SHALL be deferred to v0.2 pending license blessing from the agentation maintainer

### Requirement: Schema-Compatible Component Output
The system SHALL emit component and source data in a JSON-first schema that is projectable to existing agent-readable formats without translation logic on the agent side.

#### Scenario: JSON canonical schema
- **WHEN** `reelink_get_components(recording_id, ts, x?, y?)` returns a result
- **THEN** the JSON response SHALL include the following fields when available: `recording_id`, `finding_id`, `ts`, `frame_idx`, `prod_build`, `element_path`, `bounding_box`, `selected_text`, `css_classes`, `computed_styles`, `accessibility`, `component_stack` (array of `{display_name, fiber_id, source}`), and `fiber_diff` when applicable
- **AND** the schema SHALL be the canonical truth from which renderable views are derived

#### Scenario: Agent consumes agentation-style markdown
- **WHEN** a coding agent consuming Reelink output is already trained on agentation's forensic markdown format
- **THEN** the response SHALL include or be projectable to that markdown via a documented `toAgentationMarkdown()` view
- **AND** the projection SHALL preserve agentation's forensic field names (Full DOM Path, CSS Classes, Position, Selected text, Computed Styles, Accessibility, Source, React) where applicable

#### Scenario: Agent consumes react-grab-style XML
- **WHEN** a coding agent is already trained on react-grab's `<selected_element>` XML wrapper format
- **THEN** the response SHALL be projectable to that XML format via a documented `toReactGrabXML()` view
- **AND** the projection SHALL include the component stack with display names and `at <component> in <file>:<line>:<column>` source references

### Requirement: Component Retrieval Tool
The system SHALL provide component/source lookup through `reelink_get_components(recording_id, ts, x?, y?)`.

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
