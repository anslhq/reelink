## ADDED Requirements

### Requirement: Bippy and React-Grab React Capture

The system SHALL use bippy directly for per-commit React fiber capture and react-grab in visible toolbar mode for element-pointer component-stack enrichment in Layer 1.

#### Scenario: React fiber capture available

- **WHEN** a supported React development app is recorded with the Reck instrumentation installed
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

- **WHEN** `reck_get_components(recording_id, ts, x?, y?)` returns a result
- **THEN** the JSON response SHALL include the following fields when available: `recording_id`, `finding_id`, `ts`, `frame_idx`, `prod_build`, `element_path`, `bounding_box`, `selected_text`, `css_classes`, `computed_styles`, `accessibility`, `component_stack` (array of `{display_name, fiber_id, source}`), and `fiber_diff` when applicable
- **AND** the schema SHALL be the canonical truth from which renderable views are derived

#### Scenario: Agent consumes agentation-style markdown

- **WHEN** a coding agent consuming Reck output is already trained on agentation's forensic markdown format
- **THEN** the response SHALL include or be projectable to that markdown via a documented `toAgentationMarkdown()` view
- **AND** the projection SHALL preserve agentation's forensic field names (Full DOM Path, CSS Classes, Position, Selected text, Computed Styles, Accessibility, Source, React) where applicable

#### Scenario: Agent consumes react-grab-style XML

- **WHEN** a coding agent is already trained on react-grab's `<selected_element>` XML wrapper format
- **THEN** the response SHALL be projectable to that XML format via a documented `toReactGrabXML()` view
- **AND** the projection SHALL include the component stack with display names and `at <component> in <file>:<line>:<column>` source references

### Requirement: Component Retrieval Tool

The system SHALL provide component/source lookup through `reck_get_components(recording_id, ts, x?, y?)`.

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

### Requirement: Real React-Grab Completion Gate

The system SHALL treat real react-grab capture, visible user annotation, rich component schemas, and agent-readable projections as required product behavior, not optional polish.

#### Scenario: React capture status is reported

- **WHEN** tasks or docs claim React/source capture is complete
- **THEN** the claim SHALL be backed by observed evidence that supported React pages produce real react-grab-driven component/source data and persisted user annotation events
- **AND** heuristic or synthetic fixture-only capture SHALL be described as partial progress, not completion

#### Scenario: Landing real-app target is verified

- **WHEN** React/source capture is promoted beyond fixture proof
- **THEN** `~/Documents/Github/landing` SHALL be verified after removing pre-existing react-grab setup and running `bunx -y @anslai/reck init` or installed `reck init`
- **AND** verification SHALL prove framework-file initialization, visible glow/click/annotation UX, persisted `react-grab-events.jsonl`, and source/component retrieval from a real browser recording

#### Scenario: Broader support is claimed

- **WHEN** docs claim support beyond the first verified `landing` app path
- **THEN** at least one additional lightweight real-app or fixture-app target SHALL verify framework detection, init idempotency, and build/start behavior
- **AND** docs SHALL NOT overclaim framework support beyond observed verification

#### Scenario: Rich component projection is verified

- **WHEN** `reck_get_components` is marked complete
- **THEN** verification SHALL cover canonical JSON fields, `toAgentationMarkdown()`-style markdown, and `toReactGrabXML()` `<selected_element>`-style XML
- **AND** missing React/source context SHALL remain explicit rather than fabricated

#### Scenario: Bippy/fiber scope is reported honestly

- **WHEN** tasks or docs describe bippy/fiber capture
- **THEN** they SHALL distinguish hook-observed commit evidence from full fiber topology/source traversal unless full traversal is implemented and verified
- **AND** status SHALL NOT treat DOM/dataset heuristics as equivalent to real react-grab or bippy source evidence

#### Scenario: Reck component source context is queried

- **WHEN** an agent queries component/source evidence after the Reck rename
- **THEN** the public tool SHALL be named `reck_get_components`
- **AND** docs SHALL describe Reck recording packages and Reck setup commands

#### Scenario: Reck react-grab setup is documented

- **WHEN** docs describe initializing react-grab through the product workflow
- **THEN** they SHALL use `reck init` or `bunx -y @anslai/reck init` according to the final package behavior
- **AND** they SHALL NOT use old Reelink binary names except in migration notes