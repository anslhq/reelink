import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  BrowserRecordingModule,
  directPlaywrightBrowserToolClassification,
  type BrowserAutomationGateway,
  type BrowserConsoleMessage,
  type BrowserRecordingClock,
  type BrowserRecordingDriver,
  type BrowserRecordingPage,
  type BrowserRequest,
  type BrowserResponse,
} from "../src/browser-recording/lifecycle.js";

let workspace: string;
let previousCwd: string;
let driver: FakeBrowserRecordingDriver;
let clock: FakeClock;
let module: BrowserRecordingModule;

beforeEach(async () => {
  previousCwd = process.cwd();
  workspace = await mkdtemp(join(tmpdir(), "reelink-browser-recording-"));
  process.chdir(workspace);
  driver = new FakeBrowserRecordingDriver();
  clock = new FakeClock(Date.parse("2026-04-29T00:00:00.000Z"));
  module = new BrowserRecordingModule(driver, clock, () => "rec_browser_test");
});

afterEach(async () => {
  process.chdir(previousCwd);
  await rm(workspace, { recursive: true, force: true });
});

describe("browser recording lifecycle module", () => {
  test("starts a fake browser session and reports active status", async () => {
    const started = await module.startRecording({ url: "http://example.test", max_seconds: 60 });

    expect(started).toMatchObject({
      session_id: "rec_browser_test",
      status: "recording",
      url: "http://example.test",
      path: resolve(".reck/browser-recordings/rec_browser_test/video.webm"),
      started_at: "2026-04-29T00:00:00.000Z",
      max_seconds: 60,
    });
    expect(driver.page.url()).toBe("http://example.test");
    expect(module.listActiveRecordings().active).toEqual([
      {
        session_id: "rec_browser_test",
        url: "http://example.test",
        path: resolve(".reck/browser-recordings/rec_browser_test/video.webm"),
        started_at: "2026-04-29T00:00:00.000Z",
        max_seconds: 60,
      },
    ]);
  });

  test("stops once and returns the same result on double stop", async () => {
    const started = await module.startRecording({ url: "http://example.test", max_seconds: 60 });
    clock.advance(1500);

    const stopped = await module.stopRecording(started.session_id);
    const stoppedAgain = await module.stopRecording(started.session_id);

    expect(stoppedAgain).toBe(stopped);
    expect(stopped).toMatchObject({
      session_id: "rec_browser_test",
      status: "stopped",
      exists: true,
      size_bytes: 11,
      started_at: "2026-04-29T00:00:00.000Z",
      stopped_at: "2026-04-29T00:00:01.500Z",
      duration_limit_hit: false,
    });
    expect(module.listActiveRecordings().active).toEqual([]);
    expect(driver.closedContextCount).toBe(1);
    expect(driver.closedBrowserCount).toBe(1);
  });

  test("stops through max duration handling", async () => {
    await module.startRecording({ url: "http://example.test", max_seconds: 2 });

    clock.runNextTimer();
    const stopped = await module.stopRecording("rec_browser_test");

    expect(stopped.duration_limit_hit).toBe(true);
    const manifest = readJson(stopped.artifacts.manifest);
    expect(manifest.duration_limit_hit).toBe(true);
  });

  test("installs bippy hook-only before the full secure recorder", async () => {
    await module.startRecording({ url: "http://example.test", max_seconds: 60 });

    expect(driver.page.initScripts).toHaveLength(2);
    expect(driver.page.initScripts[0]).toContain("hookOnlyInstalled");
    expect(driver.page.initScripts[0]).toContain("__REACT_DEVTOOLS_GLOBAL_HOOK__");
    expect(driver.page.initScripts[1]).toContain("__REACT_GRAB_MODULE__");
    expect(driver.page.initScripts[1]).toContain("react-grab:init");
    expect(driver.page.initScripts[1]).toContain("secureApplied: true");
    expect(driver.page.initScripts[1]).toContain("dangerouslyRunInProduction: false");
    expect(driver.page.initScripts[1]).toContain("reactGrab: 'react-grab/dist/index.global.js headless bundle plus element-pointer recorder'");
  });


  test("recorder init script enriches annotations from the React Grab runtime API", async () => {
    await module.startRecording({ url: "http://example.test", max_seconds: 60 });
    const script = driver.page.initScripts[1];

    expect(script).toContain("await api.getSource(element)");
    expect(script).toContain("await api.getStackContext(element)");
    expect(script).toContain("filePath");
    expect(script).toContain("fileName");
    expect(script).toContain("lineNumber");
    expect(script).toContain("getDisplayName");
    expect(script).not.toContain("if (!source) return;");
    expect(script).toContain("react_grab: true");
    expect(script).toContain("[data-reck-source-file], [data-source-file]");
    expect(script).toContain("reck_init: dataset.reckSourceTruth === 'source-file'");
    expect(script).toContain("void annotateElement(event.target, 'click'");
    expect(script).toContain("void annotateElement(element, 'selection', null)");
  });

  test("writes artifact manifest with package-compatible paths and honest stream status", async () => {
    const started = await module.startRecording({ url: "http://example.test", max_seconds: 60 });
    await module.snapshotBrowser(started.session_id, true);
    clock.advance(500);
    driver.page.emitConsole("error", "Hydration warning password=super-secret");
    driver.page.emitRequest("GET", "http://example.test/api/data?token=raw-secret");
    driver.page.emitResponse(500, "http://example.test/api/data?token=raw-secret", false);

    const stopped = await module.stopRecording(started.session_id);
    const manifest = readJson(stopped.artifacts.manifest);

    expect(manifest).toMatchObject({
      recording_id: "rec_browser_test",
      session_id: "rec_browser_test",
      source_type: "browser_recording",
      source_path: "http://example.test",
      artifacts: {
        video: "video.webm",
        network: "network.jsonl",
        network_har: "network.har",
        console: "console.jsonl",
        logs: "logs.jsonl",
        dom: "dom",
        trace: "trace.zip",
        frames: "frames",
        fiber_commits: "fiber-commits.jsonl",
        source_dictionary: "source-dictionary.json",
        react_grab_events: "react-grab-events.jsonl",
        gateway: "gateway.jsonl",
      },
      streams: {
        layer0: { status: "not_collected", reason: "Browser recording was captured without Layer 0 video analysis" },
        frames: { status: "not_collected", reason: "Browser recording could not sample screenshots from the active page" },
        trace: { status: "not_collected", reason: "Playwright tracing was unavailable from the active browser driver" },
        dom: { status: "available" },
        fiber_commits: {
          status: "not_collected",
          reason: "No bippy/React fiber commits were available on the page",
        },
        source_dictionary: {
          status: "not_collected",
          reason: "No React source dictionary was available on the page",
        },
        react_grab_events: {
          status: "not_collected",
          reason: "No react-grab compatible component events were available on the page",
        },
        network: { status: "available" },
        console: { status: "available" },
        logs: { status: "available" },
        gateway: { status: "unavailable" },
        eval: { status: "not_collected", reason: "No verification artifact generated" },
      },
      safety: {
        redaction_applied: true,
        redaction_rules: expect.arrayContaining(["text:password", "url_param:token", "header:cookie"]),
        redacted_streams: expect.arrayContaining(["console", "network"]),
      },
      gateway: { mode: "single-mcp", cdp_endpoint_available: false, child_status: "unavailable", child_mode: null, child_tools: [], forwarded_tools: {} },
      tool_classification: directPlaywrightBrowserToolClassification,
    });
    expect(existsSync(resolve(".reck/browser-recordings/rec_browser_test/video.webm"))).toBe(true);
    const consoleJsonl = readFileSync(stopped.artifacts.console, "utf8");
    const networkJsonl = readFileSync(stopped.artifacts.network, "utf8");
    const networkHar = readJson(stopped.artifacts.network_har);
    expect(consoleJsonl).toContain("Hydration warning password=[redacted]");
    expect(consoleJsonl).not.toContain("super-secret");
    expect(networkJsonl).toContain("\"status\":500");
    expect(networkJsonl).not.toContain("raw-secret");
    expect(networkHar).toMatchObject({
      log: {
        version: "1.2",
        entries: expect.arrayContaining([
          expect.objectContaining({
            _reck_ts: 0.5,
            startedDateTime: "2026-04-29T00:00:00.500Z",
            request: expect.objectContaining({ url: "http://example.test/api/data?token=%5Bredacted%5D" }),
          }),
        ]),
      },
    });
    expect(JSON.stringify(networkHar)).not.toContain("raw-secret");
    expect(manifest.dom_snapshots).toEqual(
      expect.arrayContaining([expect.objectContaining({ ts: 0, tree_summary: "main:1" })]),
    );
    expect(manifest.timeline_alignment).toMatchObject({
      frames: { origin: "recording_start_monotonic", unit: "seconds", event_count: 0, artifact: "frames" },
      dom: { origin: "recording_start_monotonic", unit: "seconds", event_count: 2, artifact: "dom" },
      network: { origin: "recording_start_monotonic", unit: "seconds", event_count: 2, artifact: "network.jsonl" },
      console: { origin: "recording_start_monotonic", unit: "seconds", event_count: 1, artifact: "console.jsonl" },
      fiber_commits: { origin: "page_performance_now_relative_to_recording_start", unit: "seconds", event_count: 0, artifact: "fiber-commits.jsonl" },
      react_grab_events: { origin: "page_performance_now_relative_to_recording_start", unit: "seconds", event_count: 0, artifact: "react-grab-events.jsonl" },
      trace: { origin: "playwright_trace_clock_aligned_by_recording_start", unit: "seconds", event_count: 0, artifact: "trace.zip" },
      work_items: { origin: "recording_start_monotonic", unit: "seconds", event_count: 0, artifact: "analysis.json when Layer 0/eval has run" },
    });
    expect(manifest.prod_build).toBeNull();
    expect(manifest.prod_build_status).toBe("unavailable");
    expect(manifest.prod_build_reason).toBe("React production-mode detection was not available from captured runtime evidence");
    expect(manifest.relations).toEqual({ browser_recording_id: "rec_browser_test", related_recording_ids: [], relation: "browser_capture" });
    expect(manifest.react_capture).toEqual({
      hook_order: ["install-hook-only", "react-grab-global-bundle", "secure-recorder"],
      secure_applied: true,
      dangerously_run_in_production: false,
      direct_libraries: {
        bippy: "install-hook-only-compatible-devtools-hook",
        react_grab: "react-grab/dist/index.global.js headless bundle plus element-pointer recorder",
      },
    });
  });

  test("persists child gateway forwarding events with public reck browser tool names", async () => {
    driver.gateway = new FakeGateway();
    const started = await module.startRecording({ url: "http://example.test", max_seconds: 60 });

    const evaluated = await module.evaluateBrowser({ session_id: started.session_id, expression: "document.title" });
    const screenshot = await module.takeScreenshotBrowser({ session_id: started.session_id });
    const stopped = await module.stopRecording(started.session_id);
    const manifest = readJson(stopped.artifacts.manifest);
    const gatewayEvents = readFileSync(resolve(".reck/browser-recordings/rec_browser_test/gateway.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(evaluated).toMatchObject({
      gateway: "playwright-mcp-child",
      gateway_status: "forwarded",
      result: {
        public_tool: "reck_browser_evaluate",
        child_tool: "browser_evaluate",
        result: "Fake page",
      },
    });
    expect(screenshot).toMatchObject({
      gateway: "playwright-mcp-child",
      gateway_status: "forwarded",
      public_tool: "reck_browser_take_screenshot",
      child_tool: "browser_take_screenshot",
    });
    expect((manifest.streams as Record<string, unknown>).gateway).toEqual({ status: "available" });
    expect(manifest.gateway).toMatchObject({
      mode: "single-mcp",
      child_status: "available",
      child_mode: "playwright-mcp-child",
      child_tools: ["browser_snapshot", "browser_evaluate", "browser_take_screenshot"],
      forwarded_tools: {
        reck_browser_snapshot: "browser_snapshot",
        reck_browser_evaluate: "browser_evaluate",
        reck_browser_take_screenshot: "browser_take_screenshot",
      },
    });
    expect(gatewayEvents.some((event) =>
      event.status === "forwarded" &&
      event.tool === "evaluate" &&
      event.mode === "playwright-mcp-child" &&
      typeof event.result === "object" &&
      event.result !== null &&
      (event.result as Record<string, unknown>).public_tool === "reck_browser_evaluate" &&
      (event.result as Record<string, unknown>).child_tool === "browser_evaluate",
    )).toBe(true);
    expect(gatewayEvents.some((event) =>
      event.status === "forwarded" &&
      event.tool === "screenshot" &&
      event.mode === "playwright-mcp-child" &&
      event.public_tool === "reck_browser_take_screenshot" &&
      event.child_tool === "browser_take_screenshot",
    )).toBe(true);
  });

  test("persists visible react-grab annotation events with rich redacted metadata", async () => {
    driver.page.reactRecorderState = {
      installed: true,
      hasReactHook: true,
      sourceDictionary: {
        "/Users/harsha/Documents/GitHub/landing/src/components/HomeHeroMount.tsx": {
          file: "/Users/harsha/Documents/GitHub/landing/src/components/HomeHeroMount.tsx",
          line: 25,
          column: null,
          react_grab: true,
        },
      },
      fiberCommits: [],
      reactGrabEvents: [
        {
          ts: 0.4,
          event: "annotation",
          trigger: "click",
          x: 42,
          y: 64,
          dom_coordinates: { x: 42, y: 64 },
          component: "HomeHeroMount",
          source: {
            file: "/Users/harsha/Documents/GitHub/landing/src/components/HomeHeroMount.tsx",
            line: 25,
            column: null,
            react_grab: true,
          },
          react_grab: true,
          element_path: "html > body > main > span",
          selected_text: "Build",
          css_classes: ["hero-word"],
          accessibility: { role: null, name: "Build" },
          computed_styles: { display: "inline-flex", color: "rgb(255, 255, 255)" },
          bounding_box: { x: 10, y: 20, width: 120, height: 40 },
          props: { label: "Build", token: "raw-secret", nested: { password: "pw" } },
          component_stack: [
            {
              display_name: "HomeHeroMount",
              source: {
                file: "/Users/harsha/Documents/GitHub/landing/src/components/HomeHeroMount.tsx",
                line: 25,
                column: 9,
                react_grab: true,
              },
            },
            { display_name: "Providers" },
            { display_name: "AppShell" },
          ],
        },
      ],
    };

    const started = await module.startRecording({ url: "http://example.test", max_seconds: 60 });
    const stopped = await module.stopRecording(started.session_id);

    const events = readFileSync(stopped.artifacts.react_grab_events, "utf8").trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      ts: 0.4,
      event: "annotation",
      trigger: "click",
      x: 42,
      y: 64,
      dom_coordinates: { x: 42, y: 64 },
      component: "HomeHeroMount",
      source: { file: "/Users/harsha/Documents/GitHub/landing/src/components/HomeHeroMount.tsx", line: 25, column: null, react_grab: true },
      react_grab: true,
      element_path: "html > body > main > span",
      selected_text: "Build",
      css_classes: ["hero-word"],
      accessibility: { role: null, name: "Build" },
      computed_styles: { display: "inline-flex", color: "rgb(255, 255, 255)" },
      bounding_box: { x: 10, y: 20, width: 120, height: 40 },
      props: { label: "Build", token: "[redacted]", nested: { password: "[redacted]" } },
      component_stack: expect.arrayContaining([
        expect.objectContaining({
          display_name: "HomeHeroMount",
          source: { file: "/Users/harsha/Documents/GitHub/landing/src/components/HomeHeroMount.tsx", line: 25, column: 9, react_grab: true },
        }),
      ]),
    });
    expect(JSON.stringify(events)).not.toContain("raw-secret");
    const sourceDictionary = readJson(stopped.artifacts.source_dictionary);
    expect(sourceDictionary).toMatchObject({
      "/Users/harsha/Documents/GitHub/landing/src/components/HomeHeroMount.tsx": {
        file: "/Users/harsha/Documents/GitHub/landing/src/components/HomeHeroMount.tsx",
        line: 25,
        react_grab: true,
      },
    });
    const manifest = readJson(stopped.artifacts.manifest);
    expect(manifest.streams).toMatchObject({ react_grab_events: { status: "available" }, source_dictionary: { status: "available" } });
    expect(manifest.safety).toMatchObject({ redacted_streams: expect.arrayContaining(["react_grab_events"]) });
  });

  test("harvests real Next prerender stack metadata from DOM snapshots into source dictionary", async () => {
    driver.page.html = `<template data-cstck="
    at div (&lt;anonymous&gt;)
    at RootLayout (about://React/Prerender/file:///Users/harsha/Documents/GitHub/landing/.next/dev/server/chunks/ssr/%255Broot-of-the-server%255D__0ifzdiu._.js?id=%255Bproject%255D%252Fsrc%252Fapp%252Flayout.tsx+%255Bapp-rsc%255D+%2528ecmascript%2529?159:117:284)
    at ContainerRoot (about://React/Prerender/file:///Users/harsha/Documents/GitHub/landing/.next/dev/server/chunks/ssr/%5Broot-of-the-server%5D__0ifzdiu._.js?4:209:263)
    at HomePage (about://React/Prerender/file:///Users/harsha/Documents/GitHub/landing/.next/dev/server/chunks/ssr/%5Broot-of-the-server%5D__0a_yupn._.js?2:3193:264)
    at App (/Users/harsha/Documents/GitHub/landing/node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js:69:46054)"></template>`;

    const started = await module.startRecording({ url: "http://example.test", max_seconds: 60 });
    await module.snapshotBrowser(started.session_id, true);
    const stopped = await module.stopRecording(started.session_id);

    const sourceDictionary = readJson(stopped.artifacts.source_dictionary);
    expect(sourceDictionary).toMatchObject({
      provenance: "next_prerender_stack",
      entries: expect.arrayContaining([
        expect.objectContaining({
          component: "RootLayout",
          file: "src/app/layout.tsx",
          line: 117,
          column: 284,
          provenance: "next_prerender_stack",
          snapshot_path: "dom/snapshot-0001.html",
        }),
      ]),
      components: {
        RootLayout: expect.objectContaining({ file: "src/app/layout.tsx", provenance: "next_prerender_stack" }),
      },
    });
    expect(JSON.stringify(sourceDictionary)).not.toContain("made-up");
    const manifest = readJson(stopped.artifacts.manifest);
    expect(manifest.streams).toMatchObject({ source_dictionary: { status: "available" } });
    expect(manifest.timeline_alignment).toMatchObject({ source_dictionary: { origin: "dom_snapshot_next_prerender_stack", unit: "seconds", event_count: 1, artifact: "source-dictionary.json" } });
  });

  test("captures DOM snapshots when requested and reports null when skipped", async () => {
    const started = await module.startRecording({ url: "http://example.test", max_seconds: 60 });

    const skipped = await module.snapshotBrowser(started.session_id, false);
    const saved = await module.snapshotBrowser(started.session_id, true);

    expect(skipped.dom_path).toBeNull();
    expect(saved.dom_path).toBe(resolve(".reck/browser-recordings/rec_browser_test/dom/snapshot-0001.html"));
    expect(readFileSync(saved.dom_path!, "utf8")).toContain("<main>Fake page</main>");
  });

  test("cleans up driver resources when startup fails", async () => {
    driver.failOpen = true;

    await expect(module.startRecording({ url: "http://example.test", max_seconds: 60 })).rejects.toThrow("open failed");

    expect(module.listActiveRecordings().active).toEqual([]);
    expect(driver.closedContextCount).toBe(1);
    expect(driver.closedBrowserCount).toBe(1);
  });
});

