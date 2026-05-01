# Reelink — Competitive Analysis & Advancement Probability

**Source:** Reddit r/codex Sydney Hackathon Entries thread (`1synu8q`), 69 raw posts → ~50 unique projects after dedupe. Captured 2026-04-29 ~17:30 AEST shortly after entries closed.

**This file is gitignored** (`.gitignore` line 19). Not for the public repo.

---

## 1. The brief (re-anchor)

From the morning briefing:
> "Why are you going to build what was practically impossible before Codex?"

Judging rubric:
1. **Clarity of idea**
2. **Technical execution**
3. **Completeness**
4. **Impact / insight** (positive social impact considered)
5. **Creative / correct uses of Codex**

5-hour build window. Hard 5pm submission deadline. Public GitHub + 2-min demo video required.

---

## 2. Field overview — ~50 unique submissions

**Codex-on-Codex tooling (12)** — meta-tools that improve coding-agent workflows. This is the densest category, which means competition for "creative use of Codex" credit is fierce here:
- TrustMeBroChecker (PR review with reasoning)
- Multiplayer Codex (collaborative agent sessions)
- AI Cursor Buddy
- BetterReview (reviewable PRs)
- Compliance Codex (parallel subagents for GDPR/Privacy)
- Review Room (voice agent for PR reviews)
- Scout (eval layer for AI-written code)
- Product Warden
- CONDUCTOR (orchestration layer for "Symphony")
- Agenthub (collaborative agent community)
- CoCanvas (live canvas for Codex)
- Where's Codex?!

**Civic / social-impact (8)** — the only category that gets the explicit social-impact bonus the brief mentions:
- STRUXO — NSW DA (Development Application) screener for builders
- AccessMate — VoiceClaw for NDIS (disability)
- Civic Aid AI Platform
- CivicForge — civic org dark-factory sites
- CrowdPulse
- TTS Reader for blind/visually impaired
- CareWalk — Meta AI Glasses copilot for social workers
- AI-ATC — air traffic control automation

**Agent infrastructure / memory (6)** — Reelink's category:
- **Reelink** (you) — temporal memory for coding agents via video
- **Signal Recycler** — "Durable Project Memory for Codex" (DIRECT positioning overlap)
- .loopthing — file format for AI work loops
- OpenIdeas — signal-to-product pipeline from X bookmarks
- Alfred — proactive background agent
- Mira — agentic product release demo (has live prod URL)

**Vertical SaaS built with Codex (10)** — these answer "build a thing with Codex" but probably do NOT answer "couldn't be built before Codex":
- OfferPilot (job search)
- ReceiptDesk (expense org)
- FluxReader (e-book reader)
- BioStream
- PersonaLense (market validation)
- ChronoLens (cultural learning)
- PocketMentor
- Quorum (multi-AI deliberation)
- Plywood
- DreamPanel (deploy websites in minutes)

**Creative / games (5):**
- Codex modded into Pokemon Emerald + Zelda Ocarina of Time (Hamish Bultitude)
- Alpha7 Tanks Battle Royale
- Dreamwalk (voice-driven generated worlds)
- Drawn To Story (jane_ara)
- Primer (visual learning for students)

**Other (9):** ARchitect, OpenPrax, nanaOS design system, Agent Zero (just-in-time AWS perms broker), SecurityDex (continuous pentesting), CodexSuccessOS, CoCraft, TrustLens (live app at trustlens.z2hs.au), Taico (Symphony implementation).

---

## 3. Top 10 most likely to advance (best-guess ranking)

