# PRODUCT

Last updated: 2026-04-30

## What Reelink Is

Reelink is an open-source **video/state primitive for coding agents**.

It is not primarily a bug-reporting app, not primarily an MCP wrapper, and not primarily a browser automation tool. Those are surfaces. The product itself is a system that turns user-visible software behavior over time into **queryable, timestamped agent state**.

The core insight is simple:

**Coding agents are snapshot-bound.**
They usually see one screenshot, one DOM dump, one trace, one tool call at a time. Real UI failures often happen across time: transition glitches, flicker, delayed loading states, race conditions, state mismatches, overlapping animations, and visual regressions that cannot be understood from any single frame.

Reelink gives coding agents **temporal memory**.

It lets an agent reason over:
- a recorded video,
- aligned runtime/browser state,
- aligned React/component/source context,
- aligned network and console evidence,
- and later eval artifacts,
all bound to the same recording timeline.

That is the product.

---

## Core Product Thesis

A screen recording is not just evidence for a human.
It should become a first-class state object for an agent.

Reelink exists to answer questions like:
- What happened at 1.2 seconds?
- What did the user actually see?
- What DOM state existed near that moment?
- What component rendered that element?
- What source file and line likely caused it?
- What network or console events surrounded it?
- What did the agent attempt, and what happened after?

The product is valuable because it closes the gap between:
- **what happened visually**, and
- **what the code/runtime was doing at that time**.

This is what differentiates Reelink from screenshot tools, replay tools, generic browser MCPs, and generic bug-reporting tools.

---

## Product Layers

Reelink has three layers. All three are part of the intended product.

### Layer 0: Imported Video Analysis

A user provides a local `.mov`, `.mp4`, or `.webm` file.

Reelink analyzes it and returns structured findings, persisted to a recording package.

This is the **adoption wedge** because it works without requiring:
- app instrumentation,
- a browser extension,
- source access,
- or a pre-existing replay system.

Layer 0 proves immediate utility.

### Layer 1: Full Recording State Package

Reelink itself opens a browser session, records it, and captures timestamp-aligned artifacts alongside the video.

This is the **architectural unlock** and one of the core differentiators of the full product.

Layer 1 is where a recording stops being “just a video” and becomes a real state package.

### Layer 2: Agent Self-Recording

The agent drives the browser itself, while Reelink records the session and preserves the output as both:
- evidence of what the agent attempted,
- and the next observation surface for the agent.

This is the long-term agentic primitive.

---

## The Wedge vs The Product

The wedge is not the whole product.

The wedge is:
- paste a video,
- get a useful answer,
- persist a package,
- let the agent retrieve evidence.

The full product is:
- imported video analysis,
- browser-native recording,
- runtime/component/source correlation,
- agent self-recording,
- and trustworthy evidence/eval behavior.

Reelink should never be reduced to “AI bug reports.”
That framing is too narrow and undersells the long-term value.

At the same time, Reelink should not become so abstract that it stops being useful.
The wedge has to stay concrete and immediately legible.

So the correct framing is:

> Reelink is temporal memory for coding agents.
> Bug findings are the first WorkItem source, and WorkItems are the first public slice of a broader agent-readable work protocol.

---

## Primary User

The primary user is a developer using a coding agent such as:
- Codex,
- Cursor,
- Claude Code,
- Cline,
- Roo,
- VS Code Copilot,
- or another MCP-aware tool.

The user may be:
- investigating a visual bug,
- trying to understand what happened during a browser task,
- validating whether a fix changed behavior,
- or trying to hand better evidence to an agent.

A second-order user is a non-technical reporter or teammate who can provide a recording even if they cannot inspect the code.

---

## User Problems Reelink Solves

### 1. Motion bugs are hard to explain

Screenshots miss the failure.
A human can see the glitch in a recording but an agent cannot reason about it from a single frame.

### 2. Browser automation tools expose too much static state and not enough temporal state

The current loop is often:
- click,
- inspect DOM,
- inspect screenshot,
- click again,
- inspect again.

