// Section 0.1.4 smoke test: verify ffmpeg-static binary is downloaded and executable.
// Pre-hackathon validation only — not part of the runtime path.

// ffmpeg-static under NodeNext exports the path as the default; the upstream type alias confuses TSC,
// so we re-narrow at the boundary.
import ffmpegPathRaw from "ffmpeg-static";
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";

const ffmpegPath = ffmpegPathRaw as unknown as string | null;

if (!ffmpegPath) {
  console.error("FAIL: ffmpeg-static did not resolve a binary path");
  process.exit(1);
}

const stat = statSync(ffmpegPath);
console.log(`ffmpeg-static binary: ${ffmpegPath}`);
console.log(`size: ${(stat.size / 1024 / 1024).toFixed(1)} MB`);

const result = spawnSync(ffmpegPath, ["-version"], { encoding: "utf8" });
if (result.status !== 0) {
  console.error("FAIL: ffmpeg -version exited", result.status);
  console.error(result.stderr);
  process.exit(1);
}

const firstLine = (result.stdout ?? "").split("\n")[0];
console.log(`ok: ${firstLine}`);
console.log("ffmpeg-static smoke test: PASS");
