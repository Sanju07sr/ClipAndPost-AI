import { googleConfigured, loadAccount } from "../google";
import { config } from "../config";
import type { PlatformId } from "../types";
import { metaStatus } from "./meta";
import { tiktokStatus } from "./tiktok";

export interface PlatformStatus {
  configured: boolean;
  connected: boolean;
  /** Account or Page name shown in the UI. */
  account: string | null;
  picture?: string | null;
  /** Why it can't be used yet, if connected but unusable. */
  problem?: string | null;
}

/** Connection state of every platform, for the UI and for validating publish requests. */
export function allStatuses() {
  const yt = loadAccount();
  const meta = metaStatus();
  const tt = tiktokStatus();
  const platforms: Record<PlatformId, PlatformStatus> = {
    youtube: {
      configured: googleConfigured(),
      connected: Boolean(yt),
      account: yt?.channel.title ?? null,
      picture: yt?.channel.thumbnail ?? null,
    },
    instagram: {
      configured: meta.configured,
      connected: meta.connected && Boolean(meta.instagram),
      account: meta.instagram ? `@${meta.instagram.username}` : null,
      picture: meta.instagram?.picture ?? null,
      problem:
        meta.connected && !meta.instagram
          ? `The Facebook Page "${meta.page?.name ?? "?"}" has no Instagram professional account linked.`
          : meta.expired
            ? "Login expired: connect again."
            : null,
    },
    facebook: {
      configured: meta.configured,
      connected: meta.connected && Boolean(meta.page),
      account: meta.page?.name ?? null,
      picture: meta.page?.picture ?? null,
      problem: meta.expired ? "Login expired: connect again." : null,
    },
    tiktok: {
      configured: tt.configured,
      connected: tt.connected,
      account: tt.account ? (tt.account.username ? `@${tt.account.username}` : tt.account.name) : null,
      picture: tt.account?.picture ?? null,
    },
  };
  return {
    platforms,
    meta: { pages: meta.pages, selectedPageId: meta.page?.id ?? null, redirectUri: meta.redirectUri },
    tiktok: { redirectUri: tt.redirectUri },
    youtube: { redirectUri: config.googleRedirectUri },
  };
}
