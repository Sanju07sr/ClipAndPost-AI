import fs from "node:fs";
import { config } from "../config";
import { loadConnection, removeConnection, saveConnection, sleep } from "./store";
import type { PostResult } from "./meta";

// TikTok through Login Kit + the Content Posting API (Direct Post, file upload).
// Apps that haven't passed TikTok's audit can only post privately (SELF_ONLY).

interface TikTokConnection {
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
  openId: string;
  displayName: string;
  username?: string;
  avatar?: string;
  connectedAt: string;
}

export const tiktokConfigured = () => Boolean(config.tiktokClientKey && config.tiktokClientSecret);
export const tiktokRedirectUri = () => `${config.appUrl}/api/connect/tiktok/callback`;

export class TikTokError extends Error {}

export function tiktokAuthUrl(state: string) {
  const u = new URL(config.tiktokAuthUrl);
  u.search = new URLSearchParams({
    client_key: config.tiktokClientKey,
    scope: "user.info.basic,video.publish",
    response_type: "code",
    redirect_uri: tiktokRedirectUri(),
    state,
  }).toString();
  return u.toString();
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  open_id?: string;
  error?: string;
  error_description?: string;
}

async function token(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${config.tiktokApi}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: config.tiktokClientKey, client_secret: config.tiktokClientSecret, ...params }),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token) throw new TikTokError(data.error_description || data.error || `TikTok login failed (${res.status})`);
  return data;
}