class FakeClock implements BrowserRecordingClock {
  private timer: (() => void) | null = null;

  constructor(private current: number) {}

  now(): number {
    return this.current;
  }

  advance(ms: number): void {
    this.current += ms;
  }

  setTimeout(callback: () => void): unknown {
    this.timer = callback;
    return callback;
  }

  clearTimeout(handle: unknown): void {
    if (this.timer === handle) this.timer = null;
  }

  runNextTimer(): void {
    const callback = this.timer;
    this.timer = null;
    callback?.();
  }
}

class FakeBrowserRecordingDriver implements BrowserRecordingDriver {
  readonly page = new FakePage();
  gateway: BrowserAutomationGateway | undefined;
  failOpen = false;
  closedBrowserCount = 0;
  closedContextCount = 0;

  async open() {
    const browser = { close: async () => void (this.closedBrowserCount += 1) };
    const context = { close: async () => void (this.closedContextCount += 1) };
    if (this.failOpen) {
      await context.close();
      await browser.close();
      throw new Error("open failed");
    }
    return { browser, context, page: this.page, cdpEndpoint: this.gateway ? "http://127.0.0.1:9222" : undefined, automationGateway: this.gateway };
  }
}


class FakeGateway implements BrowserAutomationGateway {
  mode = "playwright-mcp-child" as const;
  status = "available" as const;
  child_tools = ["browser_snapshot", "browser_evaluate", "browser_take_screenshot"];
  forwarded_tools = {
    reck_browser_snapshot: "browser_snapshot",
    reck_browser_evaluate: "browser_evaluate",
    reck_browser_take_screenshot: "browser_take_screenshot",
  };

