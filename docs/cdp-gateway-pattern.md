# CDP-attach Gateway Pattern — for Faction B (gateway sub-task)

Paste-ready TypeScript skeletons for **Decision 9** (single MCP gateway pattern with Playwright MCP child via CDP attach). Faction B copies these into `reelink/src/recording/` and `reelink/src/mcp/tools/recording.ts` during Phase 1.

**Locked invariants:**
- Single MCP server registered in the user's coding-agent config (`reelink`).
- Playwright MCP runs as a *child stdio subprocess* of the Reelink server. Never registered separately.
- Reelink-native owns recording (video/HAR/trace). Forwarded child tools are limited to navigation/click/type/evaluate/snapshot/screenshot.

**References (read these for context):**
- `playwright-mcp/README.md` — CLI flags table (`--cdp-endpoint <endpoint>`, env `PLAYWRIGHT_MCP_CDP_ENDPOINT`)
- `playwright-mcp/config.d.ts:72` — `Config.browser.cdpEndpoint?: string`
- `playwright-mcp/cli.js` — entry point delegates to `tools.decorateMCPCommand` from `playwright-core/lib/coreBundle`
- `reelink/src/mcp/server.ts` — current aggregator
- `openspec/changes/build-reelink-mcp/design.md` Decision 9
- `openspec/changes/build-reelink-mcp/tasks.md` 1B.x (recording tasks)

---

## 1. Chromium launch with remote-debugging port

Reelink's recording session launches Chromium with the DevTools protocol exposed on a known port. Both the Reelink recorder AND the spawned Playwright MCP child attach to the *same* Chromium instance via that endpoint.

Pick a port at recording start (random unprivileged port to avoid collisions when multiple recordings run on the same machine).

```ts
// reelink/src/recording/launch.ts
import { chromium, type Browser, type BrowserContext } from "playwright";
import { logger } from "../utils/logger.js";

const log = logger("recording-launch");

export type LaunchedBrowser = {
  browser: Browser;
  context: BrowserContext;
  cdpPort: number;
  cdpHttpUrl: string; // e.g. "http://127.0.0.1:9234"
  cdpWsUrl: string;   // e.g. "ws://127.0.0.1:9234/devtools/browser/<id>"
};

export async function launchRecordingBrowser(opts: {
  videoDir: string;
  harPath: string;
  viewport?: { width: number; height: number };
}): Promise<LaunchedBrowser> {
  const cdpPort = await pickFreePort();
  const cdpHttpUrl = `http://127.0.0.1:${cdpPort}`;

  // Use launchPersistentContext if you need profile persistence across recordings.
  // For Reelink v0.1, fresh per-recording profile (default temp dir) is fine.
  const browser = await chromium.launch({
    headless: false, // visible toolbar matters; react-grab toolbar shows up here
    args: [`--remote-debugging-port=${cdpPort}`],
  });

  const context = await browser.newContext({
    viewport: opts.viewport ?? { width: 1280, height: 720 },
    recordVideo: { dir: opts.videoDir, size: opts.viewport ?? { width: 1280, height: 720 } },
    recordHar: { path: opts.harPath },
  });

  // Discover the actual ws://host:port/devtools/browser/<id> endpoint.
  // Playwright doesn't expose it directly; we fetch /json/version off the HTTP
  // side of the same DevTools Protocol port the browser opened.
  const cdpWsUrl = await discoverCdpWsEndpoint(cdpHttpUrl);

  log.info({ cdpPort, cdpWsUrl }, "chromium launched with cdp endpoint");
  return { browser, context, cdpPort, cdpHttpUrl, cdpWsUrl };
}

async function pickFreePort(): Promise<number> {
  const { createServer } = await import("node:net");
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error("could not pick free port")));
      }
    });
  });
}

