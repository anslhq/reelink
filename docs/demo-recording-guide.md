# Demo Recording Guide

Operator runbook for capturing the Reelink demo `.mov` files. Follow top-to-bottom under hackathon time pressure. No voiceover. No commentary. Just clean visual artifacts that the Layer 0 `reelink analyze` wedge can convert into structured `WorkItem[]` output.

The primary recording is the founder's portfolio view-transition flicker (per `openspec/changes/build-reelink-mcp/design.md` Decision 8, lines 159–167). Two backups exist in case the live bug fails to reproduce or the portfolio is unreachable.

---

## 1. Pre-flight checklist

Have these ready before opening the recorder. If any line is unchecked, do not start recording — fix the gap first.

- [ ] **Recording tool installed and tested**
  - Preferred: ScreenStudio (cinematic cursor, automatic 1080p export)
  - Acceptable: CleanShot X (set Output → MP4, 30fps)
  - Fallback: macOS QuickTime (File → New Screen Recording, area-select)
- [ ] **Browser**: Chrome or Chromium-based (Edge/Arc/Brave OK). Safari skipped — DevTools throttling profiles differ.
- [ ] **DevTools open and configured** for the FOUC backup:
  - Network tab → Throttling → custom **"Slow 3G"** profile (download 500kbps / latency 400ms). Leave throttling **off** for the primary recording — view-transition flickers reproduce at native speed.
- [ ] **Portfolio URL** ready in clipboard: `____________________` (Harsha to fill — likely `https://harshavardhan.me` or whichever route deployed the broken view-transition).
- [ ] **Output target directory exists**:
  ```bash
  ls /Users/harsha/Developer/hackathon/reelink/demo-recordings/
  ```
  Should already contain `.gitkeep`. The folder is real.
- [ ] **Output filename**: `portfolio-view-transition.mov` for the primary. Do not rename later — the demo script and `STATUS_TRACKER.md` reference the exact path.
- [ ] **Final path** must end up at exactly:
  `/Users/harsha/Developer/hackathon/reelink/demo-recordings/portfolio-view-transition.mov`
- [ ] **Resolution**: 1280×720 minimum. 1920×1080 preferred (matches `scripts/generate-playwright-fixture.ts:13` viewport intent at 2× scale).
- [ ] **Frame rate**: 30 fps. Qwen3.6-flash samples at `default_fps_sample: 4` (see `reelink/src/cli.ts:97`), so 30→4 downsampling is safe.
- [ ] **Duration**: 6–15 seconds. Longer recordings spike the OpenRouter raw-video token cost without adding signal. Shorter than 6s misses the second navigation cycle.
- [ ] **No microphone**. The Layer 0 analyzer is visuals-only. Disable input capture in the recorder.
- [ ] **Browser window**: real-screen fullscreen (Cmd+Ctrl+F). Hide bookmarks bar (Cmd+Shift+B) and any extensions producing toasts.
- [ ] **System notifications silenced**: macOS Focus → Do Not Disturb on. AirDrop popovers and Slack toasts will end up in the frame.
- [ ] **Cursor visible**: ScreenStudio defaults to YES; QuickTime needs Options → "Show Mouse Clicks in Recording" enabled.
- [ ] **OPENROUTER_API_KEY present**:
  ```bash
  cat /Users/harsha/Developer/hackathon/reelink/.env | grep OPENROUTER_API_KEY
  ```
  Required for the post-recording validation step. If empty, the analyze command will fail before sending video.

**The single most important pre-flight check**: confirm Slow 3G throttling is **OFF** before recording the primary view-transition file. The flicker only reproduces at native speed.

---

## 2. Primary recording — portfolio view-transition flicker

Captures the bug from Decision 8: "the words here, they are not seamless". The old route's title remains painted while the new route's title fades in, producing a 1–2 frame overlap visible as text doubling.

**Sequence:**

