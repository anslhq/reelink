import { createRequire } from "node:module";
import { copyFileSync, existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";

import {
  browserPackageRelativePath,
  createBrowserRecordingPackage,
  type BrowserRecordingPackage,
} from "../recordings/store.js";
import type { Manifest } from "../schemas/recording.js";

export type BrowserArtifactEvent = Record<string, unknown>;

export type BrowserRecordingToolClassification = "single-mcp-gateway";

export const directPlaywrightBrowserToolClassification = {
  classification: "single-mcp-gateway" as BrowserRecordingToolClassification,
  reason:
    "Reck exposes a single MCP surface for curated browser automation while Reck-owned Playwright recording captures native video, trace, DOM, network, console, and runtime streams.",
};

export type BrowserRecordingPage = {
  goto(url: string, options?: { waitUntil?: "domcontentloaded" }): Promise<unknown>;
  addInitScript?(script: string): Promise<unknown>;
  title(): Promise<string>;
  content(): Promise<string>;
  url(): string;
  video(): { path(): Promise<string> } | null;
  locator(selector: string): { first(): { click(): Promise<unknown> }; innerText(): Promise<string> };
  getByText(text: string, options?: { exact?: boolean }): { first(): { click(): Promise<unknown> } };
  mouse: { click(x: number, y: number): Promise<unknown> };
  fill(selector: string, text: string): Promise<unknown>;
  waitForTimeout(ms: number): Promise<unknown>;
  screenshot?(options: { path: string; fullPage?: boolean }): Promise<unknown>;
  evaluate?<T, Arg = unknown>(pageFunction: (arg: Arg) => T | Promise<T>, arg?: Arg): Promise<T>;
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

export type BrowserAutomationGateway = {
  mode: "playwright-mcp-child" | "cdp-adapter";
  status: "available" | "unavailable" | "failed";
  reason?: string;
  child_tools?: string[];
  forwarded_tools?: Record<string, string>;
  close(): Promise<unknown>;
  navigate?(url: string): Promise<Record<string, unknown>>;
  click?(args: { text?: string; selector?: string; x?: number; y?: number }): Promise<Record<string, unknown>>;
  type?(args: { selector: string; text: string }): Promise<Record<string, unknown>>;
  evaluate?<T = unknown>(expression: string): Promise<T>;
  snapshot?(): Promise<Record<string, unknown>>;
  screenshot?(path: string): Promise<Record<string, unknown>>;
};

export type BrowserRecordingDriver = {
  open(options: {
    videoDir: string;
    viewport: { width: number; height: number };
    videoSize: { width: number; height: number };
    tracePath?: string;
    headless?: boolean;
  }): Promise<{
    browser: { close(): Promise<unknown> };
    context: { close(): Promise<unknown>; tracing?: { stop(options: { path: string }): Promise<unknown> } };
    page: BrowserRecordingPage;
    cdpEndpoint?: string;
    automationGateway?: BrowserAutomationGateway;
  }>;
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
  context: { close(): Promise<unknown>; tracing?: { stop(options: { path: string }): Promise<unknown> } };
  page: BrowserRecordingPage;
  timer: unknown;
  networkEvents: BrowserArtifactEvent[];
  consoleEvents: BrowserArtifactEvent[];
  logEvents: BrowserArtifactEvent[];
  domSnapshots: Array<{ ts: number; path: string; url: string; title: string; tree_summary: string }>;
  frameSnapshots: Array<{ ts: number; path: string; url: string }>;
  cdpEndpoint?: string;
  automationGateway?: BrowserAutomationGateway;
  gatewayEvents: BrowserArtifactEvent[];
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
  artifacts: {
    video: string;
    trace: string;
    frames: string;
    network: string;
    network_har: string;
    console: string;
    logs: string;
    dom: string;
    fiber_commits: string;
    source_dictionary: string;
    react_grab_events: string;
    manifest: string;
  };
};

export type BrowserSnapshotResult = {
  session_id: string;
  url: string;
  title: string;
  text: string;
  dom_path: string | null;
};

export type BrowserAutomationResult = {
  session_id: string;
  ok: boolean;
  url: string;
  action?: string;
  selector?: string;
  waited_ms?: number;
  gateway?: string;
  gateway_status?: string;
  cdp_endpoint?: string;
};

export type BrowserEvaluateResult = BrowserAutomationResult & {
  result: unknown;
};

export type BrowserScreenshotResult = BrowserAutomationResult & {
  path: string;
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
        tracePath: browserPackage.tracePath,
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
        logEvents: [],
        domSnapshots: [],
        frameSnapshots: [],
        cdpEndpoint: opened.cdpEndpoint,
        automationGateway: opened.automationGateway,
        gatewayEvents: [],
        durationLimitHit: false,
        redaction: createRedactionTracker(),
      };
      this.activeRecordings.set(session_id, session);
      this.attachArtifactListeners(session);
      await this.installReactSourceRecorder(session);
      await this.navigateBrowser({ session_id, url });
      await this.ensureReactSourceRecorderApplied(session);
      await this.captureReactSourceStreams(session);
      await this.captureFrameSnapshot(session);
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
        "Recording started in headed Chromium. Drive it with reck_browser_* tools, then call reck_record_stop with this session_id.",
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
    const gatewayResult = await this.tryGateway(session, "snapshot", () => session.automationGateway?.snapshot?.());
    const title = await session.page.title().catch(() => "");
    const text = snapshotText(gatewayResult) ?? (((await session.page.locator("body").innerText().catch(() => "")) || "").slice(0, 8000));
    const domPath = saveDom ? await this.saveDomSnapshot(session, title) : null;
    return { session_id: sessionId, url: session.page.url(), title, text, dom_path: domPath };
  }

  async clickBrowser(args: { session_id: string; text?: string; selector?: string; x?: number; y?: number }): Promise<BrowserAutomationResult> {
    const session = this.requireSession(args.session_id);
    const gatewayResult = await this.tryGateway(session, "click", () => session.automationGateway?.click?.(args));
    if (gatewayResult) return { session_id: args.session_id, ok: true, ...gatewayResult, url: session.page.url() };

    if (args.selector) {
      await session.page.locator(args.selector).first().click();
      return { session_id: args.session_id, ok: true, action: `selector:${args.selector}`, gateway: "direct-playwright-fallback", url: session.page.url() };
    }

    if (args.text) {
      await session.page.getByText(args.text, { exact: false }).first().click();
      return { session_id: args.session_id, ok: true, action: `text:${args.text}`, gateway: "direct-playwright-fallback", url: session.page.url() };
    }

    if (typeof args.x === "number" && typeof args.y === "number") {
      await session.page.mouse.click(args.x, args.y);
      return { session_id: args.session_id, ok: true, action: `xy:${args.x},${args.y}`, gateway: "direct-playwright-fallback", url: session.page.url() };
    }

    throw new Error("Provide selector, text, or x/y for reck_browser_click");
  }

  async typeBrowser({ session_id, selector, text }: { session_id: string; selector: string; text: string }): Promise<BrowserAutomationResult> {
    const session = this.requireSession(session_id);
    const gatewayResult = await this.tryGateway(session, "type", () => session.automationGateway?.type?.({ selector, text }));
    if (gatewayResult) return { session_id, ok: true, selector, ...gatewayResult, url: session.page.url() };
    await session.page.fill(selector, text);
    return { session_id, ok: true, selector, gateway: "direct-playwright-fallback", url: session.page.url() };
  }

  async navigateBrowser({ session_id, url }: { session_id: string; url: string }): Promise<BrowserAutomationResult> {
    const session = this.requireSession(session_id);
    const gatewayResult = await this.tryGateway(session, "navigate", () => session.automationGateway?.navigate?.(url));
    if (!gatewayResult) await session.page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    await this.ensureReactSourceRecorderApplied(session);
    return { session_id, ok: true, ...(gatewayResult ?? { gateway: "direct-playwright-fallback" }), url: session.page.url() };
  }

  async evaluateBrowser({ session_id, expression }: { session_id: string; expression: string }): Promise<BrowserEvaluateResult> {
    const session = this.requireSession(session_id);
    const gatewayResult = await this.tryGateway(session, "evaluate", async () => ({ result: await session.automationGateway?.evaluate?.(expression) }));
    if (gatewayResult) return { session_id, ok: true, result: gatewayResult.result, ...gatewayResult, url: session.page.url() };
    if (!session.page.evaluate) throw new Error("Driver page does not expose evaluate()");
    const directResult = await session.page.evaluate((source) => globalThis.eval(source), expression);
    return { session_id, ok: true, result: directResult, gateway: "direct-playwright-fallback", url: session.page.url() };
  }

  async takeScreenshotBrowser({ session_id, path }: { session_id: string; path?: string }): Promise<BrowserScreenshotResult> {
    const session = this.requireSession(session_id);
    const screenshotPath = path ?? `${session.package.framesDir}/screenshot-${String(session.frameSnapshots.length + 1).padStart(4, "0")}.png`;
    const gatewayResult = await this.tryGateway(session, "screenshot", () => session.automationGateway?.screenshot?.(screenshotPath));
    if (!gatewayResult) {
      if (!session.page.screenshot) throw new Error("Driver page does not expose screenshot()");
      await session.page.screenshot({ path: screenshotPath, fullPage: true });
    }
    if (existsSync(screenshotPath) && !session.frameSnapshots.some((frame) => frame.path === screenshotPath)) {
      session.frameSnapshots.push({ ts: this.elapsed(session), path: screenshotPath, url: session.page.url() });
    }
    return { session_id, ok: true, path: screenshotPath, ...(gatewayResult ?? { gateway: "direct-playwright-fallback" }), url: session.page.url() };
  }

  async waitBrowser({ session_id, ms }: { session_id: string; ms: number }): Promise<BrowserAutomationResult> {
    const session = this.requireSession(session_id);
    await session.page.waitForTimeout(ms);
    await this.ensureReactSourceRecorderApplied(session);
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
      await this.captureReactSourceStreams(session);
      await this.saveDomSnapshot(session, await session.page.title().catch(() => "final"));
      await this.captureFrameSnapshot(session);
      const video = session.page.video();
      await session.context.tracing?.stop({ path: session.package.tracePath }).catch((error) =>
        session.logEvents.push({ ts: this.elapsed(session), level: "warn", message: "trace capture failed", reason: errorMessage(error) }),
      );
      await session.automationGateway?.close().catch((error) =>
        session.logEvents.push({ ts: this.elapsed(session), level: "warn", message: "browser gateway close failed", reason: errorMessage(error) }),
      );
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
    session.page.on("console", (message) => {
      const event = {
        ts: this.elapsed(session),
        type: message.type(),
        text: redactText(message.text(), 2000, session.redaction, "console"),
        location: message.location(),
      };
      session.consoleEvents.push(event);
      session.logEvents.push({ ...event, level: message.type(), stream: "console" });
    });
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

  private async captureFrameSnapshot(session: ActiveBrowserRecording): Promise<void> {
    if (!session.page.screenshot) {
      session.logEvents.push({ ts: this.elapsed(session), level: "info", message: "frame snapshot unavailable", reason: "Driver page does not expose screenshot()" });
      return;
    }
    const index = session.frameSnapshots.length + 1;
    const path = `${session.package.framesDir}/frame-${String(index).padStart(4, "0")}.png`;
    await session.page.screenshot({ path, fullPage: true }).catch((error) => {
      session.logEvents.push({ ts: this.elapsed(session), level: "warn", message: "frame snapshot failed", reason: errorMessage(error) });
    });
    if (existsSync(path)) {
      session.frameSnapshots.push({ ts: this.elapsed(session), path, url: session.page.url() });
    }
  }

  private async tryGateway(
    session: ActiveBrowserRecording,
    tool: string,
    call: () => Promise<Record<string, unknown>> | undefined,
  ): Promise<Record<string, unknown> | null> {
    const gateway = session.automationGateway;
    if (!gateway || gateway.status !== "available") {
      session.gatewayEvents.push({ ts: this.elapsed(session), tool, status: "unavailable", mode: gateway?.mode ?? "none", reason: gateway?.reason ?? "No child gateway attached" });
      return null;
    }
    try {
      const result = await call();
      if (!result) {
        session.gatewayEvents.push({ ts: this.elapsed(session), tool, status: "unavailable", mode: gateway.mode, reason: "Gateway did not expose this curated tool" });
        return null;
      }
      if (isGatewayToolError(result)) {
        const event = { ts: this.elapsed(session), tool, status: "failed", mode: gateway.mode, ...result };
        session.gatewayEvents.push(event);
        return null;
      }
      const event = { ts: this.elapsed(session), tool, status: "forwarded", mode: gateway.mode, ...result };
      session.gatewayEvents.push(event);
      return { gateway: gateway.mode, gateway_status: "forwarded", ...result };
    } catch (error) {
      session.gatewayEvents.push({ ts: this.elapsed(session), tool, status: "failed", mode: gateway.mode, reason: errorMessage(error) });
      return null;
    }
  }

  private async installReactSourceRecorder(session: ActiveBrowserRecording): Promise<void> {
    if (!session.page.addInitScript) {
      this.writeUnavailableReactStreams(session, "Driver page does not expose addInitScript(); bippy/react-grab recorder could not run before page scripts");
      return;
    }

    await session.page.addInitScript(bippyInstallHookOnlyInitScript).then(
      () => session.logEvents.push({ ts: this.elapsed(session), level: "info", message: "bippy install-hook-only init script installed first", stream: "react_source", order: 1 }),
      (error) => this.writeUnavailableReactStreams(session, `Failed to install bippy install-hook-only init script: ${errorMessage(error)}`),
    );
    await session.page.addInitScript(reactSourceRecorderInitScript).then(
      () => session.logEvents.push({ ts: this.elapsed(session), level: "info", message: "bippy/react-grab recorder init script installed second", stream: "react_source", order: 2 }),
      (error) => this.writeUnavailableReactStreams(session, `Failed to install bippy/react-grab init recorder: ${errorMessage(error)}`),
    );
  }

  private async ensureReactSourceRecorderApplied(session: ActiveBrowserRecording): Promise<void> {
    if (!session.page.evaluate) return;
    const applied = await session.page
      .evaluate(() => Boolean((globalThis as unknown as { __RECK_REACT_RECORDER__?: { secureApplied?: unknown } }).__RECK_REACT_RECORDER__?.secureApplied))
      .catch(() => false);
    if (applied) return;
    await session.page
      .evaluate(() => {
        const g = globalThis as unknown as {
          __RECK_REACT_RECORDER__?: Record<string, unknown> & { reactGrabEvents?: Array<Record<string, unknown>>; sourceDictionary?: Record<string, unknown> };
          __REACT_GRAB__?: { getSource?: (element: Element) => unknown | Promise<unknown>; getStackContext?: (element: Element) => unknown | Promise<unknown> };
        };
        const recorder = (g.__RECK_REACT_RECORDER__ = Object.assign(g.__RECK_REACT_RECORDER__ || {}, {
          installed: true,
          secureApplied: true,
          dangerouslyRunInProduction: false,
          reactGrabEvents: (g.__RECK_REACT_RECORDER__?.reactGrabEvents as Array<Record<string, unknown>> | undefined) || [],
          sourceDictionary: (g.__RECK_REACT_RECORDER__?.sourceDictionary as Record<string, unknown> | undefined) || {},
        }));
        if (recorder.annotationListenerApplied) return true;
        const normalizeSource = (source: unknown) => {
          if (!source || typeof source !== "object") return null;
          const record = source as Record<string, unknown>;
          const file = typeof record.filePath === "string" ? record.filePath : typeof record.fileName === "string" ? record.fileName : typeof record.file === "string" ? record.file : null;
          if (!file) return null;
          const line = Number(record.lineNumber ?? record.line ?? 0) || null;
          const column = Number(record.columnNumber ?? record.column ?? 0) || null;
          const normalized = { file, line, column, react_grab: true };
          recorder.sourceDictionary![file] = normalized;
          return normalized;
        };
        const resolveReactGrabApi = (root: Record<string, unknown>) => {
          const direct = root.__REACT_GRAB__;
          if (direct && typeof direct === "object") return direct as { getSource?: (element: Element) => unknown | Promise<unknown>; getStackContext?: (element: Element) => unknown | Promise<unknown>; getDisplayName?: (element: Element) => string | null };
          const module = root.__REACT_GRAB_MODULE__;
          if (module && typeof module === "object") {
            const candidate = (module as { default?: unknown; reactGrab?: unknown; api?: unknown }).default ?? (module as { reactGrab?: unknown }).reactGrab ?? (module as { api?: unknown }).api;
            if (candidate && typeof candidate === "object") return candidate as { getSource?: (element: Element) => unknown | Promise<unknown>; getStackContext?: (element: Element) => unknown | Promise<unknown>; getDisplayName?: (element: Element) => string | null };
          }
          return null;
        };
        const parseStack = (stack: unknown, component: string, source: ReturnType<typeof normalizeSource>) => {
          const fallback = source ? [{ display_name: component, source }] : [{ display_name: component }];
          if (!stack) return fallback;
          const entries = String(stack)
            .split("\n")
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((entry) => {
              const match = entry.match(/^in\s+(.+?)\s+\(at\s+(.+?):(\d+)(?::(\d+))?\)$/);
              if (!match) return { display_name: entry };
              return { display_name: match[1], source: normalizeSource({ filePath: match[2], lineNumber: match[3], columnNumber: match[4] }) };
            });
          return entries.length ? entries : fallback;
        };
        const elementPath = (element: Element) => {
          const names: string[] = [];
          let current: Element | null = element;
          while (current && names.length < 8) {
            names.unshift(current.tagName.toLowerCase());
            current = current.parentElement;
          }
          return names.join(" > ");
        };
        const annotate = async (target: EventTarget | null, trigger: string, point: { x: number; y: number } | null) => {
          if (!(target instanceof Element) || typeof target.getBoundingClientRect !== "function") return;
          const api = resolveReactGrabApi(g);
          const rect = target.getBoundingClientRect();
          let rawSource: unknown = null;
          try {
            rawSource = api?.getSource ? await api.getSource(target) : null;
          } catch {}
          const source = normalizeSource(rawSource);
          const component = rawSource && typeof rawSource === "object" && typeof (rawSource as Record<string, unknown>).componentName === "string" ? String((rawSource as Record<string, unknown>).componentName) : (api?.getDisplayName?.(target) || target.tagName.toLowerCase());
          let rawStack: unknown = null;
          try {
            rawStack = api?.getStackContext ? await api.getStackContext(target) : null;
          } catch {}
          const x = point && typeof point.x === "number" ? point.x : rect.x + rect.width / 2;
          const y = point && typeof point.y === "number" ? point.y : rect.y + rect.height / 2;
          recorder.reactGrabEvents!.push({
            ts: performance.now() / 1000,
            event: "annotation",
            trigger,
            x,
            y,
            dom_coordinates: { x, y },
            component,
            source,
            react_grab: Boolean(source),
            element_path: elementPath(target),
            text: (target.textContent || "").slice(0, 500),
            selected_text: String(document.getSelection?.() || "").slice(0, 500),
            css_classes: Array.from(target.classList),
            classes: Array.from(target.classList),
            accessibility: { role: target.getAttribute("role"), name: target.getAttribute("aria-label") || target.getAttribute("title") || (target.textContent || "").slice(0, 120) },
            computed_styles: {},
            bounding_box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            props: { ...(target as HTMLElement).dataset },
            component_stack: parseStack(rawStack, component, source),
          });
        };
        document.addEventListener("click", (event) => { void annotate(event.target, "click", { x: event.clientX, y: event.clientY }); }, true);
        recorder.annotationListenerApplied = true;
        return true;
      })
      .then(
        () => session.logEvents.push({ ts: this.elapsed(session), level: "info", message: "react-grab runtime annotation recorder applied after navigation", stream: "react_source" }),
        (error) => session.logEvents.push({ ts: this.elapsed(session), level: "warn", message: "react-grab runtime annotation recorder post-navigation apply failed", reason: errorMessage(error), stream: "react_source" }),
      );
  }

  private async captureReactSourceStreams(session: ActiveBrowserRecording): Promise<void> {
    if (!session.page.evaluate) {
      this.writeUnavailableReactStreams(session, "Driver page does not expose evaluate()");
      return;
    }

    const raw = await session.page.evaluate(() => {
      const recorder = (globalThis as unknown as { __RECK_REACT_RECORDER__?: {
        installed?: boolean;
        hookDetected?: boolean;
        hookInstallReason?: string;
        fiberCommits?: Array<Record<string, unknown>>;
        reactGrabEvents?: Array<Record<string, unknown>>;
        annotationEvents?: Array<Record<string, unknown>>;
        sourceDictionary?: Record<string, unknown>;
      } }).__RECK_REACT_RECORDER__;
      const reactHook = (globalThis as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown }).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      return {
        installed: Boolean(recorder?.installed),
        hasReactHook: Boolean(reactHook) || Boolean(recorder?.hookDetected),
        hookInstallReason: recorder?.hookInstallReason ?? null,
        sourceDictionary: recorder?.sourceDictionary ?? {},
        fiberCommits: recorder?.fiberCommits ?? [],
        reactGrabEvents: recorder?.reactGrabEvents ?? [],
      };
    }).catch((error) => ({ error: errorMessage(error) }));

    if ("error" in raw) {
      this.writeUnavailableReactStreams(session, raw.error);
      return;
    }

    const fiberCommits = raw.fiberCommits.map((event) => sanitizeReactEvent(event, session.redaction, "fiber_commits"));
    const reactGrabEvents = raw.reactGrabEvents.map((event) => sanitizeReactEvent(event, session.redaction, "react_grab_events"));
    const sourceDictionary = sanitizeSourceDictionary(raw.sourceDictionary, session.redaction);
    if (fiberCommits.length) writeJsonl(session.package.fiberCommitsJsonlPath, fiberCommits);
    if (reactGrabEvents.length) writeJsonl(session.package.reactGrabEventsJsonlPath, reactGrabEvents);
    if (Object.keys(sourceDictionary).length) writeJson(session.package.sourceDictionaryPath, sourceDictionary);
    if (!fiberCommits.length && !reactGrabEvents.length && !Object.keys(sourceDictionary).length) {
      const initStatus = raw.installed ? "init recorder installed" : "init recorder not installed";
      const reason = raw.hasReactHook
        ? `React hook was present, but no bippy/react-grab component/source events were emitted (${initStatus})`
        : `React/bippy/react-grab hooks were not detected on the page (${initStatus}${raw.hookInstallReason ? `: ${raw.hookInstallReason}` : ""})`;
      this.writeUnavailableReactStreams(session, reason);
    }
  }

  private writeUnavailableReactStreams(session: ActiveBrowserRecording, reason: string): void {
    session.logEvents.push({ ts: this.elapsed(session), level: "info", message: "react/source capture unavailable", reason });
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
    writeJsonl(session.package.logsJsonlPath, session.logEvents);
    writeJsonl(`${session.package.root}/gateway.jsonl`, session.gatewayEvents);
    const domSourceDictionary = buildNextPrerenderSourceDictionary(session);
    if (!existsSync(session.package.sourceDictionaryPath) && domSourceDictionary.entries.length) {
      writeJson(session.package.sourceDictionaryPath, domSourceDictionary);
      session.logEvents.push({
        ts: this.elapsed(session),
        level: "info",
        message: "source dictionary harvested from DOM snapshot Next prerender stack metadata",
        stream: "source_dictionary",
        provenance: "next_prerender_stack",
        entry_count: domSourceDictionary.entries.length,
      });
    }
    const manifest: Manifest & {
      session_id: string;
      url: string;
      final_url: string;
      max_seconds: number;
      duration_limit_hit: boolean;
      video: string;
      dom_snapshots: ActiveBrowserRecording["domSnapshots"];
      frame_snapshots: Array<{ ts: number; path: string; url: string }>;
      timeline_alignment: Record<string, { origin: string; unit: "seconds"; event_count: number; artifact?: string }>;
      react_capture: {
        hook_order: ["install-hook-only", "react-grab-global-bundle", "secure-recorder"];
        secure_applied: boolean;
        dangerously_run_in_production: boolean;
        direct_libraries: Record<string, string>;
      };
      gateway: {
        mode: "single-mcp";
        cdp_endpoint_available: boolean;
        child_status: string;
        child_mode: string | null;
        child_tools: string[];
        forwarded_tools: Record<string, string>;
        reason?: string;
      };
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
        strategy: "cached-frame-retrieval",
        primary_analysis_uses_raw_video: false,
      },
      artifacts: {
        video: browserPackageRelativePath(session.package, session.outPath),
        network: browserPackageRelativePath(session.package, session.package.networkJsonlPath),
        network_har: browserPackageRelativePath(session.package, session.package.networkHarPath),
        console: browserPackageRelativePath(session.package, session.package.consoleJsonlPath),
        logs: browserPackageRelativePath(session.package, session.package.logsJsonlPath),
        dom: browserPackageRelativePath(session.package, session.package.domDir),
        trace: browserPackageRelativePath(session.package, session.package.tracePath),
        frames: browserPackageRelativePath(session.package, session.package.framesDir),
        fiber_commits: browserPackageRelativePath(session.package, session.package.fiberCommitsJsonlPath),
        source_dictionary: browserPackageRelativePath(session.package, session.package.sourceDictionaryPath),
        react_grab_events: browserPackageRelativePath(session.package, session.package.reactGrabEventsJsonlPath),
        gateway: "gateway.jsonl",
      },
      streams: {
        layer0: { status: "not_collected", reason: "Browser recording was captured without Layer 0 video analysis" },
        frames: { status: session.frameSnapshots.length ? "available" : "not_collected", reason: session.frameSnapshots.length ? undefined : "Browser recording could not sample screenshots from the active page" },
        trace: { status: existsSync(session.package.tracePath) ? "available" : "not_collected", reason: existsSync(session.package.tracePath) ? undefined : "Playwright tracing was unavailable from the active browser driver" },
        dom: { status: session.domSnapshots.length ? "available" : "not_collected", reason: session.domSnapshots.length ? undefined : "No DOM snapshots were captured" },
        fiber_commits: { status: existsSync(session.package.fiberCommitsJsonlPath) ? "available" : "not_collected", reason: existsSync(session.package.fiberCommitsJsonlPath) ? undefined : "No bippy/React fiber commits were available on the page" },
        source_dictionary: { status: existsSync(session.package.sourceDictionaryPath) ? "available" : "not_collected", reason: existsSync(session.package.sourceDictionaryPath) ? undefined : "No React source dictionary was available on the page" },
        react_grab_events: { status: existsSync(session.package.reactGrabEventsJsonlPath) ? "available" : "not_collected", reason: existsSync(session.package.reactGrabEventsJsonlPath) ? undefined : "No react-grab compatible component events were available on the page" },
        network: { status: "available" },
        console: { status: "available" },
        logs: { status: "available" },
        gateway: {
          status: session.automationGateway?.status ?? "unavailable",
          ...(session.automationGateway?.reason ? { reason: session.automationGateway.reason } : {}),
        },
        eval: { status: "not_collected", reason: "No verification artifact generated" },
      },
      prod_build: null,
      prod_build_status: "unavailable",
      prod_build_reason: "React production-mode detection was not available from captured runtime evidence",
      relations: {
        browser_recording_id: session.session_id,
        related_recording_ids: [],
        relation: "browser_capture",
      },
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
      frame_snapshots: session.frameSnapshots.map((frame) => ({ ...frame, path: browserPackageRelativePath(session.package, frame.path) })),
      timeline_alignment: buildTimelineAlignment(session),
      react_capture: {
        hook_order: ["install-hook-only", "react-grab-global-bundle", "secure-recorder"],
        secure_applied: true,
        dangerously_run_in_production: false,
        direct_libraries: {
          bippy: "install-hook-only-compatible-devtools-hook",
          react_grab: "react-grab/dist/index.global.js headless bundle plus element-pointer recorder",
        },
      },
      gateway: {
        mode: "single-mcp",
        cdp_endpoint_available: Boolean(session.cdpEndpoint),
        child_status: session.automationGateway?.status ?? "unavailable",
        child_mode: session.automationGateway?.mode ?? null,
        child_tools: session.automationGateway?.child_tools ?? [],
        forwarded_tools: session.automationGateway?.forwarded_tools ?? {},
        ...(session.automationGateway?.reason ? { reason: session.automationGateway.reason } : {}),
      },
      tool_classification: directPlaywrightBrowserToolClassification,
    };
    writeJson(session.package.manifestPath, manifest);
    return {
      video: session.outPath,
      trace: session.package.tracePath,
      frames: session.package.framesDir,
      network: session.package.networkJsonlPath,
      network_har: session.package.networkHarPath,
      console: session.package.consoleJsonlPath,
      logs: session.package.logsJsonlPath,
      dom: session.package.domDir,
      fiber_commits: session.package.fiberCommitsJsonlPath,
      source_dictionary: session.package.sourceDictionaryPath,
      react_grab_events: session.package.reactGrabEventsJsonlPath,
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

const nodeRequire = createRequire(import.meta.url);
const reactGrabGlobalBundle = loadReactGrabGlobalBundle();

const bippyInstallHookOnlyInitScript = `
(() => {
  const g = globalThis;
  const recorder = g.__RECK_REACT_RECORDER__ = g.__RECK_REACT_RECORDER__ || {
    installed: false,
    hookDetected: false,
    hookInstallReason: null,
    fiberCommits: [],
    reactGrabEvents: [],
    sourceDictionary: {},
    hookOnlyInstalled: false,
    secureApplied: false,
    dangerouslyRunInProduction: false
  };
  function installHookOnly() {
    const existing = g.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (existing && typeof existing === 'object') {
      recorder.hookDetected = true;
      recorder.hookOnlyInstalled = true;
      return;
    }
    const renderers = new Map();
    g.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      renderers,
      inject(renderer) {
        recorder.hookDetected = true;
        const id = renderers.size + 1;
        renderers.set(id, renderer);
        return id;
      },
      onCommitFiberRoot(id, root) {
        recorder.hookDetected = true;
        recorder.fiberCommits.push({ ts: performance.now() / 1000, renderer_id: id, component: 'ReactRoot', fiber_status: 'commit', root_tag: root && root.tag, hook_source: 'install-hook-only' });
      },
      onCommitFiberUnmount(id, fiber) {
        recorder.hookDetected = true;
        recorder.fiberCommits.push({ ts: performance.now() / 1000, renderer_id: id, component: (fiber && fiber.elementType && fiber.elementType.name) || 'unknown', fiber_status: 'unmount', hook_source: 'install-hook-only' });
      }
    };
    recorder.hookOnlyInstalled = true;
  }
  try {
    installHookOnly();
  } catch (error) {
    recorder.hookInstallReason = error instanceof Error ? error.message : String(error);
  }
})();
`;

const reactSourceRecorderInitScript = `
(() => {
  try {
    ${reactGrabGlobalBundle}
  } catch (error) {
    const g = globalThis;
    const recorder = g.__RECK_REACT_RECORDER__ = g.__RECK_REACT_RECORDER__ || {};
    recorder.reactGrabBundleError = error instanceof Error ? error.message : String(error);
  }
  const g = globalThis;
  const existingRecorder = g.__RECK_REACT_RECORDER__ || {};
  const recorder = g.__RECK_REACT_RECORDER__ = Object.assign(existingRecorder, {
    installed: true,
    hookDetected: Boolean(existingRecorder.hookDetected),
    hookInstallReason: existingRecorder.hookInstallReason || null,
    fiberCommits: existingRecorder.fiberCommits || [],
    reactGrabEvents: existingRecorder.reactGrabEvents || [],
    sourceDictionary: existingRecorder.sourceDictionary || {},
    hookOnlyInstalled: Boolean(existingRecorder.hookOnlyInstalled),
    secureApplied: true,
    dangerouslyRunInProduction: false,
    directLibraries: {
      bippy: 'install-hook-only-compatible-devtools-hook',
      reactGrab: 'react-grab/dist/index.global.js headless bundle plus element-pointer recorder'
    }
  });
  function safeText(element) { return (element.textContent || '').slice(0, 500); }
  function selectedText() {
    const selection = document.getSelection && document.getSelection();
    return selection ? String(selection).slice(0, 500) : '';
  }
  function accessibility(element) {
    return {
      role: element.getAttribute('role') || null,
      name: element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.getAttribute('title') || safeText(element).slice(0, 120),
      aria_label: element.getAttribute('aria-label') || null,
      disabled: element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true'
    };
  }
  function computedStyles(element) {
    const styles = getComputedStyle(element);
    return {
      display: styles.display,
      position: styles.position,
      color: styles.color,
      backgroundColor: styles.backgroundColor,
      font: styles.font,
      zIndex: styles.zIndex
    };
  }
  function elementPath(element) {
    const names = [];
    let current = element;
    while (current && names.length < 8) {
      names.unshift(current.tagName.toLowerCase());
      current = current.parentElement;
    }
    return names.join(' > ');
  }
  function sourceFromElement(element) {
    const sourceElement = element.closest ? element.closest('[data-reck-source-file], [data-source-file]') : element;
    const dataset = sourceElement && sourceElement.dataset ? sourceElement.dataset : element.dataset;
    const file = dataset.sourceFile || dataset.reckSourceFile || (sourceElement && sourceElement.getAttribute && sourceElement.getAttribute('data-source-file'));
    if (!file) return null;
    const line = Number(dataset.sourceLine || dataset.reckSourceLine || 0) || null;
    const column = Number(dataset.sourceColumn || dataset.reckSourceColumn || 0) || null;
    const source = { file, line, column, reck_init: dataset.reckSourceTruth === 'source-file' || undefined };
    recorder.sourceDictionary[file] = source;
    return source;
  }
  function componentFromElement(element) {
    const componentElement = element.closest ? element.closest('[data-reck-component], [data-component]') : element;
    const dataset = componentElement && componentElement.dataset ? componentElement.dataset : element.dataset;
    return dataset.reckComponent || dataset.component || element.tagName.toLowerCase();
  }
  function normalizeReactGrabSource(source) {
    if (!source || typeof source !== 'object') return null;
    const file = typeof source.filePath === 'string' ? source.filePath : (typeof source.fileName === 'string' ? source.fileName : (typeof source.file === 'string' ? source.file : null));
    if (!file) return null;
    const lineValue = source.lineNumber ?? source.line;
    const columnValue = source.columnNumber ?? source.column;
    const line = Number(lineValue || 0) || null;
    const column = Number(columnValue || 0) || null;
    const normalized = { file, line, column, react_grab: true };
    recorder.sourceDictionary[file] = normalized;
    return normalized;
  }
  function resolveReactGrabApi(root) {
    const direct = root.__REACT_GRAB__;
    if (direct && typeof direct === 'object') return direct;
    const module = root.__REACT_GRAB_MODULE__;
    if (module && typeof module === 'object') {
      const candidate = module.default || module.reactGrab || module.api;
      if (candidate && typeof candidate === 'object') return candidate;
    }
    return null;
  }
  function reactGrabApi() {
    const api = resolveReactGrabApi(g);
    return api && typeof api === 'object' ? api : null;
  }
  async function sourceFromReactGrab(element) {
    const api = reactGrabApi();
    if (!api || typeof api.getSource !== 'function') return null;
    try {
      return normalizeReactGrabSource(await api.getSource(element));
    } catch (error) {
      recorder.reactGrabRuntimeError = error instanceof Error ? error.message : String(error);
      return null;
    }
  }
  function stackEntryFromString(entry) {
    if (typeof entry !== 'string') return null;
    const trimmed = entry.trim();
    const match = trimmed.match(/^in\s+(.+?)\s+\(at\s+(.+?):(\d+)(?::(\d+))?\)$/);
    if (!match) return trimmed ? { display_name: trimmed } : null;
    const source = normalizeReactGrabSource({ filePath: match[2], lineNumber: match[3], columnNumber: match[4] });
    return { display_name: match[1], source };
  }
  function parseStackContext(stackContext, fallbackComponent, fallbackSource) {
    if (!stackContext) return fallbackSource ? [{ display_name: fallbackComponent, source: fallbackSource }] : [{ display_name: fallbackComponent }];
    const rawEntries = Array.isArray(stackContext) ? stackContext : String(stackContext).split('\n');
    const entries = rawEntries.map(stackEntryFromString).filter(Boolean);
    if (entries.length) return entries;
    return fallbackSource ? [{ display_name: fallbackComponent, source: fallbackSource }] : [{ display_name: fallbackComponent }];
  }
  async function stackFromReactGrab(element, fallbackComponent, fallbackSource) {
    const api = reactGrabApi();
    if (!api || typeof api.getStackContext !== 'function') return fallbackSource ? [{ display_name: fallbackComponent, source: fallbackSource }] : [{ display_name: fallbackComponent }];
    try {
      return parseStackContext(await api.getStackContext(element), fallbackComponent, fallbackSource);
    } catch (error) {
      recorder.reactGrabRuntimeError = error instanceof Error ? error.message : String(error);
      return fallbackSource ? [{ display_name: fallbackComponent, source: fallbackSource }] : [{ display_name: fallbackComponent }];
    }
  }
  function recordDomEvent(reason) {
    const targets = Array.from(document.querySelectorAll('[data-reck-component], [data-component], [data-source-file], [data-reck-source-file]'));
    if (!targets.length) {
      for (const script of Array.from(document.querySelectorAll('script'))) {
        const stack = script.getAttribute('data-stck') || script.getAttribute('data-cstck') || '';
        const match = stack.match(/at\s+([A-Za-z0-9_$]+).*?file:\/\/([^?\s)]+).*?id=.*?%255Bproject%255D%252F([^+\s)]+).*?:(\d+):(\d+)/);
        if (!match) continue;
        const file = decodeURIComponent('/' + match[2]);
        recorder.sourceDictionary[file] = { file, line: Number(match[4]) || null, column: Number(match[5]) || null, next_prerender_stack: true };
        recorder.reactGrabEvents.push({ ts: performance.now() / 1000, component: match[1], source: recorder.sourceDictionary[file], element_path: 'next-prerender-stack', reason, component_stack: [{ display_name: match[1], source: recorder.sourceDictionary[file] }] });
      }
    }
    for (const element of targets) {
      const rect = element.getBoundingClientRect();
      const component = componentFromElement(element);
      const source = sourceFromElement(element);
      const event = {
        ts: performance.now() / 1000,
        component,
        source,
        element_path: elementPath(element),
        text: safeText(element),
        selected_text: selectedText(),
        css_classes: Array.from(element.classList),
        classes: Array.from(element.classList),
        accessibility: accessibility(element),
        computed_styles: computedStyles(element),
        bounding_box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        props: { ...element.dataset },
        reason,
        component_stack: source ? [{ display_name: component, source }] : [{ display_name: component }]
      };
      recorder.reactGrabEvents.push(event);
      recorder.fiberCommits.push({ ...event, fiber_status: recorder.hookDetected ? 'react-hook-observed' : 'dom-associated-init-recorder' });
    }
  }
  function patchExistingHook() {
    const hook = g.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook || typeof hook !== 'object') {
      recorder.hookInstallReason = recorder.hookInstallReason || 'install-hook-only hook was not present before full recorder script';
      return;
    }
    recorder.hookDetected = true;
    const originalCommit = typeof hook.onCommitFiberRoot === 'function' ? hook.onCommitFiberRoot.bind(hook) : null;
    hook.onCommitFiberRoot = (id, root, ...rest) => {
      recorder.hookDetected = true;
      recorder.fiberCommits.push({ ts: performance.now() / 1000, renderer_id: id, component: 'ReactRoot', fiber_status: 'commit', root_tag: root && root.tag, hook_source: 'secure-recorder' });
      recordDomEvent('react-commit');
      return originalCommit ? originalCommit(id, root, ...rest) : undefined;
    };
  }
  try {
    patchExistingHook();
  } catch (error) {
    recorder.hookInstallReason = error instanceof Error ? error.message : String(error);
  }
  async function annotateElement(element, trigger, point) {
    if (!element || typeof element.getBoundingClientRect !== 'function') return;
    const rect = element.getBoundingClientRect();
    const fallbackComponent = componentFromElement(element);
    const api = reactGrabApi();
    let rawReactGrabSource = null;
    let reactGrabSource = null;
    if (api && typeof api.getSource === 'function') {
      try {
        rawReactGrabSource = await api.getSource(element);
        reactGrabSource = normalizeReactGrabSource(rawReactGrabSource);
      } catch (error) {
        recorder.reactGrabRuntimeError = error instanceof Error ? error.message : String(error);
      }
    }
    const source = reactGrabSource || sourceFromElement(element);
    const component = rawReactGrabSource && typeof rawReactGrabSource.componentName === 'string' ? rawReactGrabSource.componentName : fallbackComponent;
    const stack = await stackFromReactGrab(element, component, source);
    const stackComponent = stack.find((entry) => entry && entry.display_name && entry.display_name !== component);
    const event = {
      ts: performance.now() / 1000,
      event: 'annotation',
      trigger,
      x: point && typeof point.x === 'number' ? point.x : rect.x + rect.width / 2,
      y: point && typeof point.y === 'number' ? point.y : rect.y + rect.height / 2,
      dom_coordinates: { x: point && typeof point.x === 'number' ? point.x : rect.x + rect.width / 2, y: point && typeof point.y === 'number' ? point.y : rect.y + rect.height / 2 },
      component: reactGrabSource && stackComponent ? stackComponent.display_name : component,
      source,
      react_grab: Boolean(reactGrabSource),
      element_path: elementPath(element),
      text: safeText(element),
      selected_text: selectedText(),
      css_classes: Array.from(element.classList),
      classes: Array.from(element.classList),
      accessibility: accessibility(element),
      computed_styles: computedStyles(element),
      bounding_box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      props: { ...element.dataset },
      component_stack: stack
    };
    recorder.annotationEvents = recorder.annotationEvents || [];
    recorder.annotationEvents.push(event);
    recorder.reactGrabEvents.push(event);
    const marker = document.createElement('div');
    marker.setAttribute('data-reck-annotation-marker', 'true');
    marker.style.cssText = 'position:fixed;left:' + Math.max(0, event.x - 10) + 'px;top:' + Math.max(0, event.y - 10) + 'px;width:20px;height:20px;border:2px solid #ff3b30;border-radius:999px;background:rgba(255,59,48,.16);box-shadow:0 0 0 4px rgba(255,59,48,.12);z-index:2147483647;pointer-events:none;';
    document.documentElement.appendChild(marker);
    setTimeout(() => marker.remove(), 1600);
  }
  document.addEventListener('click', (event) => { void annotateElement(event.target, 'click', { x: event.clientX, y: event.clientY }); }, true);
  document.addEventListener('selectionchange', () => {
    const selection = document.getSelection && document.getSelection();
    if (!selection || !selection.toString()) return;
    const node = selection.anchorNode;
    const element = node && (node.nodeType === 1 ? node : node.parentElement || (node.parentNode && node.parentNode.nodeType === 1 ? node.parentNode : null));
    void annotateElement(element, 'selection', null);
  });
  document.addEventListener('DOMContentLoaded', () => recordDomEvent('domcontentloaded'), { once: true });
  setTimeout(() => recordDomEvent('post-load-sample'), 0);
})();
`;

function defaultSessionId(): string {
  return `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeJsonl(path: string, events: BrowserArtifactEvent[]): void {
  writeFileSync(path, events.map((event) => JSON.stringify(event)).join("\n") + (events.length ? "\n" : ""));
}

function isGatewayToolError(result: Record<string, unknown>): boolean {
  const childResult = result.child_result;
  return Boolean(childResult && typeof childResult === "object" && (childResult as { isError?: unknown }).isError === true);
}

function snapshotText(gatewayResult: Record<string, unknown> | null): string | null {
  if (!gatewayResult) return null;
  if (typeof gatewayResult.text === "string") return gatewayResult.text.slice(0, 8000);
  const childResult = gatewayResult.child_result;
  if (!childResult || typeof childResult !== "object") return null;
  const content = (childResult as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;
  const firstText = content
    .map((part) => (part && typeof part === "object" ? (part as { text?: unknown }).text : null))
    .find((text): text is string => typeof text === "string");
  return firstText ? firstText.slice(0, 8000) : null;
}

function buildHar(session: ActiveBrowserRecording): Record<string, unknown> {
  return {
    log: {
      version: "1.2",
      creator: { name: "reck", version: "0.0.0" },
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
        _reck_event: event.event ?? "network",
        _reck_index: index,
        _reck_ts: typeof event.ts === "number" ? event.ts : 0,
      })),
    },
  };
}

function buildTimelineAlignment(session: ActiveBrowserRecording): Record<string, { origin: string; unit: "seconds"; event_count: number; artifact?: string }> {
  return {
    frames: { origin: "recording_start_monotonic", unit: "seconds", event_count: session.frameSnapshots.length, artifact: "frames" },
    dom: { origin: "recording_start_monotonic", unit: "seconds", event_count: session.domSnapshots.length, artifact: "dom" },
    network: { origin: "recording_start_monotonic", unit: "seconds", event_count: session.networkEvents.length, artifact: "network.jsonl" },
    console: { origin: "recording_start_monotonic", unit: "seconds", event_count: session.consoleEvents.length, artifact: "console.jsonl" },
    fiber_commits: { origin: "page_performance_now_relative_to_recording_start", unit: "seconds", event_count: countJsonlEvents(session.package.fiberCommitsJsonlPath), artifact: "fiber-commits.jsonl" },
    react_grab_events: { origin: "page_performance_now_relative_to_recording_start", unit: "seconds", event_count: countJsonlEvents(session.package.reactGrabEventsJsonlPath), artifact: "react-grab-events.jsonl" },
    source_dictionary: { origin: existsSync(session.package.sourceDictionaryPath) ? "dom_snapshot_next_prerender_stack" : "react_source_runtime", unit: "seconds", event_count: countSourceDictionaryEntries(session.package.sourceDictionaryPath), artifact: "source-dictionary.json" },
    trace: { origin: "playwright_trace_clock_aligned_by_recording_start", unit: "seconds", event_count: existsSync(session.package.tracePath) ? 1 : 0, artifact: "trace.zip" },
    work_items: { origin: "recording_start_monotonic", unit: "seconds", event_count: 0, artifact: "analysis.json when Layer 0/eval has run" },
    gateway: { origin: "recording_start_monotonic", unit: "seconds", event_count: session.gatewayEvents.length, artifact: "gateway.jsonl" },
    logs: { origin: "recording_start_monotonic", unit: "seconds", event_count: session.logEvents.length, artifact: "logs.jsonl" },
  };
}

function countJsonlEvents(path: string): number {
  if (!existsSync(path)) return 0;
  return readFileSync(path, "utf8").split("\n").filter(Boolean).length;
}

function countSourceDictionaryEntries(path: string): number {
  if (!existsSync(path)) return 0;
  const value = JSON.parse(readFileSync(path, "utf8")) as { entries?: unknown };
  if (Array.isArray(value.entries)) return value.entries.length;
  return Object.keys(value).length;
}

function loadReactGrabGlobalBundle(): string {
  const path = nodeRequire.resolve("react-grab/dist/index.global.js");
  return readFileSync(path, "utf8");
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

function sanitizeRecord(value: unknown, tracker?: RedactionTracker, stream = "unknown"): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, prop]) => [
      key,
      isSensitiveKey(key) ? redactSensitiveValue(key, tracker, stream) : sanitizeNestedValue(prop, tracker, stream),
    ]),
  );
}

function sanitizeReactEvent(event: Record<string, unknown>, tracker?: RedactionTracker, stream = "react_source"): BrowserArtifactEvent {
  return Object.fromEntries(
    Object.entries(event).map(([key, value]) => {
      if (isSensitiveKey(key)) return [key, redactSensitiveValue(key, tracker, stream)];
      return [key, sanitizeNestedValue(value, tracker, stream)];
    }),
  );
}

function sanitizeSourceDictionary(sourceDictionary: Record<string, unknown>, tracker?: RedactionTracker): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(sourceDictionary).map(([key, value]) => [key, sanitizeNestedValue(value, tracker, "source_dictionary")]),
  );
}

type NextPrerenderSourceEntry = {
  id: string;
  component: string;
  file: string;
  line: number | null;
  column: number | null;
  snapshot_ts: number;
  snapshot_path: string;
  provenance: "next_prerender_stack";
  source: { file: string; line: number | null; column: number | null };
  component_stack: Array<{ display_name: string; source: { file: string; line: number | null; column: number | null }; provenance: "next_prerender_stack" }>;
};

type NextPrerenderSourceDictionary = {
  provenance: "next_prerender_stack";
  entries: NextPrerenderSourceEntry[];
  components: Record<string, NextPrerenderSourceEntry>;
};

function buildNextPrerenderSourceDictionary(session: ActiveBrowserRecording): NextPrerenderSourceDictionary {
  const byKey = new Map<string, NextPrerenderSourceEntry>();
  for (const snapshot of session.domSnapshots) {
    if (!existsSync(snapshot.path)) continue;
    const html = readFileSync(snapshot.path, "utf8");
    for (const entry of extractNextPrerenderSourceEntries(html, snapshot.ts, browserPackageRelativePath(session.package, snapshot.path))) {
      const key = `${entry.component}\0${entry.file}\0${entry.line ?? ""}\0${entry.column ?? ""}`;
      if (!byKey.has(key)) byKey.set(key, entry);
    }
  }
  const entries = [...byKey.values()].sort((a, b) => a.component.localeCompare(b.component) || a.file.localeCompare(b.file));
  return {
    provenance: "next_prerender_stack",
    entries,
    components: Object.fromEntries(entries.map((entry) => [entry.component, entry])),
  };
}

function extractNextPrerenderSourceEntries(html: string, snapshotTs: number, snapshotPath: string): NextPrerenderSourceEntry[] {
  const entries: NextPrerenderSourceEntry[] = [];
  const stackRegex = /\s+at\s+([A-Za-z_$][\w$]*(?:\s+\[Prerender\])?)\s+\((about:\/\/React\/Prerender\/file:\/\/[^\s)]+)\)/g;
  for (const match of html.matchAll(stackRegex)) {
    const rawComponent = match[1];
    const frameUrl = match[2];
    if (!rawComponent || !frameUrl) continue;
    const parsedSource = parseNextPrerenderFrameSource(frameUrl);
    if (!parsedSource.file) continue;
    const source = { file: parsedSource.file, line: parsedSource.line, column: parsedSource.column };
    const component = rawComponent.replace(/\s+\[Prerender\]$/, "");
    const entry: NextPrerenderSourceEntry = {
      id: `next-prerender-stack:${component}:${source.file}:${source.line ?? ""}:${source.column ?? ""}`,
      component,
      file: source.file,
      line: source.line,
      column: source.column,
      snapshot_ts: snapshotTs,
      snapshot_path: snapshotPath,
      provenance: "next_prerender_stack",
      source,
      component_stack: [{ display_name: component, source, provenance: "next_prerender_stack" }],
    };
    entries.push(entry);
  }
  return entries;
}

function parseNextPrerenderFrameSource(frameUrl: string): { file: string | null; line: number | null; column: number | null } {
  if (!frameUrl.startsWith("about://React/Prerender/file://")) return { file: null, line: null, column: null };
  const projectId = frameUrl.match(/[?&]id=([^?#)]+)/)?.[1];
  const file = projectId ? decodeNextPrerenderProjectId(projectId) : null;
  if (!file) return { file: null, line: null, column: null };
  const location = frameUrl.match(/\?(?:[^:)]+:)?(\d+):(\d+):(\d+)(?:\)|$)/);
  return {
    file,
    line: location ? Number(location[2]) : null,
    column: location ? Number(location[3]) : null,
  };
}

function decodeNextPrerenderProjectId(value: string): string | null {
  let decoded = value;
  for (let i = 0; i < 3; i += 1) {
    const next = safeDecodeURIComponent(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  decoded = decoded.replace(/\+/g, " ");
  const match = decoded.match(/(?:^|\s)\[project\]\/([^\s]+)/);
  return match?.[1] ?? null;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sanitizeNestedValue(value: unknown, tracker?: RedactionTracker, stream = "unknown"): unknown {
  if (typeof value === "string") return redactText(value, 1000, tracker, stream);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeNestedValue(item, tracker, stream));
  if (value && typeof value === "object") return sanitizeRecord(value, tracker, stream);
  return value;
}

function redactSensitiveValue(key: string, tracker?: RedactionTracker, stream = "unknown"): string {
  recordRedaction(tracker, stream, `prop:${key.toLowerCase()}`);
  return "[redacted]";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
