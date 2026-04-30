# Issues to Fix — post-submission cleanup

**Status:** captured 2026-04-29 after the public-repo scrub. The README, LICENSE, NOTICE are clean. Public-facing top-level surface looks good. Everything below is what *survived* the scrub and is now visible in the public repo at https://github.com/anslhq/reelink.

This doc is gitignored. Not for the public repo. Working notes only.

---

## Issue 1 — `docs/setup-prompt.md` leaks internal state

**Severity:** HIGH (README links to it as the install path)

- Line 8, 26, 35, 42, 50, 170: hardcoded `/Users/harsha/Developer/hackathon/reelink/...` paths that won't exist on a public clone
- Line 189: `Slack \`#codex-hackathon\`` reference
- Line 206: "Faction A's work" coordination leak

**Fix:** replace hardcoded paths with `<reelink-repo>/` placeholder, drop Slack line, replace "Faction A's work" with neutral language ("the retrieval tools").

---

## Issue 2 — `docs/integration-testing-runbook.md` leaks personal context

**Severity:** HIGH (linked from README)

- Line 3: "Harsha's personal portfolio repo on the MacBook"
- Line 7: "Mac Studio" reference + "synthetic Playwright fixture on Mac Studio"
- Lines 13, 24, 32, 43, 65: hardcoded `/Users/harsha/Developer/hackathon/reelink/...`
- Line 177: "Faction A is fixing this in P1A.0"

**Fix:** rewrite preamble in second-person ("you wire Reelink into your repo"), drop Mac Studio sentence, replace paths with placeholder, drop the Faction-A line.

---

## Issue 3 — `docs/demo-recording-guide.md` leaks paths + personal app references

**Severity:** MEDIUM (not linked from README but discoverable)

- Lines 23, 28, 38, 66, 68, 93, 100: hardcoded `/Users/harsha/Developer/hackathon/...` 6x
- Line 34: "Slack toasts will end up in the frame"
- References to specific portfolio bug (`portfolio-view-transition.mov`, `portfolio-fouc.mov`) that imply personal use

**Fix:** generalize paths, drop Slack line, frame as "your bug recording" rather than naming specific portfolio files.

---

## Issue 4 — `docs/cdp-gateway-pattern.md` heavy faction language

**Severity:** MEDIUM

- Lines 1, 3, 244, 250, 406, 473, 475: "Faction B" 5x, "Phase 1" framing
- Reads like a hand-off doc, not a public spec

**Fix:** rewrite header as "CDP-attach Gateway Pattern (v0.2 roadmap)". Replace "Faction B copies these into..." with "Layer 1 implementation places these in...". Drop coordination-with-faction-A asides.

---

## Issue 5 — `docs/codex-demo-script.md` faction language throughout

**Severity:** MEDIUM

- Lines 5, 210, 530, 545, 631, 686, 687, 690: "Faction A" / "Faction B" 7x
- Line 686: "ask in the OpenAI dev channel" — implies access to a private channel
- Line 687: "the only file present in `reelink/demo-recordings/` is `page@469cd67be477...webm`" — references a fixture that no longer exists in the public repo

**Fix:** strip faction language. Replace "Faction A: ask in the OpenAI dev channel" with "Resolve by running `codex models` locally". Update the demo-recordings reference to reflect what's actually in the published repo.

---

## Issue 6 — `docs/layer1-recording-skeletons.md` faction language

**Severity:** LOW-MEDIUM

- Lines 554, 812, 814, 815: "Faction B" 4x, "Open questions for Faction B" header

**Fix:** rename "Open questions for Faction B" → "Open questions for Layer 1 implementers". Replace "Faction B needs to decide..." with "Implementers need to decide...".

---

## Issue 7 — `docs/reelink-query-algorithm.md` Slack + faction + path leaks

**Severity:** MEDIUM

- Line 9: "the Slack task named `page-469cd67be477...`, but that folder was not present in the local repo"
- Line 126: "Faction A should add read-only helpers"
- Line 472: hardcoded `/Users/harsha/Developer/hackathon/reelink/demo-recordings/...` in an example JSON

**Fix:** drop the Slack-task preamble entirely, replace "Faction A should add" with "Implementation should add", change example path to a placeholder.

---

## Issue 8 — `docs/workitem-schema-validation.md` "Faction B prep" framing

**Severity:** MEDIUM

- Line 3: opening sentence "Faction B prep, read-only review of the Phase 0 `Finding → WorkItem` rename"
- Lines 133, 171, 196, 198, 202, 206: "Faction A" 6x

**Fix:** rewrite opening as "Adversarial review of the WorkItem schema rename". Replace all "Faction A" with neutral language ("Layer 1 implementation", "future contributors", etc.). Keep the technical content — it's good.

---

## Issue 9 — `openspec/changes/build-reelink-mcp/tasks.md` "Current State" block is stale + leaks

**Severity:** HIGH (this is the canonical project status that judges may read)

