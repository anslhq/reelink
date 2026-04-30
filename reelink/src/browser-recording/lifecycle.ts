import { existsSync, renameSync, statSync, writeFileSync } from "node:fs";

import {
  browserPackageRelativePath,
  createBrowserRecordingPackage,
  type BrowserRecordingPackage,
} from "../recordings/store.js";
import type { Manifest } from "../schemas/recording.js";

export type BrowserArtifactEvent = Record<string, unknown>;

export type BrowserRecordingToolClassification = "demo-only";

export const directPlaywrightBrowserToolClassification = {
  classification: "demo-only" as BrowserRecordingToolClassification,
  reason:
    "Direct Playwright MCP browser controls drive the current headed demo recording only; OpenSpec runtime streams remain deferred to the Playwright MCP child/CDP gateway.",
};

export type BrowserRecordingPage = {
  goto(url: string, options?: { waitUntil?: "domcontentloaded" }): Promise<unknown>;
  title(): Promise<string>;
  content(): Promise<string>;
  url(): string;
  video(): { path(): Promise<string> } | null;
  locator(selector: string): { first(): { click(): Promise<unknown> }; innerText(): Promise<string> };
  getByText(text: string, options?: { exact?: boolean }): { first(): { click(): Promise<unknown> } };
  mouse: { click(x: number, y: number): Promise<unknown> };
  fill(selector: string, text: string): Promise<unknown>;
  waitForTimeout(ms: number): Promise<unknown>;
  on(event: "console", handler: (message: BrowserConsoleMessage) => void): void;
  on(event: "request", handler: (request: BrowserRequest) => void): void;
  on(event: "response", handler: (response: BrowserResponse) => void): void;
  on(event: "requestfailed", handler: (request: BrowserRequest) => void): void;
};

export type BrowserConsoleMessage = {
  type(): string;
  text(): string;
  location(): unknown;
};

export type BrowserRequest = {
  method(): string;
  url(): string;
  resourceType(): string;
  failure(): { errorText: string } | null;
};

export type BrowserResponse = {
  status(): number;
  url(): string;
  ok(): boolean;
  headers(): Record<string, string>;
};

export type BrowserRecordingDriver = {
  open(options: {
    videoDir: string;
    viewport: { width: number; height: number };
    videoSize: { width: number; height: number };
    headless?: boolean;
  }): Promise<{ browser: { close(): Promise<unknown> }; context: { close(): Promise<unknown> }; page: BrowserRecordingPage }>;
};