That loop is expensive, stale, and often misses causality.

### 3. Existing tools either require too much setup or solve the wrong problem

Many existing products require:
- an extension,
- a hosted replay platform,
- SDK instrumentation,
- or a vendor-specific workflow.

Reelink starts from a local recording and grows upward.

### 4. Agents need durable evidence, not just ephemeral observations

A recording package should be queryable after creation.
An agent should not have to recreate a browser state just to answer a follow-up question.

---

## Product Goals

### Goal 1: Make temporal UI evidence accessible to coding agents

The agent should be able to consume and reason over time-based UI evidence.

### Goal 2: Keep the public surface small and useful

The tool surface should be focused, path-oriented, and practical.

### Goal 3: Make the product usable from a real developer workflow

Install, setup, client registration, recording, analysis, retrieval, and follow-up should feel coherent.

### Goal 4: Make the evidence durable and honest

When data exists, preserve it.
When it does not, say so explicitly.
Never fabricate state.

### Goal 5: Evolve from wedge to primitive without changing the thesis

Imported videos, browser-native recording, and agent self-recording should all feel like the same product.

---

## Non-Goals

These are important because the transcript repeatedly pushed against drift.

Reelink is **not**:
- mainly a generic bug-reporting SaaS,
- mainly an MCP server wrapper,
- mainly a screenshot QA tool,
- mainly a company-brain product,
- mainly a patch generator,
- or mainly a browser automation product.

Reelink v0.x should **not**:
- silently downgrade the primary video path into frame-only behavior,
- fabricate DOM/component/network/console/eval evidence,
- require multiple user-registered MCP servers,
- require a browser extension for the core Layer 0 flow,
- or pretend support is broader than what has actually been verified.

---

## Public Concepts

These concepts should stay stable across docs, code, and product surface.

### Recording

A single captured or imported investigation unit.

### Recording Package

The persisted folder containing analysis and artifacts.

### Recording ID

The stable identifier used to retrieve artifacts later.

### WorkItem

The public structured output object that represents an actionable issue or unit of work discovered from the recording. In the intended end state, a `WorkItem` is not just a bug label, it is the first public slice of a broader agent-readable work protocol.

A WorkItem should be capable of carrying lifecycle semantics such as `detected`, `prepared`, `approved`, `routed`, `executed`, and `completed`, along with fields like `approval_state`, `routed_to`, and `completed_at`, even if early layers only populate a subset truthfully.

### Finding

A public-facing semantic concept representing what was detected. A `Finding` may remain the headline Layer 0 concept for compatibility or ergonomics, but the richer long-term product contract is the `WorkItem`.

If `findings` remains the public contract, `WorkItem` can still be the richer internal/stateful representation.
If both exist publicly, that must be explicitly documented as compatibility behavior, not an accident.

### Stream

A time-series artifact source such as frames, trace, network, console, component events, or eval evidence.

### Artifact

A concrete file in a recording package.

---

## Core Product Capabilities

## 1. Analyze imported videos

The user gives Reelink a local video file.
Reelink returns structured output and writes a recording package.

This capability must remain first-class.

## 2. Retrieve evidence by recording ID

Given a recording ID, the agent can retrieve:
- the nearest frame,
- a specific work item/finding,
- deterministic summary answers,
- and later richer runtime evidence.

Without this, the wedge stays one-shot and stops being useful.

## 3. Record a live browser session

Reelink can open a browser and capture the session to video.

This is a key step toward Layer 1.

## 4. Correlate browser/runtime evidence to time

The package should preserve aligned evidence so the agent can reason about what happened at a specific moment.

## 5. Expose browser control through the same MCP

Users register one MCP server: `reelink`.
Browser automation may be implemented through an internal child gateway or other internal architecture, but the user-visible surface must stay single-server.

## 6. Capture React/component/source context

Visible annotation, component/source mapping, and source path recovery are core parts of the intended product, not optional polish.

