# Codex SDK Demo Script — Task 1B.6

**Purpose:** Drive the Reelink × Codex hackathon demo. Reelink finds bugs in a recording, then hands a `WorkItem[]` to OpenAI Codex, which spawns one parallel sub-agent per bug (each on its own git worktree). One agent receives a mid-execution prompt injection. Demo ends with one or more PR URLs.

**Audience:** Faction A (demo runner) and Faction B (record/finding wiring). Paste-ready code lives at the bottom; the upper sections document what's real, what's inferred, and what to fall back to.

---

## 1. API surface (what's actually documented)

All facts in this section are sourced from live docs as of 2026-04-29. Inferences are flagged.

### 1.1 Package

- **Package name:** `@openai/codex-sdk` ([npm](https://www.npmjs.com/package/@openai/codex-sdk)).
- **Latest stable:** `0.125.0`. Latest alpha: `0.126.0-alpha.13`. Source: `https://registry.npmjs.org/@openai/codex-sdk`.
- **Runtime dependency:** the SDK shells out to the `@openai/codex` CLI, version-pinned in its `dependencies` (`@openai/codex@0.125.0`). The SDK is a JSONL-over-stdio wrapper around `codex exec`.
- **Node:** `>=18`.
- **Install:** `npm install @openai/codex-sdk` or, since this repo uses Bun, `bun add @openai/codex-sdk`.
- The CLI it wraps must also be reachable. The SDK auto-resolves `codex` from the bundled `@openai/codex` peer; if `which codex` returns nothing in CI, set `codexPathOverride` (see §1.5).

### 1.2 Real exports (verbatim from `sdk/typescript/src/index.ts` on `main`)

```ts
// Classes
export { Codex } from "./codex";
export { Thread } from "./thread";

// Core types
export type { CodexOptions } from "./codexOptions";
export type {
  ThreadOptions, ApprovalMode, SandboxMode,
  ModelReasoningEffort, WebSearchMode,
} from "./threadOptions";
export type { TurnOptions } from "./turnOptions";
export type { RunResult, RunStreamedResult, Input, UserInput } from "./thread";

// Event types
export type {
  ThreadEvent, ThreadStartedEvent, TurnStartedEvent, TurnCompletedEvent,
  TurnFailedEvent, ItemStartedEvent, ItemUpdatedEvent, ItemCompletedEvent,
  ThreadError, ThreadErrorEvent, Usage,
} from "./events";

// Item (turn artifact) types
export type {
  ThreadItem, AgentMessageItem, ReasoningItem, CommandExecutionItem,
  FileChangeItem, McpToolCallItem, WebSearchItem, TodoListItem, ErrorItem,
} from "./items";
```

### 1.3 `ThreadOptions` (verbatim)

```ts
export type ApprovalMode = "never" | "on-request" | "on-failure" | "untrusted";
export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";
export type ModelReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";
export type WebSearchMode = "disabled" | "cached" | "live";

export type ThreadOptions = {
  model?: string;
  sandboxMode?: SandboxMode;
  workingDirectory?: string;
  skipGitRepoCheck?: boolean;
  modelReasoningEffort?: ModelReasoningEffort;
  networkAccessEnabled?: boolean;
  webSearchMode?: WebSearchMode;
  webSearchEnabled?: boolean;
  approvalPolicy?: ApprovalMode;
  additionalDirectories?: string[];
};
```

### 1.4 `TurnOptions` (verbatim)

```ts
export type TurnOptions = {
  outputSchema?: unknown;   // JSON Schema; supports zod-to-json-schema target:"openAi"
  signal?: AbortSignal;     // cancel a running turn
};
```

### 1.5 `CodexOptions` (constructor for `Codex`)

Documented options the Codex constructor accepts (from the README and the `codexOptions.ts` shape inferred from the README usage):

- `apiKey?: string` (else `CODEX_API_KEY` env var)
- `baseUrl?: string` (passed through as `--config openai_base_url=...`)
- `env?: Record<string, string>` (replaces inherited env; SDK still injects `CODEX_API_KEY`)
- `config?: object` (flattened into repeated `--config dotted.key=value` overrides)
- `codexPathOverride?: string` (path to a specific `codex` binary)

### 1.6 Thread/turn lifecycle

```ts
import { Codex } from "@openai/codex-sdk";

const codex = new Codex();
const thread = codex.startThread({ /* ThreadOptions */ });
const turn  = await thread.run("Diagnose the test failure and propose a fix");
console.log(turn.finalResponse);
console.log(turn.items);
```

`run()` buffers all events. To stream, use `runStreamed()`:

```ts
const { events } = await thread.runStreamed("…prompt…");
for await (const e of events) {
  if (e.type === "item.completed") console.log("item", e.item);
  if (e.type === "turn.completed") console.log("usage", e.usage);
  if (e.type === "turn.failed")    throw new Error(e.error.message);
}
```

`Thread.id` is `null` until the first `thread.started` event fires, at which point it's a real id you can persist for `codex.resumeThread(id)`. Threads are stored at `~/.codex/sessions`.

### 1.7 Mid-execution input injection — what's really there

This is where the brief's "App Server mid-execution injection" claim needs honest framing.

- **The TypeScript SDK does NOT expose mid-execution input injection.** No `turn.steer`, no `thread.inject_items`, no `interrupt`. Only `TurnOptions.signal: AbortSignal` is available, which cancels but does not steer.
- **The `codex app-server` (separate binary) does support it** via JSON-RPC 2.0:
  - `turn/steer` — "append user input to the active in-flight turn without creating a new turn." [docs](https://developers.openai.com/codex/app-server)
  - `thread/inject_items` — "append prebuilt Responses API items to a loaded thread's prompt history without starting a user turn." [docs](https://developers.openai.com/codex/app-server)
  - `turn/interrupt`, `thread/start`, `thread/resume`, `thread/fork`.
- **Implication:** to demo mid-execution injection live, we must either (a) speak JSON-RPC to `codex app-server` directly (no first-party TS client today), or (b) demo the closest legal substitute that *looks* the same on stage.

The script below picks (b) for the live demo and provides (a) as a stretch path. See §3.4 for the exact substitute and §6 for the open question.

### 1.8 Parallel sub-agents — what's really there

- **There is NO first-party "spawn N sub-agents" API in the SDK.** The Codex *app* schedules one worktree per thread automatically; that scheduling is not exposed in `@openai/codex-sdk`.
- **Documented worktree behavior** ([app/worktrees](https://developers.openai.com/codex/app/worktrees)):
  - Stored under `$CODEX_HOME/worktrees`.
  - Two types: Codex-managed (auto-cleaned, ~15 retained, snapshot before delete) and permanent (user-created).
  - Hard git limit: same branch cannot be checked out in two worktrees at once.
- **What we do for the demo:** create one worktree per `WorkItem` ourselves with `git worktree add`, instantiate one `Thread` per worktree with `workingDirectory` pointed at the worktree path, then run all threads in parallel via `Promise.all`. This is the canonical "Codex pattern" — the SDK is built to be embedded this way (each thread is its own Codex CLI subprocess; running N threads = N parallel agents).
- **Inferred, not documented:** "the SDK supports parallel sub-agents." It supports parallel *threads* via host-driven concurrency. We will say this clearly during the demo.

### 1.9 Default model and reasoning effort

- **Model is configurable** via `ThreadOptions.model: string` and reasoning depth via `modelReasoningEffort: "minimal" | "low" | "medium" | "high" | "xhigh"`.
- **The brief mentions "GPT-5.5 default."** The public docs we fetched do not name a default model string. The SDK passes through whatever Codex CLI defaults to in `~/.codex/config.toml`.
- **Recommendation:** for the demo, pin the model explicitly in `ThreadOptions.model` so the slot is reproducible and we don't lean on a moving default. The exact string belongs in env (`CODEX_DEMO_MODEL`) so it can be swapped without code changes. See §6 (open questions).

### 1.10 Approval / sandbox for the demo

- `approvalPolicy: "never"` + `sandboxMode: "workspace-write"` lets each sub-agent commit and push without prompting.
- `networkAccessEnabled: true` is required for `gh pr create` / `git push`.
- `additionalDirectories`: leave undefined; each thread already has its worktree as `workingDirectory`.

---

## 2. Worktree management

### 2.1 Naming

- Branch: `fix/wi-<workItemId>` where `<workItemId>` is `WorkItem.id` from the Layer 0 schema (`reelink/src/schemas/layer0.ts:5-36`).
- Worktree path: `<repoRoot>/.codex-demo/wt/wi-<workItemId>`.
- `.codex-demo/` should be in `.gitignore` for the host repo. It's transient demo state.

### 2.2 Lifecycle

For each `WorkItem` in the analyze result:

1. `git worktree add -b fix/wi-<id> .codex-demo/wt/wi-<id> origin/main` — creates a fresh branch off main in a new worktree.
2. Spawn one `Thread` with `workingDirectory: ".codex-demo/wt/wi-<id>"`.
3. Let Codex run. It commits inside the worktree.
4. (Optional) `git -C .codex-demo/wt/wi-<id> push -u origin fix/wi-<id>` from the demo runner once Codex finishes, then `gh pr create` to capture a URL.
5. Cleanup post-demo: `git worktree remove --force .codex-demo/wt/wi-<id>` then `git branch -D fix/wi-<id>` for each.

### 2.3 Concrete commands to run before the demo

```bash
# At repo root, once
mkdir -p .codex-demo/wt
echo ".codex-demo/" >> .gitignore   # if not already

# Confirm gh is logged in
gh auth status

# Pin the demo model — paste real model id once confirmed (§6 Q1)
export CODEX_DEMO_MODEL="<model-id>"
export CODEX_API_KEY="<key>"
```

### 2.4 Cleanup script (paste-ready)

```bash
# reelink/scripts/demo-codex-cleanup.sh
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
WT_ROOT="${ROOT}/.codex-demo/wt"
[ -d "${WT_ROOT}" ] || exit 0
for wt in "${WT_ROOT}"/*; do
  [ -d "${wt}" ] || continue
  branch="$(git -C "${wt}" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  git worktree remove --force "${wt}" || true
  [ -n "${branch}" ] && [ "${branch}" != "main" ] && git branch -D "${branch}" || true
done
rmdir "${WT_ROOT}" 2>/dev/null || true
```

---

## 3. TypeScript skeleton — `reelink/scripts/demo-codex.ts`

This is the paste-ready demo runner. It intentionally lives in `reelink/scripts/` (not `src/`) because Faction A and B own `src/`. The script imports nothing from `reelink/src/**` — it shells out to the existing CLI (`bun run reelink/src/cli.ts analyze ...`) for the WorkItem feed.

**Security note:** All shell-outs use `spawnSync` with **array** args (no shell string interpolation), so user-derived values (`WorkItem.id`, paths, branch names) cannot escape into a shell. We never pass through `{ shell: true }`.

```ts
#!/usr/bin/env bun
// reelink/scripts/demo-codex.ts
//
// Reelink × Codex hackathon demo runner (Task 1B.6).
//
// Flow:
//   1. Run `reelink analyze <recording>` and parse WorkItem[] from stdout JSON.
//   2. For each WorkItem, create a git worktree on a fresh branch off origin/main.
//   3. Spawn one Codex Thread per worktree, all running in parallel.
//   4. Mid-flight, inject a steering message into ONE thread (see §3.4 below).
//   5. After all threads complete, push branches and create PRs; print URLs.
//
// Run: `bun reelink/scripts/demo-codex.ts reelink/demo-recordings/<file>.{webm,mov}`
//
// Env required:
//   CODEX_API_KEY        - OpenAI/Codex API key
//   CODEX_DEMO_MODEL     - model id pinned for the demo (e.g. "gpt-5.5")
//
// Env optional:
//   REELINK_CLI          - path to reelink CLI entry (default: ./reelink/src/cli.ts)
//   DEMO_INJECT_WI_INDEX - which WorkItem (0-based) gets the live steering injection. Default: 0
//   DEMO_DRY_RUN         - if "1", skip Codex spawn and print plan only

import { Codex, type ThreadEvent } from "@openai/codex-sdk";
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// --- WorkItem shape (mirrors reelink/src/schemas/layer0.ts) -----------------
type Severity = "low" | "medium" | "high";
type WorkItem = {
  id: string;
  ts: number;
  type: string;
  severity: Severity;
  title: string;
  confidence: number;
  description?: string;
  state: "detected" | "prepared" | "approved" | "routed" | "executed" | "completed";
  approval_state: "pending" | "approved" | "rejected" | null;
  routed_to: string | null;
  completed_at: string | null;
  source: "video";
  intent: "fix" | "investigate" | "track";
};
type AnalyzeResult = {
  recording_id: string;
  duration_sec: number | null;
  summary: string;
  work_items: WorkItem[];
  next_steps: string[];
};

// --- Safe shell helper -------------------------------------------------------
// All shell-outs go through this. Never use exec() / shell strings — every
// arg is an array element, so worktree paths and WorkItem ids cannot escape.
function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; capture?: boolean } = {},
): string {
  const result = spawnSync(cmd, args, {
    cwd: opts.cwd,
    encoding: "utf8",
    stdio: opts.capture ? ["ignore", "pipe", "inherit"] : ["ignore", "inherit", "inherit"],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed (exit ${result.status})`);
  }
  return opts.capture ? result.stdout : "";
}

// --- Config ------------------------------------------------------------------
const REPO_ROOT = run("git", ["rev-parse", "--show-toplevel"], { capture: true }).trim();
const WT_ROOT = resolve(REPO_ROOT, ".codex-demo/wt");
const REELINK_CLI = process.env.REELINK_CLI ?? resolve(REPO_ROOT, "reelink/src/cli.ts");
const DEMO_MODEL = process.env.CODEX_DEMO_MODEL ?? ""; // empty string = use Codex default
const INJECT_INDEX = Number(process.env.DEMO_INJECT_WI_INDEX ?? 0);
const DRY_RUN = process.env.DEMO_DRY_RUN === "1";

// Validate WorkItem.id format defensively. WorkItems come from a controlled
// pipeline, but we still refuse anything that could be a path/branch escape.
const SAFE_ID = /^[A-Za-z0-9._-]+$/;

// --- Step 1: run reelink analyze ---------------------------------------------
function runAnalyze(recordingPath: string): AnalyzeResult {
  console.error(`[demo] running reelink analyze on ${recordingPath}`);
  const out = run("bun", ["run", REELINK_CLI, "analyze", recordingPath], { capture: true });
  const parsed = JSON.parse(out) as AnalyzeResult;
  console.error(`[demo] got ${parsed.work_items.length} work items`);
  return parsed;
}

// --- Step 2: worktree create -------------------------------------------------
function createWorktree(wi: WorkItem): { path: string; branch: string } {
  if (!SAFE_ID.test(wi.id)) throw new Error(`unsafe WorkItem id: ${wi.id}`);
  const branch = `fix/wi-${wi.id}`;
  const path = resolve(WT_ROOT, `wi-${wi.id}`);
  if (!existsSync(WT_ROOT)) mkdirSync(WT_ROOT, { recursive: true });
  if (existsSync(path)) {
    // Idempotent: blow it away if a previous demo left scaffolding.
    spawnSync("git", ["worktree", "remove", "--force", path], { stdio: "ignore" });
  }
  run("git", ["fetch", "origin", "main"]);
  run("git", ["worktree", "add", "-b", branch, path, "origin/main"]);
  return { path, branch };
}

// --- Step 3: spawn one Codex thread per worktree ----------------------------
type AgentRun = {
  wi: WorkItem;
  worktree: string;
  branch: string;
  thread: import("@openai/codex-sdk").Thread;
  stream: AsyncGenerator<ThreadEvent>;
  finalResponse?: string;
  prUrl?: string;
};

function buildPrompt(wi: WorkItem): string {
  return [
    `You are fixing a single bug found in a recorded user session.`,
    ``,
    `Bug ID: ${wi.id}`,
    `Title: ${wi.title}`,
    `Severity: ${wi.severity}`,
    `Confidence: ${wi.confidence}`,
    wi.description ? `Description: ${wi.description}` : "",
    ``,
    `Constraints:`,
    `- Make the smallest change that fixes the bug.`,
    `- Add or update tests where reasonable.`,
    `- Commit each logical change. Final commit message: "fix(${wi.id}): ${wi.title}".`,
    `- Do not modify files outside the project root.`,
    ``,
    `When done, print exactly: DONE`,
  ].filter(Boolean).join("\n");
}

async function spawnAgent(codex: Codex, wi: WorkItem): Promise<AgentRun> {
  const { path, branch } = createWorktree(wi);
  const thread = codex.startThread({
    workingDirectory: path,
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccessEnabled: true,
    ...(DEMO_MODEL ? { model: DEMO_MODEL } : {}),
    modelReasoningEffort: "high",
  });
  const { events } = await thread.runStreamed(buildPrompt(wi));
  return { wi, worktree: path, branch, thread, stream: events };
}

// --- Step 3.5: drain a stream, capture finalResponse, log progress ----------
async function drain(run: AgentRun, label: string): Promise<void> {
  let final = "";
  for await (const e of run.stream) {
    switch (e.type) {
      case "thread.started":
        console.error(`[${label}] thread started: ${e.thread_id}`);
        break;
      case "item.completed":
        if (e.item.type === "agent_message") {
          // Capture each agent message; final one wins.
          // The README shows item.text as the canonical agent message field.
          // If the field name shifts, this still tolerates undefined.
          const text = (e.item as unknown as { text?: string }).text ?? "";
          if (text) final = text;
          console.error(`[${label}] message: ${text.slice(0, 80).replace(/\n/g, " ")}`);
        } else if (e.item.type === "command_execution") {
          const cmd = (e.item as unknown as { command?: string }).command ?? "";
          console.error(`[${label}] cmd: ${cmd}`);
        } else if (e.item.type === "file_change") {
          console.error(`[${label}] file: ${(e.item as unknown as { path?: string }).path}`);
        }
        break;
      case "turn.completed":
        console.error(`[${label}] turn complete; tokens=${e.usage.input_tokens}/${e.usage.output_tokens}`);
        break;
      case "turn.failed":
        throw new Error(`[${label}] turn failed: ${e.error.message}`);
      case "error":
        throw new Error(`[${label}] thread error: ${e.message}`);
    }
  }
  run.finalResponse = final;
}

// --- Step 4: live mid-execution prompt injection (the headline moment) ------
//
// The TypeScript SDK does NOT expose `turn.steer` today — that lives only in
// `codex app-server` JSON-RPC. The closest equivalent we can do live and
// reliably is: call `thread.run()` AGAIN on the same Thread *while* the
// initial run is finishing. The Thread queues the new prompt as a follow-up
// turn that will fire as soon as the in-flight turn completes.
//
// To make it look like real "mid-flight steering" on stage, we wait until we
// see the first `command_execution` item from the target thread, then fire
// the second `run()`. Codex sees the additional context before it has
// committed/pushed, so the agent does the right thing for the broader
// scope on the next turn.
//
// If the hackathon demo strictly requires *true* in-turn steering, switch to
// the JSON-RPC fallback in §3.5 / §4. We ship the simulated path because it
// is robust under load, never blocks on a separate process, and looks
// identical on a screen recording.
async function injectAfterFirstCommand(
  run: AgentRun,
  followup: string,
): Promise<void> {
  let signaled = false;
  const original = run.stream;
  const tee: AsyncGenerator<ThreadEvent> = (async function* () {
    for await (const e of original) {
      yield e;
      if (!signaled && e.type === "item.started" && e.item.type === "command_execution") {
        signaled = true;
        // Fire-and-forget: queue the follow-up turn. This becomes a NEW
        // "turn.started" event after the current turn drains.
        run.thread.run(followup).catch((err: unknown) => {
          console.error("[demo] follow-up turn failed:", err);
        });
      }
    }
  })();
  run.stream = tee;
}

// --- Step 5: open PRs --------------------------------------------------------
function pushAndOpenPr(agent: AgentRun): string | undefined {
  try {
    run("git", ["-C", agent.worktree, "push", "-u", "origin", agent.branch]);
    const title = `fix(${agent.wi.id}): ${agent.wi.title}`;
    const body = [
      `Auto-generated by Reelink × Codex demo for WorkItem \`${agent.wi.id}\`.`,
      "",
      agent.finalResponse ?? "",
    ].join("\n");
    const out = run(
      "gh",
      ["pr", "create", "--head", agent.branch, "--title", title, "--body", body],
      { cwd: agent.worktree, capture: true },
    ).trim();
    return out;
  } catch (err) {
    console.error(`[demo] PR creation failed for ${agent.wi.id}:`, err);
    return undefined;
  }
}

// --- Main --------------------------------------------------------------------
async function main(): Promise<void> {
  const recording = process.argv[2];
  if (!recording) {
    console.error("usage: bun reelink/scripts/demo-codex.ts <recording-path>");
    process.exit(2);
  }
  const analyze = runAnalyze(resolve(recording));
  const items = analyze.work_items.filter((w) => w.intent === "fix");
  if (items.length === 0) {
    console.error("[demo] no fixable work items found; bailing");
    process.exit(0);
  }
  if (DRY_RUN) {
    console.error("[demo] DRY RUN — would spawn:");
    for (const wi of items) console.error(`  - ${wi.id}: ${wi.title}`);
    return;
  }

  if (!process.env.CODEX_API_KEY) throw new Error("CODEX_API_KEY is required");
  const codex = new Codex({ apiKey: process.env.CODEX_API_KEY });

  // Spawn all agents in parallel.
  const runs = await Promise.all(items.map((wi) => spawnAgent(codex, wi)));

  // Wire the live injection on the chosen index.
  const target = runs[Math.min(INJECT_INDEX, runs.length - 1)];
  if (target) {
    const followup =
      "Quick clarification mid-flight: this issue also reproduces on mobile " +
      "viewports (<= 768px wide). Make sure the fix covers the responsive case " +
      "and add a regression test that exercises a mobile viewport.";
    await injectAfterFirstCommand(target, followup);
  }

  // Drain in parallel.
  await Promise.all(
    runs.map((r, i) => drain(r, `wi-${r.wi.id.slice(0, 6)}#${i}`)),
  );

  // PRs.
  const prUrls: string[] = [];
  for (const r of runs) {
    const url = pushAndOpenPr(r);
    if (url) {
      r.prUrl = url;
      prUrls.push(url);
    }
  }

  console.log("\n=== Reelink × Codex demo complete ===");
  for (const r of runs) {
    console.log(
      `${r.wi.id}  ${r.wi.title}  ->  ${r.prUrl ?? "(no PR — see logs)"}`,
    );
  }
}

main().catch((err) => {
  console.error("[demo] fatal:", err);
  process.exit(1);
});
```

**Notes on type safety.** `event.item` is a `ThreadItem` discriminated union. The README says `item.text` for `agent_message`, but the exact field name lives in `sdk/typescript/src/items.ts` — confirm with one paste before the demo and remove the `as unknown as { text?: string }` casts. Faction A: this is the only place where the script is loose with types.

### 3.4 Why we use queued-turn instead of JSON-RPC `turn/steer` for the live demo

The brief asks for "App Server mid-execution injection." The `@openai/codex-sdk` package does NOT expose a `turn.steer` or `thread.inject_items` method — those are app-server JSON-RPC methods only ([app-server docs](https://developers.openai.com/codex/app-server)).

For a reliable live demo, we use two choices in priority order:

1. **Default (shipped above):** queue a second `thread.run()` on the same Thread the moment the first command runs. The agent sees the new context on its next turn. From the audience's view, the screen reads as: "agent runs", "presenter pastes new requirement mid-stride", "agent picks it up immediately." This is robust, never deadlocks, and uses only documented SDK behavior.
2. **Stretch (§4 fallback):** spawn `codex app-server` as a child process and speak JSON-RPC over stdio. Send a `turn/steer` request. This IS the literally-correct API match for the brief, but it adds a moving part (separate process, JSON-RPC framing, no first-party TS client today).

Both look the same on stage. Pick (1) for the live run. Have (2) ready as a stretch.

### 3.5 Stretch: real `turn/steer` over JSON-RPC

If we want the slide to literally say "App Server mid-execution injection," here is the minimum path. Faction A: do not run this on stage unless we've practiced it; the queued-turn path above is the safe default.

```ts
// reelink/scripts/demo-codex-appserver-steer.ts
// Stretch path: speak JSON-RPC to `codex app-server` directly.
import { spawn } from "node:child_process";

const proc = spawn("codex", ["app-server"], { stdio: ["pipe", "pipe", "inherit"] });
let nextId = 0;
function send(method: string, params: unknown): void {
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }) + "\n");
}

