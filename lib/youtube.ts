import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { run } from "./exec";
import type { VideoInfo } from "./types";

export { normalizeYouTubeUrl, youTubeId } from "./url";

/** Flags shared by every yt-dlp call. */
function common(): string[] {
  const args = ["--no-playlist", "--newline"];
  if (config.ytdlpCookies) args.push("--cookies", config.ytdlpCookies);
  return [...args, ...config.ytdlpExtraArgs];
}

interface SubTrack {
  ext: string;
}
type SubMap = Record<string, SubTrack[]>;

export interface RawMeta {
  id: string;
  title: string;
  channel?: string;
  uploader?: string;
  duration?: number;
  thumbnail?: string;
  webpage_url?: string;
  language?: string | null;
  subtitles?: SubMap;
  automatic_captions?: SubMap;
  is_live?: boolean;
}

export async function fetchMetadata(url: string): Promise<{ info: VideoInfo; raw: RawMeta }> {
  const { stdout } = await run(config.ytdlp, [...common(), "-J", "--skip-download", url], {
    timeoutMs: 120_000,
  });
  const raw = JSON.parse(stdout) as RawMeta;
  if (raw.is_live) throw new Error("Live streams can't be clipped until they've finished.");
  return {
    raw,
    info: {
      id: raw.id,
      title: raw.title,
      channel: raw.channel || raw.uploader || "Unknown channel",
      duration: raw.duration || 0,
      thumbnail: raw.thumbnail,
      webpageUrl: raw.webpage_url || url,
      language: raw.language || undefined,
    },
  };
}

/** Choose the best caption track: manual subs first, then YouTube's auto captions. */
export function pickSubtitleTrack(raw: RawMeta): { lang: string; auto: boolean } | null {
  const manual = raw.subtitles || {};
  const auto = raw.automatic_captions || {};
  const lang = (raw.language || "en").split("-")[0];
  const has = (m: SubMap, k: string) => Array.isArray(m[k]) && m[k].some((t) => t.ext === "json3");
  const manualKeys = Object.keys(manual).filter((k) => k !== "live_chat" && has(manual, k));
  const pick =
    manualKeys.find((k) => k === lang || k.startsWith(`${lang}-`)) ||
    manualKeys.find((k) => k === "en" || k.startsWith("en-"));
  if (pick) return { lang: pick, auto: false };
  for (const k of [`${lang}-orig`, lang, "en-orig", "en"]) if (has(auto, k)) return { lang: k, auto: true };
  if (manualKeys[0]) return { lang: manualKeys[0], auto: false };
  return null;
}

/** Downloads the caption track as json3 and returns its path. */
export async function downloadSubtitles(
  url: string,
  dir: string,
  track: { lang: string; auto: boolean },
): Promise<string | null> {
  await run(
    config.ytdlp,
    [
      ...common(),
      "--skip-download",
      track.auto ? "--write-auto-subs" : "--write-subs",
      "--sub-langs",
      track.lang,
      "--sub-format",
      "json3",
      "-o",
      path.join(dir, "subs.%(ext)s"),
      url,
    ],
    { timeoutMs: 120_000 },
  );
  const file = fs.readdirSync(dir).find((f) => f.startsWith("subs.") && f.endsWith(".json3"));
  return file ? path.join(dir, file) : null;
}

const VIDEO_FORMAT =
  "bv*[height<=1080][vcodec^=avc1]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]/bv*+ba/b";

function progressParser(onProgress?: (pct: number) => void) {
  return (line: string) => {
    const m = line.match(/\[download\]\s+([\d.]+)%/);
    if (m && onProgress) onProgress(Math.min(100, Number(m[1])));
  };
}

/** Download just [start, end] of the video, cut precisely. */
export async function downloadSection(
  url: string,
  outBase: string,
  start: number,
  end: number,
  onProgress?: (pct: number) => void,
): Promise<string> {
  await run(
    config.ytdlp,
    [
      ...common(),
      "-f",
      VIDEO_FORMAT,
      "--download-sections",
      `*${start.toFixed(2)}-${end.toFixed(2)}`,
      "--force-keyframes-at-cuts",
      "--merge-output-format",
      "mp4",
      "-o",
      `${outBase}.%(ext)s`,
      url,
    ],
    { onLine: progressParser(onProgress), timeoutMs: 30 * 60_000 },
  );
  return findOutput(outBase);
}

/** Download the whole video (used when section downloads fail or are disabled). */
export async function downloadFull(url: string, outBase: string, onProgress?: (pct: number) => void) {
  await run(
    config.ytdlp,
    [...common(), "-f", VIDEO_FORMAT, "--merge-output-format", "mp4", "-o", `${outBase}.%(ext)s`, url],
    { onLine: progressParser(onProgress), timeoutMs: 3 * 60 * 60_000 },
  );
  return findOutput(outBase);
}

/** Audio only, for loudness analysis when a video has no captions. */
export async function downloadAudio(url: string, outBase: string, onProgress?: (pct: number) => void) {
  await run(config.ytdlp, [...common(), "-f", "ba/b", "-o", `${outBase}.%(ext)s`, url], {
    onLine: progressParser(onProgress),
    timeoutMs: 60 * 60_000,
  });
  return findOutput(outBase);
}

function findOutput(outBase: string): string {
  const dir = path.dirname(outBase);
  const base = path.basename(outBase);
  const file = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`${base}.`) && !f.endsWith(".part") && !f.endsWith(".ytdl"))
    .sort((a, b) => (a.endsWith(".mp4") ? -1 : b.endsWith(".mp4") ? 1 : 0))[0];
  if (!file) throw new Error("Download finished but no file was produced");
  return path.join(dir, file);
}
