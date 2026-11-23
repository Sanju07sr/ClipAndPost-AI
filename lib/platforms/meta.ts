import fs from "node:fs";
import { config } from "../config";
import { loadConnection, removeConnection, saveConnection, sleep } from "./store";

// Instagram Reels + Facebook Page Reels through one Meta (Facebook Login) app.
// Docs: Instagram content publishing (resumable Reels uploads) and the
// Facebook Video API "Reels publishing" guide.

const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
];

interface Page {
  id: string;
  name: string;
  token: string;
  picture?: string;
  ig?: { id: string; username: string; picture?: string };
}

interface MetaConnection {
  userToken: string;
  userTokenExpiresAt: number;
  pages: Page[];
  selectedPageId: string | null;
  connectedAt: string;
}

export const metaConfigured = () => Boolean(config.metaAppId && config.metaAppSecret);
export const metaRedirectUri = () => `${config.appUrl}/api/connect/meta/callback`;
const graph = (p: string) => `${config.metaGraph}/${config.graphVersion}${p}`;

export class MetaError extends Error {}

async function graphFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number; error_subcode?: number } };
  if (!res.ok || data.error) {
    const e = data.error;
    if (e?.code === 190) throw new MetaError("Your Instagram/Facebook login expired. Please connect again.");
    if (e?.code === 10 || e?.code === 200) throw new MetaError(`Meta refused: ${e.message}. Check the app's permissions and that you're an admin or tester of the app.`);
    if (e?.code === 9 || e?.code === 4) throw new MetaError("Meta's posting limit was reached. Try again later.");
    throw new MetaError(e?.message || `Meta API error (${res.status})`);
  }
  return data;
}

export function metaAuthUrl(state: string) {
  const u = new URL(`${config.metaDialog}/${config.graphVersion}/dialog/oauth`);
  const params: Record<string, string> = {
    client_id: config.metaAppId,
    redirect_uri: metaRedirectUri(),
    state,
    response_type: "code",
  };
  // Facebook Login for Business: Meta recommends a configuration ID (which
  // carries the permissions and assets) instead of a scope list.
  if (config.metaConfigId) {
    params.config_id = config.metaConfigId;
    params.override_default_response_type = "true";
  } else {
    params.scope = SCOPES.join(",");
  }
  u.search = new URLSearchParams(params).toString();
  return u.toString();
}

/** Finish login: code -> long-lived user token -> Pages and their Instagram accounts. */
export async function metaConnect(code: string) {
  const short = await graphFetch<{ access_token: string }>(
    graph(
      `/oauth/access_token?${new URLSearchParams({
        client_id: config.metaAppId,
        client_secret: config.metaAppSecret,
        redirect_uri: metaRedirectUri(),
        code,
      })}`,
    ),
  );
  const long = await graphFetch<{ access_token: string; expires_in?: number }>(
    graph(
      `/oauth/access_token?${new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: config.metaAppId,
        client_secret: config.metaAppSecret,
        fb_exchange_token: short.access_token,
      })}`,
    ),
  );
  const pages = await fetchPages(long.access_token);
  const prev = loadConnection<MetaConnection>("meta");
  const keep = pages.find((p) => p.id === prev?.selectedPageId);
  saveConnection("meta", {
    userToken: long.access_token,
    userTokenExpiresAt: Date.now() + (long.expires_in || 60 * 86400) * 1000,
    pages,
    // Prefer a Page that has Instagram linked.
    selectedPageId: keep?.id || pages.find((p) => p.ig)?.id || pages[0]?.id || null,
    connectedAt: new Date().toISOString(),
  } satisfies MetaConnection);
  if (!pages.length) {
    throw new MetaError("No Facebook Pages found. Reels are posted through a Page, so create one (and link your Instagram professional account to it), then connect again.");
  }
}

async function fetchPages(userToken: string): Promise<Page[]> {
  const data = await graphFetch<{
    data: {
      id: string;
      name: string;
      access_token: string;
      picture?: { data?: { url?: string } };
      instagram_business_account?: { id: string; username?: string; profile_picture_url?: string };
    }[];
  }>(
    graph(
      `/me/accounts?${new URLSearchParams({
        fields: "id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}",
        limit: "100",
        access_token: userToken,
      })}`,
    ),
  );
  return (data.data || []).map((p) => ({
    id: p.id,
    name: p.name,
    token: p.access_token,
    picture: p.picture?.data?.url,
    ig: p.instagram_business_account
      ? {
          id: p.instagram_business_account.id,
          username: p.instagram_business_account.username || "instagram",
          picture: p.instagram_business_account.profile_picture_url,
        }
      : undefined,
  }));
}

