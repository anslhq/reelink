## ADDED Requirements

### Requirement: Timestamp-Aligned Runtime Timeline
The system SHALL align video frames, findings, DOM mutations, console events, network events, and trace metadata to recording timestamps when those streams are available.

#### Scenario: Runtime streams captured
- **WHEN** a browser session is recorded through the Layer 1 capture path
- **THEN** the system SHALL collect Playwright trace data (action-aligned DOM/network/console/sources), bippy fiber commits, react-grab element-pointer events, console logs, and network/HAR data where available
- **AND** each collected stream SHALL be associated with timestamps that can be mapped to recording time
- **AND** the system SHALL NOT depend on rrweb for v0.1 — DOM state is derived from Playwright trace snapshots and bippy fiber commits

#### Scenario: Nearest context requested
- **WHEN** an agent requests context at a timestamp with no exact runtime event
- **THEN** the system SHALL return the nearest available context with time delta metadata
- **AND** it SHALL identify streams that are missing or outside the requested time window

### Requirement: DOM Retrieval Tool
The system SHALL provide timestamped DOM retrieval through `reck_get_dom(recording_id, ts)`.

#### Scenario: DOM state available
- **WHEN** `reck_get_dom` is called for a timestamp where Playwright trace contains a snapshot at or near the requested time
- **THEN** the system SHALL return `{path, tree_summary}`
- **AND** the path SHALL point to an artifact containing the relevant DOM state or summary for that timestamp
- **AND** when only fiber-commit data is available without a Playwright trace snapshot, the system MAY synthesize a tree summary from fiber topology and DOM associations rather than refusing to answer

#### Scenario: DOM state unavailable
- **WHEN** no DOM timeline exists for the recording or timestamp
- **THEN** the system SHALL return a clear unavailable status or error summary
- **AND** it SHALL not claim that Layer 0 video analysis requires DOM context

### Requirement: Finding Detail Context
The system SHALL provide detailed finding context through `reck_get_finding(recording_id, finding_id)` when supporting streams exist.

#### Scenario: Finding context available
- **WHEN** a requested finding has nearby runtime evidence
- **THEN** the system SHALL return full description, stack when known, surrounding console, DOM diff, suggested fix, and frame paths
- **AND** each context item SHALL be tied to a timestamp or time range when possible

#### Scenario: Finding context partially available
- **WHEN** only video frames or some runtime streams are available
- **THEN** the system SHALL return the available context and mark missing context explicitly
- **AND** it SHALL avoid fabricating stack, DOM diff, or source information that was not collected

### Requirement: Runtime Data Safety
The system SHALL minimize sensitive data exposure when capturing or surfacing runtime timelines.

#### Scenario: Network data collected
- **WHEN** HAR or network events are captured
- **THEN** the system SHALL redact or omit sensitive headers, tokens, cookies, and credentials where possible
- **AND** the manifest SHALL record whether redaction or omission was applied

### Requirement: Timeline Verification Status
The timestamped runtime timeline SHALL remain a first-class requirement, but status artifacts SHALL distinguish implemented bounded evidence from unverified trace/fiber enrichment.

#### Scenario: Runtime timeline status is reported
- **WHEN** tasks, README, or release docs describe DOM timeline support
- **THEN** they SHALL state whether the claim is backed by observed tests/smoke evidence
- **AND** they SHALL preserve honest missing-stream semantics for DOM, source, network, console, and eval streams

#### Scenario: Trace-derived DOM is not available
- **WHEN** Playwright trace DOM extraction is not implemented or not verified for a recording
- **THEN** the system SHALL report persisted DOM summaries, nearest available context, or missing-stream status according to the actual artifact
- **AND** it SHALL NOT imply unverified full trace DOM extraction in docs or completion status

#### Scenario: Real recording timeline is verified
- **WHEN** Layer 1 runtime timeline support is marked complete
- **THEN** verification SHALL include a real browser recording, not only synthetic fixture data
- **AND** `reck_get_dom`, `reck_get_components`, and finding context retrieval SHALL return timestamped evidence or explicit missing-stream statuses from that recording

#### Scenario: Public browser gateway shares the recorded session
- **WHEN** browser gateway support is marked complete
- **THEN** public browser tools such as navigate, click, type, wait, snapshot, evaluate, and screenshot SHALL be verified against the same Chromium session being recorded
- **AND** gateway/fallback status SHALL be persisted or reported so users can distinguish child Playwright MCP forwarding from fallback behavior

#### Scenario: Reck runtime tools are used
- **WHEN** runtime timeline evidence is queried after the Reck rename
- **THEN** public tools SHALL use Reck names such as `reck_get_dom`, `reck_browser_snapshot`, `reck_browser_evaluate`, and `reck_browser_take_screenshot`
- **AND** returned paths for new recordings SHALL point to `.reck` recording packages