- Lines 1-37: entire "Current State (auto-updated 2026-04-29 ~15:58 AEST)" block:
  - Says P1A is "🟡 IN PROGRESS, Cursor agent on `feat/faction-a-retrieval-devx` branch, just unblocked from rebase. Expecting first commits ~16:15 AEST." — actually **shipped** as commit `f465325`.
  - Says P1B is "Harsha needs to execute Steps 4-7 to capture the portfolio bug video" — implies in-progress, but submission is already done.
  - Says P2 is "Faction B not spawned" — internal coordination leak, branch no longer exists.
  - Says P1B.5 is "BLOCKED on P1A.4" — P1A.4 shipped.
  - References `~30 min from now` and `bun run reelink/src/cli.ts analyze` (old invocation, now `reelink analyze` via linked binary).
- Lines 32-36 "Active Risks" section references "Faction A retrieval helpers" and "P1A.0 (pre-retrieval) fix proposed" — Risk #3 was **already fixed** at commit `8647ebe`.
- Body of file (P1A section, line 99): "Owner: Faction A (Cursor agent on `feat/faction-a-retrieval-devx`). Status: IN PROGRESS as of 16:00 AEST."
- Body (P1B section, line 117): "Owner: Harsha (manual capture + verification on the MacBook)."

**Fix:** rewrite the "Current State" block as a static post-hackathon snapshot ("v0.1 Submitted 2026-04-29 to OpenAI Codex Hackathon Sydney"). Update task checkboxes to reflect what actually shipped. Strip Faction/MacBook/AEST references throughout. Replace stale `bun run reelink/src/cli.ts` invocations with `reelink` (the linked binary).

---

## Issue 10 — `openspec/changes/build-reelink-mcp/design.md` Decision 12 cites stale CLI path

**Severity:** HIGH (Decision 12 is the formal record of how Codex onboarding works)

- Line 199: Decision 12 says the setup-prompt makes Codex "write a `[mcp_servers.reelink]` block into `~/.codex/config.toml` referencing **`bun run /Users/harsha/Developer/hackathon/reelink/src/cli.ts mcp` with absolute bun path**"
- Reality: Decision 12 was implemented with `command = "reelink-mcp"` after `bun link` (commit `2b36e40`). The new `setup-prompt.md` does NOT reference `bun run cli.ts` — it uses the linked binary.
- Also: "without touching `reelink/src/`" — the touched-no-src constraint was a Phase 0 internal scaffolding rule, not a property of the design itself.

**Fix:** rewrite Decision 12 to match reality (`command = "reelink-mcp"`, post-`bun link`, paths described as `<reelink-repo>` placeholder).

---

## Issue 11 — `tasks.md` body has duplicate/old content

**Severity:** LOW

- Many tasks marked `[ ]` are actually shipped (P1A.1-P1A.5b retrieval, P1B.1-P1B.4a integration testing).
- Some tasks marked "[Defer]" or "[v0.2 stretch]" are misleading because they ARE deferred but the formatting suggests in-flight work.
- `reelink record <url>` CLI command is **not in tasks.md at all** — shipped at `fdaa998` without spec coverage.

**Fix:** mark shipped tasks as `[x]` with commit references. Add a P1B task for `reelink record <url>` with completion marker.

---

## Issue 12 — Working tree has stale gitignored files on disk

**Severity:** LOW (not visible to public, just cleanup)

Local Mac Studio working tree has these untracked-or-gitignored leftovers from before the scrub:
- `.cursor/` directory
- `cursor_general_chat_introduction.md`
- Other planning artifacts that no longer exist in tracked tree

**Fix:** optional `rm -rf .cursor cursor_general_chat_introduction.md PHASE_PLAN.md HACKATHON_*.md STATUS_TRACKER.md compass_artifact_*.md UBIQUITOUS_LANGUAGE.md RECONCILIATION_*.md FALLOW_POLICY.md skills-lock.json` to match the public repo state. Not strictly necessary since they're gitignored.

---

## Recommended fix order (if we proceed)

1. Issue 9 — `tasks.md` Current State block (highest visibility — judges will look)
2. Issue 10 — `design.md` Decision 12 (factual incorrectness)
3. Issue 1 + 2 — `setup-prompt.md` + `integration-testing-runbook.md` (linked from README)
4. Issue 3 — `demo-recording-guide.md`
5. Issues 4-8 — forward-looking spec docs (lower priority but worth doing)
6. Issue 11 — tasks.md body checkbox sync
7. Issue 12 — local working tree cleanup (optional)

Each as a separate atomic commit so the history is reviewable.

---

## What is NOT an issue

- README, LICENSE, NOTICE — all clean post-cleanup commit.
- Code in `reelink/src/` — clean, no internal references.
- `proposal.md` — neutral language throughout (already updated to mention setup-prompt + runbook).
- The forward-looking spec content itself (Layer 1 / Layer 2 designs) — technically sound, just needs neutral framing.
