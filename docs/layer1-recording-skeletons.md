# Layer 1 Recording Skeletons

Paste these skeletons into `reelink/src/recording/*` during Phase 1. They are based on the current local Reelink, bippy, react-grab, and Playwright source, and intentionally avoid `rrweb`.

## 1. Recording entry point skeleton - `src/recording/record.ts`

```ts
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page, type ViewportSize } from "playwright";
import type { Manifest } from "../schemas.js";
import { startProbeExtraction } from "./extract-probes.js";
import { installRecordingInitScripts } from "./init-scripts.js";
import { writeRecordingManifest } from "./manifest.js";

export type StreamStatus = "available" | "not_collected" | "unavailable" | "failed";

export type RecordingPackage = {
  id: string;
  root: string;
  manifestPath: string;
  artifacts: {
    video: string;
    trace: string;
    network: string;
    console: string;
    fiberCommits: string;
    reactGrabEvents: string;
    sourceDictionary: string;
  };
  manifest: Manifest;
};

export type RecordSessionOptions = {
  timeoutMs?: number;
  viewport?: ViewportSize;
  remoteDebuggingPort?: number;
  bippyInstallHookOnlyIife?: string;
  bippyBundleIife?: string;
  bippySourceBundleIife?: string;
  reactGrabBundleIife?: string;
};

const DEFAULT_VIEWPORT: ViewportSize = { width: 1280, height: 720 };

export async function recordSession(
  url: string,
  opts: RecordSessionOptions = {},
): Promise<RecordingPackage> {
  const viewport = opts.viewport ?? DEFAULT_VIEWPORT;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const remoteDebuggingPort = opts.remoteDebuggingPort ?? 9222;
  const id = recordingIdFor(url);
  const root = join(process.cwd(), ".reelink", id);
  mkdirSync(root, { recursive: true });

  const artifacts = {
    video: "video.webm",
    trace: "trace.zip",
    network: "network.har",
    console: "console.jsonl",
    fiberCommits: "fiber-commits.jsonl",
    reactGrabEvents: "react-grab-events.jsonl",
    sourceDictionary: "source-dictionary.json",
  };

  const absolute = {
    videoDir: root,
    trace: join(root, artifacts.trace),
    network: join(root, artifacts.network),
    console: join(root, artifacts.console),
    fiberCommits: join(root, artifacts.fiberCommits),
    reactGrabEvents: join(root, artifacts.reactGrabEvents),
    sourceDictionary: join(root, artifacts.sourceDictionary),
  };

  const browser = await chromium.launch({
    headless: true,
    args: [`--remote-debugging-port=${remoteDebuggingPort}`],
  });

  let context: BrowserContext | undefined;
  let page: Page | undefined;

  try {
    context = await browser.newContext({
      viewport,
      recordVideo: { dir: absolute.videoDir, size: viewport },
      recordHar: {
        path: absolute.network,
        content: "omit",
        mode: "minimal",
      },
    });

    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });

    page = await context.newPage();
    await installRecordingInitScripts(page, opts);
    const extraction = startProbeExtraction(page, {
      fiberCommitsPath: absolute.fiberCommits,
      reactGrabEventsPath: absolute.reactGrabEvents,
      sourceDictionaryPath: absolute.sourceDictionary,
      consolePath: absolute.console,
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForTimeout(timeoutMs);
    await extraction.stop();
    await context.tracing.stop({ path: absolute.trace });
    await context.close();
    context = undefined;

    const videoPath = await page.video()?.path().catch(() => null);
    if (videoPath && existsSync(videoPath)) {
      // Phase 1 can rename/copy this to `${root}/video.webm`; keep artifact manifest relative.
    }

    const manifest = writeRecordingManifest({
      id,
      root,
      url,
      artifacts,
      prodBuild: extraction.prodBuild,
      durationSec: null,
    });

    return {
      id,
      root,
      manifestPath: join(root, "manifest.json"),
      artifacts,
      manifest,
    };
  } finally {
    if (context) {
      await context.tracing.stop({ path: absolute.trace }).catch(() => undefined);
      await context.close().catch(() => undefined);
    }
    await browser.close().catch(() => undefined);
  }
}

function recordingIdFor(url: string): string {
  const h = createHash("sha1");
  h.update(url);
  h.update(String(Date.now()));
  return `browser-${h.digest("hex").slice(0, 10)}`;
}
```