async function discoverCdpWsEndpoint(httpUrl: string, retries = 30): Promise<string> {
  // Browser may take a moment to bind /json/version. Poll briefly.
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${httpUrl}/json/version`);
      if (res.ok) {
        const data = (await res.json()) as { webSocketDebuggerUrl?: string };
        if (data.webSocketDebuggerUrl) {
          // Replace localhost with 127.0.0.1 if needed; some Node fetch impls disagree
          return data.webSocketDebuggerUrl.replace("ws://localhost", "ws://127.0.0.1");
        }
      }
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`CDP /json/version did not respond at ${httpUrl}`);
}
```

**Why fetch /json/version:** Playwright's `chromium.launch()` returns a `Browser` object but does NOT surface the underlying DevTools WebSocket URL the browser bound to. The DevTools HTTP endpoint at `/json/version` returns `{ webSocketDebuggerUrl }`, which is what Playwright MCP's `--cdp-endpoint` flag wants. This is the documented Chrome DevTools Protocol behavior.

---

## 2. Playwright MCP child spawn

Spawn `npx -y @playwright/mcp@latest --cdp-endpoint=<ws>` as a stdio subprocess. Reelink's parent MCP server connects to that child via the MCP TypeScript SDK's `Client` over `StdioClientTransport`.

```ts
// reelink/src/recording/mcp-child.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { logger } from "../utils/logger.js";

const log = logger("mcp-child");

export type PlaywrightMcpChild = {
  client: Client;
  close: () => Promise<void>;
};

export async function spawnPlaywrightMcpChild(opts: {
  cdpWsUrl: string;
  cdpTimeoutMs?: number;
}): Promise<PlaywrightMcpChild> {
  // Resolve absolute npx path on Apple Silicon to defend against launchd PATH issues.
  // The transport spawns the process for us; we just hand it the command.
  const transport = new StdioClientTransport({
    command: "/opt/homebrew/bin/npx",
    args: [
      "-y",
      "@playwright/mcp@latest",
      `--cdp-endpoint=${opts.cdpWsUrl}`,
      ...(opts.cdpTimeoutMs ? [`--cdp-timeout=${opts.cdpTimeoutMs}`] : []),
    ],
    // CRITICAL: child stderr must NOT be inherited if it would corrupt our parent's
    // stdout (which carries Reelink's MCP JSON-RPC). StdioClientTransport handles
    // stdio piping for us — it pipes child's stdout->parent's read side and
    // captures child's stderr to the transport's stderr stream we can subscribe to.
    stderr: "pipe",
  });

  const client = new Client(
    {
      name: "reelink-gateway",
      version: "0.0.0",
    },
    {
      capabilities: {},
    },
  );

  await client.connect(transport);
  log.info({ cdpWsUrl: opts.cdpWsUrl }, "playwright-mcp child connected");

  // Forward child stderr to OUR stderr (never stdout — corrupts MCP JSON-RPC).
  // The transport exposes the child stderr stream.
  if (transport.stderr) {
    transport.stderr.on("data", (chunk: Buffer) => {
      process.stderr.write(`[playwright-mcp child] ${chunk.toString()}`);
    });
  }

  return {
    client,
    close: async () => {
      try {
        await client.close();
      } catch (err) {
        log.warn({ err }, "client.close() failed");
      }
      try {
        await transport.close();
      } catch (err) {
        log.warn({ err }, "transport.close() failed");
      }
    },
  };
}
```

**Notes:**
- `StdioClientTransport` from `@modelcontextprotocol/sdk` handles the stdio piping. We do NOT spawn manually with `child_process.spawn` — that's what the SDK is for, and rolling our own would have to reimplement JSON-RPC framing.
- `stderr: "pipe"` keeps child errors visible without corrupting our JSON-RPC channel.
- All log writes go to **stderr** of the parent. Stdout is for MCP JSON-RPC only.

---

## 3. Tool list discovery

Once connected, list the child's tools and curate the subset Reelink will forward.

```ts
// reelink/src/recording/forwarder.ts (continued in section 4)
import type { PlaywrightMcpChild } from "./mcp-child.js";

const FORWARDED_TOOLS = new Set([
  "browser_navigate",
  "browser_click",
  "browser_type",
  "browser_evaluate",
  "browser_snapshot",
  "browser_take_screenshot",
]);

const FORBIDDEN_TOOLS = new Set([
  // Reelink-native owns recording; never forward these from the child.
  "browser_start_video",
  "browser_stop_video",
  "browser_start_tracing",
  "browser_stop_tracing",
]);

export async function discoverForwardableTools(child: PlaywrightMcpChild) {
  const list = await child.client.listTools();
  const all = list.tools ?? [];

  const forwarded = all.filter((t) => FORWARDED_TOOLS.has(t.name));
  const skipped = all.filter((t) => FORBIDDEN_TOOLS.has(t.name));
  const ignored = all.filter((t) => !FORWARDED_TOOLS.has(t.name) && !FORBIDDEN_TOOLS.has(t.name));

  return { forwarded, skipped, ignored };
}
```

The actual tool names from Playwright MCP at the time of this writing are prefixed `browser_`. If a future Playwright MCP renames them, update `FORWARDED_TOOLS`. Keep the curated set tight.

---

## 4. Tool forwarding

Each forwarded tool gets a `reelink_browser_<name>` wrapper on the parent MCP server that proxies to the child via `client.callTool()`.

```ts
// reelink/src/mcp/tools/recording.ts (extends existing file — coordinate with Faction B)
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import type { PlaywrightMcpChild } from "../../recording/mcp-child.js";
import { withToolLogging } from "../../utils/tool-middleware.js";

// Faction B: replace the current `not_implemented` stubs with these forwarders
// once a recording session is active. Until a session is active, the forwarders
// return { status: "no_recording_session" }.

export function registerForwardedBrowserTools(
  server: McpServer,
  getChild: () => PlaywrightMcpChild | null,
): void {
  const wrap = (childToolName: string, reelinkToolName: string, description: string) => {
    server.registerTool(
      reelinkToolName,
      {
        title: reelinkToolName,
        description,
        // Pass-through input schema. The child validates its own args; we use a
        // permissive object here so we don't drift if Playwright MCP changes.
        inputSchema: { args: z.record(z.string(), z.unknown()).default({}) },
        outputSchema: {
          status: z.enum(["ok", "no_recording_session", "child_error"]),
          result: z.unknown().optional(),
          error: z.string().optional(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
        },
      },
      withToolLogging(reelinkToolName, async (args) => {
        const child = getChild();
        if (!child) {
          return {
            content: [{ type: "text", text: "no_recording_session" }],
            structuredContent: { status: "no_recording_session" as const },
          };
        }
        try {
          const result = await child.client.callTool({
            name: childToolName,
            arguments: (args as { args?: Record<string, unknown> }).args ?? {},
          });
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            structuredContent: { status: "ok" as const, result },
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text", text: message }],
            structuredContent: { status: "child_error" as const, error: message },
          };
        }
      }),
    );
  };

  wrap("browser_navigate", "reelink_browser_navigate", "Navigate the recorded browser to a URL.");
  wrap("browser_click", "reelink_browser_click", "Click on an element in the recorded browser.");
  wrap("browser_type", "reelink_browser_type", "Type into a focused input in the recorded browser.");
  wrap("browser_evaluate", "reelink_browser_evaluate", "Evaluate a JS expression in the recorded page.");
  wrap("browser_snapshot", "reelink_browser_snapshot", "Capture an accessibility snapshot of the recorded page.");
  wrap("browser_take_screenshot", "reelink_browser_take_screenshot", "Take a screenshot of the recorded page.");
}
```

**Key invariants:**
- Reelink **never** forwards `browser_start_video`, `browser_start_tracing`, or any other recording-flavored tool. That's Reelink-native's job.
- The parent registers the wrappers with `reelink_browser_*` prefix so namespace collisions are impossible.
- All forwarders go through `withToolLogging` for observability parity with the rest of the Reelink tool surface.

---

## 5. Lifecycle

The Playwright MCP child is spawned **lazily on `reelink_run` (Layer 2) or `reelink record <url>` (Layer 1)** — never eagerly at MCP server startup. Reasoning:

- Layer 0 (`reelink_analyze`) doesn't need a browser at all. Spawning the child would waste resources and add a hard dependency on Chromium being installed.
- The child only makes sense when there's an active recording session to attach to.

```ts
// reelink/src/recording/session.ts (lifecycle owner)
import type { PlaywrightMcpChild } from "./mcp-child.js";
import type { LaunchedBrowser } from "./launch.js";
import { launchRecordingBrowser } from "./launch.js";
import { spawnPlaywrightMcpChild } from "./mcp-child.js";
import { logger } from "../utils/logger.js";

const log = logger("recording-session");

let activeBrowser: LaunchedBrowser | null = null;
let activeChild: PlaywrightMcpChild | null = null;

export function getActiveChild(): PlaywrightMcpChild | null {
  return activeChild;
}

export async function startRecordingSession(opts: {
  videoDir: string;
  harPath: string;
}): Promise<{ cdpWsUrl: string }> {
  if (activeBrowser || activeChild) {
    throw new Error("recording session already active; only one supported in v0.1");
  }
  activeBrowser = await launchRecordingBrowser(opts);
  activeChild = await spawnPlaywrightMcpChild({ cdpWsUrl: activeBrowser.cdpWsUrl });
  return { cdpWsUrl: activeBrowser.cdpWsUrl };
}

export async function stopRecordingSession(): Promise<void> {
  // Order matters: close child first so it stops sending CDP messages,
  // then close the browser context, then close the browser itself.
  const child = activeChild;
  const browser = activeBrowser;
  activeChild = null;
  activeBrowser = null;

  if (child) {
    try {
      await child.close();
    } catch (err) {
      log.warn({ err }, "child.close() during stop failed");
    }
  }
  if (browser) {
    try {
      await browser.context.close();
    } catch (err) {
      log.warn({ err }, "context.close() during stop failed");
    }
    try {
      await browser.browser.close();
    } catch (err) {
      log.warn({ err }, "browser.close() during stop failed");
    }
  }
}

// Cleanup on parent shutdown
process.on("SIGINT", () => void stopRecordingSession());
process.on("SIGTERM", () => void stopRecordingSession());
process.on("beforeExit", () => void stopRecordingSession());
```

**Failure handling:**
- If the child dies mid-session (e.g., user closes Chrome), `client.callTool()` rejects with a connection error. The forwarder catches and returns `{ status: "child_error", error: ... }`. Don't crash the parent MCP.
- All child stderr lines are forwarded to **parent stderr** with a prefix. Never to parent stdout.
- v0.1 supports exactly one active recording session. Concurrent sessions are out of scope (cleaner manifest semantics, smaller blast radius).

---

## 6. Single-MCP guarantee

Reelink is the *only* MCP server registered in the user's coding-agent config. The Playwright MCP child is a process inside Reelink's process tree, invisible to the user's coding agent.

`reelink doctor` enforces this:

```ts
// reelink/src/cli/doctor.ts (extends Faction A's doctor)

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

type DoctorCheck = { name: string; ok: boolean; detail: string };

function checkSingleMcp(): DoctorCheck[] {
  const checks: DoctorCheck[] = [];

  const codexConfig = join(homedir(), ".codex", "config.toml");
  if (existsSync(codexConfig)) {
    const text = readFileSync(codexConfig, "utf8");
    const playwrightMcpRegistered =
      /mcp_servers\.playwright/.test(text) || /@playwright\/mcp/.test(text);
    checks.push({
      name: "codex single-mcp",
      ok: !playwrightMcpRegistered,
      detail: playwrightMcpRegistered
        ? "playwright-mcp is also registered in ~/.codex/config.toml — Reelink spawns it as a child, you should NOT register it separately"
        : "only reelink registered in codex",
    });
  }

  const cursorConfig = join(homedir(), ".cursor", "mcp.json");
  if (existsSync(cursorConfig)) {
    const text = readFileSync(cursorConfig, "utf8");
    const playwrightMcpRegistered = /@playwright\/mcp|playwright-mcp/.test(text);
    checks.push({
      name: "cursor single-mcp",
      ok: !playwrightMcpRegistered,
      detail: playwrightMcpRegistered
        ? "playwright-mcp is also registered in ~/.cursor/mcp.json — remove it; Reelink spawns it"
        : "only reelink registered in cursor",
    });
  }

  return checks;
}

export function singleMcpChecks(): DoctorCheck[] {
  return checkSingleMcp();
}
```

A test fixture can also assert this at CI time:

```ts
// reelink/tests/single-mcp.spec.ts
import { test, expect } from "vitest";
import { singleMcpChecks } from "../src/cli/doctor.js";

test("only one MCP server registered in user agent configs", () => {
  const checks = singleMcpChecks();
  for (const c of checks) {
    expect(c.ok, c.detail).toBe(true);
  }
});
```

---

## 7. Open questions

- **Persistent vs ephemeral profile.** v0.1 uses ephemeral (default temp dir). If a recording needs the user's actual logged-in state, we'd swap to `chromium.launchPersistentContext({ userDataDir: ... })`. That changes the launch shape but not the CDP attach pattern. Out of scope for v0.1.
- **Multiple concurrent recordings.** v0.1 enforces one session at a time. Multi-session would need a session ID surface in the forwarded tools. Defer.
- **Codex SDK + worktree spawning interaction.** Task 1B.6 (Codex-native demo) spawns Codex parallel sub-agents on git worktrees. Each Codex sub-agent has its own MCP client connection to Reelink. They share the SAME Reelink server, which means they'd share the SAME recording session if any of them called `reelink_run`. Faction B should serialize Codex sub-agents' Layer 2 calls or fail-loud on concurrent `reelink_run`. Document the constraint.
- **CDP timeout.** README documents `--cdp-timeout` (default 30s). Pass through from Reelink config so users with slow Chromium startup can tune. Default fine for v0.1.
- **Headless mode.** Decision 9 implies headed (`headless: false`) so the react-grab toolbar is visible during Layer 1 recordings. Confirm with Faction B whether Layer 2 (`reelink_run`) also runs headed for demo purposes, or whether agent runs go headless to save resources. v0.1 recommendation: Layer 2 runs headed too for the Codex demo flex (visible browser is part of the demo), unless wall-time budget says otherwise.

---

## License attribution

Apache 2.0 throughout. Reelink imports `@modelcontextprotocol/sdk` (MIT), `playwright` (Apache 2.0), and spawns `@playwright/mcp` (Apache 2.0) as a runtime child. No source from `playwright-mcp` is copied into Reelink — only the runtime CLI is invoked. NOTICE entry not required for the spawn pattern; required if any source is copied.