function current(): { conn: MetaConnection; page: Page } {
  const conn = loadConnection<MetaConnection>("meta");
  if (!conn) throw new MetaError("Connect Instagram & Facebook first.");
  if (conn.userTokenExpiresAt < Date.now()) throw new MetaError("Your Instagram/Facebook login expired. Please connect again.");
  const page = conn.pages.find((p) => p.id === conn.selectedPageId);
  if (!page) throw new MetaError("Choose which Facebook Page to post to in Settings.");
  return { conn, page };
}

export function metaStatus() {
  const conn = loadConnection<MetaConnection>("meta");
  const page = conn?.pages.find((p) => p.id === conn.selectedPageId);
  const expired = conn ? conn.userTokenExpiresAt < Date.now() : false;
  return {
    configured: metaConfigured(),
    connected: Boolean(conn) && !expired,
    expired,
    redirectUri: metaRedirectUri(),
    page: page ? { id: page.id, name: page.name, picture: page.picture } : null,
    instagram: page?.ig ? { username: page.ig.username, picture: page.ig.picture } : null,
    pages: (conn?.pages || []).map((p) => ({ id: p.id, name: p.name, instagram: p.ig?.username || null })),
  };
}

export function metaSelectPage(pageId: string) {
  const conn = loadConnection<MetaConnection>("meta");
  if (!conn?.pages.some((p) => p.id === pageId)) throw new MetaError("Unknown Page");
  conn.selectedPageId = pageId;
  saveConnection("meta", conn);
}

export function metaDisconnect() {
  removeConnection("meta");
}

/** Upload bytes to rupload.facebook.com in one request (Reels are small). */
async function rupload(url: string, token: string, file: string) {
  const size = fs.statSync(file).size;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${token}`,
      offset: "0",
      file_size: String(size),
      "Content-Type": "application/octet-stream",
    },
    body: fs.readFileSync(file),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string }; debug_info?: { message?: string } };
  if (!res.ok || data.success === false) {
    throw new MetaError(data.error?.message || data.debug_info?.message || `Upload failed (${res.status})`);
  }
}

export interface PostResult {
  id: string;
  url?: string;
}

/** Facebook Page Reel: start -> upload -> finish (published). */
export async function uploadFacebookReel(file: string, description: string, onProgress: (p: number) => void): Promise<PostResult> {
  const { page } = current();
  const start = await graphFetch<{ video_id: string; upload_url?: string }>(graph(`/${page.id}/video_reels`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ upload_phase: "start", access_token: page.token }),
  });
  onProgress(10);
  await rupload(start.upload_url || `${config.metaRupload}/video-upload/${config.graphVersion}/${start.video_id}`, page.token, file);
  onProgress(80);
  await graphFetch(graph(`/${page.id}/video_reels`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      upload_phase: "finish",
      video_id: start.video_id,
      video_state: "PUBLISHED",
      description,
      access_token: page.token,
    }),
  });
  onProgress(100);
  return { id: start.video_id, url: `https://www.facebook.com/reel/${start.video_id}` };
}

/** Instagram Reel: create container (resumable) -> upload -> wait until processed -> publish. */
export async function uploadInstagramReel(file: string, caption: string, onProgress: (p: number) => void): Promise<PostResult> {
  const { conn, page } = current();
  if (!page.ig) throw new MetaError(`The Page "${page.name}" has no Instagram professional account linked.`);
  const token = conn.userToken;
  const container = await graphFetch<{ id: string; uri?: string }>(graph(`/${page.ig.id}/media`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "REELS",
      upload_type: "resumable",
      caption: caption.slice(0, 2200),
      share_to_feed: true,
      access_token: token,
    }),
  });
  onProgress(10);
  await rupload(container.uri || `${config.metaRupload}/ig-api-upload/${config.graphVersion}/${container.id}`, token, file);
  onProgress(60);

  // Instagram processes the video before it can be published.
  for (let i = 0; i < 90; i++) {
    const st = await graphFetch<{ status_code?: string; status?: string }>(
      graph(`/${container.id}?fields=status_code,status&access_token=${encodeURIComponent(token)}`),
    );
    if (st.status_code === "FINISHED") break;
    if (st.status_code === "ERROR" || st.status_code === "EXPIRED") {
      throw new MetaError(`Instagram couldn't process the video: ${st.status || st.status_code}`);
    }
    onProgress(Math.min(90, 60 + i));
    await sleep(4000);
    if (i === 89) throw new MetaError("Instagram is taking too long to process the video. Try again later.");
  }
  const published = await graphFetch<{ id: string }>(graph(`/${page.ig.id}/media_publish`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: container.id, access_token: token }),
  });
  let url: string | undefined;
  try {
    const info = await graphFetch<{ permalink?: string }>(
      graph(`/${published.id}?fields=permalink&access_token=${encodeURIComponent(token)}`),
    );
    url = info.permalink;
  } catch {}
  onProgress(100);
  return { id: published.id, url };
}