## 2. `addInitScript` ordering and window recorder IIFE

The ordering is strict: first install the React DevTools hook before React boots, then inject the full bippy bundle, react-grab bundle, and the per-commit recorder.

```ts
import type { Page } from "playwright";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

declare global {
  interface Window {
    Bippy?: BippyRuntime;
    BippySource?: BippySourceRuntime;
    __REACT_GRAB__?: import("react-grab").ReactGrabAPI;
    __REELINK_BUFFER__?: ReelinkWindowBuffer;
  }
}

export type BippyRuntime = {
  instrument: (options: {
    name?: string;
    onActive?: () => void;
    onCommitFiberRoot?: (rendererID: number, root: unknown, priority: number | void) => void;
  }) => unknown;
  traverseRenderedFibers: (root: unknown, visitor: (fiber: any, phase: string) => void) => void;
  getDisplayName: (type: unknown) => string | null;
  getNearestHostFiber: (fiber: any) => any | null;
  detectReactBuildType: (renderer: unknown) => "development" | "production";
};

export type BippySourceRuntime = {
  getSource: (fiber: any) => Promise<{
    fileName?: string;
    lineNumber?: number;
    columnNumber?: number;
    functionName?: string;
  } | null>;
};

export type ReelinkWindowBuffer = {
  flush: () => {
    fiberCommits: FiberCommitRecord[];
    reactGrabEvents: ReactGrabEventRecord[];
    sourceDictionary: Record<string, SourceDictionaryEntry>;
    prodBuild: boolean;
  };
};

export type FiberCommitRecord = {
  t: number;
  commit_id: number;
  renderer_id: number;
  priority: number | null;
  phase: string;
  fiber_id: string;
  parent_fiber_id: string | null;
  display_name: string | null;
  tag: number;
  key: string | null;
  element_path: string | null;
  bounds: { x: number; y: number; width: number; height: number } | null;
  props: Record<string, unknown>;
};

export type ReactGrabEventRecord = {
  t: number;
  target: string | null;
  component_name: string | null;
  source: SourceDictionaryEntry | null;
  toolbar_state: unknown;
};

export type SourceDictionaryEntry = {
  file: string | null;
  line: number | null;
  column: number | null;
  component: string | null;
};

export async function installRecordingInitScripts(
  page: Page,
  opts: {
  bippyInstallHookOnlyIife?: string;
  bippyBundleIife?: string;
  bippySourceBundleIife?: string;
  reactGrabBundleIife?: string;
  },
): Promise<void> {
  // 1. First call: bippy's install-hook-only IIFE, generated from
  // bippy/packages/bippy/src/install-hook-only.ts. The built artifact is the tiny hook-only bundle.
  await page.addInitScript({
    content: opts.bippyInstallHookOnlyIife ?? loadBrowserBundle("bippy", "dist/install-hook-only.iife.js"),
  });

  // 2. Second call: full bippy bundle, react-grab bundle, then Reelink's commit recorder.
  await page.addInitScript({
    content: [
      opts.bippyBundleIife ?? loadBrowserBundle("bippy", "dist/index.iife.js"),
      opts.bippySourceBundleIife ?? loadBrowserBundle("bippy", "dist/source.iife.js"),
      opts.reactGrabBundleIife ?? loadBrowserBundle("react-grab", "dist/index.global.js"),
      REELINK_PER_COMMIT_RECORDER_IIFE,
    ].join("\n;\n"),
  });
}

const require = createRequire(import.meta.url);

function loadBrowserBundle(packageName: string, subpath: string): string {
  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const packageRoot = packageJsonPath.slice(0, -"/package.json".length);
  return readFileSync(`${packageRoot}/${subpath}`, "utf8");
}
```

Exact per-commit recorder IIFE:

```ts
export const REELINK_PER_COMMIT_RECORDER_IIFE = `(() => {
  const w = window;
  const Bippy = w.Bippy || globalThis.Bippy;
  const BippySource = w.BippySource || globalThis.BippySource || Bippy;
  const t0 = performance.now();
  let commitId = 0;
  let prodBuild = false;
  const fiberCommits = [];
  const reactGrabEvents = [];
  const sourceByFiberType = new Map();
  const sourceDictionary = {};

  const now = () => Math.round((performance.now() - t0) * 1000) / 1000;
  const safeJson = (value) => {
    if (value == null || typeof value !== "object") return value;
    const out = Array.isArray(value) ? [] : {};
    for (const [key, item] of Object.entries(value)) {
      if (/password|secret|token|cookie|authorization/i.test(key)) {
        out[key] = "[redacted]";
      } else if (item == null || ["string", "number", "boolean"].includes(typeof item)) {
        out[key] = item;
      } else if (typeof item === "function") {
        out[key] = "[function]";
      } else {
        out[key] = "[object]";
      }
    }
    return out;
  };
  const selectorFor = (element) => {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;
    if (element.id) return "#" + CSS.escape(element.id);
    const parts = [];
    let cur = element;
    while (cur && cur.nodeType === Node.ELEMENT_NODE && parts.length < 8) {
      const name = cur.localName;
      const parent = cur.parentElement;
      if (!parent) {
        parts.unshift(name);
        break;
      }
      const siblings = Array.from(parent.children).filter((child) => child.localName === name);
      const nth = siblings.length > 1 ? ":nth-of-type(" + (siblings.indexOf(cur) + 1) + ")" : "";
      parts.unshift(name + nth);
      cur = parent;
    }
    return parts.join(">");
  };
  const rectFor = (element) => {
    if (!element || typeof element.getBoundingClientRect !== "function") return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  };
  const fiberId = (fiber) => {
    const name = Bippy.getDisplayName(fiber.type) || Bippy.getDisplayName(fiber.elementType) || fiber.tag;
    return [name, fiber.key || "", fiber.index ?? ""].join(":");
  };
  const rememberSource = async (fiber) => {
    const type = fiber.type || fiber.elementType;
    if (!type || sourceByFiberType.has(type)) return sourceByFiberType.get(type) || null;
    const source = await BippySource.getSource(fiber).catch(() => null);
    const entry = source
      ? {
          file: source.fileName || null,
          line: source.lineNumber || null,
          column: source.columnNumber || null,
          component: source.functionName || Bippy.getDisplayName(type) || null,
        }
      : null;
    sourceByFiberType.set(type, entry);
    if (entry) sourceDictionary[fiberId(fiber)] = entry;
    return entry;
  };

  w.__REELINK_BUFFER__ = {
    flush() {
      const fiberBatch = fiberCommits.splice(0);
      const grabBatch = reactGrabEvents.splice(0);
      return {
        fiberCommits: fiberBatch,
        reactGrabEvents: grabBatch,
        sourceDictionary,
        prodBuild,
      };
    },
  };

  if (w.__REACT_GRAB__) {
    w.__REACT_GRAB__.activate();
    w.__REACT_GRAB__.onToolbarStateChange((toolbar_state) => {
      const state = w.__REACT_GRAB__.getState();
      const target = state.targetElement || state.labelInstances?.[0]?.element || null;
      Promise.resolve(target ? w.__REACT_GRAB__.getSource(target) : null).then((source) => {
        reactGrabEvents.push({
          t: now(),
          target: selectorFor(target),
          component_name: target ? w.__REACT_GRAB__.getDisplayName(target) : null,
          source: source
            ? { file: source.filePath, line: source.lineNumber, column: null, component: source.componentName }
            : null,
          toolbar_state,
        });
      });
    });
  }

  Bippy.instrument({
    name: "reelink-layer1",
    onActive() {
      const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      for (const renderer of hook.renderers.values()) {
        prodBuild = prodBuild || Bippy.detectReactBuildType(renderer) === "production";
      }
    },
    onCommitFiberRoot(rendererID, root, priority) {
      const commit_id = commitId++;
      Bippy.traverseRenderedFibers(root, (fiber, phase) => {
        const host = Bippy.getNearestHostFiber(fiber);
        const element = host && host.stateNode instanceof Element ? host.stateNode : null;
        void rememberSource(fiber);
        fiberCommits.push({
          t: now(),
          commit_id,
          renderer_id: rendererID,
          priority: typeof priority === "number" ? priority : null,
          phase,
          fiber_id: fiberId(fiber),
          parent_fiber_id: fiber.return ? fiberId(fiber.return) : null,
          display_name: Bippy.getDisplayName(fiber.type) || Bippy.getDisplayName(fiber.elementType) || null,
          tag: fiber.tag,
          key: fiber.key || null,
          element_path: selectorFor(element),
          bounds: rectFor(element),
          props: safeJson(fiber.memoizedProps),
        });
      });
    },
  });
})();`;
```