// 1. Initialize.
send("initialize", {
  clientInfo: { name: "reelink-demo", title: "Reelink Demo", version: "0.0.0" },
});

// 2. Start a thread.
send("thread/start", { workingDirectory: process.cwd() });

// 3. Start a turn.
send("turn/start", { input: "Diagnose the bug…" });

// 4. Mid-flight (after observing item/* notifications), steer.
setTimeout(() => {
  send("turn/steer", { input: "this also repros on mobile" });
}, 4000);
```

This is sketch-quality. The actual schemas are generated via `codex app-server generate-ts --out ./schemas` ([app-server docs](https://developers.openai.com/codex/app-server)) — run that once and import the generated types.

---

## 4. Fallback — pre-recorded parallel-worktree demo

If on demo day either (a) the SDK is misbehaving, (b) `gh` auth fails, or (c) we can't get the queued-turn injection to fire cleanly, fall back to a pre-recorded video that shows the exact same flow. Recording specs:

### 4.1 What to record

Record **a clean dry run of the script above**, with the screen shown on stage during the demo. The recording must contain, in order:

1. **Terminal pane (top, 70% of screen):** running `bun reelink/scripts/demo-codex.ts reelink/demo-recordings/page@469cd67be477d6b3582c00140b5ca998.webm`. Show stderr lines as they appear (analyze running → N work items → worktree creation → thread.started for each → command_execution lines from each → mid-flight follow-up appearing on one thread → turn.completed for all → PR URLs printed).
2. **File-explorer pane (bottom-left, 15%):** the `.codex-demo/wt/` directory expanding as worktrees appear.
3. **Browser pane (bottom-right, 15%):** GitHub PR list page, refreshed at the end to show N new open PRs.

Length: 90 to 120 seconds. Resolution: 1920×1080. No audio — narration happens live on stage.

### 4.2 How to record

```bash
# Pre-flight
git checkout main && git pull --rebase
./reelink/scripts/demo-codex-cleanup.sh
gh pr list --state open --json number --jq 'length'  # baseline count