| Rank | Project | Author / Team | Why it's a threat |
|---|---|---|---|
| 1 | **Codex Pokemon/Zelda mod** | harboursideapps / Hamish Bultitude | Highest novelty + visual-demo charisma. Judges remember it. Hard not to advance regardless of code depth — the *concept* is unforgettable. |
| 2 | **Compliance Codex** | Nice_Taste4891 / Hormuz | EXPLICITLY uses 3 Codex subagents in **parallel git worktrees** (the Codex-native flex the brief asked for) + maps to Australian Privacy Act + GDPR (regulatory weight). This nails 4 of 5 criteria. |
| 3 | **STRUXO — NSW DA Screener** | DhrubBiswas (solo) | Direct NSW-government social impact, real builder use case, real regulatory domain. Strong AU-local relevance. |
| 4 | **AccessMate — VoiceClaw for NDIS** | Shoddy_Menu8542 / EAI Wizards | NDIS = Australian National Disability Insurance Scheme. Strong social-impact bonus + assistive-tech narrative. |
| 5 | **Multiplayer Codex** | cognnart / Multitaskers | Codex-native flex (multiplayer = unprecedented Codex pattern). The OpenAI product team will care. |
| 6 | **Scout — Eval Layer** | Background_Daikon976 | "Verify AI-written code before you trust it" — clean wedge in a hot space. **Same name as agno-agi/scout from morning briefing — could be Ashpreet's team that shipped this in <8h.** |
| 7 | **Signal Recycler** | surely_confused / AI-pacas | "Durable Project Memory for Codex" — **direct positioning collision with Reelink's temporal-memory pitch.** Need to watch their video to know if their build is shallow or solid. |
| 8 | **AI-ATC** | SignificantFrame6115 | High-stakes, dramatic demo (air traffic control). Judges remember theatrical demos. Probably toy-quality build but undeniable theater. |
| 9 | **Reelink** | nich-lx / Ansl AI (you) | Working v0.1: video → WorkItem MCP, deterministic retrieval (12 query patterns), record CLI, bun-link global binary, Codex-as-client setup-prompt. Strong on tech execution + clarity. Audio quality on demo video is the visible weakness. **No social-impact angle now (correctly removed).** |
| 10 | **CONDUCTOR** | nickbeau5 / Released | "Orchestrator layer for Symphony" — Symphony framing implies serious infra ambition. Likely deep build. |

**Other strong watch-list:** TrustMeBroChecker, Mira (live prod URL = completeness signal), Quorum (multi-agent deliberation), TrustLens (live deployed app), Civic Aid AI, Conductor.

---

## 4. Reelink scored against the brief criteria (CORRECTED — no NSW)

| Criterion | Score (1-10) | Reasoning | Field-leader on this axis |
|---|---|---|---|
| **Clarity of idea** | **8** | "Temporal memory for coding agents." Sharp, one-line. README opens with the wedge. | Compliance Codex / Scout (also one-line clarity) |
| **Technical execution** | **9** | Real MCP server. Deterministic retrieval (12 patterns). Real Qwen3.6-flash video round-trip via OpenRouter. `bun link` global binary. Apache 2.0 + NOTICE attribution. OpenSpec planning visible in repo. `reelink record <url>` CLI subcommand. | Compliance Codex (parallel-worktree implementation) |
| **Completeness** | **7** | Layer 0 + retrieval + record CLI shipped. Layer 1/2 honestly framed as roadmap in README. Demo video exists. Public repo. | Mira (live prod URL), TrustLens (live app at trustlens.z2hs.au) |
| **Impact / insight** | **5** | Generic value across motion bugs in any web app. **No social-impact angle** (NSW line removed — was incoherent). | STRUXO (NSW gov), AccessMate (NDIS), TTS Reader (visually impaired), Civic Aid AI |
| **Creative / correct use of Codex** | **6** | Codex-as-client setup-prompt (`docs/setup-prompt.md`). README explicitly answers the brief's "couldn't be built before Codex" question. **Codex-native flex (parallel sub-agents on worktrees, App Server `turn/steer`) is documented in `docs/codex-demo-script.md` but NOT implemented.** | Compliance Codex (built it), Multiplayer Codex (multiplayer is unprecedented Codex pattern), CONDUCTOR (orchestration) |

**Net Reelink score: 35/50** (was 38/50 before correctly removing the NSW impact claim)

