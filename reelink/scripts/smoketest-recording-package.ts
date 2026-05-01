import { existsSync, readFileSync } from "node:fs";

import { BrowserRecordingModule } from "../src/browser-recording/lifecycle.js";
import { playwrightBrowserRecordingDriver } from "../src/browser-recording/playwright-driver.js";
import { getRuntimeComponents, getRuntimeDom } from "../src/runtime-artifacts/retrieval.js";

const module = new BrowserRecordingModule(playwrightBrowserRecordingDriver, undefined, () => `rec_smoke_${Date.now().toString(36)}`);
const pageUrl = `data:text/html,${encodeURIComponent(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>Reck smoke app</title></head>
<body>
  <main data-reck-component="SmokeApp" data-source-file="src/SmokeApp.tsx" data-source-line="7" data-secret-token="raw-secret">
    <button id="nav" data-reck-component="SmokeButton" data-source-file="src/SmokeButton.tsx" data-source-line="11">Open panel</button>
    <section id="panel" hidden data-reck-component="SmokePanel" data-source-file="src/SmokePanel.tsx" data-source-line="21">Ready</section>
  </main>
  <script>
    console.info('smoke app boot token=console-secret');
    fetch('data:application/json,{"ok":true}').catch(() => undefined);
    document.getElementById('nav').addEventListener('click', () => {
      document.getElementById('panel').hidden = false;
      console.error('panel opened password=panel-secret');
    });
  </script>
</body>
</html>`)}`;

const started = await module.startRecording({ url: pageUrl, max_seconds: 20, headless: true });
await module.clickBrowser({ session_id: started.session_id, selector: "#nav" });
await module.snapshotBrowser(started.session_id, true);
await module.waitBrowser({ session_id: started.session_id, ms: 500 });
const stopped = await module.stopRecording(started.session_id);

type RecordingManifest = {
  gateway?: unknown;
  streams?: Record<string, { status?: string; reason?: string }>;
};

const manifest = JSON.parse(readFileSync(stopped.artifacts.manifest, "utf8")) as RecordingManifest;
const dom = await getRuntimeDom(stopped.session_id, 0);
const components = await getRuntimeComponents(stopped.session_id, 0);
const requiredArtifacts = [
  stopped.artifacts.video,
  stopped.artifacts.trace,
  stopped.artifacts.network_har,
  stopped.artifacts.console,
  stopped.artifacts.logs,
  stopped.artifacts.manifest,
];
const optionalArtifacts = {
  fiber_commits: stopped.artifacts.fiber_commits,
  source_dictionary: stopped.artifacts.source_dictionary,
  react_grab_events: stopped.artifacts.react_grab_events,
};

for (const artifact of requiredArtifacts) {
  if (!existsSync(artifact)) throw new Error(`Expected recording artifact missing: ${artifact}`);
}

for (const stream of ["frames", "trace", "dom", "network", "console", "logs", "gateway"]) {
  const status = manifest.streams?.[stream]?.status;
  if (status !== "available") throw new Error(`Expected ${stream} stream available, got ${status}: ${manifest.streams?.[stream]?.reason ?? "no reason"}`);
}

for (const [stream, artifact] of Object.entries(optionalArtifacts)) {
  const status = manifest.streams?.[stream]?.status;
  if (status === "available" && !existsSync(artifact)) throw new Error(`Expected available ${stream} artifact missing: ${artifact}`);
  if (status !== "available" && !manifest.streams?.[stream]?.reason) throw new Error(`Expected unavailable ${stream} stream to include an explicit reason`);
}

if (dom.status !== "available") throw new Error(`DOM retrieval failed: ${dom.reason}`);
if (manifest.streams?.react_grab_events?.status === "available") {
  if (components.status !== "available") throw new Error(`Component retrieval failed: ${components.reason}`);
} else if (components.status !== "missing_stream") {
  throw new Error(`Expected component retrieval to report missing_stream, got ${components.status}`);
}
if (readFileSync(stopped.artifacts.console, "utf8").includes("panel-secret")) throw new Error("Console secret was not redacted");
if (manifest.streams?.react_grab_events?.status === "available" && readFileSync(stopped.artifacts.react_grab_events, "utf8").includes("raw-secret")) {
  throw new Error("React/source props secret was not redacted");
}

console.log(JSON.stringify({
  recording_id: stopped.session_id,
  manifest: stopped.artifacts.manifest,
  gateway: manifest.gateway,
  streams: manifest.streams,
  dom_status: dom.status,
  component_status: components.status,
}, null, 2));
