## ADDED Requirements

### Requirement: Path-Only Video Finding Analysis
The system SHALL analyze arbitrary local screen recordings as Layer 0 video findings without requiring browser, source, DOM, trace, or SDK context.

#### Scenario: Analyze supported recording path
- **WHEN** a user calls `bugpack_analyze(path, fps_sample=4, focus="any")` with a valid local `.mov` or `.mp4` recording
- **THEN** the system SHALL return `{recording_id, duration_sec, summary, findings, next_steps}`
- **AND** each finding SHALL include `id`, `ts`, `type`, `severity`, `title`, and `confidence`

#### Scenario: Analyze without application context
- **WHEN** the user provides only a video path and no target URL, repository, browser session, or app SDK
- **THEN** the system SHALL still attempt video-only analysis
- **AND** the system SHALL not require DOM, network, source, trace, or Playwright artifacts to complete the Layer 0 workflow

#### Scenario: No confident finding
- **WHEN** the model cannot identify a visible UI issue with sufficient confidence
- **THEN** the system SHALL return an empty or low-confidence findings set with a concise summary
- **AND** the system SHALL include next steps such as providing a focus hint or inspecting specific timestamps

### Requirement: Deterministic Video Preprocessing
The system SHALL preprocess recordings for model analysis using deterministic, bounded frame extraction before invoking the vision model route.

#### Scenario: Frame extraction for analysis
- **WHEN** `bugpack_analyze` preprocesses a recording
- **THEN** the system SHALL use `ffmpeg-static` to sample frames at the configured policy, with the MVP policy of fps=1, max 64 frames, and long edge <=896px
- **AND** the system SHALL store sampled frame paths in the recording folder for later retrieval

#### Scenario: Caller requests fps sample
- **WHEN** the caller provides `fps_sample`
- **THEN** the system SHALL apply or clamp the requested sampling according to the preprocessing policy
- **AND** the response or manifest SHALL record the effective sampling strategy used

### Requirement: Model-Agnostic Finding Contract
The system SHALL expose a stable finding schema regardless of the underlying hosted or local vision model provider.

#### Scenario: Hosted default route
- **WHEN** a hosted model provider is available
- **THEN** the system SHALL route analysis through the configured OpenRouter/Qwen3-VL path by default
- **AND** the returned finding contract SHALL not expose provider-specific response shapes

#### Scenario: Local fallback route
- **WHEN** the hosted path is unavailable and a local LM Studio-compatible model endpoint is configured
- **THEN** the system SHALL attempt the local fallback route
- **AND** the response SHALL record provider strategy metadata for traceability without changing the tool return schema

#### Scenario: Focus hint supplied
- **WHEN** the caller supplies `focus` such as a suspected transition, loading state, or component area
- **THEN** the system SHALL include the focus in the analysis prompt/context
- **AND** the system SHALL reflect relevant focus-specific next steps when confidence is low