## 7. Preserve eval evidence truthfully

A recording should be usable as durable evidence even if deterministic test generation is not possible.

## 8. Support real onboarding and client setup

Init, doctor, client registration, and docs are part of the product surface.
They are not afterthoughts.

---

## Layer 0 Requirements

Layer 0 must:
- accept local video files,
- use the intended primary model path,
- return stable public structured output,
- persist analysis + package metadata,
- support deterministic follow-up retrieval,
- and fail honestly when configuration or provider support is wrong.

Layer 0 should not require:
- source code,
- browser automation,
- runtime traces,
- or app-specific setup.

---

## Layer 1 Requirements

Layer 1 must:
- create a browser recording package,
- persist video,
- persist trace/runtime/browser artifacts,
- support DOM/runtime/component retrieval,
- support visible react-grab behavior,
- support source mapping where possible,
- expose truthful stream statuses,
- and operate through the single-MCP user story.

Layer 1 is not complete if the code merely exists.
It is complete only when the runtime path is actually verified in a real supported app.

---

## Layer 2 Requirements

Layer 2 must:
- expose `reelink_run` as a real public workflow,
- record the agent’s browser activity,
- preserve partial failure evidence,
- return usable recent observation fields,
- and write durable eval evidence.

Layer 2 should not overclaim deterministic test generation if that capability is not actually implemented and proven.

---

## Model Strategy

The transcript made this clear:
- Qwen raw-video capability is a major reason the product exists in this form.
- The primary path should remain raw-video first where supported.
- Model-route validation must be real, not assumed.
- If the configured route cannot accept video, the product should fail clearly rather than silently degrade the primary product thesis.

A self-host fallback path may exist, but it is not the same thing as the primary supported path.

The product should keep a clean distinction between:
- primary provider path,
- optional fallback path,
- and roadmap provider support.

---

## Client Strategy

Codex is the canonical demo and onboarding client.

That does not mean Reelink is Codex-only.
It means:
- the best-supported first-class workflow should be proven through Codex,
- and other clients can be supported secondarily.

The product should eventually make client setup consistent and truthful across supported agents. Codex-native proof is part of the hackathon story, but the long-term end-state product must remain broader than Codex alone.

---

## Recording Package Expectations

A recording package should eventually be able to represent:
- imported video investigations,
- browser-generated recordings,
- agent-run recordings,
- and the relationships between them.

It should also be able to preserve the relationship between a recording and the `WorkItems` that emerge from it, so the package is not only evidence storage but a durable container for agent-readable work state.

It should preserve:
- artifact paths,
- stream availability,
- model/provider metadata,
- manifest semantics,
- and any honest uncertainty like unknown `prod_build`.

The manifest must be truthful.

---

## Documentation Expectations

A final open-source project should have docs that do three things:

1. explain the thesis clearly,
2. explain how to install and use the tool truthfully,
3. and separate shipped behavior from roadmap.

The transcript consistently pushed against fake certainty, fake support, and fake finish. The docs should reflect that.

At the same time, docs should not bury the user in internal planning chatter. The public repo should feel polished, not like a coordination dump.

---

## What the final open-source project should include

At minimum:
- clear README,
- license and attribution,
- install + setup path,
- real client onboarding,
- recording package semantics,
- public MCP contract,
- working Layer 0,
- verified Layer 1,
- truthful Layer 2,
- examples / integration docs,
- troubleshooting,
- and a stable release story.

---

## Definition of success

Reelink is successful when a developer can:

1. install it,
2. register one MCP,
3. record or import a real UI bug,
4. get back a stable, useful structured output,
5. retrieve evidence later by recording ID,
6. correlate what they saw to what the app/runtime was doing,
7. and let a coding agent act on that evidence.

The full version of success requires this across all three layers.

---

## Definitive product statement

> Reelink is temporal memory for coding agents.
> It turns screen recordings and browser sessions into queryable, timestamped state packages so agents can understand what happened over time, not just what one snapshot shows.

Everything else should serve that.
