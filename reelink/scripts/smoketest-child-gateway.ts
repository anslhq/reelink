import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { runReckAgent } from "../src/agent-run/run.js";
import { BrowserRecordingModule } from "../src/browser-recording/lifecycle.js";
import { playwrightBrowserRecordingDriver } from "../src/browser-recording/playwright-driver.js";

type GatewayManifest = {
  gateway?: {
    child_mode?: string;
    child_tools?: string[];
    forwarded_tools?: Record<string, string>;
  };
};

type GatewayEvent = Record<string, unknown> & {
  status?: string;
  tool?: string;
  child_tool?: string;
};

const module = new BrowserRecordingModule(playwrightBrowserRecordingDriver);

const started = await module.startRecording({ url: "https://example.com", max_seconds: 15, headless: true });
await module.snapshotBrowser(started.session_id, true);
await module.evaluateBrowser({ session_id: started.session_id, expression: "document.title" });
await module.takeScreenshotBrowser({ session_id: started.session_id });
await module.clickBrowser({ session_id: started.session_id, x: 20, y: 20 });
await module.waitBrowser({ session_id: started.session_id, ms: 250 });
const stopped = await module.stopRecording(started.session_id);
const manifest = readJson<GatewayManifest>(stopped.artifacts.manifest);
const gatewayEvents = readJsonl<GatewayEvent>(join(dirname(stopped.artifacts.manifest), "gateway.jsonl"));

assert(manifest.gateway?.child_mode === "playwright-mcp-child", "expected Playwright MCP child mode");
assert(Array.isArray(manifest.gateway?.child_tools) && manifest.gateway.child_tools.includes("browser_snapshot"), "expected listed child tools");
assert(manifest.gateway?.forwarded_tools?.reck_browser_snapshot === "browser_snapshot", "expected snapshot forwarding map");
assert(manifest.gateway?.forwarded_tools?.reck_browser_evaluate === "browser_evaluate", "expected evaluate forwarding map");
assert(manifest.gateway?.forwarded_tools?.reck_browser_take_screenshot, "expected screenshot forwarding map");
assert(gatewayEvents.some((event) => event.status === "forwarded" && event.tool === "snapshot" && event.child_tool === "browser_snapshot"), "expected forwarded child snapshot event");
assert(gatewayEvents.some((event) => event.status === "forwarded" && event.tool === "evaluate" && nestedPublicTool(event) === "reck_browser_evaluate"), "expected forwarded child evaluate event");
assert(gatewayEvents.some((event) => event.status === "forwarded" && event.tool === "screenshot" && event.public_tool === "reck_browser_take_screenshot"), "expected forwarded child screenshot event");
assert(gatewayEvents.some((event) => event.status === "forwarded" && event.tool === "click"), "expected forwarded child click event");
assert(existsSync(stopped.path), "expected recorded video to exist");

const run = await runReckAgent(new BrowserRecordingModule(playwrightBrowserRecordingDriver), {
  task_description: "Verify shared child gateway records a simple page observation",
  target_url: "https://example.com",
  max_seconds: 15,
  headless: true,
  actions: [{ type: "snapshot", save_dom: true }, { type: "wait", ms: 250 }],
});
const runManifest = readJson<GatewayManifest>(run.artifacts.manifest);
assert(run.status === "completed", "expected reck_run to complete");
assert(run.recording_id.length > 0, "expected reusable recording id from reck_run");
const runGatewayEvents = readJsonl<GatewayEvent>(join(dirname(run.artifacts.manifest), "gateway.jsonl"));
assert(runManifest.gateway?.child_mode === "playwright-mcp-child", "expected reck_run manifest to use child mode");
assert(runGatewayEvents.some((event) => event.status === "forwarded" && event.tool === "snapshot" && event.child_tool === "browser_snapshot"), "expected reck_run snapshot through child gateway artifact");

process.stdout.write(JSON.stringify({
  browser_recording_id: stopped.session_id,
  browser_manifest: stopped.artifacts.manifest,
  run_recording_id: run.recording_id,
  run_manifest: run.artifacts.manifest,
  child_mode: manifest.gateway.child_mode,
  forwarded_tools: manifest.gateway.forwarded_tools,
}, null, 2) + "\n");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function nestedPublicTool(event: GatewayEvent): unknown {
  if (event.public_tool) return event.public_tool;
  const result = event.result;
  return result && typeof result === "object" ? (result as Record<string, unknown>).public_tool : undefined;
}