1. Open Chrome. Open a new window (Cmd+N) so no other tabs leak into the recorder frame.
2. Paste the portfolio URL into the address bar. Press Enter.
3. Wait for the page to fully render (cursor idle, all images loaded).
4. **Hard refresh**: Cmd+Shift+R. This evicts any cached transition state.
5. Wait 1 second for steady state.
6. **Start the recorder**. ScreenStudio: Cmd+Shift+2 → select browser window. Save target = `portfolio-view-transition.mov`.
7. Hold for ~1 second of stable home-page idle (gives the analyzer a clear "before" frame).
8. **Click the link/button that triggers the buggy route transition** (Harsha names it — "Blog", "Projects", "About", whichever transition reproduces the overlap).
9. Wait ~1.5 seconds. The flicker happens in the first 200–400ms of the transition; the wait gives downstream verification frames.
10. **Click back** to home (browser back button or in-page nav).
11. Wait ~1 second.
12. **Click forward again** — second cycle. The two cycles give the VLM two independent samples of the same bug, raising confidence above the 0.5 threshold even if one cycle compresses oddly.
13. Wait 1 second after the second navigation completes.
14. **Stop the recorder.** Total duration ~7–10 seconds.
15. **Save / export to**: `/Users/harsha/Developer/hackathon/reelink/demo-recordings/portfolio-view-transition.mov`. Confirm the file exists with:
    ```bash
    ls -lh /Users/harsha/Developer/hackathon/reelink/demo-recordings/portfolio-view-transition.mov
    ```
    Expect 0.5–4 MB for 7–10s of 1080p H.264. If it's 50+ MB, the recorder used a near-lossless codec — re-export at standard quality.

**If the flicker doesn't reproduce on the recording:** check the actual `.mov` in QuickTime Player at 0.25× speed. The bug is real but subtle. If still invisible, fall through to backup #1.

---

## 3. Backup #1 — portfolio FOUC (green-overlay-before-main-shell)

Used when the view-transition bug fails to reproduce live (browser version drift, CSS feature-flag changes, etc.). Decision 8 names this as the explicit secondary.

**Sequence:**

1. Open Chrome. New window.
2. **DevTools (Cmd+Opt+I)** → Network tab → Throttling dropdown → select **"Slow 3G"**.
3. Confirm throttling is active: the dropdown should display "Slow 3G" and the Network tab will show a warning banner.
4. Navigate to the portfolio URL.
5. Wait for full render. (This is just to prime DNS/cert; the recording captures a refresh, not the cold initial load.)
6. **Start the recorder**. Save target = `portfolio-fouc.mov`.
7. Hold 1 second to capture the stable rendered state as a "before" reference.
8. **Hard refresh**: Cmd+Shift+R.
9. Hold the recording for the **entire** Slow-3G load (8–14 seconds). The green overlay flashes during the early HTML/CSS-only paint window before the main shell hydrates. Do not stop early.
10. Wait 1 second after the page is fully rendered and idle.
11. **Stop the recorder.** Total duration ~12–18 seconds.
12. **Export to**: `/Users/harsha/Developer/hackathon/reelink/demo-recordings/portfolio-fouc.mov`.
13. **Disable Slow 3G** afterward (Throttling → "No throttling") so the next recording isn't accidentally throttled.

---

## 4. Backup #2 — sample-buggy-app modal animation glitch

Used when both founder-portfolio recordings fail (network down, site offline, browser version drift, etc.). This requires `samples/buggy-app/` to exist — at the time of writing, that directory is **not** scaffolded in `/Users/harsha/Developer/hackathon/`. If you reach this fallback, you'll need to either spin up the sample or skip to a synthetic Playwright fixture (see Section 6).

**Assumed setup (verify before recording):**

- `samples/buggy-app/` exists at the repo root and is a Vite or Next.js dev server.
- Branch checked out: `bug-1-modal-animation` (deliberate animation-timing glitch on modal close).
- Dev server up at `http://localhost:3000` with the modal trigger reachable from the home page.

**Sequence:**

1. Start the dev server in a separate terminal:
   ```bash
   cd /Users/harsha/Developer/hackathon/samples/buggy-app
   git checkout bug-1-modal-animation
   bun install && bun run dev
   ```