## 3. Probe extraction script

```ts
import { appendFileSync, writeFileSync } from "node:fs";
import type { Page } from "playwright";

export type ProbeExtractionOptions = {
  fiberCommitsPath: string;
  reactGrabEventsPath: string;
  sourceDictionaryPath: string;
  consolePath: string;
  pollMs?: number;
};

export function startProbeExtraction(page: Page, opts: ProbeExtractionOptions): {
  stop: () => Promise<void>;
  prodBuild: boolean;
} {
  let stopped = false;
  let prodBuild = false;
  const pollMs = opts.pollMs ?? 250;

  page.on("console", (message) => {
    appendJsonl(opts.consolePath, {
      t: Date.now(),
      type: message.type(),
      text: message.text(),
      location: message.location(),
    });
  });

  const flushOnce = async (): Promise<void> => {
    const batch = await page
      .evaluate(() => window.__REELINK_BUFFER__?.flush?.() ?? null)
      .catch(() => null);
    if (!batch) return;
    prodBuild = prodBuild || Boolean(batch.prodBuild);
    for (const record of batch.fiberCommits) appendJsonl(opts.fiberCommitsPath, record);
    for (const record of batch.reactGrabEvents) appendJsonl(opts.reactGrabEventsPath, record);
    writeFileSync(opts.sourceDictionaryPath, `${JSON.stringify(batch.sourceDictionary, null, 2)}\n`);
  };

  const loop = async (): Promise<void> => {
    while (!stopped) {
      await flushOnce();
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    await flushOnce();
  };

  const running = loop();
  return {
    get prodBuild() {
      return prodBuild;
    },
    async stop() {
      stopped = true;
      await running;
    },
  };
}

function appendJsonl(path: string, value: unknown): void {
  appendFileSync(path, `${JSON.stringify(value)}\n`);
}
```

This writes `fiber-commits.jsonl`, `react-grab-events.jsonl`, `source-dictionary.json`, and `console.jsonl`. Playwright writes `network.har`, `trace.zip`, and the context video stream; Phase 1 should normalize Playwright's generated video path to `video.webm` before final manifest serialization.

## 4. Manifest update - `src/schemas.ts` / `src/schemas/recording.ts`

```ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Manifest } from "../schemas.js";

type ManifestInput = {
  id: string;
  root: string;
  url: string;
  artifacts: {
    video: string;
    trace: string;
    network: string;
    console: string;
    fiberCommits: string;
    reactGrabEvents: string;
    sourceDictionary: string;
  };
  prodBuild: boolean;
  durationSec: number | null;
};

export function writeRecordingManifest(input: ManifestInput): Manifest {
  const manifest: Manifest = {
    recording_id: input.id,
    created_at: new Date().toISOString(),
    source_type: "browser_recording",
    source_path: input.url,
    duration_sec: input.durationSec,
    preprocessing: {
      requested_fps: 0,
      effective_fps: 0,
      max_frames: 0,
      long_edge_px: 0,
      frame_count: 0,
    },
    artifacts: {
      video: input.artifacts.video,
      trace: input.artifacts.trace,
      network: input.artifacts.network,
      console: input.artifacts.console,
      fiber_commits: input.artifacts.fiberCommits,
      react_grab_events: input.artifacts.reactGrabEvents,
      source_dictionary: input.artifacts.sourceDictionary,
    },
    streams: {
      video: { status: "available" },
      trace: { status: "available" },
      fiber_commits: { status: "available" },
      source_dictionary: input.prodBuild
        ? { status: "unavailable", reason: "React production build detected by bippy; source names may be minified" }
        : { status: "available" },
      react_grab_events: { status: "available" },
      network: { status: "available" },
      console: { status: "available" },
      frames: { status: "not_collected", reason: "Layer 1 capture stores video; frame extraction is optional" },
      eval: { status: "not_collected", reason: "No verification artifact generated" },
    },
    prod_build: input.prodBuild,
    safety: {
      redaction_applied: true,
    },
  };
  writeFileSync(join(input.root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
```

