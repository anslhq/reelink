## ADDED Requirements

### Requirement: Folder-Based Recording Package
The system SHALL persist Reck recordings as folders rather than single files so agents can query timestamp-aligned state artifacts over time. Old `.reelink` packages are legacy data only if compatibility is retained.

#### Scenario: Imported video recording created
- **WHEN** `reck_analyze` imports a local recording
- **THEN** the system SHALL create or update a recording folder under `.reck/<id>/` or a sibling folder such as `recording.mov.reck/`
- **AND** old `.reelink/<id>/` or `recording.mov.reelink/` packages SHALL be read only through documented legacy compatibility if retained
- **AND** the folder SHALL contain `manifest.json`, analysis output, sampled `frames/`, and a reference or copy of the source video

#### Scenario: Layer 1 captured recording created
- **WHEN** the system records a browser session
- **THEN** the recording folder SHALL use the canonical layout with `video.webm`, `trace.zip` (Playwright trace with action-aligned DOM/network/console/sources), `fiber-commits.jsonl` (bippy), `source-dictionary.json` (bippy), `react-grab-events.jsonl` (element-pointer events from the visible toolbar), `network.har`, `console.jsonl`, `manifest.json`, and `frames/` when available
- **AND** missing optional streams SHALL be represented explicitly in the manifest
- **AND** v0.1 SHALL NOT include `rrweb-events.jsonl`; DOM state is derived from Playwright trace snapshots plus bippy fiber commits

#### Scenario: Package layout is finalized
- **WHEN** recording package semantics are marked complete
- **THEN** imported-video, browser-recording, and agent-run package layouts SHALL be documented and tested
- **AND** frame lookup SHALL work across package types, including imported-video frame artifacts and browser-recording screenshot/frame artifacts

#### Scenario: Reck recording package is created
- **WHEN** a new imported video, browser recording, or agent-run package is created after the rename
- **THEN** the recording folder SHALL use `.reck/` as the current storage root
- **AND** old `.reelink` paths SHALL NOT be used for new recordings

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

#### Scenario: Production build detected
- **WHEN** Layer 1 fiber capture runs against a recorded app
- **THEN** `manifest.json` SHALL include a `prod_build` boolean indicating whether bippy detected production-mode React
- **AND** downstream tools consuming `fiber-commits.jsonl`, `source-dictionary.json`, or component findings SHALL NOT assume display names or source locations are reliable when `prod_build: true`

#### Scenario: Stream availability summary
- **WHEN** the manifest is serialized
- **THEN** it SHALL include a `streams` map with one entry per optional Layer 1 stream (`fiber_commits`, `source_dictionary`, `react_grab_events`, `network`, `console`, `trace`, `frames`, `eval`)
- **AND** each entry SHALL be one of `available`, `not_collected`, `unavailable`, or `failed` with an optional reason field

### Requirement: Recording Package Extensibility
The recording folder SHALL allow later layers to append timestamp-aligned artifacts without overwriting original findings.

#### Scenario: Layer 1 artifacts appended
- **WHEN** Playwright, bippy, react-grab, network, or console capture runs after initial video analysis
- **THEN** the system SHALL append the new artifacts to the existing recording folder or link a related recording folder
- **AND** the manifest SHALL preserve original findings and record how streams were aligned

#### Scenario: Eval evidence appended
- **WHEN** an agent run or verification check creates eval evidence
- **THEN** the system SHALL store artifact paths and verification metadata in the recording folder
- **AND** it SHALL preserve the recording as durable evidence even if the eval fails

#### Scenario: Browser recording session created
- **WHEN** the system records a browser session through Reck-owned browser capture
- **THEN** the recording folder SHALL live under `.reck/browser-recordings/<id>`
- **AND** imported videos SHALL use `.reck/<id>/` or sibling package folders such as `recording.mov.reck/` for new writes
- **AND** legacy `.reelink/` browser recordings or imported packages SHALL be read only through documented compatibility if retained
- **AND** docs and manifests SHALL make this layout split explicit so browser recordings and imported videos are not conflated

#### Scenario: Legacy `.reelink` package is handled
- **WHEN** a `.reelink` package already exists after the Reck rename
- **THEN** the system SHALL either read it as legacy data or provide migration behavior
- **AND** the chosen compatibility behavior SHALL be documented and tested

#### Scenario: Related recordings are linked
- **WHEN** a browser recording is related to an imported video analysis package or later eval artifact
- **THEN** the manifest SHALL record relation/linkage metadata when applicable
- **AND** status artifacts SHALL NOT claim this linkage complete until tests or smoke evidence prove it

#### Scenario: Agent-run relation is recorded
- **WHEN** `reck_run` creates or updates a browser recording package
- **THEN** the manifest SHALL record the agent-run relationship and eval-evidence artifact paths according to the final schema
- **AND** partial-failure recordings SHALL preserve that relationship when finalization succeeds

#### Scenario: Production build is unknown
- **WHEN** React production-mode detection cannot be proven from captured runtime evidence
- **THEN** `prod_build` SHALL be represented as detected true/false or explicitly unknown/unavailable according to the implemented schema
- **AND** the system SHALL NOT rely on an unconditional `false` default as evidence of development-mode React
