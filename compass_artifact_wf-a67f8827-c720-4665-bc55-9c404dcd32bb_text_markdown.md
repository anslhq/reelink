# Ansl AI - OpenAI Codex Hackathon Sydney PRD, Dev Plan & Execution Brief

**Event:** OpenAI Codex Hackathon Sydney - April 29, 2026, 9:50 AM doors close, ~7 PM submission
**Team:** Ansl AI (Harsha, Sydney) - 3 Codex Pro plans
**Track:** Multimodal Intelligence
**Build window:** 6.5 hours, on-site, public GitHub repo + 2-minute demo video required

---

## 0. Executive summary (the pitch)

We're shipping a local-first MCP server plus Codex skill that turns any screen recording of a UI bug into a fixed pull request with a Playwright regression test attached. A designer drags a `.mov` from Loom or QuickTime onto Codex CLI, and Codex spawns three subagents in parallel git worktrees: one runs frame extraction plus GPT-5.4-mini vision to identify the bug timestamp, one re-runs the page in headless Playwright with a `bippy` probe injected to dump the React fiber tree and source line at that timestamp, and one writes a failing Playwright eval that reproduces the glitch deterministically. Codex then patches the source until the eval goes green. **The eval IS the deliverable** - this bug never ships again. No Chrome extension, no SaaS account, no SDK install in the target app. Pure Codex-native (subagents, worktrees, skills, MCP, evals - the five primitives Gabriel Chua's brief explicitly highlights), built in 6.5 hours, public on GitHub, posted to r/codex same day.

---

## 1. Product Requirements Document

### 1.1 Problem
When a designer or PM sends a Loom of a UI bug, the engineer spends 15-30 minutes reproducing it before writing a single line of fix. Existing tools either need a Chrome extension on the live site (Jam.dev), a custom recording browser (Replay.io), or a production SDK (Sentry Replay, LogRocket). None of them write a Playwright regression test. None work with the `.mov` already sitting in your downloads folder.

### 1.2 User
React/Next.js engineer running Codex CLI locally. Receives bug reports as videos. Wants a tested fix, not a paste-link.

### 1.3 Input
- **Primary:** path to a screen recording (`.mp4`, `.mov`, `.webm`, 5-30 sec) plus the local app URL the bug occurred against
- **Optional:** repro hint string ("click the red X on the modal"), GitHub repo path for source mapping
- **Out of scope for v0:** voiceover transcription, multi-bug videos, mobile native apps

### 1.4 Output - the BugPack folder
Exactly the structure the browser-research subagent locked in:
```
bugpack-<runId>/
├── manifest.json              # runId, app_url, react_version, framework
├── video.webm                 # original recording, copied
├── trace.zip                  # Playwright tracing - DOM/network/console/sources
├── frames/00000.jpg ... NNNNN.jpg  +  frames.index.json   (2 fps subsample)
├── bug_analysis.json          # {bug_start_s, bug_end_s, bbox, bug_type, severity, description, reproduction_hint, suggested_fix}
├── react_tree.json            # bippy fiber dump at bug_ts
├── dom_snapshot.html
├── computed_styles.json
├── console.log                # NDJSON
├── network.har
├── source_candidates.json     # ranked [{fileName, lineNumber, componentName, confidence}]
├── repro_steps.md
├── generated_eval.spec.ts     # the failing Playwright test
└── screenshots/{before_bug.png, at_bug.png, after_bug.png}
```

### 1.5 Core AI architecture - hybrid OpenAI-native primary, HF fallback
- **Primary video intelligence:** OpenAI Responses API, model `gpt-5.4-mini`, 2 fps frame batching, `detail: "low"`, structured JSON output. ~$0.05/clip, 10-20s latency. This is the demo path - judges from OpenAI, prizes from OpenAI, brief says "Build with Codex, or on top of it."
- **Local fallback:** `Qwen/Qwen3-VL-30B-A3B-Instruct` via HF Inference Providers (Hyperbolic / Cerebras / Novita / Groq) using `huggingface_hub.InferenceClient(provider="hyperbolic")`. Native text-timestamp grounding (T-RoPE), Apache 2.0, served on 10+ providers with zero setup. Used as second-pass disagreement check or when API key is missing.
- **Pre-filter heuristic:** ffmpeg scene-change + frame-diff to nominate candidate "bug moments" before sending to vision (cuts cost and latency on long clips - not critical for 30s demo but cheap to add).

### 1.6 System architecture (ASCII)

```
                        ┌──────────────────────────────────────┐
                        │   Codex CLI  (~/.codex/config.toml)  │
                        │   Skill: bugpack-demo                │
                        │   Subagents: video / runtime / eval  │
                        └──────────────┬───────────────────────┘
                                       │  stdio JSON-RPC (MCP 2025-11-25)
                                       ▼
                ┌──────────────────────────────────────────────┐
                │  bugpack-mcp  (Python + FastMCP 3.0)         │
                │                                              │
                │  Tools:                                      │
                │  ┌─ analyze_video_file(video, hint)          │
                │  │     ffmpeg → 2fps frames                  │
                │  │     OpenAI gpt-5.4-mini vision  ─────────┼──► api.openai.com /v1/responses
                │  │     fallback → Qwen3-VL via HF  ─────────┼──► router.huggingface.co
                │  │     → bug_analysis.json                  │
                │  ├─ record_instrumented_session(url, steps)  │
                │  │     Playwright + addInitScript(probe.js)  │
                │  │     bippy fiber instrument               │
                │  │     context.tracing.start                │
                │  │     → trace.zip + console + HAR + dump   │
                │  ├─ map_timestamp_to_context(bugpack_dir, t) │
                │  │     scrub trace.zip to t                 │
                │  │     extract react_tree, source_candidates │
                │  │     → react_tree.json + sources.json      │
                │  └─ generate_regression_eval(bugpack_dir)    │
                │        playwright codegen base               │
                │        + toHaveScreenshot keyframes          │
                │        + interaction asserts                 │
                │        → generated_eval.spec.ts              │
                └──────────────────────────────────────────────┘
                                       │
                                       ▼
                            BugPack folder on disk
                                       │
                                       ▼
                Codex reads BugPack → patches source → re-runs eval
                            (red → green = demo wow)
```

