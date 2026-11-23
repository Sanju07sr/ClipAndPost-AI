import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { accessToken, GoogleAuthError, loadAccount } from "./google";
import { writePublishMetaWithClaude } from "./ai";
import { getJob, jobDir, updateJob } from "./store";
import { parseJson3, wordsInRange } from "./transcript";
import type { Clip, ClipUpload, PlatformId, Privacy, PublishMeta } from "./types";
import { uploadFacebookReel, uploadInstagramReel, type PostResult } from "./platforms/meta";
import { uploadTikTok } from "./platforms/tiktok";

// ------------------------------------------------------------ Google API errors

interface GoogleErrorBody {
  error?: { message?: string; errors?: { reason?: string }[] };
}

function friendlyApiError(status: number, body: GoogleErrorBody): string {
  const reason = body.error?.errors?.[0]?.reason || "";
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded")
    return "YouTube's daily API quota for your Google Cloud project is used up (about 6 uploads a day by default). It resets at midnight Pacific time.";
  if (reason === "uploadLimitExceeded") return "Your channel has hit YouTube's upload limit for today. Try again tomorrow.";
  if (reason === "youtubeSignupRequired") return "This Google account has no YouTube channel yet. Create one on youtube.com first.";
  if (reason === "forbidden" || status === 403)
    return `YouTube refused the request: ${body.error?.message || "forbidden"}. Check that the YouTube Data API v3 is enabled in your Google Cloud project.`;
  if (status === 401) return "Your YouTube connection expired. Please connect again.";
  return body.error?.message || `YouTube returned an error (${status})`;
}

async function ytGet<T>(pathAndQuery: string): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${config.youtubeApi}${pathAndQuery}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = (await res.json().catch(() => ({}))) as T & GoogleErrorBody;
  if (!res.ok) throw new Error(friendlyApiError(res.status, data));
  return data;
}

// ------------------------------------------------------------ trending hashtags

const GENERIC = new Set(["shorts", "short", "youtubeshorts", "viral", "fyp", "foryou", "foryoupage", "trending", "reels", "subscribe", "ytshorts", "clips", "clip"]);

/**
 * Hashtags used by the most-viewed Shorts on this topic from the last two
 * weeks, weighted by their views. Costs ~101 units of YouTube API quota.
 */