export type BrowserRecordingClock = {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

type RedactionTracker = {
  rules: Set<string>;
  streams: Set<string>;
};

export type ActiveBrowserRecording = {
  session_id: string;
  url: string;
  outPath: string;
  package: BrowserRecordingPackage;
  started_at: string;
  max_seconds: number;
  browser: { close(): Promise<unknown> };
  context: { close(): Promise<unknown> };
  page: BrowserRecordingPage;
  timer: unknown;
  networkEvents: BrowserArtifactEvent[];
  consoleEvents: BrowserArtifactEvent[];
  domSnapshots: Array<{ ts: number; path: string; url: string; title: string; tree_summary: string }>;
  durationLimitHit: boolean;
  redaction: RedactionTracker;
  stopping?: Promise<StoppedBrowserRecording>;
};

export type StartedBrowserRecording = {
  session_id: string;
  status: "recording";
  url: string;
  path: string;
  started_at: string;
  max_seconds: number;
  message: string;
};

export type StoppedBrowserRecording = {
  session_id: string;
  status: "stopped";
  path: string;
  exists: boolean;
  size_bytes: number | null;
  started_at: string;
  stopped_at: string;
  duration_limit_hit: boolean;
  artifacts: { network: string; network_har: string; console: string; dom: string; manifest: string };
};

export type BrowserSnapshotResult = {
  session_id: string;
  url: string;
  title: string;
  text: string;
  dom_path: string | null;
};

export class BrowserRecordingModule {
  private readonly activeRecordings = new Map<string, ActiveBrowserRecording>();
  private readonly stoppedRecordings = new Map<string, StoppedBrowserRecording>();

  constructor(
    private readonly driver: BrowserRecordingDriver,
    private readonly clock: BrowserRecordingClock = systemClock,
    private readonly createSessionId: () => string = defaultSessionId,
  ) {}

  async startRecording({
    url,
    out_path,
    max_seconds,
    headless,
  }: {
    url: string;
    out_path?: string;
    max_seconds: number;
    headless?: boolean;
  }): Promise<StartedBrowserRecording> {
    const session_id = this.createSessionId();
    const started_at = new Date(this.clock.now()).toISOString();
    const browserPackage = createBrowserRecordingPackage(session_id, { outPath: out_path });
    let opened: Awaited<ReturnType<BrowserRecordingDriver["open"]>> | undefined;
    let session: ActiveBrowserRecording | undefined;

    try {
      opened = await this.driver.open({
        videoDir: browserPackage.root,
        viewport: { width: 1280, height: 720 },
        videoSize: { width: 1280, height: 720 },
        headless,
      });
      session = {
        session_id,
        url,
        outPath: browserPackage.videoPath,
        package: browserPackage,
        started_at,
        max_seconds,
        browser: opened.browser,
        context: opened.context,
        page: opened.page,
        timer: this.clock.setTimeout(() => {
          void this.stopRecording(session_id, true).catch(() => undefined);
        }, max_seconds * 1000),
        networkEvents: [],
        consoleEvents: [],
        domSnapshots: [],
        durationLimitHit: false,
        redaction: createRedactionTracker(),
      };
      this.activeRecordings.set(session_id, session);
      this.attachArtifactListeners(session);
      await opened.page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    } catch (error) {
      if (session) {
        this.clock.clearTimeout(session.timer);
        this.activeRecordings.delete(session_id);
      }
      await opened?.context.close().catch(() => undefined);
      await opened?.browser.close().catch(() => undefined);
      throw error;
    }

    return {
      session_id,
      status: "recording",
      url,
      path: browserPackage.videoPath,
      started_at,
      max_seconds,
      message:
        "Recording started in headed Chromium. Drive it with reelink_browser_* tools, then call reelink_record_stop with this session_id.",
    };
  }

  listActiveRecordings(): { active: Array<{ session_id: string; url: string; path: string; started_at: string; max_seconds: number }> } {
    return {
      active: [...this.activeRecordings.values()].map((session) => ({
        session_id: session.session_id,
        url: session.url,
        path: session.outPath,
        started_at: session.started_at,
        max_seconds: session.max_seconds,
      })),
    };
  }

  async snapshotBrowser(sessionId: string, saveDom: boolean): Promise<BrowserSnapshotResult> {
    const session = this.requireSession(sessionId);
    const title = await session.page.title().catch(() => "");
    const text = ((await session.page.locator("body").innerText().catch(() => "")) || "").slice(0, 8000);
    const domPath = saveDom ? await this.saveDomSnapshot(session, title) : null;
    return { session_id: sessionId, url: session.page.url(), title, text, dom_path: domPath };
  }

  async clickBrowser(args: { session_id: string; text?: string; selector?: string; x?: number; y?: number }) {
    const session = this.requireSession(args.session_id);

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

  async typeBrowser({ session_id, selector, text }: { session_id: string; selector: string; text: string }) {
    const session = this.requireSession(session_id);
    await session.page.fill(selector, text);
    return { session_id, ok: true, selector, url: session.page.url() };
  }

  async navigateBrowser({ session_id, url }: { session_id: string; url: string }) {
    const session = this.requireSession(session_id);
    await session.page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    return { session_id, ok: true, url: session.page.url() };
  }

  async waitBrowser({ session_id, ms }: { session_id: string; ms: number }) {
    const session = this.requireSession(session_id);
    await session.page.waitForTimeout(ms);
    return { session_id, ok: true, waited_ms: ms, url: session.page.url() };
  }

  async stopRecording(sessionId: string, durationLimitHit = false): Promise<StoppedBrowserRecording> {
    const completed = this.stoppedRecordings.get(sessionId);
    if (completed) return completed;

    const session = this.requireSession(sessionId);
    if (session.stopping) return session.stopping;
    if (durationLimitHit) session.durationLimitHit = true;

    session.stopping = (async () => {
      this.clock.clearTimeout(session.timer);
      await this.saveDomSnapshot(session, await session.page.title().catch(() => "final"));
      const video = session.page.video();
      await session.context.close();
      await session.browser.close();
      const tmpPath = await video?.path();
      if (!tmpPath || !existsSync(tmpPath)) throw new Error("Playwright did not write a video artifact");
      if (tmpPath !== session.outPath) renameSync(tmpPath, session.outPath);
      const stoppedAt = new Date(this.clock.now()).toISOString();
      const artifacts = this.writeArtifacts(session, stoppedAt);
      const sizeBytes = existsSync(session.outPath) ? statSync(session.outPath).size : null;
      const stopped = {
        session_id: sessionId,
        status: "stopped" as const,
        path: session.outPath,
        exists: existsSync(session.outPath),
        size_bytes: sizeBytes,
        started_at: session.started_at,
        stopped_at: stoppedAt,
        duration_limit_hit: session.durationLimitHit,
        artifacts,
      };
      this.activeRecordings.delete(sessionId);
      this.stoppedRecordings.set(sessionId, stopped);
      return stopped;
    })().catch((error) => {
      session.stopping = undefined;
      throw error;
    });
    return session.stopping;
  }

  private attachArtifactListeners(session: ActiveBrowserRecording): void {
    session.page.on("console", (message) =>
      session.consoleEvents.push({
        ts: this.elapsed(session),
        type: message.type(),
        text: redactText(message.text(), 2000, session.redaction, "console"),
        location: message.location(),
      }),
    );
    session.page.on("request", (request) =>
      session.networkEvents.push({
        ts: this.elapsed(session),
        event: "request",
        method: request.method(),
        url: redactUrl(request.url(), 1000, session.redaction, "network"),
        resource_type: request.resourceType(),
      }),
    );
    session.page.on("response", (response) =>
      session.networkEvents.push({
        ts: this.elapsed(session),
        event: "response",
        status: response.status(),
        url: redactUrl(response.url(), 1000, session.redaction, "network"),
        ok: response.ok(),
        redacted_headers: redactHeaders(response.headers(), session.redaction, "network"),
      }),
    );
    session.page.on("requestfailed", (request) =>
      session.networkEvents.push({
        ts: this.elapsed(session),
        event: "requestfailed",
        method: request.method(),
        url: redactUrl(request.url(), 1000, session.redaction, "network"),
        failure: request.failure()?.errorText,
      }),
    );
  }

  private async saveDomSnapshot(session: ActiveBrowserRecording, title: string): Promise<string> {
    const index = session.domSnapshots.length + 1;
    const path = `${session.package.domDir}/snapshot-${String(index).padStart(4, "0")}.html`;
    const html = await session.page.content().catch(() => "");
    writeFileSync(path, html);
    session.domSnapshots.push({
      ts: this.elapsed(session),
      path,
      url: session.page.url(),
      title,
      tree_summary: summarizeHtml(html),
    });
    return path;
  }

  private writeArtifacts(session: ActiveBrowserRecording, stoppedAt: string): StoppedBrowserRecording["artifacts"] {
    writeJsonl(session.package.networkJsonlPath, session.networkEvents);
    writeJson(session.package.networkHarPath, buildHar(session));
    writeJsonl(session.package.consoleJsonlPath, session.consoleEvents);
    const manifest: Manifest & {
      session_id: string;
      url: string;
      final_url: string;
      max_seconds: number;
      duration_limit_hit: boolean;
      video: string;
      dom_snapshots: ActiveBrowserRecording["domSnapshots"];
      tool_classification: typeof directPlaywrightBrowserToolClassification;
    } = {
      recording_id: session.session_id,
      session_id: session.session_id,
      created_at: session.started_at,
      source_type: "browser_recording",
      source_path: session.url,
      duration_sec: null,
      preprocessing: {
        requested_fps: 0,
        effective_fps: 0,
        max_frames: 0,
        long_edge_px: 0,
        frame_count: 0,
      },
      artifacts: {
        video: browserPackageRelativePath(session.package, session.outPath),
        network: browserPackageRelativePath(session.package, session.package.networkJsonlPath),
        network_har: browserPackageRelativePath(session.package, session.package.networkHarPath),
        console: browserPackageRelativePath(session.package, session.package.consoleJsonlPath),
        dom: browserPackageRelativePath(session.package, session.package.domDir),
        trace: browserPackageRelativePath(session.package, session.package.tracePath),
        fiber_commits: browserPackageRelativePath(session.package, session.package.fiberCommitsJsonlPath),
        source_dictionary: browserPackageRelativePath(session.package, session.package.sourceDictionaryPath),
        react_grab_events: browserPackageRelativePath(session.package, session.package.reactGrabEventsJsonlPath),
      },
      streams: {
        layer0: { status: "not_collected", reason: "Browser recording was captured without Layer 0 video analysis" },
        frames: { status: "not_collected", reason: "Browser recording did not sample video frames" },
        trace: { status: existsSync(session.package.tracePath) ? "available" : "not_collected", reason: existsSync(session.package.tracePath) ? undefined : "Playwright tracing is not enabled for the direct headed demo recorder" },
        dom: { status: session.domSnapshots.length ? "available" : "not_collected", reason: session.domSnapshots.length ? undefined : "No DOM snapshots were captured" },
        fiber_commits: { status: existsSync(session.package.fiberCommitsJsonlPath) ? "available" : "not_collected", reason: existsSync(session.package.fiberCommitsJsonlPath) ? undefined : "bippy fiber capture is not installed in the direct headed demo recorder" },
        source_dictionary: { status: existsSync(session.package.sourceDictionaryPath) ? "available" : "not_collected", reason: existsSync(session.package.sourceDictionaryPath) ? undefined : "bippy source dictionary capture is not installed in the direct headed demo recorder" },
        react_grab_events: { status: existsSync(session.package.reactGrabEventsJsonlPath) ? "available" : "not_collected", reason: existsSync(session.package.reactGrabEventsJsonlPath) ? undefined : "react-grab element capture is not installed in the direct headed demo recorder" },
        network: { status: "available" },
        console: { status: "available" },
        eval: { status: "not_collected", reason: "No verification artifact generated" },
      },
      prod_build: false,
      safety: {
        redaction_applied: true,
        redaction_rules: [...session.redaction.rules].sort(),
        redacted_streams: [...session.redaction.streams].sort(),
      },
      url: session.url,
      final_url: session.page.url(),
      max_seconds: session.max_seconds,
      duration_limit_hit: session.durationLimitHit,
      video: session.outPath,
      dom_snapshots: session.domSnapshots,
      tool_classification: directPlaywrightBrowserToolClassification,
    };
    writeJson(session.package.manifestPath, manifest);
    return {
      network: session.package.networkJsonlPath,
      network_har: session.package.networkHarPath,
      console: session.package.consoleJsonlPath,
      dom: session.package.domDir,
      manifest: session.package.manifestPath,
    };
  }

  private requireSession(sessionId: string): ActiveBrowserRecording {
    const session = this.activeRecordings.get(sessionId);
    if (!session) {
      if (this.stoppedRecordings.has(sessionId)) throw new Error(`Recording session already stopped: ${sessionId}`);
      throw new Error(`No active recording session: ${sessionId}`);
    }
    return session;
  }

  private elapsed(session: ActiveBrowserRecording): number {
    return Math.round(((this.clock.now() - Date.parse(session.started_at)) / 1000) * 1000) / 1000;
  }
}

export const systemClock: BrowserRecordingClock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

function defaultSessionId(): string {
  return `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeJsonl(path: string, events: BrowserArtifactEvent[]): void {
  writeFileSync(path, events.map((event) => JSON.stringify(event)).join("\n") + (events.length ? "\n" : ""));
}

function buildHar(session: ActiveBrowserRecording): Record<string, unknown> {
  return {
    log: {
      version: "1.2",
      creator: { name: "reelink", version: "0.0.0" },
      pages: [
        { id: session.session_id, startedDateTime: session.started_at, title: session.url, pageTimings: {} },
      ],
      entries: session.networkEvents.map((event, index) => ({
        startedDateTime: new Date(Date.parse(session.started_at) + eventTimestampMs(event)).toISOString(),
        time: 0,
        request: {
          method: typeof event.method === "string" ? event.method : "GET",
          url: typeof event.url === "string" ? event.url : "",
          httpVersion: "HTTP/1.1",
          headers: [],
          queryString: [],
          cookies: [],
          headersSize: -1,
          bodySize: -1,
        },
        response: {
          status: typeof event.status === "number" ? event.status : 0,
          statusText: "",
          httpVersion: "HTTP/1.1",
          headers: harHeaders(event.redacted_headers),
          cookies: [],
          content: { size: 0, mimeType: "" },
          redirectURL: "",
          headersSize: -1,
          bodySize: -1,
        },
        cache: {},
        timings: { send: 0, wait: 0, receive: 0 },
        pageref: session.session_id,
        _reelink_event: event.event ?? "network",
        _reelink_index: index,
        _reelink_ts: typeof event.ts === "number" ? event.ts : 0,
      })),
    },
  };
}

function eventTimestampMs(event: BrowserArtifactEvent): number {
  return typeof event.ts === "number" ? Math.round(event.ts * 1000) : 0;
}

function harHeaders(value: unknown): Array<{ name: string; value: string }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).map(([name, headerValue]) => ({
    name,
    value: typeof headerValue === "string" ? headerValue : JSON.stringify(headerValue),
  }));
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...(+${value.length - maxLength} chars)`;
}

function createRedactionTracker(): RedactionTracker {
  return { rules: new Set(), streams: new Set() };
}

function recordRedaction(tracker: RedactionTracker | undefined, stream: string, rule: string): void {
  tracker?.streams.add(stream);
  tracker?.rules.add(rule);
}

function redactText(value: string, maxLength: number, tracker?: RedactionTracker, stream = "unknown"): string {
  const redacted = value.replace(/(token|secret|password|authorization|api[-_]?key)=([^&\s]+)/gi, (_match, key: string) => {
    recordRedaction(tracker, stream, `text:${key.toLowerCase()}`);
    return `${key}=[redacted]`;
  });
  return truncate(redacted, maxLength);
}

function redactUrl(value: string, maxLength: number, tracker?: RedactionTracker, stream = "unknown"): string {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (isSensitiveKey(key)) {
        recordRedaction(tracker, stream, `url_param:${key.toLowerCase()}`);
        url.searchParams.set(key, "[redacted]");
      }
    }
    return truncate(url.toString(), maxLength);
  } catch {
    return redactText(value, maxLength, tracker, stream);
  }
}

function redactHeaders(headers: Record<string, string>, tracker?: RedactionTracker, stream = "unknown"): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      if (isSensitiveKey(key)) {
        recordRedaction(tracker, stream, `header:${key.toLowerCase()}`);
        return [key, "[redacted]"];
      }
      return [key, truncate(value, 500)];
    }),
  );
}

function isSensitiveKey(key: string): boolean {
  return /authorization|cookie|token|secret|password|api[-_]?key|x-api-key/i.test(key);
}

function summarizeHtml(html: string): string {
  const tags = [...html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)\b/g)].map((match) => match[1]?.toLowerCase()).filter(Boolean);
  const counts = new Map<string, number>();
  for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()]
    .slice(0, 12)
    .map(([tag, count]) => `${tag}:${count}`)
    .join(", ");
}
