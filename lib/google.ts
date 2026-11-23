import fs from "node:fs";
import path from "node:path";
import { config } from "./config";

// Google OAuth for one YouTube channel. This is a self-hosted, single-user
// app, so the connected account is stored in DATA_DIR/youtube-account.json.

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

export interface Channel {
  id: string;
  title: string;
  thumbnail?: string;
}

interface Account {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  channel: Channel;
  connectedAt: string;
}

const ACCOUNT_FILE = () => path.join(config.dataDir, "youtube-account.json");

export function googleConfigured() {
  return Boolean(config.googleClientId && config.googleClientSecret);
}

export function loadAccount(): Account | null {
  try {
    return JSON.parse(fs.readFileSync(ACCOUNT_FILE(), "utf8")) as Account;
  } catch {
    return null;
  }
}

function saveAccount(a: Account) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(ACCOUNT_FILE(), JSON.stringify(a, null, 2), { mode: 0o600 });
}

export function authUrl(state: string) {
  const u = new URL(config.googleAuthUrl);
  u.search = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();
  return u.toString();
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(config.googleTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      ...params,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new GoogleAuthError(data.error_description || data.error || `Google sign-in failed (${res.status})`, data.error);
  }
  return data;
}

export class GoogleAuthError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

/** Finish sign-in: swap the code for tokens and look up the channel. */
export async function connectWithCode(code: string): Promise<Channel> {
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: config.googleRedirectUri });
  if (!t.refresh_token) throw new GoogleAuthError("Google didn't return a refresh token. Please try connecting again.");
  const channel = await fetchChannel(t.access_token!);
  saveAccount({
    accessToken: t.access_token!,
    refreshToken: t.refresh_token,
    expiresAt: Date.now() + (t.expires_in || 3600) * 1000,
    channel,
    connectedAt: new Date().toISOString(),
  });
  return channel;
}

async function fetchChannel(token: string): Promise<Channel> {
  const res = await fetch(`${config.youtubeApi}/channels?part=snippet&mine=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as {
    items?: { id: string; snippet: { title: string; thumbnails?: { default?: { url: string } } } }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new GoogleAuthError(data.error?.message || "Couldn't read your YouTube channel");
  const ch = data.items?.[0];
  if (!ch) throw new GoogleAuthError("This Google account has no YouTube channel. Create one on youtube.com first.");
  return { id: ch.id, title: ch.snippet.title, thumbnail: ch.snippet.thumbnails?.default?.url };
}

/** A valid access token, refreshed when needed. Throws if not connected. */
export async function accessToken(): Promise<string> {
  const a = loadAccount();
  if (!a) throw new GoogleAuthError("Connect your YouTube account first.", "not_connected");
  if (a.expiresAt - 60_000 > Date.now()) return a.accessToken;
  try {
    const t = await tokenRequest({ refresh_token: a.refreshToken, grant_type: "refresh_token" });
    a.accessToken = t.access_token!;
    a.expiresAt = Date.now() + (t.expires_in || 3600) * 1000;
    if (t.refresh_token) a.refreshToken = t.refresh_token;
    saveAccount(a);
    return a.accessToken;
  } catch (err) {
    if (err instanceof GoogleAuthError && err.code === "invalid_grant") {
      // Revoked, or expired (apps in Google's "Testing" mode expire after 7 days).
      fs.rmSync(ACCOUNT_FILE(), { force: true });
      throw new GoogleAuthError("Your YouTube connection expired. Please connect again.", "not_connected");
    }
    throw err;
  }
}

export async function disconnect() {
  const a = loadAccount();
  fs.rmSync(ACCOUNT_FILE(), { force: true });
  if (a) {
    await fetch(`${config.googleRevokeUrl}?token=${encodeURIComponent(a.refreshToken)}`, { method: "POST" }).catch(
      () => undefined,
    );
  }
}
