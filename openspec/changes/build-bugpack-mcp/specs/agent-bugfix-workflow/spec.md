## ADDED Requirements

### Requirement: Local Agent Workflow Entry Point
The system SHALL provide a local workflow entry point that allows a coding agent to start from a local video file path and receive BugPack outputs.

#### Scenario: Agent analyzes local video
- **WHEN** a coding agent invokes the workflow with a local `video_file_path`
- **THEN** the system SHALL analyze the recording and create a BugPack
- **AND** it SHALL return the BugPack path and structured summary to the agent

#### Scenario: Absolute and relative paths
- **WHEN** a user provides an absolute or repo-relative video path
- **THEN** the system SHALL resolve the path safely
- **AND** it SHALL return a clear error if the file does not exist or is unsupported

### Requirement: Layered Workflow Orchestration
The system SHALL orchestrate basic, enhanced, and advanced workflow layers without requiring all layers for every run.

#### Scenario: Basic video-only workflow
- **WHEN** only a video path is provided
- **THEN** the workflow SHALL complete video analysis and BugPack creation
- **AND** it SHALL mark runtime/source/eval stages as not collected or not requested

#### Scenario: Enhanced context workflow
- **WHEN** a video path, app URL, and repro steps are provided
- **THEN** the workflow SHALL run video analysis, create a BugPack, and attempt runtime context capture
- **AND** it SHALL append runtime artifacts to the BugPack

#### Scenario: Advanced eval workflow
- **WHEN** a BugPack contains enough bug analysis and repro/runtime context
- **THEN** the workflow SHALL attempt source mapping and regression eval generation
- **AND** it SHALL return next-step guidance for the coding agent to patch and verify

### Requirement: Coding-Agent Friendly Summary
The workflow SHALL produce a concise summary that a coding agent can use to inspect source files, patch the bug, and verify behavior.

#### Scenario: Workflow completes
- **WHEN** any workflow layer completes
- **THEN** the system SHALL summarize bug description, timestamp, evidence paths, available context, missing context, and recommended next action
- **AND** the summary SHALL not expose API keys or sensitive local environment details
