import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.DATA_DIR
  ? path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR)
  : path.join(process.cwd(), "data");

/** Keys saved from the website's Settings page (DATA_DIR/settings.json). */
export interface SavedSettings {
  anthropicApiKey?: string;
  googleClientId?: string;
  googleClientSecret?: string;
}

export const SETTINGS_FILE = path.join(dataDir, "settings.json");
let cache: { mtime: number; data: SavedSettings } | null = null;

export function readSettings(): SavedSettings {
  try {
    const mtime = fs.statSync(SETTINGS_FILE).mtimeMs;
    if (cache?.mtime !== mtime) cache = { mtime, data: JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) };
    return cache.data;
  } catch {
    return {};
  }
}

// Settings come from environment variables (see .env.example). Keys entered
// on the Settings page take priority over the environment.
export const config = {
  dataDir,
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
  /** API key from the Settings page, else the environment. */
  get anthropicApiKey(): string {
    return readSettings().anthropicApiKey || process.env.ANTHROPIC_API_KEY || "";
  },
  get hasClaude(): boolean {
    return Boolean(this.anthropicApiKey || process.env.ANTHROPIC_AUTH_TOKEN);
  },
  x264Preset: process.env.X264_PRESET || "veryfast",
  // YouTube publishing (Google OAuth client from Google Cloud Console).
  get googleClientId(): string {
    return readSettings().googleClientId || process.env.GOOGLE_CLIENT_ID || "";
  },
  get googleClientSecret(): string {
    return readSettings().googleClientSecret || process.env.GOOGLE_CLIENT_SECRET || "";
  },
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI || `http://localhost:${process.env.PORT || 3000}/api/youtube/callback`,
  // Google endpoints; only overridden by tests that use a local mock server.
  googleAuthUrl: process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth",
  googleTokenUrl: process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token",
  googleRevokeUrl: process.env.GOOGLE_REVOKE_URL || "https://oauth2.googleapis.com/revoke",
  youtubeApi: process.env.YOUTUBE_API_BASE || "https://www.googleapis.com/youtube/v3",
  youtubeUploadApi: process.env.YOUTUBE_UPLOAD_BASE || "https://www.googleapis.com/upload/youtube/v3",
  captionFont: process.env.CAPTION_FONT || "Inter",
  fontsDir: process.env.FONTS_DIR || "",
};
