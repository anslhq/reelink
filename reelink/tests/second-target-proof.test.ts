import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

import { initializeFrameworkTarget, inspectFrameworkTarget } from "../src/config/diagnostics/index.js";

let workspace: string;

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), "reck-second-target-proof-"));
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

describe("Wave 5 second-target proof", () => {
  test("verifies lightweight Vite React fixture detection, init idempotency, build/start smoke, and missing-source honesty", async () => {
    const appRoot = join(workspace, "vite-react-second-target");
    cpSync(resolve("tests/fixtures/vite-react-second-target"), appRoot, { recursive: true });

    expect(inspectFrameworkTarget(appRoot)).toMatchObject({
      framework: "vite-react",
      initialized: false,
      missingSource: false,
      missingSourceReason: null,
      buildCommand: "bun run scripts/build.ts",
      startCommand: "bun run scripts/start.ts",
      reactGrabInitialized: false,
    });

    const firstInit = initializeFrameworkTarget(appRoot);
    const secondInit = initializeFrameworkTarget(appRoot);
    expect(firstInit).toEqual(secondInit);
    expect(secondInit).toMatchObject({ framework: "vite-react", initialized: true, missingSource: false });

    await runFixtureCommand(["run", "build"], appRoot);
    expect(existsSync(join(appRoot, "dist", "index.html"))).toBe(true);
    await smokeStart(appRoot, 48157);

    renameSync(join(appRoot, "src"), join(appRoot, "src.missing"));
    expect(inspectFrameworkTarget(appRoot)).toMatchObject({
      framework: "vite-react",
      initialized: true,
      missingSource: true,
      missingSourceReason: "No src directory was found; React source capture cannot be verified for this target",
    });
  });

  test("initializes Next App Router React Grab source setup idempotently", async () => {
    const appRoot = join(workspace, "next-react-target");
    mkdirSync(join(appRoot, "src", "app"), { recursive: true });
    writeFileSync(
      join(appRoot, "package.json"),
      `${JSON.stringify({
        scripts: { build: "next build", start: "next start" },
        dependencies: { next: "16.0.0", react: "19.0.0", "react-dom": "19.0.0" },
        devDependencies: { "react-grab": "0.1.32" },
      }, null, 2)}\n`,
    );
    writeFileSync(join(appRoot, "next.config.mjs"), "export default {};\n");
    writeFileSync(
      join(appRoot, "src", "app", "layout.tsx"),
      `import type { ReactNode } from "react";\n\nexport default function RootLayout({ children }: { children: ReactNode }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  );\n}\n`,
    );

    expect(inspectFrameworkTarget(appRoot)).toMatchObject({
      framework: "next-react",
      reactGrabInstalled: true,
      reactGrabInitialized: false,
    });

    const firstInit = initializeFrameworkTarget(appRoot);
    const firstLayout = readFileSync(join(appRoot, "src", "app", "layout.tsx"), "utf8");
    const secondInit = initializeFrameworkTarget(appRoot);
    const secondLayout = readFileSync(join(appRoot, "src", "app", "layout.tsx"), "utf8");

    expect(firstInit).toMatchObject({
      framework: "next-react",
      initialized: true,
      reactGrabInstalled: true,
      reactGrabInitialized: true,
      reactGrabInitChanged: true,
      reactGrabInitFile: join(appRoot, "src", "app", "layout.tsx"),
      sourceAnnotationsInitialized: true,
      sourceAnnotationsChanged: true,
      sourceAnnotationsFile: join(appRoot, "src", "app", "layout.tsx"),
    });
    expect(firstLayout).toContain('import Script from "next/script";');
    expect(firstLayout).toContain('src="//unpkg.com/react-grab/dist/index.global.js"');
    expect(firstLayout).toContain('strategy="beforeInteractive"');
    expect(firstLayout).toContain("function ReckSourceRoot");
    expect(firstLayout).toContain(`data-reck-source-file=${JSON.stringify(join(appRoot, "src", "app", "layout.tsx"))}`);
    expect(firstLayout).toContain("data-reck-source-truth=\"source-file\"");
    expect(firstLayout).toContain("<ReckSourceRoot>{children}</ReckSourceRoot>");
    expect(secondInit).toMatchObject({ reactGrabInitialized: true, reactGrabInitChanged: false, sourceAnnotationsInitialized: true, sourceAnnotationsChanged: false });
    expect(secondLayout).toBe(firstLayout);
    expect(JSON.parse(readFileSync(join(appRoot, ".reck", "target.json"), "utf8"))).toMatchObject({
      framework: "next-react",
      react_grab_installed: true,
      react_grab_initialized: true,
      react_grab_init_file: join(appRoot, "src", "app", "layout.tsx"),
      source_annotations_initialized: true,
      source_annotations_file: join(appRoot, "src", "app", "layout.tsx"),
    });
  });
});

async function runFixtureCommand(args: string[], cwd: string, env: Record<string, string> = {}): Promise<string> {
  const child = spawn("bun", args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => (output += String(chunk)));
  child.stderr.on("data", (chunk) => (output += String(chunk)));

  const exitCode = await new Promise<number | null>((resolveExit) => child.on("exit", resolveExit));
  if (exitCode !== 0) throw new Error(`Command failed: bun ${args.join(" ")}\n${output}`);
  return output;
}

async function smokeStart(cwd: string, port: number): Promise<void> {
  const child = spawn("bun", ["run", "start"], { cwd, env: { ...process.env, PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => (output += String(chunk)));
  child.stderr.on("data", (chunk) => (output += String(chunk)));

  try {
    await waitFor(() => output.includes(`fixture target listening on ${port}`));
    const response = await fetch(`http://127.0.0.1:${port}`);
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("built second target");
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolveExit) => child.once("exit", resolveExit));
  }
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > 3000) throw new Error("Timed out waiting for fixture server to start");
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
}