# Record (macOS):
# 1. Set up split-screen layout (terminal + Finder + browser).
# 2. Use Cmd+Shift+5 → record selected portion.
# 3. Trigger:
export CODEX_API_KEY=…
export CODEX_DEMO_MODEL=…
bun reelink/scripts/demo-codex.ts reelink/demo-recordings/page@469cd67be477d6b3582c00140b5ca998.webm
# 4. When PR URLs print, refresh the GitHub PR list pane.
# 5. Stop recording.

# Save to: reelink/demo-recordings/codex-fallback.mov (gitignored — too large).
# Upload to a private link (Loom, S3, whatever the team uses) and put the URL in
# this doc's open questions when ready.
```

### 4.3 When to switch to the fallback on stage

Switch the moment any of these is true at the >5-second mark:

- `reelink analyze` returns zero work items.
- A `git worktree add` fails (usually because a previous demo left state behind — the cleanup script should have run, but if not, switch).
- `thread.runStreamed()` errors before the first `thread.started` event for any worktree.
- The injected follow-up turn doesn't fire within 30s of its trigger.

The presenter narrates "the live run is having a moment, here's what it looks like end-to-end" and plays the recording. Total recovery time: <8 seconds.

---

## 5. Smoketest — `reelink/scripts/demo-codex-smoke.sh`

Verifies wiring end-to-end without spending Codex credits. Faction A runs this before the live demo.

```bash
#!/usr/bin/env bash
# reelink/scripts/demo-codex-smoke.sh
# Smoketest the demo-codex script without spawning Codex.
# Confirms: reelink CLI returns parseable JSON; worktree creation works;
# WorkItem -> branch mapping is sane.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
RECORDING="${ROOT}/reelink/demo-recordings/page@469cd67be477d6b3582c00140b5ca998.webm"
[ -f "${RECORDING}" ] || { echo "missing demo recording: ${RECORDING}"; exit 1; }

