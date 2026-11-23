"use client";

import { useEffect, useState } from "react";
import { Check, Flame, Hash, LoaderCircle, Plus, RefreshCw, Send, Sparkles, TriangleAlert, X } from "lucide-react";
import { type Clip, type PlatformId, type Privacy, type PublishMeta } from "@/lib/types";
import { PlatformPicker, type PlatformState } from "./PlatformPicker";
import { PLATFORMS, describeTargets } from "./PublishBar";

interface Draft {
  clip: Clip;
  loading: boolean;
  error?: string;
  title: string;
  description: string;
  hashtags: string[];
  trending: string[];
  source?: PublishMeta["trendingSource"];
  writer?: PublishMeta["writer"];
}

export function PublishDialog(props: {
  jobId: string;
  clips: Clip[];
  states: Record<PlatformId, PlatformState>;
  targets: PlatformId[];
  onTargetsChange: (t: PlatformId[]) => void;
  onClose: () => void;
  onPublished: () => void;
}) {
  const targets = props.targets;
  const connected = PLATFORMS.filter((p) => props.states[p]?.connected);
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    props.clips.map((c) => ({
      clip: c,
      loading: !c.meta,
      title: c.meta?.title ?? c.title,
      description: c.meta?.description ?? c.description,
      hashtags: c.meta?.hashtags ?? c.hashtags,
      trending: c.meta?.trending ?? [],
      source: c.meta?.trendingSource,
      writer: c.meta?.writer,
    })),
  );
  const [privacy, setPrivacy] = useState<Privacy>("public");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (clipId: string, p: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.clip.id === clipId ? { ...d, ...p } : d)));

  async function generate(clipId: string) {
    patch(clipId, { loading: true, error: undefined });
    try {
      const res = await fetch(`/api/jobs/${props.jobId}/clips/${clipId}/metadata`, { method: "POST" });
      const data = (await res.json()) as { meta?: PublishMeta; error?: string };
      if (!res.ok || !data.meta) throw new Error(data.error || "Couldn't prepare metadata");
      const m = data.meta;
      patch(clipId, {
        loading: false,
        title: m.title,
        description: m.description,
        hashtags: m.hashtags,
        trending: m.trending,
        source: m.trendingSource,
        writer: m.writer,
      });
    } catch (err) {
      patch(clipId, { loading: false, error: (err as Error).message });
    }
  }

  // Prepare metadata for clips that don't have it yet, two at a time.
  useEffect(() => {
    const todo = props.clips.filter((c) => !c.meta).map((c) => c.id);
    let i = 0;
    const worker = async () => {
      while (i < todo.length) await generate(todo[i++]);
    };
    worker();
    worker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !submitting && props.onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props, submitting]);

  const anyLoading = drafts.some((d) => d.loading);
  const invalid = drafts.some((d) => !d.title.trim() || d.title.length > 100);

  async function publish() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${props.jobId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: drafts.map((d) => ({
            clipId: d.clip.id,
            title: d.title.trim(),
            description: d.description,
            hashtags: d.hashtags,
            privacy,
          })),
          platforms: targets,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't start the upload");
      props.onPublished();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Publish Shorts">
      <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-ink-900 shadow-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold text-white">
              Publish {drafts.length} Short{drafts.length === 1 ? "" : "s"}
            </h2>
            <p className="text-xs text-ink-400">AI-written titles and trending hashtags. Edit anything before publishing.</p>
          </div>
          <button onClick={props.onClose} disabled={submitting} className="rounded-lg p-2 text-ink-400 hover:bg-white/5 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drafts */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {drafts.map((d) => (
            <DraftEditor
              key={d.clip.id}
              jobId={props.jobId}
              draft={d}
              onChange={(p) => patch(d.clip.id, p)}
              onRegenerate={() => generate(d.clip.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="space-y-3 border-t border-white/5 bg-ink-950/60 px-5 py-4">
          {error && (
            <p className="flex items-start gap-2 text-sm text-rose-300">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium uppercase tracking-wider text-ink-400">Post to</span>
            <PlatformPicker platforms={PLATFORMS} states={props.states} selected={targets} onChange={props.onTargetsChange} />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/5">
              {(["public", "unlisted", "private"] as Privacy[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPrivacy(p)}
                  className={`rounded-lg px-3 py-1.5 text-sm capitalize transition ${privacy === p ? "bg-white text-ink-950" : "text-ink-300 hover:text-white"}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={publish}
              disabled={submitting || anyLoading || invalid || !targets.length}
              className="bg-brand flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold text-white shadow-lg shadow-brand-pink/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {anyLoading
                ? "Preparing titles & hashtags…"
                : !targets.length
                  ? "Choose where to post"
                  : `${privacy === "public" ? "Publish" : `Upload as ${privacy}`} to ${describeTargets(targets, connected)}`}
            </button>
          </div>
          <ul className="space-y-1 text-xs leading-relaxed text-ink-400">
            <li>Instagram and Facebook get one caption: the title, description and hashtags together.</li>
            {targets.includes("youtube") && (
              <li>YouTube: about 6 uploads a day on the free API quota; new Google projects upload as private until YouTube&apos;s API audit.</li>
            )}
            {(targets.includes("instagram") || targets.includes("facebook")) && privacy !== "public" && (
              <li>Instagram and Facebook Reels are always public; the privacy choice applies to YouTube.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function DraftEditor(props: { jobId: string; draft: Draft; onChange: (p: Partial<Draft>) => void; onRegenerate: () => void }) {
  const { draft: d } = props;
  const [newTag, setNewTag] = useState("");
  const base = `/api/jobs/${props.jobId}/clips/${d.clip.id}`;

  const addTag = (raw: string) => {
    const t = raw.replace(/^#/, "").replace(/[^\p{L}\p{N}_]/gu, "");
    if (!t || d.hashtags.some((h) => h.toLowerCase() === t.toLowerCase())) return;
    props.onChange({ hashtags: [...d.hashtags, t].slice(0, 15) });
  };
  const suggestions = d.trending.filter((t) => !d.hashtags.some((h) => h.toLowerCase() === t.toLowerCase())).slice(0, 10);

  return (
    <div className="flex gap-4 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/5 sm:p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}/thumb`} alt="" className="hidden aspect-[9/16] w-24 shrink-0 rounded-xl bg-ink-800 object-cover sm:block" />
      <div className="min-w-0 flex-1 space-y-3">
        {d.loading ? (
          <div className="space-y-2.5">
            <p className="flex items-center gap-2 text-sm text-ink-300">
              <Sparkles className="h-4 w-4 animate-pulse text-brand-pink" /> Researching trending hashtags and writing the title…
            </p>
            <div className="skeleton h-9 rounded-lg" />
            <div className="skeleton h-16 rounded-lg" />
            <div className="skeleton h-7 w-2/3 rounded-lg" />
          </div>
        ) : (
          <>
            {d.error && (
              <p className="flex items-center gap-2 text-xs text-amber-200">
                <TriangleAlert className="h-3.5 w-3.5" /> {d.error}. Using the clip&apos;s own title and hashtags.
              </p>
            )}
            <label className="block">
              <span className="mb-1 flex items-center text-xs font-medium text-ink-300">
                Title
                <span className={`ml-auto tabular-nums ${d.title.length > 100 ? "text-rose-400" : "text-ink-400"}`}>{d.title.length}/100</span>
              </span>
              <input
                value={d.title}
                onChange={(e) => props.onChange({ title: e.target.value })}
                className="w-full rounded-lg bg-ink-950/70 px-3 py-2 text-sm font-medium text-white ring-1 ring-white/10 focus:outline-none focus:ring-brand-pink/60"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-300">Description</span>
              <textarea
                value={d.description}
                rows={3}
                onChange={(e) => props.onChange({ description: e.target.value })}
                className="w-full resize-y rounded-lg bg-ink-950/70 px-3 py-2 text-sm text-ink-100 ring-1 ring-white/10 focus:outline-none focus:ring-brand-pink/60"
              />
            </label>
            <div>
              <span className="mb-1.5 flex items-center gap-1 text-xs font-medium text-ink-300">
                <Hash className="h-3.5 w-3.5" /> Hashtags <span className="text-ink-400">(added to the description; the first 3 show above the title)</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {d.hashtags.map((h) => (
                  <span key={h} className="inline-flex items-center gap-1 rounded-full bg-brand-pink/15 py-1 pl-2.5 pr-1.5 text-xs font-medium text-pink-200 ring-1 ring-brand-pink/30">
                    #{h}
                    <button
                      onClick={() => props.onChange({ hashtags: d.hashtags.filter((x) => x !== h) })}
                      className="rounded-full p-0.5 hover:bg-white/10"
                      aria-label={`Remove #${h}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addTag(newTag);
                    setNewTag("");
                  }}
                  className="inline-flex"
                >
                  <input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="add tag"
                    className="w-24 rounded-full bg-ink-950/70 px-2.5 py-1 text-xs text-white ring-1 ring-white/10 focus:outline-none focus:ring-brand-pink/60"
                  />
                </form>
              </div>
            </div>
            {suggestions.length > 0 && (
              <div>
                <span className="mb-1.5 flex items-center gap-1 text-xs font-medium text-orange-200">
                  <Flame className="h-3.5 w-3.5" /> Trending on top Shorts this week
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((t) => (
                    <button
                      key={t}
                      onClick={() => addTag(t)}
                      className="inline-flex items-center gap-1 rounded-full bg-orange-400/10 px-2.5 py-1 text-xs text-orange-100 ring-1 ring-orange-300/20 transition hover:bg-orange-400/20"
                    >
                      <Plus className="h-3 w-3" />#{t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 text-xs text-ink-400">
              <span>
                {d.writer === "claude" ? "Written by Claude" : "Basic metadata"}
                {d.source === "youtube" ? " · trending data from YouTube" : ""}
              </span>
              <button onClick={props.onRegenerate} className="ml-auto inline-flex items-center gap-1 hover:text-white">
                <RefreshCw className="h-3 w-3" /> Regenerate
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