async function api<T>(path: string, accessToken: string, body?: unknown, method = "POST"): Promise<T> {
  const res = await fetch(`${config.tiktokApi}${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { data?: T; error?: { code?: string; message?: string } };
  const code = data.error?.code;
  if (!res.ok || (code && code !== "ok")) {
    if (code === "spam_risk_too_many_posts") throw new TikTokError("TikTok's daily posting limit was reached. Try again tomorrow.");
    if (code === "unaudited_client_can_only_post_to_private_accounts")
      throw new TikTokError("Your TikTok app isn't audited yet, so TikTok only allows posting while your account is set to private.");
    if (code === "access_token_invalid") throw new TikTokError("Your TikTok login expired. Please connect again.");
    throw new TikTokError(data.error?.message || `TikTok API error (${res.status})`);
  }
  return data.data as T;
}

export async function tiktokConnect(code: string) {
  const t = await token({ code, grant_type: "authorization_code", redirect_uri: tiktokRedirectUri() });
  const info = await api<{ user?: { open_id?: string; display_name?: string; username?: string; avatar_url?: string } }>(
    "/v2/user/info/?fields=open_id,display_name,avatar_url,username",
    t.access_token!,
    undefined,
    "GET",
  ).catch(() => ({ user: undefined }));
  saveConnection("tiktok", {
    accessToken: t.access_token!,
    expiresAt: Date.now() + (t.expires_in || 86400) * 1000,
    refreshToken: t.refresh_token || "",
    refreshExpiresAt: Date.now() + (t.refresh_expires_in || 365 * 86400) * 1000,
    openId: t.open_id || info.user?.open_id || "",
    displayName: info.user?.display_name || "TikTok account",
    username: info.user?.username,
    avatar: info.user?.avatar_url,
    connectedAt: new Date().toISOString(),
  } satisfies TikTokConnection);
}

/** A valid access token (refreshed when needed). */
async function accessToken(): Promise<{ token: string; conn: TikTokConnection }> {
  const conn = loadConnection<TikTokConnection>("tiktok");
  if (!conn) throw new TikTokError("Connect TikTok first.");
  if (conn.expiresAt - 60_000 > Date.now()) return { token: conn.accessToken, conn };
  if (!conn.refreshToken || conn.refreshExpiresAt < Date.now()) throw new TikTokError("Your TikTok login expired. Please connect again.");
  const t = await token({ grant_type: "refresh_token", refresh_token: conn.refreshToken });
  conn.accessToken = t.access_token!;
  conn.expiresAt = Date.now() + (t.expires_in || 86400) * 1000;
  if (t.refresh_token) conn.refreshToken = t.refresh_token;
  saveConnection("tiktok", conn);
  return { token: conn.accessToken, conn };
}

export function tiktokStatus() {
  const conn = loadConnection<TikTokConnection>("tiktok");
  return {
    configured: tiktokConfigured(),
    connected: Boolean(conn),
    redirectUri: tiktokRedirectUri(),
    account: conn ? { name: conn.displayName, username: conn.username, picture: conn.avatar } : null,
  };
}

export function tiktokDisconnect() {
  removeConnection("tiktok");
}

const MB = 1024 * 1024;

/** Chunking rules: one chunk under 64 MB, otherwise 10 MB chunks with the remainder in the last one. */
function chunking(size: number) {
  if (size <= 64 * MB) return { chunkSize: size, count: 1 };
  const chunkSize = 10 * MB;
  return { chunkSize, count: Math.floor(size / chunkSize) };
}

export async function uploadTikTok(
  file: string,
  caption: string,
  wantPublic: boolean,
  onProgress: (p: number) => void,
): Promise<PostResult> {
  const { token: at, conn } = await accessToken();
  const creator = await api<{ privacy_level_options?: string[]; max_video_post_duration_sec?: number; creator_username?: string }>(
    "/v2/post/publish/creator_info/query/",
    at,
    {},
  );
  const options = creator.privacy_level_options || ["SELF_ONLY"];
  const privacy = wantPublic && options.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : options.includes("SELF_ONLY") ? "SELF_ONLY" : options[0];
  const size = fs.statSync(file).size;
  const { chunkSize, count } = chunking(size);

  const init = await api<{ publish_id: string; upload_url: string }>("/v2/post/publish/video/init/", at, {
    post_info: {
      title: caption.slice(0, 2200),
      privacy_level: privacy,
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
      video_cover_timestamp_ms: 1000,
    },
    source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunkSize, total_chunk_count: count },
  });
  onProgress(5);

  const fd = fs.openSync(file, "r");
  try {
    for (let i = 0; i < count; i++) {
      const start = i * chunkSize;
      const end = i === count - 1 ? size - 1 : start + chunkSize - 1;
      const buf = Buffer.alloc(end - start + 1);
      fs.readSync(fd, buf, 0, buf.length, start);
      const res = await fetch(init.upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(buf.length),
          "Content-Range": `bytes ${start}-${end}/${size}`,
        },
        body: buf,
      });
      if (!res.ok && res.status !== 206) throw new TikTokError(`TikTok upload failed (${res.status})`);
      onProgress(5 + Math.round(((i + 1) / count) * 65));
    }
  } finally {
    fs.closeSync(fd);
  }

  // TikTok processes and posts the video asynchronously.
  for (let i = 0; i < 90; i++) {
    const st = await api<{ status?: string; fail_reason?: string; publicaly_available_post_id?: (string | number)[] }>(
      "/v2/post/publish/status/fetch/",
      at,
      { publish_id: init.publish_id },
    );
    if (st.status === "PUBLISH_COMPLETE") {
      const postId = st.publicaly_available_post_id?.[0];
      const user = creator.creator_username || conn.username;
      onProgress(100);
      return {
        id: String(postId || init.publish_id),
        url: postId && user ? `https://www.tiktok.com/@${user}/video/${postId}` : undefined,
        note: privacy === "PUBLIC_TO_EVERYONE" ? undefined : "Posted as private (Only me): TikTok requires an audited app for public posts.",
      };
    }
    if (st.status === "FAILED") throw new TikTokError(`TikTok couldn't post the video: ${st.fail_reason || "unknown reason"}`);
    onProgress(Math.min(95, 70 + i));
    await sleep(4000);
  }
  throw new TikTokError("TikTok is taking too long to process the video. Check your TikTok app; it may still appear.");
}
