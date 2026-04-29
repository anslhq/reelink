// fallow-ignore-next-line unresolved-import
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { z } from "zod/v4";

import { registerUnavailableTool } from "./_helpers.js";
import { withToolLogging } from "../../utils/tool-middleware.js";

type BrowserArtifactEvent = Record<string, unknown>;

type ActiveRecording = {
  session_id: string;
  url: string;
  outPath: string;
  artifactDir: string;
  domDir: string;
  started_at: string;
  max_seconds: number;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  timer: NodeJS.Timeout;
  networkEvents: BrowserArtifactEvent[];
  consoleEvents: BrowserArtifactEvent[];
  domSnapshots: Array<{ ts: number; path: string; url: string; title: string }>;
  stopping?: Promise<StoppedRecording>;
};

type StoppedRecording = {
  session_id: string;
  status: "stopped";
  path: string;
  exists: boolean;
  size_bytes: number | null;
  started_at: string;
  stopped_at: string;
  duration_limit_hit: boolean;
  artifacts: { network: string; console: string; dom: string; manifest: string };
};

const activeRecordings = new Map<string, ActiveRecording>();
const stoppedRecordings = new Map<string, StoppedRecording>();

export function registerRecordingTools(server: McpServer): void {
  registerUnavailableTool(server, "reelink_get_dom", {
    recording_id: z.string(),
    ts: z.number(),
  });
  registerUnavailableTool(server, "reelink_get_components", {
    recording_id: z.string(),
    ts: z.number(),
    x: z.number().optional(),
    y: z.number().optional(),
  });
}

export function registerRunTools(server: McpServer): void {
  registerRecordLifecycleTools(server);
  registerBrowserAutomationTools(server);
  registerUnavailableTool(server, "reelink_run", {
    task_description: z.string(),
    target_url: z.string(),
  });
}

