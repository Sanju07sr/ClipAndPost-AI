"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckSquare, CircleCheck, LoaderCircle, Plus, Send, Settings, Square, TriangleAlert } from "lucide-react";
import { PLATFORM_NAMES, type PlatformId } from "@/lib/types";
import { PlatformBadge } from "./PlatformBadge";

export const PLATFORMS: PlatformId[] = ["youtube", "instagram", "facebook", "tiktok"];

export interface ConnState {
  platforms: Record<PlatformId, { configured: boolean; connected: boolean; account: string | null; problem?: string | null }>;
}

export function useConnections() {
  const [conn, setConn] = useState<ConnState | null>(null);
  const reload = useCallback(() => {
    fetch("/api/connections", { cache: "no-store" })
      .then((r) => r.json())
      .then(setConn)
      .catch(() => undefined);
  }, []);
  useEffect(reload, [reload]);
  return { conn, reload };
}

export function connectedPlatforms(conn: ConnState | null): PlatformId[] {
  return conn ? PLATFORMS.filter((p) => conn.platforms[p].connected) : [];
}

export function PublishBar(props: {
  jobId: string;
  conn: ConnState | null;
  selectable: number;
  selected: number;
  onSelectAll: () => void;
  onClear: () => void;
  onPublish: () => void;
}) {
  const { conn } = props;
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const connected = connectedPlatforms(conn);
  const allSelected = props.selectable > 0 && props.selected === props.selectable;

  // Result of a YouTube sign-in started from this page (?youtube=connected|error).
  useEffect(() => {
    const url = new URL(window.location.href);
    const yt = url.searchParams.get("youtube");
    if (!yt) return;
    if (yt === "connected") setNotice({ kind: "ok", text: "YouTube connected." });
    else setNotice({ kind: "error", text: url.searchParams.get("youtube_error") || "Couldn't connect to YouTube." });
    window.history.replaceState(null, "", url.pathname);
  }, []);

  return (
    <section className="glass mb-6 overflow-hidden rounded-3xl">
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold text-white">Publish everywhere in one click</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {!conn ? (
              <LoaderCircle className="h-5 w-5 animate-spin text-ink-400" />
            ) : (
              PLATFORMS.map((p) => {
                const s = conn.platforms[p];
                return (
                  <span
                    key={p}
                    title={s.problem || undefined}
                    className={`inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm ring-1 ${
                      s.connected ? "bg-white/[0.05] text-ink-100 ring-white/10" : "text-ink-400 ring-white/5"
                    }`}
                  >
                    <PlatformBadge platform={p} size="sm" />
                    {s.connected ? (
                      <>
                        <span className="max-w-40 truncate">{s.account || PLATFORM_NAMES[p]}</span>
                        <CircleCheck className="h-4 w-4 text-lime-400" />
                      </>
                    ) : (
                      <>
                        {PLATFORM_NAMES[p]}
                        {s.problem && <TriangleAlert className="h-3.5 w-3.5 text-amber-300" />}
                      </>
                    )}
                  </span>
                );
              })
            )}
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm text-ink-300 ring-1 ring-dashed ring-white/15 transition hover:text-white"
            >
              {connected.length ? <Settings className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {connected.length ? "Manage" : "Connect accounts"}
            </Link>
          </div>
        </div>

        {connected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={allSelected ? props.onClear : props.onSelectAll}
              disabled={!props.selectable}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm text-ink-200 ring-1 ring-white/10 transition hover:bg-white/5 disabled:opacity-40"
            >
              {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              {allSelected ? "Clear" : "Select all"}
            </button>
            <button
              onClick={props.onPublish}
              disabled={!props.selected}
              className="bg-brand flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-pink/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <Send className="h-4 w-4" />
              {props.selected ? `Publish ${props.selected} Short${props.selected === 1 ? "" : "s"}` : "Select Shorts to publish"}
            </button>
          </div>
        )}
      </div>
      {notice && (
        <div
          className={`flex items-start gap-2 border-t px-5 py-3 text-sm ${
            notice.kind === "ok" ? "border-lime-400/15 bg-lime-400/10 text-lime-100" : "border-rose-400/15 bg-rose-500/10 text-rose-100"
          }`}
        >
          <p className="flex-1">{notice.text}</p>
          <button onClick={() => setNotice(null)} className="text-xs opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}
    </section>
  );
}