**Strong on tech execution + clarity. Two visible gaps:**
- **Impact/insight (5/10):** zero social-impact narrative. Pure dev tool. Acceptable for the brief (the word is "considered," not "required") but loses ground to STRUXO/AccessMate/TTS Reader.
- **Creative-Codex (6/10):** the worktree + parallel-subagent flex is documented but unbuilt. Compliance Codex shipped this exact thing.

---

## 5. Probability of advancing to next round

**MEDIUM (40-60%) — most-likely point estimate ~50%.**

### Why not higher
- Pokemon mod and Compliance Codex both have stronger judge-bait than Reelink. Pokemon = unforgettable novelty; Compliance Codex = literal Codex-flex + regulatory weight.
- **Signal Recycler's "Durable Project Memory for Codex"** is dangerously close to our "temporal memory for coding agents" pitch. If their build is solid, judges may see them and Reelink as redundant alternatives, splitting the vote.
- **Scout's name collision** with the morning brief's agno-agi/scout reference is real. If that's Ashpreet's team, they shipped a competing "verify Codex output" angle in under 8h. Their experience advantage is real.
- The social-impact criterion goes to STRUXO/AccessMate/TTS Reader cleanly. Reelink can't compete on that axis.

### Why not lower
- Most of the 10 "vertical SaaS" submissions don't pattern-match the "couldn't be built before Codex" brief. They built *with* Codex, not *because of* Codex. Reelink has a better story here than half the field.
- Reelink's *technical* execution (real MCP server, deterministic 12-pattern retrieval, native-video VLM, dual-client setup-prompt for Codex AND Cursor, public Apache 2.0 + NOTICE) is in the top quartile of the field.
- Audio quality on the demo video is a fixable submission-presentation problem, not a project problem. Re-uploading with cleaner audio + pinning a redirect comment costs ~15 min.
- Reelink's depth signal (OpenSpec planning visible, working CLI + MCP + record loop, persistence, schema lifecycle) is beyond what most 5-hour builds achieve. Judges who actually open the repo will see real engineering.

### Sensitivity analysis
- **If Signal Recycler video is shallow:** Reelink's probability bumps to **55-65%** (uncontested temporal-memory positioning).
- **If Signal Recycler video is solid:** probability drops to **35-45%** (split vote in our category).
- **If we ship the Codex-native parallel-subagents flex as a follow-up commit before judging:** probability bumps to **55-70%** (closes the Compliance Codex gap on creative-Codex).
- **If audio re-upload happens:** +5pp in either direction (modest, but real).

---

## 6. Specific competitor signals worth verifying

These three are the highest-information watches. Each takes ~5 min to evaluate (skim repo + watch first 30s of video).

### Signal Recycler (`vivekmaru/Signal-recycler`)
- **Why it matters:** direct positioning overlap with Reelink. "Durable Project Memory for Codex" vs our "temporal memory for coding agents."
- **What to check:** is "memory" video-based (collision) or session/conversation-based (orthogonal)?
- **Outcome flags:**
  - If session/text-based memory → DIFFERENT product, Reelink stays distinct. Probability bumps up.
  - If video-based or screen-recording-based → DIRECT competitor, judges may see them as alternatives.

### Compliance Codex (`james-heidi/openai-hormuz`)
- **Why it matters:** literal Codex-native flex (3 parallel subagents on worktrees) + regulatory framing. The thing we documented but didn't ship.
- **What to check:** is the worktree-parallel-subagent flow real and demoable, or is it a README claim with toy execution?
- **Outcome flags:**
  - If real and demoable → strongest competitor on creative-Codex axis. Cannot beat them on that criterion.
  - If toy/scripted → Compliance Codex moves down, Reelink moves up.