  async close(): Promise<void> {}

  async navigate(): Promise<Record<string, unknown>> {
    return { public_tool: "reck_browser_navigate", child_tool: "browser_navigate" };
  }

  async evaluate<T = unknown>(): Promise<T> {
    return { public_tool: "reck_browser_evaluate", child_tool: "browser_evaluate", result: "Fake page" } as T;
  }

  async screenshot(path: string): Promise<Record<string, unknown>> {
    writeFileSync(path, "fake-screenshot\n");
    return { public_tool: "reck_browser_take_screenshot", child_tool: "browser_take_screenshot", path };
  }

  async snapshot(): Promise<Record<string, unknown>> {
    return { public_tool: "reck_browser_snapshot", child_tool: "browser_snapshot", text: "Fake body text" };
  }
}

class FakePage implements BrowserRecordingPage {
  mouse = { click: async () => undefined };
  readonly initScripts: string[] = [];
  html = "<main>Fake page</main>";
  reactRecorderState: Record<string, unknown> | null = null;
  private currentUrl = "about:blank";
  private handlers: {
    console: Array<(message: BrowserConsoleMessage) => void>;
    request: Array<(request: BrowserRequest) => void>;
    response: Array<(response: BrowserResponse) => void>;
    requestfailed: Array<(request: BrowserRequest) => void>;
  } = { console: [], request: [], response: [], requestfailed: [] };

