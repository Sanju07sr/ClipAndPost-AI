"use client";

import { useRef, useState } from "react";
import {
  Check,
  CheckSquare,
  CircleCheck,
  Copy,
  Download,
  ExternalLink,
  Hash,
  LoaderCircle,
  Play,
  Square,
  TriangleAlert,
} from "lucide-react";
import type { Clip, ClipUpload } from "@/lib/types";
import { fmt, fmtBytes } from "./format";

export function ClipCard({
  jobId,
  clip,
  rank,
  sourceUrl,
  selectable = false,
  selected = false,
  onToggle,
}: {
  jobId: string;
  clip: Clip;
  rank: number;
  sourceUrl: string;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const duration = clip.end - clip.start;
  const ready = clip.status === "done";
  const base = `/api/jobs/${jobId}/clips/${clip.id}`;
  const caption = `${clip.description}\n\n${clip.hashtags.map((h) => `#${h}`).join(" ")}`;

  return (
    <article
      className={`glass group flex flex-col overflow-hidden rounded-3xl animate-fade-up transition ${
        selected ? "!border-red-500/70 shadow-lg shadow-red-600/20" : ""
      }`}
    >
      {/* Player */}
      <div className="relative p-3 pb-0">
        <div className="relative mx-auto aspect-[9/16] w-full overflow-hidden rounded-2xl bg-ink-900 ring-1 ring-white/10">
          {ready ? (
            <>
              <video
                ref={videoRef}
                src={base}
                poster={clip.thumb ? `${base}/thumb` : undefined}
                preload="metadata"
                playsInline
                controls={playing}
                onPlay={() => setPlaying(true)}
                onEnded={() => setPlaying(false)}
                className="h-full w-full object-cover"
              />
              {!playing && (
                <button
                  onClick={() => videoRef.current?.play()}
                  className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/50 via-transparent to-black/20 transition hover:from-black/60"
                  aria-label={`Play ${clip.title}`}
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur-md transition group-hover:scale-110">
                    <Play className="ml-1 h-7 w-7 fill-white text-white" />
                  </span>
                </button>
              )}
            </>
          ) : (
            <div className="skeleton flex h-full w-full flex-col items-center justify-center gap-3 text-sm text-ink-300">
              {clip.status === "error" ? (
                <>
                  <TriangleAlert className="h-6 w-6 text-rose-300" />
                  <span className="px-6 text-center text-rose-200/90">{clip.error || "This clip failed"}</span>
                </>
              ) : (
                <>
                  <LoaderCircle className="h-6 w-6 animate-spin text-brand-pink" />
                  {clip.status === "downloading" ? "Downloading…" : clip.status === "rendering" ? "Rendering…" : "Waiting…"}
                </>
              )}
            </div>
          )}
          {/* Overlays */}
          {!playing && (
            <>
              {selectable ? (
                <button
                  onClick={onToggle}
                  role="checkbox"
                  aria-checked={selected}
                  aria-label={`Select "${clip.title}" for YouTube`}
                  className={`absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold backdrop-blur transition ${
                    selected ? "bg-red-600 text-white" : "bg-black/60 text-white hover:bg-black/80"
                  }`}
                >
                  {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}#{rank}
                </button>
              ) : (
                <span className="absolute left-3 top-3 rounded-lg bg-black/60 px-2 py-1 font-display text-xs font-bold text-white backdrop-blur">
                  #{rank}
                </span>
              )}
              <span className="absolute bottom-3 right-3 rounded-md bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white backdrop-blur">
                {fmt(duration)}
              </span>
              <ScoreRing score={clip.score} />
            </>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-base font-semibold leading-snug text-white">{clip.title}</h3>
        <p className="mt-1 text-xs text-ink-400">
          {fmt(clip.start)} – {fmt(clip.end)} in the original{ready && clip.sizeBytes ? ` · ${fmtBytes(clip.sizeBytes)}` : ""}
        </p>
        {clip.hook && (
          <p className="mt-3 inline-flex w-fit rounded-lg bg-white/[0.06] px-2 py-1 text-xs font-medium text-ink-100 ring-1 ring-white/10">
            “{clip.hook}”
          </p>
        )}
        <p className="mt-3 text-sm leading-relaxed text-ink-300">{clip.reason}</p>
        {clip.hashtags.length > 0 && (
          <p className="mt-3 flex flex-wrap gap-1.5 text-xs text-brand-pink/90">
            {clip.hashtags.map((h) => (
              <span key={h} className="inline-flex items-center">
                <Hash className="h-3 w-3" />
                {h}
              </span>
            ))}
          </p>
        )}

        {clip.upload && <UploadStatus upload={clip.upload} />}

        <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
          {ready ? (
            <a
              href={`${base}?download=1`}
              className="bg-brand col-span-2 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-pink/15 transition hover:brightness-110"
            >
              <Download className="h-4 w-4" /> Download MP4
            </a>
          ) : (
            <span className="col-span-2 flex items-center justify-center rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm text-ink-400">
              {clip.status === "error" ? "Not available" : "Preparing…"}
            </span>
          )}
          <CopyButton text={clip.title} label="Copy title" />
          <CopyButton text={caption} label="Copy caption" />
          <a
            href={`${sourceUrl}&t=${Math.floor(clip.start)}s`}
            target="_blank"
            rel="noreferrer"
            className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs text-ink-400 transition hover:bg-white/5 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Watch this moment in the original
          </a>
        </div>
      </div>
    </article>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="flex items-center justify-center gap-1.5 rounded-xl bg-white/[0.04] px-3 py-2 text-xs font-medium text-ink-200 ring-1 ring-white/[0.07] transition hover:bg-white/[0.08]"
    >
      {done ? <Check className="h-3.5 w-3.5 text-lime-400" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const color = score >= 85 ? "#a3e635" : score >= 70 ? "#facc15" : "#fb923c";
  return (
    <div
      className="absolute right-3 top-3 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur"
      title={`Virality score ${score}/100`}
    >
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
        />
      </svg>
      <span className="font-display text-sm font-bold text-white">{score}</span>
    </div>
  );
}

function UploadStatus({ upload }: { upload: ClipUpload }) {
  if (upload.status === "queued" || upload.status === "uploading") {
    return (
      <div className="mt-4 rounded-xl bg-red-500/10 p-3 ring-1 ring-red-500/20">
        <p className="flex items-center gap-2 text-sm font-medium text-red-100">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {upload.status === "queued" ? "Waiting to upload…" : `Uploading to YouTube… ${upload.progress}%`}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-red-500 transition-[width] duration-500" style={{ width: `${Math.max(3, upload.progress)}%` }} />
        </div>
      </div>
    );
  }
  if (upload.status === "error") {
    return (
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200 ring-1 ring-rose-400/20">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <b>Upload failed.</b> {upload.error} Select the Short again to retry.
        </p>
      </div>
    );
  }
  const forcedPrivate = upload.actualPrivacy && upload.actualPrivacy !== upload.privacy;
  return (
    <div className="mt-4 rounded-xl bg-lime-400/10 p-3 text-sm ring-1 ring-lime-400/20">
      <p className="flex items-center gap-2 font-medium text-lime-100">
        <CircleCheck className="h-4 w-4" />
        {upload.actualPrivacy === "public" ? "Live on YouTube" : `Uploaded as ${upload.actualPrivacy}`}
        {upload.url && (
          <a href={upload.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs underline">
            View <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </p>
      {forcedPrivate && (
        <p className="mt-1.5 text-xs text-amber-200">
          YouTube made this video {upload.actualPrivacy} because your Google Cloud project hasn&apos;t passed YouTube&apos;s API audit
          yet. You can make it public in YouTube Studio.
        </p>
      )}
    </div>
  );
}