function registerRecordLifecycleTools(server: McpServer): void {
  server.registerTool(
    "reelink_record_start",
    {
      title: "Start a headed browser recording",
      description:
        "Open a headed Chromium window at a URL and keep recording until reelink_record_stop is called or max_seconds elapses.",
      inputSchema: {
        url: z.string(),
        out_path: z.string().optional(),
        max_seconds: z.number().positive().max(300).default(60),
      },
      outputSchema: {
        session_id: z.string(),
        status: z.literal("recording"),
        url: z.string(),
        path: z.string(),
        started_at: z.string(),
        max_seconds: z.number(),
        message: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reelink_record_start", async ({ url, out_path, max_seconds }) =>
      jsonToolResult(await startRecording({ url, out_path, max_seconds })),
    ),
  );

  server.registerTool(
    "reelink_record_stop",
    {
      title: "Stop a headed browser recording",
      description: "Stop an active Reelink browser recording and return the saved .webm path plus captured artifacts.",
      inputSchema: {
        session_id: z.string(),
      },
      outputSchema: {
        session_id: z.string(),
        status: z.literal("stopped"),
        path: z.string(),
        exists: z.boolean(),
        size_bytes: z.number().nullable(),
        started_at: z.string(),
        stopped_at: z.string(),
        duration_limit_hit: z.boolean(),
        artifacts: z.object({
          network: z.string(),
          console: z.string(),
          dom: z.string(),
          manifest: z.string(),
        }),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reelink_record_stop", async ({ session_id }) =>
      jsonToolResult(await stopRecording(session_id, false)),
    ),
  );

  server.registerTool(
    "reelink_record_status",
    {
      title: "List active browser recordings",
      description: "Return active Reelink recording sessions in this MCP server process.",
      inputSchema: {},
      outputSchema: {
        active: z.array(
          z.object({
            session_id: z.string(),
            url: z.string(),
            path: z.string(),
            started_at: z.string(),
            max_seconds: z.number(),
          }),
        ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    withToolLogging("reelink_record_status", async () =>
      jsonToolResult({
        active: [...activeRecordings.values()].map((session) => ({
          session_id: session.session_id,
          url: session.url,
          path: session.outPath,
          started_at: session.started_at,
          max_seconds: session.max_seconds,
        })),
      }),
    ),
  );
}

function registerBrowserAutomationTools(server: McpServer): void {
  server.registerTool(
    "reelink_browser_snapshot",
    {
      title: "Snapshot the active recording browser",
      description: "Capture a lightweight DOM/text snapshot from an active Reelink recording session.",
      inputSchema: {
        session_id: z.string(),
        save_dom: z.boolean().default(true),
      },
      outputSchema: {
        session_id: z.string(),
        url: z.string(),
        title: z.string(),
        text: z.string(),
        dom_path: z.string().nullable(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reelink_browser_snapshot", async ({ session_id, save_dom }) =>
      jsonToolResult(await snapshotBrowser(session_id, save_dom)),
    ),
  );

  server.registerTool(
    "reelink_browser_click",
    {
      title: "Click in the active recording browser",
      description: "Click by visible text, CSS selector, or x/y coordinates inside an active recording session.",
      inputSchema: {
        session_id: z.string(),
        text: z.string().optional(),
        selector: z.string().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
      },
      outputSchema: {
        session_id: z.string(),
        ok: z.boolean(),
        action: z.string(),
        url: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reelink_browser_click", async (args) => jsonToolResult(await clickBrowser(args))),
  );

  server.registerTool(
    "reelink_browser_type",
    {
      title: "Type in the active recording browser",
      description: "Fill a selector in an active recording session.",
      inputSchema: {
        session_id: z.string(),
        selector: z.string(),
        text: z.string(),
      },
      outputSchema: {
        session_id: z.string(),
        ok: z.boolean(),
        selector: z.string(),
        url: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reelink_browser_type", async ({ session_id, selector, text }) => {
      const session = requireSession(session_id);
      await session.page.fill(selector, text);
      return jsonToolResult({ session_id, ok: true, selector, url: session.page.url() });
    }),
  );

  server.registerTool(
    "reelink_browser_navigate",
    {
      title: "Navigate the active recording browser",
      description: "Navigate an active recording session to a URL.",
      inputSchema: {
        session_id: z.string(),
        url: z.string(),
      },
      outputSchema: {
        session_id: z.string(),
        ok: z.boolean(),
        url: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reelink_browser_navigate", async ({ session_id, url }) => {
      const session = requireSession(session_id);
      await session.page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => undefined);
      return jsonToolResult({ session_id, ok: true, url: session.page.url() });
    }),
  );

  server.registerTool(
    "reelink_browser_wait",
    {
      title: "Wait in the active recording browser",
      description: "Wait for a short interval while recording continues.",
      inputSchema: {
        session_id: z.string(),
        ms: z.number().positive().max(30000).default(1000),
      },
      outputSchema: {
        session_id: z.string(),
        ok: z.boolean(),
        waited_ms: z.number(),
        url: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    withToolLogging("reelink_browser_wait", async ({ session_id, ms }) => {
      const session = requireSession(session_id);
      await session.page.waitForTimeout(ms);
      return jsonToolResult({ session_id, ok: true, waited_ms: ms, url: session.page.url() });
    }),
  );
}

async function startRecording({ url, out_path, max_seconds }: { url: string; out_path?: string; max_seconds: number }) {
  const recDir = resolve("demo-recordings");
  const outPath = out_path ? resolve(out_path) : resolve(recDir, `reelink-${Date.now()}.webm`);
  const session_id = `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const started_at = new Date().toISOString();
  const artifactDir = resolve(".reelink", "browser-recordings", session_id);
  const domDir = join(artifactDir, "dom");
  mkdirSync(recDir, { recursive: true });
  mkdirSync(resolve(outPath, ".."), { recursive: true });
  mkdirSync(domDir, { recursive: true });

  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let session: ActiveRecording | undefined;

  try {
    browser = await chromium.launch({ headless: false });
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: recDir, size: { width: 1280, height: 720 } },
    });
    const page = await context.newPage();
    session = {
      session_id,
      url,
      outPath,
      artifactDir,
      domDir,
      started_at,
      max_seconds,
      browser,
      context,
      page,
      timer: setTimeout(() => void stopRecording(session_id, true).catch(() => undefined), max_seconds * 1000),
      networkEvents: [],
      consoleEvents: [],
      domSnapshots: [],
    };
    activeRecordings.set(session_id, session);
    attachArtifactListeners(session);
    await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => undefined);
  } catch (error) {
    if (session) {
      clearTimeout(session.timer);
      activeRecordings.delete(session_id);
    }
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
    throw error;
  }

  return {
    session_id,
    status: "recording" as const,
    url,
    path: outPath,
    started_at,
    max_seconds,
    message:
      "Recording started in headed Chromium. Drive it with reelink_browser_* tools, then call reelink_record_stop with this session_id.",
  };
}

function attachArtifactListeners(session: ActiveRecording): void {
  session.page.on("console", (message) =>
    session.consoleEvents.push({
      ts: elapsed(session),
      type: message.type(),
      text: truncate(message.text(), 2000),
      location: message.location(),
    }),
  );
  session.page.on("request", (request) =>
    session.networkEvents.push({
      ts: elapsed(session),
      event: "request",
      method: request.method(),
      url: truncate(request.url(), 1000),
      resource_type: request.resourceType(),
    }),
  );
  session.page.on("response", (response) =>
    session.networkEvents.push({
      ts: elapsed(session),
      event: "response",
      status: response.status(),
      url: truncate(response.url(), 1000),
      ok: response.ok(),
    }),
  );
  session.page.on("requestfailed", (request) =>
    session.networkEvents.push({
      ts: elapsed(session),
      event: "requestfailed",
      method: request.method(),
      url: truncate(request.url(), 1000),
      failure: request.failure()?.errorText,
    }),
  );
}

async function snapshotBrowser(sessionId: string, saveDom: boolean) {
  const session = requireSession(sessionId);
  const title = await session.page.title().catch(() => "");
  const text = ((await session.page.locator("body").innerText().catch(() => "")) || "").slice(0, 8000);
  const domPath = saveDom ? await saveDomSnapshot(session, title) : null;
  return { session_id: sessionId, url: session.page.url(), title, text, dom_path: domPath };
}

async function clickBrowser(args: { session_id: string; text?: string; selector?: string; x?: number; y?: number }) {
  const session = requireSession(args.session_id);

  if (args.selector) {
    await session.page.locator(args.selector).first().click();
    return { session_id: args.session_id, ok: true, action: `selector:${args.selector}`, url: session.page.url() };
  }

  if (args.text) {
    await session.page.getByText(args.text, { exact: false }).first().click();
    return { session_id: args.session_id, ok: true, action: `text:${args.text}`, url: session.page.url() };
  }

  if (typeof args.x === "number" && typeof args.y === "number") {
    await session.page.mouse.click(args.x, args.y);
    return { session_id: args.session_id, ok: true, action: `xy:${args.x},${args.y}`, url: session.page.url() };
  }

  throw new Error("Provide selector, text, or x/y for reelink_browser_click");
}

async function stopRecording(sessionId: string, durationLimitHit: boolean): Promise<StoppedRecording> {
  const completed = stoppedRecordings.get(sessionId);
  if (completed) return completed;

  const session = requireSession(sessionId);
  if (session.stopping) return session.stopping;
  session.stopping = (async () => {
    clearTimeout(session.timer);
    await saveDomSnapshot(session, await session.page.title().catch(() => "final"));
    const video = session.page.video();
    await session.context.close();
    await session.browser.close();
    const tmpPath = await video?.path();
    if (!tmpPath || !existsSync(tmpPath)) throw new Error("Playwright did not write a video artifact");
    if (tmpPath !== session.outPath) renameSync(tmpPath, session.outPath);
    const artifacts = writeArtifacts(session, durationLimitHit);
    const sizeBytes = existsSync(session.outPath) ? statSync(session.outPath).size : null;
    const stopped = {
      session_id: sessionId,
      status: "stopped" as const,
      path: session.outPath,
      exists: existsSync(session.outPath),
      size_bytes: sizeBytes,
      started_at: session.started_at,
      stopped_at: new Date().toISOString(),
      duration_limit_hit: durationLimitHit,
      artifacts,
    };
    activeRecordings.delete(sessionId);
    stoppedRecordings.set(sessionId, stopped);
    return stopped;
  })().catch((error) => {
    session.stopping = undefined;
    throw error;
  });
  return session.stopping;
}

async function saveDomSnapshot(session: ActiveRecording, title: string): Promise<string> {
  const index = session.domSnapshots.length + 1;
  const path = join(session.domDir, `snapshot-${String(index).padStart(4, "0")}.html`);
  const html = await session.page.content().catch(() => "");
  writeFileSync(path, html);
  session.domSnapshots.push({ ts: elapsed(session), path, url: session.page.url(), title });
  return path;
}

function writeArtifacts(session: ActiveRecording, durationLimitHit: boolean): StoppedRecording["artifacts"] {
  const network = join(session.artifactDir, "network.jsonl");
  const consolePath = join(session.artifactDir, "console.jsonl");
  const manifest = join(session.artifactDir, "manifest.json");
  writeJsonl(network, session.networkEvents);
  writeJsonl(consolePath, session.consoleEvents);
  writeFileSync(
    manifest,
    `${JSON.stringify(
      {
        session_id: session.session_id,
        url: session.url,
        final_url: session.page.url(),
        started_at: session.started_at,
        stopped_at: new Date().toISOString(),
        max_seconds: session.max_seconds,
        duration_limit_hit: durationLimitHit,
        video: session.outPath,
        artifacts: { network, console: consolePath, dom: session.domDir },
        dom_snapshots: session.domSnapshots,
      },
      null,
      2,
    )}\n`,
  );
  return { network, console: consolePath, dom: session.domDir, manifest };
}

function writeJsonl(path: string, events: BrowserArtifactEvent[]): void {
  writeFileSync(path, events.map((event) => JSON.stringify(event)).join("\n") + (events.length ? "\n" : ""));
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...(+${value.length - maxLength} chars)`;
}

function requireSession(sessionId: string): ActiveRecording {
  const session = activeRecordings.get(sessionId);
  if (!session) {
    if (stoppedRecordings.has(sessionId)) throw new Error(`Recording session already stopped: ${sessionId}`);
    throw new Error(`No active recording session: ${sessionId}`);
  }
  return session;
}

function elapsed(session: ActiveRecording): number {
  return Math.round(((Date.now() - Date.parse(session.started_at)) / 1000) * 1000) / 1000;
}

function jsonToolResult<T>(structuredContent: T) {
  return { content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }], structuredContent };
}
