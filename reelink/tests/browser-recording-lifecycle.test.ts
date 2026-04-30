import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  BrowserRecordingModule,
  directPlaywrightBrowserToolClassification,
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
      path: resolve(".reelink/browser-recordings/rec_browser_test/video.webm"),
      started_at: "2026-04-29T00:00:00.000Z",
      max_seconds: 60,
    });
    expect(driver.page.url()).toBe("http://example.test");
    expect(module.listActiveRecordings().active).toEqual([
      {
        session_id: "rec_browser_test",
        url: "http://example.test",
        path: resolve(".reelink/browser-recordings/rec_browser_test/video.webm"),
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
        dom: "dom",
        trace: "trace.zip",
        fiber_commits: "fiber-commits.jsonl",
        source_dictionary: "source-dictionary.json",
        react_grab_events: "react-grab-events.jsonl",
      },
      streams: {
        layer0: { status: "not_collected", reason: "Browser recording was captured without Layer 0 video analysis" },
        frames: { status: "not_collected", reason: "Browser recording did not sample video frames" },
        trace: { status: "not_collected", reason: "Playwright tracing is not enabled for the direct headed demo recorder" },
        dom: { status: "available" },
        fiber_commits: {
          status: "not_collected",
          reason: "bippy fiber capture is not installed in the direct headed demo recorder",
        },
        source_dictionary: {
          status: "not_collected",
          reason: "bippy source dictionary capture is not installed in the direct headed demo recorder",
        },
        react_grab_events: {
          status: "not_collected",
          reason: "react-grab element capture is not installed in the direct headed demo recorder",
        },
        network: { status: "available" },
        console: { status: "available" },
        eval: { status: "not_collected", reason: "No verification artifact generated" },
      },
      safety: {
        redaction_applied: true,
        redaction_rules: expect.arrayContaining(["text:password", "url_param:token", "header:cookie"]),
        redacted_streams: expect.arrayContaining(["console", "network"]),
      },
      tool_classification: directPlaywrightBrowserToolClassification,
    });
    expect(existsSync(resolve(".reelink/browser-recordings/rec_browser_test/video.webm"))).toBe(true);
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
            _reelink_ts: 0.5,
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
  });

  test("captures DOM snapshots when requested and reports null when skipped", async () => {
    const started = await module.startRecording({ url: "http://example.test", max_seconds: 60 });

    const skipped = await module.snapshotBrowser(started.session_id, false);
    const saved = await module.snapshotBrowser(started.session_id, true);

    expect(skipped.dom_path).toBeNull();
    expect(saved.dom_path).toBe(resolve(".reelink/browser-recordings/rec_browser_test/dom/snapshot-0001.html"));
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
    return { browser, context, page: this.page };
  }
}

class FakePage implements BrowserRecordingPage {
  mouse = { click: async () => undefined };
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

  async title(): Promise<string> {
    return "Fake title";
  }

  async content(): Promise<string> {
    return "<main>Fake page</main>";
  }

  url(): string {
    return this.currentUrl;
  }

  video(): { path(): Promise<string> } {
    return {
      path: async () => {
        const path = resolve(".reelink/browser-recordings/rec_browser_test/playwright-video.webm");
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