### 1.7 MVP feature lock-in (ranked by must-ship)

| Rank | Feature | MVP? | Notes |
|---|---|---|---|
| 1 | `analyze_video_file` MCP tool with OpenAI vision | **MUST** | The wedge. No demo without this. |
| 2 | BugPack folder output structure | **MUST** | The artifact that wins judging. |
| 3 | Codex skill `bugpack-demo` orchestrating the flow | **MUST** | Codex-native flex. |
| 4 | Generated Playwright eval that fails on the demo bug | **MUST** | Red-to-green is the wow moment. |
| 5 | `record_instrumented_session` with bippy injection | **MUST** | Lifts us above Jam.dev (we capture React fiber). |
| 6 | `map_timestamp_to_context` returning source file:line | **MUST (degraded ok)** | Even just "nearest composite component name" is enough. |
| 7 | `generate_regression_eval` that goes green after Codex patch | **MUST** | The eval flipping is the demo. |
| 8 | Codex subagent traces visible in demo | **SHOULD** | Judges built this; show it. |
| 9 | Hugging Face Qwen3-VL fallback path | **SHOULD** | Multimodal track credibility, hedge if OpenAI rate-limits. |
| 10 | Pre-filter scene-change heuristic | NICE | Cost/latency win, not visible in demo. |
| 11 | `react-grab` fallback for source resolution | NICE | Hedge against React 19 host-fiber loss. |
| 12 | Web UI (drop zone, BugPack viewer) | STRETCH | Skip - terminal demo is more Codex-native. |
| 13 | Voice-over transcription with Whisper | STRETCH | Don't open this rabbit hole. |
| 14 | Multi-bug detection in one video | STRETCH | Out of scope. |

---

## 2. Tech stack with specific package versions

```jsonc
// MCP server (Python - FastMCP path, recommended)
"python": ">=3.11",
"mcp[cli]": "^1.27.0",
"fastmcp": "^3.0",
"openai": "^1.60",
"huggingface_hub": "^0.27",                 // for InferenceClient fallback
"pydantic": "^2.9",
"httpx": "^0.27",
"opencv-python-headless": "^4.10",          // scene-change / frame diff
// ffmpeg via system binary (brew install ffmpeg)

// Playwright runner (Node - co-located alongside Python)
"playwright": "1.59.1",
"@playwright/test": "1.59.1",
"bippy": "^0.3.x",                           // R17-R19 fiber introspection
"esbuild": "^0.25.x",                        // bundles probe.ts → IIFE
"source-map-js": "^1.2.1",                   // production sourcemap fallback only

// Demo target app (sample buggy Next.js)
"next": "15.1",
"react": "18.3",                             // pin to 18 - _debugSource still works
"tailwindcss": "^3.4",
"@radix-ui/react-dialog": "^1.1",

// Codex / MCP infra
"@modelcontextprotocol/sdk": "latest",       // only if we add a TS shim
"@modelcontextprotocol/inspector": "latest", // local debugging
"@openai/codex": "latest"                    // Codex CLI itself
```