export async function trendingHashtags(query: string): Promise<string[]> {
  const after = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const search = await ytGet<{ items?: { id?: { videoId?: string } }[] }>(
    `/search?${new URLSearchParams({
      part: "snippet",
      type: "video",
      videoDuration: "short",
      order: "viewCount",
      publishedAfter: after,
      maxResults: "25",
      q: query,
    })}`,
  );
  const ids = (search.items || []).map((i) => i.id?.videoId).filter(Boolean) as string[];
  if (!ids.length) return [];
  const videos = await ytGet<{
    items?: { snippet?: { title?: string; description?: string; tags?: string[] }; statistics?: { viewCount?: string } }[];
  }>(`/videos?part=snippet,statistics&id=${ids.join(",")}`);

  const score = new Map<string, { label: string; score: number; videos: number }>();
  for (const v of videos.items || []) {
    const weight = Math.log10(Number(v.statistics?.viewCount || 0) + 10);
    const text = `${v.snippet?.title || ""} ${v.snippet?.description || ""}`;
    const seen = new Set<string>();
    for (const m of text.matchAll(/#([\p{L}\p{N}_]{2,40})/gu)) {
      const key = m[1].toLowerCase();
      if (GENERIC.has(key) || seen.has(key)) continue;
      seen.add(key);
      const cur = score.get(key) || { label: m[1], score: 0, videos: 0 };
      cur.score += weight;
      cur.videos += 1;
      score.set(key, cur);
    }
  }
  return [...score.values()]
    .filter((s) => s.videos >= 2 || score.size < 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map((s) => s.label);
}

// ------------------------------------------------------------ metadata

function clipTranscript(jobId: string, clip: Clip): string {
  try {
    const dir = jobDir(jobId);
    const file = fs.readdirSync(dir).find((f) => f.startsWith("subs.") && f.endsWith(".json3"));
    if (!file) return "";
    return wordsInRange(parseJson3(path.join(dir, file)), clip.start, clip.end)
      .map((w) => w.text)
      .join(" ")
      .slice(0, 4000);
  } catch {
    return "";
  }
}

function cleanTag(t: string) {
  return t.replace(/^#/, "").replace(/[^\p{L}\p{N}_]/gu, "");
}

/** Title, description and hashtags tuned for YouTube Shorts, using live trending data when possible. */
export async function buildPublishMeta(jobId: string, clipId: string): Promise<PublishMeta> {
  const job = getJob(jobId);
  const clip = job?.clips.find((c) => c.id === clipId);
  if (!job || !clip) throw new Error("Clip not found");

  let trending: string[] = [];
  let trendingSource: PublishMeta["trendingSource"] = "none";
  if (loadAccount()) {
    const topic = clip.hashtags.filter((h) => !GENERIC.has(h.toLowerCase())).slice(0, 2).join(" ") || clip.title;
    try {
      trending = await trendingHashtags(topic);
      trendingSource = "youtube";
    } catch (err) {
      console.warn("Trending hashtag lookup failed:", (err as Error).message);
    }
  }

  let meta: PublishMeta | null = null;
  if (config.hasClaude) {
    try {
      const out = await writePublishMetaWithClaude({
        videoTitle: job.video?.title || "",
        channel: job.video?.channel || "",
        clip,
        transcript: clipTranscript(jobId, clip),
        trending,
      });
      meta = { ...out, trending, trendingSource, writer: "claude" };
    } catch (err) {
      console.warn("Claude metadata failed, using basic metadata:", (err as Error).message);
    }
  }
  if (!meta) {
    const own = clip.hashtags.filter((h) => !GENERIC.has(h.toLowerCase()));
    meta = {
      title: clip.title,
      description: clip.description,
      hashtags: [...own.slice(0, 3), ...trending.slice(0, 3)],
      trending,
      trendingSource,
      writer: "basic",
    };
  }
  // Tidy up: unique, valid hashtags; #Shorts always included; max 8.
  const seen = new Set<string>();
  const tags = ["Shorts", ...meta.hashtags]
    .map(cleanTag)
    .filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
  meta.hashtags = [...tags.slice(1, 8), tags[0]];
  meta.title = meta.title.replace(/\s+/g, " ").trim().slice(0, 100);
  meta.description = meta.description.trim().slice(0, 4500);

  updateJob(jobId, (j) => {
    const c = j.clips.find((x) => x.id === clipId);
    if (c) c.meta = meta!;
  });
  return meta;
}

// ------------------------------------------------------------ upload queue

export interface PublishItem {
  clipId: string;
  title: string;
  description: string;
  hashtags: string[];
  privacy: Privacy;
  platforms: PlatformId[];
}

// One upload at a time per platform; different platforms upload in parallel.
const g = globalThis as unknown as { __uploadChains?: Partial<Record<PlatformId, Promise<void>>> };
const chains = (g.__uploadChains ??= {});

export function queueUploads(jobId: string, items: PublishItem[]) {
  for (const item of items) {
    for (const platform of item.platforms) {
      updateJob(jobId, (j) => {
        const c = j.clips.find((x) => x.id === item.clipId);
        if (!c) return;
        c.uploads = { ...c.uploads, [platform]: { status: "queued", progress: 0, privacy: item.privacy, title: item.title } };
      });
      chains[platform] = (chains[platform] || Promise.resolve()).then(() =>
        uploadTo(platform, jobId, item).catch((err) => {
          setUpload(jobId, item.clipId, platform, { status: "error", error: (err as Error).message });
        }),
      );
    }
  }
}

function setUpload(jobId: string, clipId: string, platform: PlatformId, patch: Partial<ClipUpload>) {
  updateJob(jobId, (j) => {
    const u = j.clips.find((x) => x.id === clipId)?.uploads?.[platform];
    if (u) Object.assign(u, patch);
  });
}

/** One caption for Instagram, Facebook and TikTok: title, description, hashtags. */
export function socialCaption(item: Pick<PublishItem, "title" | "description" | "hashtags">) {
  const tags = item.hashtags.map(cleanTag).filter(Boolean).slice(0, 25).map((h) => `#${h}`).join(" ");
  return [item.title.trim(), item.description.trim(), tags].filter(Boolean).join("\n\n").slice(0, 2200);
}

async function uploadTo(platform: PlatformId, jobId: string, item: PublishItem) {
  if (platform === "youtube") return uploadClip(jobId, item);
  const clip = getJob(jobId)?.clips.find((c) => c.id === item.clipId);
  if (!clip?.file) throw new Error("This clip's video file is missing");
  const file = path.join(jobDir(jobId), path.basename(clip.file));
  setUpload(jobId, item.clipId, platform, { status: "uploading", progress: 0 });
  const progress = (p: number) => setUpload(jobId, item.clipId, platform, { progress: Math.round(p) });
  const caption = socialCaption(item);
  let result: PostResult;
  let actualPrivacy = "public";
  if (platform === "instagram") result = await uploadInstagramReel(file, caption, progress);
  else if (platform === "facebook") result = await uploadFacebookReel(file, caption, progress);
  else {
    result = await uploadTikTok(file, caption, item.privacy === "public", progress);
    if (result.note) actualPrivacy = "private";
  }
  setUpload(jobId, item.clipId, platform, {
    status: "published",
    progress: 100,
    videoId: result.id,
    url: result.url,
    actualPrivacy: platform === "tiktok" ? actualPrivacy : "public",
    note: result.note,
    publishedAt: new Date().toISOString(),
  });
}

const CHUNK = 8 * 1024 * 1024; // multiple of 256 KiB, as YouTube requires

async function uploadClip(jobId: string, item: PublishItem) {
  const job = getJob(jobId);
  const clip = job?.clips.find((c) => c.id === item.clipId);
  if (!job || !clip?.file) throw new Error("This clip's video file is missing");
  const file = path.join(jobDir(jobId), path.basename(clip.file));
  const size = fs.statSync(file).size;
  setUpload(jobId, item.clipId, "youtube", { status: "uploading", progress: 0 });

  const hashtags = item.hashtags.map(cleanTag).filter(Boolean);
  const hashtagLine = hashtags.map((h) => `#${h}`).join(" ");
  const metadata = {
    snippet: {
      title: item.title.replace(/[<>]/g, "").slice(0, 100) || clip.title.slice(0, 100),
      description: `${item.description.replace(/[<>]/g, "").trim()}\n\n${hashtagLine}`.slice(0, 5000),
      tags: hashtags.slice(0, 15),
      categoryId: "22", // People & Blogs; YouTube lets creators change it later
    },
    status: {
      privacyStatus: item.privacy,
      selfDeclaredMadeForKids: false,
    },
  };

  // 1. Start a resumable upload session.
  let token = await accessToken();
  const start = await fetch(`${config.youtubeUploadApi}/videos?uploadType=resumable&part=snippet,status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(size),
    },
    body: JSON.stringify(metadata),
  });
  if (!start.ok) throw new Error(friendlyApiError(start.status, (await start.json().catch(() => ({}))) as GoogleErrorBody));
  const session = start.headers.get("location");
  if (!session) throw new Error("YouTube didn't start the upload session");

  // 2. Send the file in chunks so we can report progress.
  const fd = fs.openSync(file, "r");
  type Inserted = { id?: string; status?: { privacyStatus?: string; uploadStatus?: string } };
  let result = null as Inserted | null;
  try {
    let offset = 0;
    let retries = 0;
    while (offset < size) {
      const len = Math.min(CHUNK, size - offset);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, offset);
      token = await accessToken();
      let res: Response;
      try {
        res = await fetch(session, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Length": String(len),
            "Content-Range": `bytes ${offset}-${offset + len - 1}/${size}`,
          },
          body: buf,
        });
      } catch (err) {
        if (++retries > 5) throw err;
        await new Promise((r) => setTimeout(r, 2000 * retries));
        continue;
      }
      if (res.status === 308) {
        // Incomplete: YouTube tells us how much it has.
        const range = res.headers.get("range");
        offset = range ? Number(range.split("-")[1]) + 1 : offset + len;
        retries = 0;
        setUpload(jobId, item.clipId, "youtube", { progress: Math.round((offset / size) * 100) });
        continue;
      }
      if (res.status >= 500 && ++retries <= 5) {
        await new Promise((r) => setTimeout(r, 2000 * retries));
        continue;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(friendlyApiError(res.status, body as GoogleErrorBody));
      result = body as Inserted;
      break;
    }
  } finally {
    fs.closeSync(fd);
  }
  if (!result?.id) throw new Error("YouTube finished the upload but didn't return a video id");

  setUpload(jobId, item.clipId, "youtube", {
    status: "published",
    progress: 100,
    videoId: result.id,
    url: `https://www.youtube.com/shorts/${result.id}`,
    actualPrivacy: result.status?.privacyStatus || item.privacy,
    publishedAt: new Date().toISOString(),
  });
}

export function isAuthError(err: unknown) {
  return err instanceof GoogleAuthError;
}