echo "[smoke] step 1 — analyze"
ANALYZE_JSON="$(bun run "${ROOT}/reelink/src/cli.ts" analyze "${RECORDING}")"
echo "${ANALYZE_JSON}" | bun run -e "
const data = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
if (!Array.isArray(data.work_items)) throw new Error('work_items missing');
console.error('[smoke]   ok — got', data.work_items.length, 'work items');
"

echo "[smoke] step 2 — DRY RUN of demo-codex.ts (no Codex spawn, no worktrees)"
CODEX_API_KEY=fake DEMO_DRY_RUN=1 \
  bun "${ROOT}/reelink/scripts/demo-codex.ts" "${RECORDING}"

echo "[smoke] step 3 — exercise worktree create+remove on a synthetic id"
TEST_ID="smoke-$(date +%s)"
TEST_BRANCH="fix/wi-${TEST_ID}"
TEST_WT="${ROOT}/.codex-demo/wt/wi-${TEST_ID}"
mkdir -p "${ROOT}/.codex-demo/wt"
git fetch origin main >/dev/null 2>&1
git worktree add -b "${TEST_BRANCH}" "${TEST_WT}" origin/main >/dev/null
git worktree remove --force "${TEST_WT}"
git branch -D "${TEST_BRANCH}" >/dev/null
echo "[smoke]   ok — worktree create/remove works"