  async goto(url: string): Promise<void> {
    this.currentUrl = url;
  }

  async addInitScript(script: string): Promise<void> {
    this.initScripts.push(script);
  }

  async title(): Promise<string> {
    return "Fake title";
  }

  async content(): Promise<string> {
    return this.html;
  }

  url(): string {
    return this.currentUrl;
  }

  video(): { path(): Promise<string> } {
    return {
      path: async () => {
        const path = resolve(".reck/browser-recordings/rec_browser_test/playwright-video.webm");
        writeFileSync(path, "fake-video\n");
        return path;
      },
    };
  }

  locator() {
    return {
      first: () => ({ click: async () => undefined }),
      innerText: async () => "Fake body text",
    };
  }

  getByText() {
    return { first: () => ({ click: async () => undefined }) };
  }

  async fill(): Promise<void> {}

  async waitForTimeout(): Promise<void> {}

  async evaluate<T>(): Promise<T> {
    return (this.reactRecorderState ?? {
      installed: true,
      hasReactHook: false,
      hookInstallReason: "fake page has no React runtime",
      sourceDictionary: {},
      fiberCommits: [],
      reactGrabEvents: [],
    }) as T;
  }

  on<EventName extends keyof FakePage["handlers"]>(event: EventName, handler: FakePage["handlers"][EventName][number]): void {
    this.handlers[event].push(handler as never);
  }

  emitConsole(type: string, text: string): void {
    for (const handler of this.handlers.console) {
      handler({ type: () => type, text: () => text, location: () => ({}) });
    }
  }

  emitRequest(method: string, url: string): void {
    for (const handler of this.handlers.request) {
      handler({ method: () => method, url: () => url, resourceType: () => "fetch", failure: () => null });
    }
  }

  emitResponse(status: number, url: string, ok: boolean): void {
    for (const handler of this.handlers.response) {
      handler({ status: () => status, url: () => url, ok: () => ok, headers: () => ({ cookie: "secret", "content-type": "application/json" }) });
    }
  }
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}