### Codex Pokemon/Zelda mod (`hami-sh/codex-retro-hackathon-2026`)
- **Why it matters:** novelty + visual-demo charisma. Judges remember it regardless of build depth.
- **What to check:** is it actual Codex integration into the games (RAM patching, tool-use over Lua scripts) or is it just "Codex helped me write a Pokemon mod"?
- **Outcome flags:**
  - If real Codex-controlling-game-state integration → top-3 lock, can't beat on novelty.
  - If "Codex wrote my mod code" → less Codex-native than the framing suggests, threat drops.

### Honorable mentions worth a 60-second look
- **Mira** (`qave-chat/mira`) — has live prod URL `mira.qave.dev`. Completeness signal. If polished, top-5 lock.
- **TrustLens** (`PatrickTHZ/TeamOpenSpot-OpenAIHackathon`) — has live app at `trustlens.z2hs.au`. Same logic.
- **Scout** (`esreekarreddy/scout`) — confirm whether this is Ashpreet's agno-agi team or a different "scout" project.
- **Multiplayer Codex** (`rayzhudev/codex`) — if it's truly multiplayer (concurrent agents in a single Codex session), it's the most Codex-native concept in the field.

---

## 7. Top 3 action items in next 6-12 hours (ranked by leverage)

### 1. Re-upload demo video with cleaner audio + pin redirect comment on original
- **Cost:** ~15 minutes (Adobe Podcast Enhance is free, takes 3 min for a 2-min clip)
- **Impact:** +5pp probability. Single biggest avoidable point loss is judge bouncing in the first 10 seconds because audio is bad.
- **How:** YouTube Studio → original video → pin top comment with new URL + add link to top of description. Don't edit submission unless form is still open.

### 2. Watch the 3 highest-information competitor videos (Signal Recycler, Compliance Codex, Pokemon mod)
- **Cost:** ~15-20 minutes
- **Impact:** updates this analysis with real signal. Specifically resolves whether Signal Recycler is a direct competitor.
- **How:** open YouTube links from §6, watch first 30-60 seconds of each.

### 3. (OPTIONAL — only if currently testing already passes) Ship the Codex-native parallel-subagents demo as a follow-up commit
- **Cost:** ~30-45 min if the skeleton in `docs/codex-demo-script.md` is paste-ready
- **Impact:** +10-15pp on creative-Codex axis. Bumps Reelink from 6/10 → 9/10 on that criterion. **Judges check repos during judging, not just at submission.**
- **Risk:** could break current testing flow if you have an agent actively working on `main`. **Coordinate with whatever agent is currently developing before touching anything.**
- **How:** the skeleton is at `docs/codex-demo-script.md`. Make it `reelink/scripts/demo-codex.ts`. Commit + push.
- **DO NOT do this without coordinating** — there's an active development agent and the user explicitly said "don't touch the current code base."

---

## 8. What we know we DON'T know

- We haven't actually watched any competitor demo video. All scoring above is from the headline pitch in their Reddit post + repo-name signal. The §6 verifications would refine this materially.
- We don't know judging weighting. The brief lists 5 criteria but doesn't say each is 20%. Some hackathons weight "creative use of {sponsor}" 40%, others 10%.
- We don't know how many advance. Some Codex hackathons advance top 3, some advance top 10. Sydney's number is unknown to us.
- We don't know whether judges open repos or only watch videos. Affects whether the OpenSpec depth + working CLI matters at first-cut judging.
- We don't know the OpenAI judges' personal biases. The product team will reward Codex-native creative use; ANZ business team may reward AU social impact more.

---

## 9. Bottom line

**Reelink's probability of advancing: ~50%, range 35-65% depending on competitor depth and submission-quality fixes.**

You built a real thing. The repo is clean, public, Apache-2.0, with working demos and honest scoping. Top-quartile technical execution.

The two structural gaps (no social impact, creative-Codex flex documented-but-unshipped) are not fatal — they're just where probability gets eaten. Half the field has worse technical execution. The Pokemon mod, Compliance Codex, and possibly Signal Recycler are the real threats; everything else is roughly peer or weaker.

**The single highest-EV action right now is re-uploading the demo video with cleaner audio.** Do that before anything else.