**Language choice: Python + FastMCP 3.0** for the MCP server. Decorator tools auto-generate JSON schemas from type hints, `uvx` distribution is one command for judges, and `mcp dev` plus the Inspector give a built-in test loop. The Playwright runner is Node (it's natively Node) and the Python MCP shells out to it via subprocess - cleaner than fighting Playwright Python's slightly-behind feature parity.

---

## 3. Hour-by-hour dev plan (9:50 AM - 7:00 PM = 6.5 hours after setup)

We dogfood Codex subagents. Three engineers (or one engineer + Codex Pro x3 in parallel worktrees) drive three subagents simultaneously.

### Phase 0 - Pre-event setup (TONIGHT, April 28, 2-3 hours)
See the prep checklist in §6. Repo is scaffolded, MCP `ping` tool works, demo bug Next.js app builds, Codex config is registered, `tools.csv` is written. We walk in with a working hello-world.

### Phase 1 - On-site setup (9:50 - 10:20 AM, 30 min)
- Pull the prepped repo. Sanity check Codex CLI, OpenAI key, HF key, Playwright, ffmpeg.
- Create three git worktrees: `wt/video`, `wt/runtime`, `wt/eval`. One Codex CLI thread per worktree.
- Drop the canonical `tools.csv` into the repo root with rows for `analyze_video_file`, `record_instrumented_session`, `map_timestamp_to_context`, `generate_regression_eval`.
- Open Codex with the orchestrator prompt: "Use spawn_agents_on_csv over tools.csv with the tool-builder agent, max_concurrent_agents=3, each in its own worktree. Stream progress."

### Phase 2 - Parallel build (10:20 AM - 1:30 PM, 3 hours, 10 min)

**Subagent A - Video analysis** (worktree `wt/video`)
- Hour 1: ffmpeg frame extractor (`ffmpeg -i clip.mp4 -vf "fps=2,scale=1280:-1" frames/%05d.jpg`), build `frames.index.json`.
- Hour 1.5: OpenAI Responses API call with the prompt template from §4.1, JSON-mode output, `gpt-5.4-mini`, `detail: "low"`, `reasoning.effort: "low"`. Confirm latency under 20s on real recording.
- Hour 2: Add HF fallback path - `InferenceClient(provider="hyperbolic", api_key=os.getenv("HF_TOKEN")).chat.completions.create(model="Qwen/Qwen3-VL-30B-A3B-Instruct", ...)`. Disagreement check: if both run, prefer the one that returns `bug_detected=true` with higher confidence.
- Hour 2.5: Wire as `analyze_video_file` MCP tool. Smoke-test through Inspector.
- Hour 3: Hand off `bug_analysis.json` schema to Subagent C.

**Subagent B - Instrumented session** (worktree `wt/runtime`)
- Hour 1: Bundle `probe.ts` with esbuild into IIFE (`probe.js`). Probe contains bippy hook, console/network/MO buffers, `window.__bugpack_dump(t)` from snippet B in research.
- Hour 1.5: Playwright runner (`runner.ts`) - launches Chromium with `recordVideo`, `recordHar`, `context.tracing.start`, `addInitScript(probe.js)`. Drives a hardcoded user flow (modal open → close).
- Hour 2: Wire as `record_instrumented_session` MCP tool. Tool spec: `(app_url: str, steps: list[str], target_t_ms: int) → bugpack_dir: str`.
- Hour 2.5: Build `map_timestamp_to_context` - reads existing trace.zip + react_tree.json, returns `source_candidates.json` ranked by composite-fiber proximity to bbox center.
- Hour 3: Smoke-test on the demo Next.js app. Verify `_debugSource` resolves to `Dialog.tsx:42`.

**Subagent C - Eval generation** (worktree `wt/eval`)
- Hour 1: Playwright codegen wrapper - takes `repro_steps.md` (natural language) + `bug_analysis.json` (timestamp, bbox), emits `.spec.ts` skeleton.
- Hour 1.5: Add the assertion synthesis logic. For animation glitches: `page.clock.install()` + `clock.runFor(150)` + `toHaveScreenshot('modal-mid-close.png', { maxDiffPixelRatio: 0.01 })`. For loading-state bugs: `await expect(spinner).toBeHidden({ timeout: 2000 })`. For layout-shift: `toHaveScreenshot` at first-paint.
- Hour 2: Generate three test flavors per BugPack: interaction, visual, invariant. Pick the one matching `bug_type` from `bug_analysis.json`.
- Hour 2.5: Wire as `generate_regression_eval` MCP tool. Confirm fail-on-broken-HEAD, pass-on-fixed-HEAD against the demo bug.
- Hour 3: Hand off the green→red→green flow to integration.

### Phase 3 - Integration (1:30 PM - 3:00 PM, 1.5 hours)
- 1:30: Merge three worktrees back to `main`. Run `bugpack-mcp` standalone, end-to-end on the demo `.mov`.
- 2:00: Author the Codex skill at `.agents/skills/bugpack-demo/SKILL.md` (template in §4.3). Skill orchestrates: call `analyze_video_file` → call `record_instrumented_session` → call `map_timestamp_to_context` → call `generate_regression_eval` → run `npx playwright test` → if red, hand to Codex main thread for fix → re-run eval.
- 2:30: Full dry-run. Time it. Target: 90 seconds end-to-end on stage.
- 2:50: Fix anything that broke. Pin model versions, pin Playwright, pin Node.

### Phase 4 - Demo prep (3:00 PM - 4:30 PM, 1.5 hours; runs in parallel with buffer testing)
- 3:00: Set up ScreenStudio with three-pane layout (browser top-left, Codex CLI top-right, Playwright report bottom).
- 3:15: Practice voiceover script (§5.2) once dry, once with the actual flow running.
- 3:45: Record take 1. Watch back. Note timing issues.
- 4:00: Record take 2 (likely the keeper). 
- 4:15: Re-record audio if needed. ScreenStudio audio track edit.
- 4:25: Export 1080p H.264 MP4.

### Phase 5 - Submission + buffer (4:30 PM - 7:00 PM, 2.5 hours)
- 4:30: README polish (§4.4 template), GIF in README, badges, install one-liner.
- 5:00: Push to public GitHub. Verify a fresh clone works: `git clone && uv sync && codex mcp add ...`.
- 5:30: Pre-record fallback demo video (in case live demo terminal craps out).
- 6:00: Submission form, devpost (if applicable), tweet thread queued.
- 6:30: r/codex post drafted.
- Remaining time: rehearse live demo, fix tiny polish items.

---

## 4. Code skeletons for the four MCP tools

### 4.1 `analyze_video_file` - the OpenAI-native vision call

```python
# src/bugpack_mcp/tools/analyze_video.py
import base64, json, subprocess, os, pathlib
from openai import OpenAI
from huggingface_hub import InferenceClient
from fastmcp import FastMCP

mcp = FastMCP("bugpack-mcp")
oai = OpenAI()

PROMPT = """You are a QA engineer reviewing a screen recording of a web UI for visual bugs.
You will receive {n} frames sampled at {fps} fps. Frame i corresponds to timestamp t = i/{fps} seconds.
Frame timestamps (s): {timestamps}

Identify any visual UI bug: layout break, overlap, missing element, z-index issue, flicker,
broken animation, contrast/illegible text, loading state stuck, error toast, route transition glitch.

Return STRICT JSON:
{{
  "bug_detected": bool,
  "bug_start_s": float | null,
  "bug_end_s": float | null,
  "frame_indices": [int],
  "bbox": {{"x": int, "y": int, "w": int, "h": int}} | null,
  "bug_type": "layout"|"overlap"|"missing_element"|"text_contrast"|"flicker"|"loading_stuck"|"error_state"|"animation_glitch"|"other",
  "severity": "low"|"medium"|"high",
  "description": "1-3 sentences",
  "reproduction_hint": "what user did just before",
  "suggested_fix": "1 sentence"
}}
If no bug, set bug_detected=false."""

@mcp.tool
def analyze_video_file(video_path: str, hint: str | None = None, fps: int = 2) -> dict:
    """Extract frames from a screen recording and identify the UI bug timestamp + description."""
    out = pathlib.Path("./bugpack-tmp/frames")
    out.mkdir(parents=True, exist_ok=True)
    subprocess.check_call([
        "ffmpeg", "-y", "-i", video_path,
        "-vf", f"fps={fps},scale=1280:-1",
        f"{out}/%05d.jpg"
    ], stderr=subprocess.DEVNULL)

    frame_paths = sorted(out.glob("*.jpg"))
    timestamps = [round(i / fps, 2) for i in range(len(frame_paths))]

    content = [{"type": "input_text",
                "text": PROMPT.format(n=len(frame_paths), fps=fps, timestamps=timestamps)
                + (f"\n\nUser hint: {hint}" if hint else "")}]
    for i, p in enumerate(frame_paths):
        b64 = base64.b64encode(p.read_bytes()).decode()
        content.append({"type": "input_text", "text": f"--- Frame {i} (t={timestamps[i]}s) ---"})
        content.append({"type": "input_image",
                        "image_url": f"data:image/jpeg;base64,{b64}",
                        "detail": "low"})

    try:
        resp = oai.responses.create(
            model="gpt-5.4-mini",
            input=[{"role": "user", "content": content}],
            reasoning={"effort": "low"},
            text={"format": {"type": "json_object"}},
        )
        return json.loads(resp.output_text)
    except Exception as e:
        # HF fallback - Qwen3-VL via Hyperbolic
        return _qwen_fallback(frame_paths, timestamps, hint)

def _qwen_fallback(frame_paths, timestamps, hint):
    client = InferenceClient(provider="hyperbolic", api_key=os.environ["HF_TOKEN"])
    msg_content = [{"type": "text", "text": PROMPT.format(
        n=len(frame_paths), fps=2, timestamps=timestamps)}]
    for p in frame_paths:
        b64 = base64.b64encode(p.read_bytes()).decode()
        msg_content.append({"type": "image_url",
                           "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})
    resp = client.chat.completions.create(
        model="Qwen/Qwen3-VL-30B-A3B-Instruct",
        messages=[{"role": "user", "content": msg_content}],
        response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content)
```

### 4.2 `record_instrumented_session` - Playwright + bippy probe

```python
# src/bugpack_mcp/tools/record_session.py
import subprocess, json, pathlib

@mcp.tool
def record_instrumented_session(
    app_url: str,
    steps: list[str],
    target_t_ms: int | None = None,
    out_dir: str = "./bugpack",
) -> dict:
    """Replay user flow under instrumentation; capture video + trace + React fiber dump."""
    p = pathlib.Path(out_dir); p.mkdir(parents=True, exist_ok=True)
    payload = {"app_url": app_url, "steps": steps, "target_t_ms": target_t_ms, "out": str(p)}
    (p / "input.json").write_text(json.dumps(payload))
    subprocess.check_call(["node", "runner.js", str(p / "input.json")])
    return {
        "trace_zip": str(p / "trace.zip"),
        "video_webm": str(p / "video.webm"),
        "react_tree": str(p / "react_tree.json"),
        "dom_snapshot": str(p / "dom_snapshot.html"),
        "console_log": str(p / "console.log"),
        "har": str(p / "network.har"),
    }
```

```ts
// runner.ts (compiled to runner.js)
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const input = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
const probe = await fs.readFile('probe.js', 'utf8');

const browser = await chromium.launch();
const context = await browser.newContext({
  recordVideo: { dir: input.out, size: { width: 1280, height: 720 } },
  recordHar:   { path: `${input.out}/network.har` },
});
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
const page = await context.newPage();
await page.addInitScript({ content: probe });
await page.goto(input.app_url);

// Naive step interpreter - good enough for hackathon. Steps are like:
// "click button [name='Submit']" or "type 'hello' in [placeholder='Email']"
for (const step of input.steps) await runStep(page, step);

const dump = await page.evaluate(() => (window as any).__bugpack_dump(performance.now()));
await fs.writeFile(`${input.out}/react_tree.json`, JSON.stringify(dump.fiberTree, null, 2));
await fs.writeFile(`${input.out}/dom_snapshot.html`, dump.html);
await fs.writeFile(`${input.out}/console.log`, dump.console.map((e:any)=>JSON.stringify(e)).join('\n'));
await fs.writeFile(`${input.out}/source_candidates.json`, JSON.stringify(dump.sourceCandidates, null, 2));

await context.tracing.stop({ path: `${input.out}/trace.zip` });
await context.close(); await browser.close();
```

`probe.js` is exactly snippet B from the runtime-instrumentation research output above (bippy hook, console/network/MO buffers, `window.__bugpack_dump`). Bundle from `probe.ts` with `esbuild probe.ts --bundle --format=iife --outfile=probe.js`.

### 4.3 `map_timestamp_to_context` and `generate_regression_eval`

```python
@mcp.tool
def map_timestamp_to_context(bugpack_dir: str, t_ms: int) -> dict:
    """Read trace.zip + react_tree.json; return ranked source candidates near timestamp t."""
    p = pathlib.Path(bugpack_dir)
    react_tree = json.loads((p / "react_tree.json").read_text())
    candidates = json.loads((p / "source_candidates.json").read_text())
    # candidates is already ranked composite fibers from probe.js walk
    return {
        "candidates": candidates[:5],
        "fiber_summary": _summarise_tree(react_tree, depth=3),
        "console_at_t": _slice_console(p / "console.log", t_ms, window_ms=2500),
    }

@mcp.tool
def generate_regression_eval(bugpack_dir: str, eval_path: str = "tests/regression.spec.ts") -> dict:
    """Synthesize a Playwright test from BugPack contents that fails on the bug."""
    p = pathlib.Path(bugpack_dir)
    bug = json.loads((p / "bug_analysis.json").read_text())
    cands = json.loads((p / "source_candidates.json").read_text())
    spec = _render_spec(bug, cands)  # template per bug_type
    pathlib.Path(eval_path).write_text(spec)
    return {"eval_path": eval_path, "preview": spec[:400]}

_TEMPLATES = {
  "animation_glitch": """\
import { test, expect } from '@playwright/test';

test('{slug} @regression', async ({{ page }}) => {{
  await page.clock.install();
  await page.goto('{app_url}');
  {steps}
  await page.clock.runFor({mid_ms});
  await expect(page).toHaveScreenshot('{slug}-mid.png', {{ maxDiffPixelRatio: 0.01 }});
  await page.clock.runFor(400);
  await expect(page.getByRole('dialog')).toBeHidden();
}});
""",
  "loading_stuck": """\
import { test, expect } from '@playwright/test';
test('{slug} @regression', async ({{ page }}) => {{
  await page.route('{api_url}', r => r.fulfill({{ status: 200, body: '{{}}' }}));
  await page.goto('{app_url}');
  {steps}
  await expect(page.getByTestId('spinner')).toBeHidden({{ timeout: 2000 }});
}});
""",
  # ... layout, overlap, text_contrast, flicker, error_state ...
}
```

### 4.4 Codex skill template

```markdown
<!-- .agents/skills/bugpack-demo/SKILL.md -->
---
name: bugpack-demo
description: Use when the user drops a screen recording or mentions a UI bug video, "bugpack", or asks Codex to fix a UI bug from a recording. Triggers on .mov/.mp4/.webm paths or words "bug video", "screen recording", "loom".
---
You are the BugPack demo runner. Your job: take a video path + app URL, produce a tested fix.

Workflow:
1. Verify `bugpack-mcp` is registered: `codex mcp list`. If not, run `scripts/install.sh`.
2. Call `bugpack-mcp.analyze_video_file(video_path, hint)` → bug_analysis.json.
3. Call `bugpack-mcp.record_instrumented_session(app_url, steps, target_t_ms=bug_start_s*1000)`.
4. Call `bugpack-mcp.map_timestamp_to_context(bugpack_dir, t_ms)` → source candidates.
5. Call `bugpack-mcp.generate_regression_eval(bugpack_dir)` → tests/regression.spec.ts.
6. Run `npx playwright test tests/regression.spec.ts --reporter=list`. Expect RED.
7. Open the top source candidate file. Read +/- 30 lines. Apply fix matching `suggested_fix` from bug_analysis.
8. Re-run `npx playwright test tests/regression.spec.ts`. If still red, iterate up to 3 times.
9. When green, summarize: bug, fix, eval path. Ask user to confirm before commit.

Notes:
- Always log to stderr in stdio mode (stdout corrupts JSON-RPC).
- Never expose OPENAI_API_KEY or HF_TOKEN.
- For React 19 apps, source candidates may resolve to enclosing composite, not the JSX line - that's fine.
```

### 4.5 README template (skeleton)

```markdown
# bugpack-mcp
> Drop a screen recording. Get a tested fix. Local-first MCP for Codex.

![demo](docs/demo.gif)

## What it does
Takes any `.mov` / `.mp4` of a UI bug → identifies the bug timestamp with GPT-5.4-mini → re-runs the page under Playwright with bippy fiber introspection → maps the bug to your source file → writes a failing Playwright regression test → Codex patches until green.

No Chrome extension. No SaaS account. No SDK in your app. Pure MCP + Codex.

## Install
```bash
codex mcp add bugpack -- uvx bugpack-mcp@latest
```
Add `OPENAI_API_KEY` to env. Optional: `HF_TOKEN` for Qwen3-VL fallback.

## Use
In Codex CLI: `> use bugpack-demo skill on ./bug.mov against http://localhost:3000`

## Architecture
[ASCII diagram from PRD §1.6]

## Built at OpenAI Codex Hackathon Sydney, April 29 2026.
```

---

## 5. Demo strategy

### 5.1 Bug catalog - 5 demo-ready bugs (from research)

| # | Bug | Why it works | Single-component fix? |
|---|---|---|---|
| **1** | **Modal close animation glitch** (missing Tailwind `data-[state=closed]:animate-out fade-out-0`) | Visually unmistakable, screenshots can't capture it but video can - perfect "why video > screenshot" narrative | Yes - `components/ui/dialog.tsx` |
| **2** | **Dark-mode FOUC on first load** (next-themes provider inside Suspense) | Every dev has lived this; flash is obvious in a recording | Yes - `app/layout.tsx`, 4 lines |
| **3** | **Infinite spinner on 200 OK** (forgot `setLoading(false)` in success branch with empty body) | Shows interaction state capture, not just pixels; demos the network HAR going to Codex | Yes - one component file |
| 4 | **CLS layout shift on hero image load** (no width/height on `<img>`) | Demonstrates frame-level diff catching layout instability | Yes - `Hero.tsx` |
| 5 | **Z-index dropdown clipped by overflow:hidden parent** | Classic CSS nightmare; satisfying fix | Yes - one CSS file |

**Lead with #1** in the demo. **Pre-stage all five** in the sample-app repo (`samples/buggy-app/`) on different branches, in case live demo decides to be cute and the bug 1 patch fails - we hot-swap to bug 3.

### 5.2 Two-minute video script (verbatim voiceover)

**[0:00-0:10] HOOK.** *Black screen, single line of text fades in.*
> "When a designer sends you a Loom of a UI bug, you spend 20 minutes reproducing it before you write a single line of code. We made that 0 minutes."

*B-roll: real Loom-style video plays - cursor opens a modal, modal close animation jankily teleports off screen. Frame freezes on the glitch. Title card slides in: project name + Codex Hackathon Sydney 2026.*

**[0:10-0:25] PROBLEM.**
> "Today you have two options. Option one: Jam.dev - but it needs a browser extension on a live site, and it gives your AI a paste-link, not a fix. Option two: stare at the video, scrub frame by frame, hunt the component. Neither writes you a regression test."

*B-roll: Jam.dev landing page on left, dev scrubbing video timeline on right, red X over both.*

**[0:25-1:55] DEMO.**

*[0:25] VS Code on left, Codex CLI on right, Playwright report panel below.*
> "Here's a real Next.js dashboard. Watch."

*[0:30] Drag `bug.mov` onto Codex CLI.*
> "I drop in a 6-second recording of the bug. No extension, no SDK. Local."

*[0:35] Codex spawns subagents - subagent trace cards animate in.*
> "Codex spawns three subagents in parallel git worktrees. One analyzes the video with GPT-5.4-mini vision and finds the glitch at timestamp 2.4 seconds. One re-runs the page in Playwright with a bippy probe and dumps the React fiber tree at that moment. One generates the regression test."

*B-roll: subagent cards fill in: `🎥 frame 72 → modal close`, `⚛️ Dialog.tsx:42`, `📝 modal-close-glitch.spec.ts`.*

*[1:00] Terminal: `npx playwright test`.*
> "Here's the test before any fix."

*Test runs RED. Visual diff popup shows modal mid-glitch.*
> "Red. The eval reproduces the bug deterministically. That's our success criterion."

*[1:15] Codex skill: `> /fix-from-eval`.*
> "Codex reads the failing trace, opens Dialog.tsx, sees the missing transition class, patches it in one turn."

*B-roll: diff appears - `+ data-[state=closed]:animate-out fade-out-0`.*

*[1:35] Re-run test.*
> "Re-run."

*Test goes GREEN. Playwright HTML report flashes.*
> "Green. Video to tested fix in 90 seconds, fully local, zero SaaS."

*[1:50] Show committed `modal-close-glitch.spec.ts`.*
> "And the regression test stays. This bug never ships again."

**[1:55-2:00] OUTRO.**
> "It's an MCP server, a Codex skill, and your screen recorder. Open source. Built today in Sydney."

*B-roll: GitHub URL + QR + team handle.*

**Wow moment:** the red→green Playwright transition at 1:35. Anchor the entire video around making that frame land cleanly.

**Recording tools:** ScreenStudio (cinematic zooms, auto-cursor highlight) - polished hackathon vibe. Live voiceover, single take, re-record audio in ScreenStudio's audio track if needed. **Show subagent traces** - judges built this primitive and want to see it exercised.

---

## 6. Pre-hackathon prep checklist (TONIGHT, April 28)

Block 2-3 hours. The goal: walk in tomorrow with a working hello-world and zero setup risk.

```
[ ] Repo `bugpack-mcp` initialized, public GitHub
[ ] uv init, FastMCP installed, ping tool works through MCP Inspector
[ ] codex mcp add bugpack-mcp registered, `codex mcp list` shows it
[ ] Codex skill scaffold at .agents/skills/bugpack-demo/SKILL.md
[ ] tools.csv with 4 rows (analyze_video_file, record_instrumented_session, map_timestamp_to_context, generate_regression_eval)
[ ] Three git worktrees pre-created: wt/video, wt/runtime, wt/eval
[ ] Subagents config in ~/.codex/config.toml: tool-builder + reviewer
[ ] Sample buggy Next.js app in samples/buggy-app/, runs on localhost:3000
[ ] FIVE branches in samples/buggy-app: bug-1-modal, bug-2-fouc, bug-3-spinner, bug-4-cls, bug-5-zindex
[ ] FIVE recordings prepared: docs/demos/bug-1.mov ... bug-5.mov (each 6-15 sec, QuickTime/CleanShot)
[ ] Playwright installed: npx playwright install chromium
[ ] ffmpeg on PATH: brew install ffmpeg, verify ffmpeg -version
[ ] OPENAI_API_KEY in .envrc, tested with a small responses call (gpt-5.4-mini hello world)
[ ] HF_TOKEN in .envrc, tested with InferenceClient(provider="hyperbolic") on Qwen3-VL
[ ] probe.ts written, esbuild bundled to probe.js, smoke-tested in headed Chrome on the demo app
[ ] bippy installed in samples/buggy-app, _debugSource resolves on a manual click
[ ] README skeleton with placeholders, badges, install one-liner
[ ] Demo script printed/in iPad, voice rehearsed once
[ ] ScreenStudio installed and tested, three-pane window arrangement saved
[ ] Charged: laptop, AirPods (for stage), backup battery
[ ] Backup: clone the repo to a USB stick in case wifi dies
[ ] Keys backed up: OPENAI_API_KEY and HF_TOKEN in 1Password
[ ] r/codex draft post written
[ ] Tweet thread queued (4-5 tweets with the demo GIF)
[ ] Tested: Codex Pro account signed in on the demo laptop
[ ] Free disk: at least 10GB for video traces and Playwright artifacts
```

---

## 7. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OpenAI vision call exceeds 30s on stage | Medium | High | Pre-call once at install to warm; parallelize HF Qwen3-VL fallback; use `reasoning.effort=low`; pre-record fallback demo video. |
| Rate limit on `gpt-5.4-mini` (Tier 1 = ~30k TPM image) | Medium | High | Request quota bump TODAY; use Tier 2 key; batch frame count to 60 max; have HF Hyperbolic key ready for instant flip. |
| Codex subagent fans out to wrong worktree, conflicts | Low | Medium | `max_concurrent_agents=3`; pre-create worktrees with `git worktree add`; reviewer agent gates merge. |
| MCP stdio gotchas (logging to stdout corrupts JSON-RPC) | Medium | High | All `print()` redirected to `sys.stderr`; verified with Inspector before demo. |
| React 19 host-fiber `_debugSource` removed | Medium | Medium | Use React 18 in demo app; bippy `getFiberSource` walks to enclosing composite anyway; react-grab as fallback. |
| Probe init order race (React loads before bippy) | Medium | High | `bippy/install-hook-only` at top of addInitScript; `Object.defineProperty(__REACT_DEVTOOLS_GLOBAL_HOOK__, {configurable:false})`. |
| `_debugSource` only present in dev mode | Low | Medium | Confirmed Next.js dev mode injects `@babel/plugin-transform-react-jsx-development` by default. Demo app runs `next dev`. |
| Generated eval doesn't actually fail on broken HEAD | Medium | High | Pre-validate the eval flips red→green tonight against bug-1 branch; bake assertions per `bug_type` template. |
| Live demo network flakes on hackathon wifi | High | High | All API keys in env; have local Qwen3-VL via LM Studio (Q4_K_M GGUF) as last-resort offline fallback; pre-recorded video as final backstop. |
| ffmpeg not installed on demo machine | Low | High | Tonight: brew install ffmpeg; check `which ffmpeg`. |
| Codex CLI version drift (skill format changed) | Low | Medium | Pin Codex CLI version tonight; don't update tomorrow morning. |
| Playwright `context.tracing` slows recording | Low | Low | Trace is offline-only feature; recording itself is unaffected. |
| Sora video API confused with understanding (someone tries `/v1/videos`) | Low | Low | Don't go near it - it's generation-only and being deprecated Sep 24, 2026. |

---

## 8. Worst-case fallback plan

**If Subagent A's video model can't reliably timestamp bugs in 6.5 hours:** fall back to user-supplied timestamp. Add a CLI prompt: "When does the bug occur? (e.g., 2.4s)". Skip vision entirely, ship the rest of the pipeline. Still novel because no one else maps that timestamp to React source.

**If React mapping doesn't work:** dump DOM + computed styles only. `source_candidates.json` becomes `["best guess: <component name from class hint>"]`. Codex can still fix from a plain DOM snapshot - we just lose the precision flex.

**If generated eval doesn't fail/pass cleanly:** ship it as a draft. README says: "The eval is a starting point. Codex iterates on it." Frame as a feature, not a bug.

**If live demo terminal crashes on stage:** roll the pre-recorded fallback video. Have it queued in a browser tab.

**MUST-SHIP minimum:** `analyze_video_file` MCP tool returning real `bug_analysis.json` on the demo `.mov` + Codex skill that calls it + a hardcoded `generated_eval.spec.ts` for bug 1 that flips red→green when Codex applies a known patch. Even if the runtime instrumentation pipeline is half-cooked, this minimum demos the wedge.

---

## 9. Why we win - positioning

Three reasons.

**One, novelty has a defensible moat.** Jam.dev and Replay.io ship MCPs that pipe a video link to your agent, but they're cloud SaaS that needs a browser extension or custom recorder, and neither writes a Playwright regression test. We're the only project that closes the loop from a non-textual artifact (a video file already on your disk) to a verified persistent code change (a passing test that stays in your repo). That's the eval-driven, outcome-over-output pattern that won SF Codex Hackathon (Rippletide, Feb 2026) and that Gabriel Chua's Sydney brief explicitly calls out.

**Two, depth matches the demo.** Most teams will ship a chatbot wrapper, a code-review agent, or a docs MCP. We ship a real four-tool MCP server, an instrumented Playwright session with bippy fiber introspection (no off-the-shelf "bippy + Playwright" combo exists - that's the technical edge), structured JSON outputs, a working Codex skill, and a generated regression test that flips red-to-green on stage. Every demo second is real working code.

**Three, Codex-native maxing.** We use every primitive judges built: subagents in parallel, git worktrees per agent, skill files, MCP tools, evals as the success criterion, `spawn_agents_on_csv` for the build itself (we dogfood Codex to build Codex tooling). Gabriel's brief and the Sydney event Luma page name these primitives in their hackathon framing - we're literally executing the brief.

---

## 10. Stretch goals (if ahead of schedule by 3 PM)

- **MCP `.mcpb` bundle** - portable single-file install for judges (Nov 2025 spec).
- **Codex Apps SDK widget** - render BugPack as inline UI in Codex chat using `@modelcontextprotocol/ext-apps`. Hugely visible flex, but only if integration time allows.
- **Multi-bug detection** in one video - vision returns array of bugs, generate one eval per bug.
- **Voice-over transcription** with `whisper-1` to extract repro hint from spoken Loom narration.
- **Pre-filter scene-change heuristic** with OpenCV before vision call - 2-3x cost reduction on long clips.
- **Live mode** - replace `analyze_video_file` with a screencast subscription that detects bugs in real time (gpt-realtime + still images, since gpt-realtime accepts images).
- **Public registry submission** to `registry.modelcontextprotocol.io`.

---

## 11. Candidate names (for later, do not pick now)

Snapfix, Replayable, Trace, Rewind, Glitchhiker, Bugcast, Repro, Pixelpost, Frame Zero, Looplint, Codex Eyes, Showbug, BugPack (the artifact name itself works as the project name), ScreenSense, ClipFix.

Lean toward **Snapfix**, **Rewind**, **Repro**, or **BugPack** for clarity at a 2-minute demo where judges hear the name once.

---

## 12. Open-source video model recommendation - locked

**Use `Qwen/Qwen3-VL-30B-A3B-Instruct` via Hugging Face Inference Providers (Hyperbolic or Cerebras) as the OSS fallback path.**

- **HF model card:** https://huggingface.co/Qwen/Qwen3-VL-30B-A3B-Instruct
- **Why:** Native text-timestamp alignment for video grounding (T-RoPE), GUI/screen-content training in the base model, served on 10+ HF Inference Providers (Groq, Novita, Cerebras, SambaNova, Hyperbolic, Together, Fireworks, etc.) with zero setup, OpenAI-compatible chat endpoint, Apache 2.0 license, and runs locally on Apple Silicon via MLX/llama.cpp for the offline backstop.
- **Latency for 30s clip @ 2 fps (60 frames):** ~3-8s on Cerebras/Groq, ~10-20s on Hyperbolic/Novita.
- **Cost:** Free HF tier covers light hackathon usage; paid is ~$0.50-$2 per 1M output tokens.
- **One-line client:** `InferenceClient(provider="hyperbolic", api_key="hf_...").chat.completions.create(model="Qwen/Qwen3-VL-30B-A3B-Instruct", ...)`
- **Local backstop:** LM Studio → `Qwen3-VL-8B-Instruct-GGUF` Q4_K_M → `llama-server` for OpenAI-compatible local endpoint on 16GB M-series Mac, ~2-8s per 30s clip at 1 fps.
- **Why not the alternatives:** Tarsier2-7B has slightly better raw temporal grounding but no Inference Provider support (self-host overhead kills hackathon timeline). UI-TARS-1.5-7B is screenshot-only, not video. SmolVLM2 has no temporal grounding. MiniCPM-V is captioning-strong but no second-level grounding head.

---

## 13. OpenAI-native video pipeline recommendation - locked

- **Endpoint:** `POST https://api.openai.com/v1/responses`
- **Primary model:** `gpt-5.4-mini` (snapshot `gpt-5.4-mini-2026-03-05`). Best $/quality for UI bug detection.
- **Upgrade path:** `gpt-5.4` for fine-grained layout/text reasoning, or `gpt-5.2` if you specifically want its software-UI vision tuning (OpenAI explicitly called out "ScreenSpot-Pro" in the GPT-5.2 launch).
- **DO NOT use `gpt-5.5` for the demo** - announced Apr 23, 2026 but API GA is "coming very soon" not dated. Don't bet the demo on it.
- **DO NOT use `/v1/videos`** - Sora generation only, deprecated Sep 24, 2026.
- **Frame extraction:** `ffmpeg -i clip.mp4 -vf "fps=2,scale=1280:-1" frame_%03d.jpg` → 60 frames for 30s.
- **Encoding:** base64 data URLs (simplest); Files API + `file_id` if re-querying.
- **`detail` parameter:** start with `"low"`; promote to `"auto"` only if evals show missed bugs.
- **Cost:** ~$0.05/clip at gpt-5.4-mini, `detail:low`, 60 frames, ~1k output tokens.
- **Latency:** 10-20s with `reasoning.effort=low`.
- **Throughput gotcha:** Tier 1 ~30k TPM image - that's roughly one call/min. Request a Tier 2 bump before the hackathon.
- **Codex CLI cannot ingest video natively** (CLI v0.117.0, March 26 2026) - it accepts images via `--image` and GIFs only show first frame. Our MCP server is the bridge: video in, frames + analysis out, Codex consumes the BugPack.

---

## 14. Best-case scenario - what wins

All four MCP tools work end-to-end on stage. The 90-second demo runs cleanly: drop `.mov` → Codex spawns three subagents in worktrees → vision pinpoints the modal animation glitch at 2.4s → Playwright + bippy maps it to `Dialog.tsx:42` → generated test runs RED with a screenshot diff → Codex skill reads the failing trace, opens `Dialog.tsx`, adds the missing `data-[state=closed]:animate-out fade-out-0` Tailwind class → re-run goes GREEN. Subagent traces visible in the demo. Repo public on GitHub before submission. Posted to r/codex with a GIF same day. We hit every Codex-native primitive judges built (subagents, worktrees, skills, MCP, evals), execute Gabriel Chua's brief literally, and produce a PR-ready artifact. Win conditions met: novelty (only project going video → tested fix locally), depth (real working four-tool pipeline, not slideware), Codex-native flex (subagents + worktrees + skills + MCP + evals + dogfooded build).

---

## 15. Final gut-check

If you can only ship three things tomorrow, ship these in order:
1. `analyze_video_file` returning real bug_analysis.json on the demo `.mov` via OpenAI gpt-5.4-mini.
2. A hardcoded `generated_eval.spec.ts` for bug 1 (modal close) that flips red→green when Codex applies the known patch.
3. The Codex skill that orchestrates 1→2 with subagent traces visible.

That's the wedge. The rest is depth that earns judging points but doesn't define the win.

Good luck. Ship it.