Schema addition shape if Faction B wants explicit stream keys instead of the current `z.record`:

```ts
export const StreamStatusSchema = z.object({
  status: z.enum(["available", "not_collected", "unavailable", "failed"]),
  reason: z.string().optional(),
});

export const Layer1StreamsSchema = z.object({
  video: StreamStatusSchema.optional(),
  trace: StreamStatusSchema,
  fiber_commits: StreamStatusSchema,
  source_dictionary: StreamStatusSchema,
  react_grab_events: StreamStatusSchema,
  network: StreamStatusSchema,
  console: StreamStatusSchema,
  frames: StreamStatusSchema,
  eval: StreamStatusSchema,
});
```

`prod_build` is set from bippy's `detectReactBuildType(renderer) === "production"` inside the window recorder.

## 5. Timestamp alignment

```ts
// Window side: established in the second addInitScript, before page app code runs.
const t0 = performance.now();
const t = () => Math.round((performance.now() - t0) * 1000) / 1000;

// Every window-side record carries `t`.
fiberCommits.push({ t: t(), commit_id, fiber_id, phase });
reactGrabEvents.push({ t: t(), target, component_name });

// Node side: use the window-side `t` as canonical recording-relative time.
// Console can only be captured from Playwright events, so keep Date.now() as metadata
// and prefer nearby trace/fiber timestamps when joining streams.
page.on("console", (message) => appendJsonl(consolePath, {
  wall_time: Date.now(),
  type: message.type(),
  text: message.text(),
  location: message.location(),
}));
```

All browser-emitted streams share the same `t0 = performance.now()` origin. Retrieval tools choose nearest records by absolute delta from requested `ts`.

## 6. MCP tool implementations

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

type DomResult = {
  recording_id: string;
  ts: number;
  status: "available" | "unavailable";
  path?: string;
  tree_summary?: Json;
  nearest_delta_ms?: number;
  missing_streams?: string[];
};

type ComponentResult = {
  recording_id: string;
  ts: number;
  prod_build: boolean;
  component: string | null;
  file: string | null;
  line: number | null;
  props: Json;
  candidates: Array<{
    component: string | null;
    file: string | null;
    line: number | null;
    props: Json;
    confidence: number;
    rationale: string;
  }>;
  canonical: Json;
};

export async function reelink_get_dom(recording_id: string, ts: number): Promise<DomResult> {
  const root = recordingRoot(recording_id);
  const tracePath = join(root, "trace.zip");
  const fiberPath = join(root, "fiber-commits.jsonl");
  const missing_streams = [];

  if (!existsSync(tracePath)) missing_streams.push("trace");
  if (!existsSync(fiberPath)) missing_streams.push("fiber_commits");
  if (!existsSync(fiberPath)) {
    return { recording_id, ts, status: "unavailable", missing_streams };
  }

  const commits = readJsonl<FiberCommitRecord>(fiberPath);
  const nearest = nearestByTs(commits, ts);
  if (!nearest) {
    return { recording_id, ts, status: "unavailable", missing_streams };
  }

  const summary = {
    source: existsSync(tracePath) ? "trace.zip + fiber-commits.jsonl" : "fiber-commits.jsonl",
    requested_ts: ts,
    nearest_ts: nearest.t,
    commit_id: nearest.commit_id,
    nodes: commits
      .filter((item) => item.commit_id === nearest.commit_id)
      .slice(0, 200)
      .map((item) => ({
        fiber_id: item.fiber_id,
        parent_fiber_id: item.parent_fiber_id,
        display_name: item.display_name,
        element_path: item.element_path,
        bounds: item.bounds,
        phase: item.phase,
      })),
    trace_path: existsSync(tracePath) ? tracePath : null,
  };

  const outDir = join(root, "derived");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `dom-${Math.round(ts * 1000)}.json`);
  writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);

  return {
    recording_id,
    ts,
    status: "available",
    path: outPath,
    tree_summary: summary as Json,
    nearest_delta_ms: Math.round(Math.abs(nearest.t - ts) * 1000),
    missing_streams,
  };
}

