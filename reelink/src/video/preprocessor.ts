import ffmpegPathRaw from "ffmpeg-static";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const ffmpegPath = ffmpegPathRaw as unknown as string | null;

type PreprocessPolicy = {
  requestedFps: number;
  effectiveFps: number;
  maxFrames: number;
  longEdgePx: number;
};

export function preprocessVideo(
  sourcePath: string,
  framesDir: string,
  requestedFps: number,
): { durationSec: number | null; framePaths: string[]; policy: PreprocessPolicy } {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static did not resolve a binary path");
  }

  const policy = {
    requestedFps,
    effectiveFps: Math.max(0.1, Math.min(requestedFps, 1)),
    maxFrames: 64,
    longEdgePx: 896,
  };

  const durationSec = probeDuration(sourcePath);
  const result = spawnSync(
    ffmpegPath,
    [
      "-y",
      "-i",
      sourcePath,
      "-vf",
      `fps=${policy.effectiveFps},scale=${policy.longEdgePx}:${policy.longEdgePx}:force_original_aspect_ratio=decrease`,
      "-frames:v",
      String(policy.maxFrames),
      join(framesDir, "frame-%04d.jpg"),
    ],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(`ffmpeg frame extraction failed: ${(result.stderr ?? "").slice(0, 1000)}`);
  }

  const framePaths = readdirSync(framesDir)
    .filter((file) => /^frame-\d+\.jpg$/i.test(file))
    .sort()
    .map((file) => join(framesDir, file));

  return { durationSec, framePaths, policy };
}

function probeDuration(sourcePath: string): number | null {
  if (!ffmpegPath) return null;
  const result = spawnSync(ffmpegPath, ["-i", sourcePath], { encoding: "utf8" });
  const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text);
  if (!match) return null;
  return Math.round((Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000) / 1000;
}