2. Wait for the server to print its ready URL. Open `http://localhost:3000` in Chrome.
3. Wait for full hydration (no React warnings in console).
4. **Start the recorder**. Save target = `sample-buggy-app-modal.mov`.
5. Hold 1 second of stable home-page idle.
6. **Click the modal trigger** (button label TBD — name it on the dev server's home page).
7. Wait for the modal to fully open (~600ms).
8. **Click the modal's close button.** The animation glitch happens in the close handler — the modal collapses to half-height before snapping shut, or the backdrop fades faster than the content (depends on the exact bug branch).
9. Wait ~1.5 seconds for the post-close animation residue.
10. **Re-open the modal** for a second cycle.
11. **Close it again** to give the VLM two independent samples.
12. Wait 1 second.
13. **Stop the recorder.** Total duration ~8–12 seconds.
14. **Export to**: `/Users/harsha/Developer/hackathon/reelink/demo-recordings/sample-buggy-app-modal.mov`.

**If `samples/buggy-app/` does not exist**: stop here, escalate to team-lead, or pivot to running `bun run smoketest:recording` (see Section 6) which produces a synthetic Playwright fixture demonstrating the same view-transition pattern as the primary.

---

## 5. Validation step (run after every recording)

Confirms the recording is analyzable end-to-end before the demo locks. Per Decision 8: "Validate at least one produces a structured finding via the Layer 0 wedge before locking the demo script."

**Run:**

```bash
cd /Users/harsha/Developer/hackathon/reelink
bun run src/cli.ts analyze demo-recordings/portfolio-view-transition.mov "view-transition flicker"
```

(Substitute `portfolio-fouc.mov` / `"hard-refresh FOUC"` or `sample-buggy-app-modal.mov` / `"modal close animation"` for the backups.)

**Expected output shape** (per `reelink/src/schemas/layer0.ts:5–27`):

```json
{
  "recording_id": "<sha-or-uuid>",
  "duration_sec": 8.4,
  "summary": "<one-sentence VLM description>",
  "work_items": [
    {
      "id": "<id>",
      "ts": 2.1,
      "type": "view-transition-overlap",
      "severity": "medium",
      "title": "Old route title overlaps new page title during navigation",
      "confidence": 0.72,
      "description": "...",
      "state": "detected",
      "approval_state": null,
      "routed_to": null,
      "completed_at": null,
      "source": "video",
      "intent": "fix"
    }
  ],
  "next_steps": ["..."]
}
```

**What to look for:**

- `work_items` is a non-empty array.
- At least one item has `state: "detected"`.
- At least one item has `confidence > 0.5`.
- The `type` and `title` mention the bug class (transition / flicker / overlap / FOUC). The exact strings vary by VLM prompt run; a `confidence > 0.5` finding whose `title` references the visible bug class is a pass.

**Failure modes:**

| Symptom | Likely cause | Remediation |
|---|---|---|
| `work_items: []` (no findings) | VLM didn't see the bug; recording too short, too long, or bug compressed out of the sampled frames | Re-record at higher resolution (1920×1080), keep duration 6–10s, ensure the bug is visible at native playback speed in QuickTime first |
| All findings have `confidence < 0.5` | VLM is uncertain — bug too subtle or too brief | Re-record with two full nav cycles instead of one. Slow down the click cadence so each transition has clean before/after frames |
| `work_items[*].type` is unrelated (e.g., "layout-shift" when the bug is a flicker) | VLM picked a different visible artifact | Tighten the `focus` argument: `bun run src/cli.ts analyze <file> "transition flicker text overlap during route change"` |
| Command errors before VLM runs (`OPENROUTER_API_KEY missing`) | `.env` not populated | `cp .env.example .env` then fill `OPENROUTER_API_KEY` per `reelink/README.md:24` |
| Command errors with "model does not advertise video" | OpenRouter model catalog flapped or `qwen/qwen3.6-flash` was removed from the route | Re-check the OpenRouter live catalog; smoketest:gateway prints the failing assertion. Fall back to a documented alternate raw-video model if needed (escalate to team-lead) |
| File too large (>20MB) and analyze times out | Recorder used a near-lossless codec | Re-export at H.264 standard quality, or run through ffmpeg: `ffmpeg -i input.mov -c:v libx264 -crf 23 output.mov` |

If the primary recording fails validation but a backup passes, **rename the passing backup**:

```bash
cd /Users/harsha/Developer/hackathon/reelink/demo-recordings
mv portfolio-fouc.mov portfolio-view-transition.mov  # or: mv sample-buggy-app-modal.mov ...
```

The demo script references the canonical filename, not the underlying bug.

---

## 6. Storage notes

- The `reelink/.gitignore` excludes recorded artifacts: `*.mov`, `*.mp4`, `*.webm` are gitignored on lines 9–11 with an explicit `!demo-recordings/.gitkeep` allow on line 12. `*.reelink/` sidecar folders are excluded on line 8. Recordings stay local. Do not commit them.
- The current state of `reelink/demo-recordings/` already contains a Playwright-generated `.webm` fixture (`page@<hash>.webm`, ~570 KB) from a prior smoketest run. That file is gitignored and harmless — leave it alone. It is **not** the demo artifact.
- **Synthetic fixture fallback**: if all live recordings fail, run:
  ```bash
  cd /Users/harsha/Developer/hackathon/reelink
  bun run smoketest:recording
  ```
  This regenerates a fresh synthetic `.webm` via `scripts/generate-playwright-fixture.ts`. The script renders an HTML shell with a deliberate view-transition flicker (see `scripts/generate-playwright-fixture.ts:35–41`) and produces output at `demo-recordings/page@<hash>.webm`. It's a smoketest fixture — explicitly **not** the demo artifact per `openspec/changes/build-reelink-mcp/design.md:24` — but it demonstrates the same bug class and validates the analyze pipeline end-to-end if the live recording falls through.
- **Proposed change (do not execute)**: if we later decide to ship a sample recording with the repo for offline reproducibility, candidates are a ≤2 MB H.264 `sample.webm` under `reelink/demo-recordings/sample.webm`, allow-listed via a new line in `reelink/.gitignore`:
  ```
  !demo-recordings/sample.webm
  ```
  This keeps the rest of `*.webm` excluded while shipping one canonical sample. **Do not edit `.gitignore` as part of this prep task.** Surface the proposal to team-lead first.

---

## 7. Accessibility & polish notes for the 2-minute submission video

The submission-pack track produces the 2-minute hackathon video later — these recordings feed into it. Capture them with the submission video in mind:

- **Cursor visibly tracked**: viewers must see what the founder clicks. ScreenStudio's auto-zoom-to-cursor is fine; QuickTime's "Show Mouse Clicks" is mandatory.
- **No microphone audio**. The 2-minute voiceover is added in post by the submission-pack track. Audio in the source `.mov` interferes with later edit decisions.
- **Screen brightness at max** during recording: prevents dim-monitor patches in the encoded video.
- **Browser fullscreen** (Cmd+Ctrl+F): maximizes the bug's visual prominence and mimics the real user UX. Half-window recordings telegraph "demo footage" instead of "product moment".
- **No DevTools panel visible** in the primary recording. The view-transition bug should look like a real-world user encounter, not a debugging session. (DevTools is necessary for the FOUC backup because Slow 3G must be visibly on — that's fine, FOUC backup is shown only if needed.)
- **No browser extensions**: hide React DevTools, Vue DevTools, AdBlock badges, anything that flickers in the toolbar.
- **No stale tab badges**: close all unread Slack / Linear / Gmail tabs in the recording window.

---

## 8. Quick-reference command block

Paste-ready for a terminal during recording prep:

```bash
# Confirm prereqs
ls /Users/harsha/Developer/hackathon/reelink/demo-recordings/
cat /Users/harsha/Developer/hackathon/reelink/.env | grep OPENROUTER_API_KEY

# After recording, validate primary
cd /Users/harsha/Developer/hackathon/reelink
bun run src/cli.ts analyze demo-recordings/portfolio-view-transition.mov "view-transition flicker"

# After recording, validate FOUC backup
bun run src/cli.ts analyze demo-recordings/portfolio-fouc.mov "hard-refresh FOUC overlay"

# After recording, validate sample-app backup (if scaffolded)
bun run src/cli.ts analyze demo-recordings/sample-buggy-app-modal.mov "modal close animation glitch"

# Fall-through: regenerate synthetic Playwright fixture if all live recordings fail
bun run smoketest:recording
```

---

**Stop conditions**: If after three primary recording attempts the view-transition flicker still fails to reproduce, do not keep retrying. Pivot to the FOUC backup. If the FOUC backup also fails, escalate to team-lead with: which step failed, the actual `.mov` file, and the analyze command output.
