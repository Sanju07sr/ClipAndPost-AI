"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckSquare, LoaderCircle, Send, Square } from "lucide-react";
import { PLATFORM_NAMES, type PlatformId } from "@/lib/types";
import { PlatformPicker, type PlatformState } from "./PlatformPicker";

export const PLATFORMS: PlatformId[] = ["youtube", "instagram", "facebook"];

export interface ConnState {
  platforms: Record<PlatformId, PlatformState>;
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

/** "YouTube", "YouTube + Instagram", or "all platforms". */
export function describeTargets(targets: PlatformId[], connected: PlatformId[]) {
  if (targets.length > 1 && targets.length === connected.length) return "all platforms";
  return targets.map((t) => PLATFORM_NAMES[t]).join(" + ");
}

export function PublishBar(props: {
  conn: ConnState | null;
  targets: PlatformId[];
  onTargetsChange: (t: PlatformId[]) => void;
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
  const canPublish = props.selected > 0 && props.targets.length > 0;

  // Result of a YouTube sign-in started from this page (?youtube=connected|error).
  useEffect(() => {
    const url = new URL(window.location.href);
    const yt = url.searchParams.get("youtube");
    if (!yt) return;
    if (yt === "connected") setNotice({ kind: "ok", text: "YouTube connected." });
    else setNotice({ kind: "error", text: url.searchParams.get("youtube_error") || "Couldn't connect to YouTube." });
    window.history.replaceState(null, "", url.pathname);
  }, []);

  let hint = "Tick the Shorts you want below, choose where to post, then publish.";
  if (conn && !connected.length) hint = "Connect at least one account in Settings to publish from here.";
  else if (props.selected && !props.targets.length) hint = "Choose at least one platform.";

  return (
    <section className="glass mb-6 rounded-3xl">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-semibold text-white">Publish your Shorts</p>
            <p className="mt-1 text-ink-300">{hint}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium uppercase tracking-wider text-ink-400">Post to</span>
              {!conn ? (
                <LoaderCircle className="h-5 w-5 animate-spin text-ink-400" />
              ) : (
                <PlatformPicker
                  platforms={PLATFORMS}
                  states={conn.platforms}
                  selected={props.targets}
                  onChange={props.onTargetsChange}
                />
              )}
            </div>
          </div>

          {connected.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-stretch">
              <button
                onClick={allSelected ? props.onClear : props.onSelectAll}
                disabled={!props.selectable}
                className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-ink-100 ring-1 ring-white/15 transition hover:bg-white/5 disabled:opacity-40"
              >
                {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {allSelected ? "Clear selection" : "Select all Shorts"}
              </button>
              <button
                onClick={props.onPublish}
                disabled={!canPublish}
                className="bg-brand flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold text-white shadow-lg shadow-brand-pink/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                <Send className="h-4 w-4" />
                {!props.selected
                  ? "Select Shorts to publish"
                  : !props.targets.length
                    ? "Choose a platform"
                    : `Publish ${props.selected} Short${props.selected === 1 ? "" : "s"} to ${describeTargets(props.targets, connected)}`}
              </button>
            </div>
          )}
        </div>
      </div>
      {notice && (
        <div
          className={`flex items-start gap-2 rounded-b-3xl border-t px-5 py-3 text-sm ${
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
