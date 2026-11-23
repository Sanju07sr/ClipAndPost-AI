"use client";

import { useEffect, useState } from "react";
import { CheckSquare, LoaderCircle, LogOut, Send, Square, TriangleAlert } from "lucide-react";
import { VideoGlyph } from "./Logo";

export interface YtStatus {
  configured: boolean;
  connected: boolean;
  channel: { id: string; title: string; thumbnail?: string } | null;
  redirectUri: string;
}

export function useYouTubeStatus() {
  const [status, setStatus] = useState<YtStatus | null>(null);
  const reload = () =>
    fetch("/api/youtube/status", { cache: "no-store" })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => undefined);
  useEffect(() => {
    reload();
  }, []);
  return { status, reload };
}

export function YouTubeBar(props: {
  jobId: string;
  status: YtStatus | null;
  onDisconnected: () => void;
  selectable: number;
  selected: number;
  onSelectAll: () => void;
  onClear: () => void;
  onPublish: () => void;
}) {
  const { status } = props;
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Result of the Google sign-in redirect (?youtube=connected|error).
  useEffect(() => {
    const url = new URL(window.location.href);
    const yt = url.searchParams.get("youtube");
    if (!yt) return;
    if (yt === "connected") setNotice({ kind: "ok", text: "YouTube connected. Select Shorts below and publish." });
    else if (yt === "not-configured") setNotice({ kind: "error", text: "Add your Google client ID and secret in Settings first." });
    else setNotice({ kind: "error", text: url.searchParams.get("youtube_error") || "Couldn't connect to YouTube." });
    url.searchParams.delete("youtube");
    url.searchParams.delete("youtube_error");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, []);

  async function disconnect() {
    if (!confirm("Disconnect this YouTube channel?")) return;
    setBusy(true);
    await fetch("/api/youtube/disconnect", { method: "POST" });
    setBusy(false);
    props.onDisconnected();
  }

  const allSelected = props.selectable > 0 && props.selected === props.selectable;

  return (
    <section className="glass mb-6 overflow-hidden rounded-3xl">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {status?.connected && status.channel?.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={status.channel.thumbnail} alt="" className="h-11 w-11 rounded-full ring-2 ring-red-500/60" />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
              <VideoGlyph className="h-6 w-6" />
            </span>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-white">
              {status?.connected ? `Publishing to ${status.channel?.title}` : "Publish straight to YouTube"}
            </p>
            <p className="text-sm text-ink-300">
              {status?.connected
                ? "Pick Shorts, review the AI title & trending hashtags, then publish."
                : "Connect your channel to upload Shorts with an AI-written title, description and trending hashtags."}
            </p>
          </div>
        </div>

        {!status ? (
          <LoaderCircle className="h-5 w-5 animate-spin text-ink-400" />
        ) : status.connected ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={allSelected ? props.onClear : props.onSelectAll}
              disabled={!props.selectable}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-ink-200 ring-1 ring-white/10 transition hover:bg-white/5 disabled:opacity-40"
            >
              {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              {allSelected ? "Clear" : "Select all"}
            </button>
            <button
              onClick={props.onPublish}
              disabled={!props.selected}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <Send className="h-4 w-4" />
              {props.selected ? `Publish ${props.selected} Short${props.selected === 1 ? "" : "s"}` : "Select Shorts to publish"}
            </button>
            <button
              onClick={disconnect}
              disabled={busy}
              title="Disconnect YouTube"
              className="rounded-xl p-2 text-ink-400 transition hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : status.configured ? (
          <a
            href={`/api/youtube/connect?returnTo=${encodeURIComponent(`/jobs/${props.jobId}`)}`}
            className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-500"
          >
            <VideoGlyph className="h-5 w-5" /> Connect YouTube
          </a>
        ) : (
          <a
            href="/settings"
            className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-500"
          >
            <VideoGlyph className="h-5 w-5" /> Set up YouTube
          </a>
        )}
      </div>

      {notice && (
        <div
          className={`flex items-start gap-2 border-t px-5 py-3 text-sm ${
            notice.kind === "ok" ? "border-lime-400/15 bg-lime-400/10 text-lime-100" : "border-rose-400/15 bg-rose-500/10 text-rose-100"
          }`}
        >
          {notice.kind === "error" && <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
          <p className="flex-1">{notice.text}</p>
          <button onClick={() => setNotice(null)} className="text-xs opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

    </section>
  );
}
