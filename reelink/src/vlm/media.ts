/** MIME type for raw video file parts sent to vision-language models. */
export function mediaTypeForVideo(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".mp4")) return "video/mp4";
  throw new Error(`Unsupported video extension for raw-video analysis: ${path}`);
}
