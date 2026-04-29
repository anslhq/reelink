import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

import type { Manifest } from "../schemas.js";

type ImportedVideoRecording = {
  id: string;
  root: string;
  framesDir: string;
  manifestPath: string;
  analysisPath: string;
  sourceVideoPath: string;
};

export function createImportedVideoRecording(
  sourcePath: string,
  options: { copyVideo?: boolean } = {},
): ImportedVideoRecording {
  const absoluteSource = resolve(sourcePath);
  if (!existsSync(absoluteSource)) {
    throw new Error(`Recording path does not exist: ${absoluteSource}`);
  }

  const id = recordingIdFor(absoluteSource);
  const root = join(process.cwd(), ".reelink", id);
  const framesDir = join(root, "frames");
  mkdirSync(framesDir, { recursive: true });

  const sourceVideoPath = options.copyVideo
    ? join(root, `source${extname(absoluteSource).toLowerCase() || ".video"}`)
    : absoluteSource;

  if (options.copyVideo) {
    copyFileSync(absoluteSource, sourceVideoPath);
  }

  return {
    id,
    root,
    framesDir,
    manifestPath: join(root, "manifest.json"),
    analysisPath: join(root, "analysis.json"),
    sourceVideoPath,
  };
}

export function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeManifest(path: string, manifest: Manifest): void {
  writeJson(path, manifest);
}

function recordingIdFor(sourcePath: string): string {
  const h = createHash("sha1");
  h.update(sourcePath);
  h.update(String(Date.now()));
  const stem = basename(sourcePath).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `${stem || "recording"}-${h.digest("hex").slice(0, 10)}`;
}