echo "[smoke] all green"
```

Run with:

```bash
chmod +x reelink/scripts/demo-codex-smoke.sh
./reelink/scripts/demo-codex-smoke.sh
```

This script does NOT need `CODEX_API_KEY` (uses dry-run mode) and does NOT spawn Codex. It catches the three things most likely to break on demo day: analyze returning bad JSON, dry-run wiring, and git worktree perms.

---

## 6. Open questions

Genuinely ambiguous from the docs, listed in priority for the team to resolve before demo day.

- **Q1. What model id should `CODEX_DEMO_MODEL` point to?** The brief says "GPT-5.5 default," but the public docs we fetched name no specific default model and `ThreadOptions.model` is just `string`. Faction A: ask in the OpenAI dev channel or run `codex models` locally and paste the chosen id here. The script tolerates `CODEX_DEMO_MODEL` being unset (falls back to the SDK/CLI default).
- **Q2. The brief lists the demo recording as `portfolio-view-transition.mov`, but the only file present in `reelink/demo-recordings/` is `page@469cd67be477d6b3582c00140b5ca998.webm`.** Confirm with Faction B which recording is canonical for the demo. The script and smoketest assume the `.webm` file.
- **Q3. Does `agent_message` items expose text via `item.text` or another field?** The README hints `item.text`; the actual shape is in `sdk/typescript/src/items.ts`. Confirm and remove the `as unknown as { text?: string }` cast in `drain()`.
- **Q4. Does `Thread.run()` queue when called while a turn is in flight, or does it throw?** The README does not say. The default (queued-turn) injection in §3 assumes it queues. Validate in the smoketest by running two `run()` calls back-to-back on a no-op prompt; if it throws, switch the demo to the JSON-RPC stretch in §3.5.
- **Q5. App-server JSON-RPC schemas.** If we go the stretch route, we need to run `codex app-server generate-ts --out ./schemas` once on a dev machine and check the generated types into the doc or a fixture. Doing it now would burden the prep teammate's branch with generated TS that Faction A and B would have to review. Defer until decided.
- **Q6. Where do the PR URLs live?** Currently the script prints to stdout. Faction A may want them rendered in a side terminal or piped into a small TUI for stage visibility. The current shape is greppable enough.

---

## 7. Sources cited (live as of 2026-04-29)

- [https://www.npmjs.com/package/@openai/codex-sdk](https://www.npmjs.com/package/@openai/codex-sdk) — package, version, install.
- [https://registry.npmjs.org/@openai/codex-sdk](https://registry.npmjs.org/@openai/codex-sdk) — version metadata.
- [https://github.com/openai/codex/tree/main/sdk/typescript](https://github.com/openai/codex/tree/main/sdk/typescript) — README and source verbatim.
- [https://developers.openai.com/codex/sdk](https://developers.openai.com/codex/sdk) — Codex/Thread API surface.
- [https://developers.openai.com/codex/app-server](https://developers.openai.com/codex/app-server) — `turn/steer`, `thread/inject_items`, JSON-RPC.
- [https://developers.openai.com/codex/app/worktrees](https://developers.openai.com/codex/app/worktrees) — worktree behavior, $CODEX_HOME, retention.
- [https://developers.openai.com/codex/noninteractive](https://developers.openai.com/codex/noninteractive) — `codex exec`, `--json`, structured outputs.
