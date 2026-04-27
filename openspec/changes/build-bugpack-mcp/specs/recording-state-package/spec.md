## ADDED Requirements

### Requirement: Folder-Based Recording Package
The system SHALL persist BugPack recordings as folders rather than single files so agents can query timestamp-aligned state artifacts over time.

#### Scenario: Imported video recording created
- **WHEN** `bugpack_analyze` imports a local recording
- **THEN** the system SHALL create or update a recording folder under `.bugpack/<id>/` or a sibling folder such as `recording.mov.bugpack/`
- **AND** the folder SHALL contain `manifest.json`, analysis output, sampled `frames/`, and a reference or copy of the source video

#### Scenario: Layer 1 captured recording created
- **WHEN** the system records a browser session
- **THEN** the recording folder SHALL use the canonical layout with `video.webm`, `trace.zip`, `rrweb-events.jsonl`, `fiber-commits.jsonl`, `source-dictionary.json`, `network.har`, `console.jsonl`, `manifest.json`, and `frames/` when available
- **AND** missing optional streams SHALL be represented explicitly in the manifest

#### Scenario: Tool responses expose paths
- **WHEN** an MCP tool returns evidence from a recording folder
- **THEN** it SHALL return paths, IDs, timestamps, and concise summaries
- **AND** it SHALL not embed raw video bytes, image pixels, trace bytes, or unbounded DOM/log payloads in the tool response

### Requirement: Agent-Readable Manifest
The recording package SHALL include a manifest describing inputs, artifacts, timestamp alignment, stream availability, model/provider metadata, and safety status.

#### Scenario: Manifest records artifacts
- **WHEN** a recording folder is created or updated
- **THEN** `manifest.json` SHALL list artifact paths relative to the recording folder
- **AND** it SHALL include recording ID, creation timestamp, source type, duration when known, preprocessing strategy, and available streams

#### Scenario: Optional stream missing
- **WHEN** DOM, React/fiber, network, console, trace, eval, or video artifacts are not collected for a layer
- **THEN** the manifest SHALL mark each unavailable stream as `not_collected`, `unavailable`, or `failed` with a reason when known
- **AND** the absence of optional Layer 1 or Layer 2 context SHALL not fail Layer 0 analysis

### Requirement: Recording Package Extensibility
The recording folder SHALL allow later layers to append timestamp-aligned artifacts without overwriting original findings.

#### Scenario: Layer 1 artifacts appended
- **WHEN** Playwright, rrweb, bippy, network, or console capture runs after initial video analysis
- **THEN** the system SHALL append the new artifacts to the existing recording folder or link a related recording folder
- **AND** the manifest SHALL preserve original findings and record how streams were aligned

#### Scenario: Eval evidence appended
- **WHEN** an agent run or verification check creates eval evidence
- **THEN** the system SHALL store artifact paths and verification metadata in the recording folder
- **AND** it SHALL preserve the recording as durable evidence even if the eval fails
