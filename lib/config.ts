import path from "node:path";

// All settings come from environment variables so the app can be deployed
// without code changes. See .env.example for descriptions.
export const config = {
  dataDir: process.env.DATA_DIR
    ? path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR)
    : path.join(process.cwd(), "data"),
  ytdlp: process.env.YTDLP_PATH || "yt-dlp",
  ffmpeg: process.env.FFMPEG_PATH || "ffmpeg",
  ffprobe: process.env.FFPROBE_PATH || "ffprobe",
  ytdlpCookies: process.env.YTDLP_COOKIES || "",
  ytdlpExtraArgs: (process.env.YTDLP_EXTRA_ARGS || "").split(" ").filter(Boolean),
  /** Download only the clip sections (fast) instead of the whole video. */
  sectionDownloads: process.env.FULL_DOWNLOAD !== "1",
  maxVideoSeconds: Number(process.env.MAX_VIDEO_SECONDS || 4 * 60 * 60),
  maxConcurrentJobs: Math.max(1, Number(process.env.MAX_CONCURRENT_JOBS || 1)),
  claudeModel: process.env.CLAUDE_MODEL || "claude-opus-5-5",
  claudeEffort: (process.env.CLAUDE_EFFORT || "medium") as "low" | "medium" | "high" | "xhigh" | "max",
  hasClaude: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
  x264Preset: process.env.X264_PRESET || "veryfast",
  captionFont: process.env.CAPTION_FONT || "Inter",
  fontsDir: process.env.FONTS_DIR || "",
};
