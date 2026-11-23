import fs from "node:fs";
import { config, readSettings, SETTINGS_FILE, type SavedSettings } from "./config";

/** Save keys from the Settings page. An empty string removes a key. */
export function saveSettings(patch: Partial<SavedSettings>) {
  const next: SavedSettings = { ...readSettings() };
  for (const [k, v] of Object.entries(patch) as [keyof SavedSettings, string | undefined][]) {
    if (v === undefined) continue;
    if (v.trim()) next[k] = v.trim();
    else delete next[k];
  }
  fs.mkdirSync(config.dataDir, { recursive: true });
  // Owner-only permissions: this file holds secrets.
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), { mode: 0o600 });
  fs.chmodSync(SETTINGS_FILE, 0o600);
}

function mask(v: string) {
  return v.length > 8 ? `••••${v.slice(-4)}` : "••••";
}

type Source = "website" | "env" | null;
const source = (saved?: string, env?: string): Source => (saved ? "website" : env ? "env" : null);

/** What the Settings page shows. Secrets are never sent back, only their last 4 characters. */
export function publicSettings() {
  const s = readSettings();
  return {
    anthropic: {
      source: source(s.anthropicApiKey, process.env.ANTHROPIC_API_KEY),
      hint: config.anthropicApiKey ? mask(config.anthropicApiKey) : null,
      model: config.claudeModel,
    },
    google: {
      clientId: config.googleClientId || null, // not secret; shown in full
      clientIdSource: source(s.googleClientId, process.env.GOOGLE_CLIENT_ID),
      secretSource: source(s.googleClientSecret, process.env.GOOGLE_CLIENT_SECRET),
      secretHint: config.googleClientSecret ? mask(config.googleClientSecret) : null,
      redirectUri: config.googleRedirectUri,
    },
    meta: {
      appId: config.metaAppId || null, // not secret
      secretHint: config.metaAppSecret ? mask(config.metaAppSecret) : null,
      saved: Boolean(s.metaAppId || s.metaAppSecret),
    },
    tiktok: {
      clientKey: config.tiktokClientKey || null, // not secret
      secretHint: config.tiktokClientSecret ? mask(config.tiktokClientSecret) : null,
      saved: Boolean(s.tiktokClientKey || s.tiktokClientSecret),
    },
  };
}