export async function reelink_get_components(
  recording_id: string,
  ts: number,
  x?: number,
  y?: number,
): Promise<ComponentResult> {
  const root = recordingRoot(recording_id);
  const manifest = readJson<{ prod_build?: boolean }>(join(root, "manifest.json"));
  const commits = readJsonl<FiberCommitRecord>(join(root, "fiber-commits.jsonl"));
  const sourceDictionary = readJson<Record<string, SourceDictionaryEntry>>(
    join(root, "source-dictionary.json"),
  );

  const nearby = commits
    .map((record) => ({
      record,
      score:
        Math.abs(record.t - ts) +
        (x == null || y == null || !record.bounds ? 0 : pointPenalty(record.bounds, x, y)),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  const candidates = nearby.map(({ record }, index) => {
    const source = sourceDictionary[record.fiber_id] ?? null;
    return {
      component: source?.component ?? record.display_name ?? null,
      file: source?.file ?? null,
      line: source?.line ?? null,
      props: redactProps(record.props) as Json,
      confidence: Math.max(0.1, 1 - index * 0.15),
      rationale: index === 0 ? "nearest timestamp and coordinate match" : "nearby timestamp candidate",
    };
  });

  const best = candidates[0] ?? {
    component: null,
    file: null,
    line: null,
    props: null,
    confidence: 0,
    rationale: "no React fiber candidate found",
  };

  const canonical = {
    recording_id,
    finding_id: `component-${recording_id}-${Math.round(ts * 1000)}`,
    ts,
    frame_idx: null,
    prod_build: Boolean(manifest.prod_build),
    element_path: nearby[0]?.record.element_path ?? null,
    bounding_box: nearby[0]?.record.bounds ?? null,
    selected_text: null,
    css_classes: null,
    computed_styles: null,
    accessibility: null,
    component_stack: candidates.map((candidate, index) => ({
      display_name: candidate.component,
      fiber_id: nearby[index]?.record.fiber_id ?? null,
      source: candidate.file
        ? { file: candidate.file, line: candidate.line, column: null }
        : null,
    })),
    fiber_diff: nearby[0]?.record.phase ?? null,
  };

  return {
    recording_id,
    ts,
    prod_build: Boolean(manifest.prod_build),
    component: best.component,
    file: best.file,
    line: best.line,
    props: best.props,
    candidates,
    canonical: canonical as Json,
  };
}

function recordingRoot(recording_id: string): string {
  return join(process.cwd(), ".reelink", recording_id);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function nearestByTs<T extends { t: number }>(records: T[], ts: number): T | null {
  return records.reduce<T | null>((best, item) => {
    if (!best) return item;
    return Math.abs(item.t - ts) < Math.abs(best.t - ts) ? item : best;
  }, null);
}

function pointPenalty(
  bounds: { x: number; y: number; width: number; height: number },
  x: number,
  y: number,
): number {
  const inside =
    x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
  return inside ? 0 : 10;
}

function redactProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props ?? {})) {
    out[key] = /password|secret|token|cookie|authorization/i.test(key) ? "[redacted]" : value;
  }
  return out;
}
```

## 7. Open questions for Faction B

- The bippy and react-grab repos define IIFE build targets, but this checkout does not currently contain built `dist/` bundles. Faction B needs to decide whether Phase 1 commits checked-in browser bundles or builds them during package preparation. The skeleton assumes a browser `bippy/source` bundle is also emitted as `dist/source.iife.js` so `getSource(fiber)` can run window-side.
- Playwright trace snapshot parsing is intentionally represented here as a derived summary path because the current Reelink repo has no trace parser yet. Faction B needs to pick the parser surface when wiring `trace.zip` into `reelink_get_dom`.
