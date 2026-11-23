"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Brain,
  Captions,
  Circle,
  CircleCheck,
  CircleMinus,
  Clock,
  Crop,
  Download,
  ExternalLink,
  FileText,
  Film,
  Link2,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Terminal,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { PLATFORM_NAMES, type Job, type PlatformId, type Stage, type StageId } from "@/lib/types";
import { ClipCard } from "./ClipCard";
import { ProcessingVisual } from "./ProcessingVisual";
import { notify, requestDesktopNotifications } from "./Toaster";
import { PublishDialog } from "./PublishDialog";
import { PublishBar, connectedPlatforms, useConnections } from "./PublishBar";
import { fmt } from "./format";

const CAPTION_LABELS: Record<string, string> = {
  bold: "Bold pop captions",
  karaoke: "Karaoke captions",
  minimal: "Minimal captions",
  neon: "Neon glow captions",
  reveal: "Word reveal captions",
  oneword: "One-word captions",
  comic: "Comic captions",
  none: "No captions",
};

const STAGE_ICONS: Record<StageId, typeof Brain> = {
  metadata: Link2,
  transcript: FileText,
  moments: Brain,
  download: Download,
  render: Film,
};

export function JobView({ id }: { id: string }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [queuePos, setQueuePos] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [publishing, setPublishing] = useState(false);
  const [pollKey, setPollKey] = useState(0);
  const { conn } = useConnections();
  // Where to publish: starts as every connected platform; the user can narrow it to one.
  const [targets, setTargets] = useState<PlatformId[] | null>(null);
  useEffect(() => {
    if (conn && targets === null) setTargets(connectedPlatforms(conn));
  }, [conn, targets]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevJob = useRef<Job | null>(null);
  // Results collected across polls for the current publishing batch.
  const batch = useRef<Batch>({ published: [], failed: 0 });
  // Keep the progress panel up briefly at 100% after a job finishes.
  const [justFinished, setJustFinished] = useState(false);

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const data = (await res.json()) as { job: Job; queuePosition: number };
        if (stop) return;
        announceChanges(prevJob.current, data.job, batch.current, () => {
          setJustFinished(true);
          setTimeout(() => setJustFinished(false), 9000);
        });
        prevJob.current = data.job;
        setJob(data.job);
        setQueuePos(data.queuePosition);
        const uploading = data.job.clips.some((c) =>
          Object.values(c.uploads || {}).some((u) => u?.status === "queued" || u?.status === "uploading"),
        );
        if ((data.job.status === "done" || data.job.status === "error") && !uploading) return;
      } catch {
        /* network blip: try again */
      }
      if (!stop) timer.current = setTimeout(poll, 1500);
    }
    poll();
    return () => {
      stop = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [id, pollKey]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-24 text-center">
        <h1 className="font-display text-2xl font-bold">This job doesn&apos;t exist</h1>
        <p className="mt-2 text-ink-300">It may have been deleted.</p>
        <Link href="/" className="bg-brand mt-6 inline-flex rounded-xl px-5 py-2.5 font-semibold text-white">
          Make new Shorts
        </Link>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <div className="skeleton h-28 rounded-3xl" />
        <div className="skeleton mt-6 h-48 rounded-3xl" />
      </div>
    );
  }

  const active = job.status === "running" || job.status === "queued";
  const showProgress = active || (justFinished && job.status === "done");
  const finished = !active && job.status === "done";
  const shownProgress = finished ? 100 : job.progress;
  const currentStage = job.stages.find((st) => st.status === "running")?.id ?? null;
  const doneClips = job.clips.filter((c) => c.status === "done");
  const busyUpload = (c: Job["clips"][number]) =>
    Object.values(c.uploads || {}).some((u) => u?.status === "queued" || u?.status === "uploading");
  const connected = connectedPlatforms(conn);
  // A clip can still be selected while some connected platform doesn't have it yet.
  const unpublished = (c: Job["clips"][number]) => connected.some((p) => c.uploads?.[p]?.status !== "published");
  const selectable = doneClips.filter((c) => !busyUpload(c) && unpublished(c));
  const selectedClips = doneClips.filter((c) => selected.has(c.id));
  const canSelect = connected.length > 0;
  const toggle = (clipId: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(clipId)) n.delete(clipId);
      else n.add(clipId);
      return n;
    });
  const o = job.options;

  async function remove() {
    if (!confirm("Delete this video and all its Shorts?")) return;
    setDeleting(true);
    const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/");
    else setDeleting(false);
  }

  function downloadAll() {
    doneClips.forEach((c, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = `/api/jobs/${id}/clips/${c.id}?download=1`;
        a.download = "";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 700);
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-300 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" /> New video
      </Link>

      {/* Video header */}
      <section className="glass mt-4 flex flex-col gap-5 rounded-3xl p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl bg-ink-800 sm:w-56">
          {job.video?.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={job.video.thumbnail}
              alt=""
              onError={(e) => (e.currentTarget.style.visibility = "hidden")}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="skeleton h-full w-full" />
          )}
          {job.video && (
            <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-medium">
              {fmt(job.video.duration)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-semibold leading-snug text-white sm:text-2xl">
            {job.video?.title || "Reading video…"}
          </h1>
          <p className="mt-1 text-sm text-ink-300">{job.video?.channel || o.url}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Chip icon={<Sparkles className="h-3.5 w-3.5" />}>{o.clipCount} Shorts</Chip>
            <Chip icon={<Clock className="h-3.5 w-3.5" />}>
              {o.minDuration}–{o.maxDuration}s
            </Chip>
            <Chip icon={<Crop className="h-3.5 w-3.5" />}>{o.layout === "fill" ? "Fill crop" : "Fit + blur"}</Chip>
            <Chip icon={<Captions className="h-3.5 w-3.5" />}>
              {CAPTION_LABELS[o.captionStyle] ?? o.captionStyle}
            </Chip>
            {job.picker && (
              <Chip icon={<Brain className="h-3.5 w-3.5" />}>
                {job.picker === "claude" ? "Picked by Claude" : "Built-in picker"}
              </Chip>
            )}
          </div>
        </div>
        <div className="flex gap-2 sm:flex-col">
          <a
            href={o.url}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-sm text-ink-200 ring-1 ring-white/10 transition hover:bg-white/10"
          >
            <ExternalLink className="h-4 w-4" /> Source
          </a>
          {!active && (
            <button
              onClick={remove}
              disabled={deleting}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm text-ink-400 ring-1 ring-white/5 transition hover:bg-rose-500/10 hover:text-rose-300"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
        </div>
      </section>

      {/* Progress */}
      {showProgress && (
        <section
          className={`glass mt-6 rounded-3xl p-5 transition sm:p-7 ${finished ? "ring-2 ring-lime-400/40" : "ring-brand"}`}
          aria-live="polite"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <ProcessingVisual stage={currentStage} done={finished} />
            <div className="min-w-0 flex-1">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className={`text-sm ${finished ? "text-lime-200" : "text-ink-300"}`}>
                    {finished
                      ? `All done! ${job.clips.filter((c) => c.status === "done").length} Shorts are ready below.`
                      : job.status === "queued" && queuePos > 0
                        ? `Queued: ${queuePos} ahead of you`
                        : job.message}
                  </p>
                  <p className="mt-1 font-display text-5xl font-bold tabular-nums text-white">{shownProgress}%</p>
                </div>
                {finished ? (
                  <CircleCheck className="mb-2 h-8 w-8 text-lime-400" />
                ) : (
                  <LoaderCircle className="mb-2 h-7 w-7 animate-spin text-brand-pink" />
                )}
              </div>
              <div className="relative mt-5 h-3 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={`relative h-full overflow-hidden rounded-full transition-[width] duration-700 ease-out ${
                    finished ? "bg-gradient-to-r from-lime-400 to-emerald-400" : "bg-brand"
                  }`}
                  style={{ width: `${Math.max(3, shownProgress)}%` }}
                >
                  {!finished && <span className="bar-sheen absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" />}
                </div>
              </div>
            </div>
          </div>
          <Stepper stages={job.stages} />
          <p className="mt-5 text-xs text-ink-400">
            {finished
              ? "Your Shorts are below. Select the ones you want and publish them."
              : "You can leave this page; processing continues on the server, and you'll get a notification when it's done."}
          </p>
        </section>
      )}

      {/* Error */}
      {job.status === "error" && (
        <section className="mt-6 rounded-3xl border border-rose-400/20 bg-rose-500/[0.07] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-rose-100">Couldn&apos;t finish this video</h2>
              <p className="mt-1 break-words text-sm text-rose-200/80">{job.error}</p>
              <div className="mt-4 flex gap-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-medium text-ink-950"
                >
                  <RotateCcw className="h-4 w-4" /> Try another video
                </Link>
              </div>
            </div>
          </div>
          {doneClips.length === 0 && <Stepper stages={job.stages} />}
        </section>
      )}

      {job.warnings?.includes("captions-unavailable") && (
        <section className="mt-6 flex items-start gap-2.5 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            These Shorts were rendered <b>without captions</b> because your ffmpeg doesn&apos;t include libass. The home page
            shows how to fix it; after that, run this video again to get captions.
          </p>
        </section>
      )}

      {/* Clips */}
      {job.clips.length > 0 && (
        <section className="mt-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">Your Shorts</h2>
              <p className="mt-1 text-sm text-ink-300">
                {job.status === "done"
                  ? `${doneClips.length} ready · ranked by virality score`
                  : `${doneClips.length} of ${job.clips.length} rendered`}
                {job.hasTranscript === false && " · no captions available for this video"}
              </p>
            </div>
            {doneClips.length > 1 && (
              <button
                onClick={downloadAll}
                className="bg-brand inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-pink/20 transition hover:brightness-110"
              >
                <Download className="h-4 w-4" /> Download all
              </button>
            )}
          </div>
          {doneClips.length > 0 && (
            <PublishBar
              conn={conn}
              targets={targets ?? []}
              onTargetsChange={setTargets}
              selectable={selectable.length}
              selected={selectedClips.length}
              onSelectAll={() => setSelected(new Set(selectable.map((c) => c.id)))}
              onClear={() => setSelected(new Set())}
              onPublish={() => {
                requestDesktopNotifications();
                setPublishing(true);
              }}
            />
          )}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {job.clips.map((c, i) => (
              <ClipCard
                key={c.id}
                jobId={job.id}
                clip={c}
                rank={i + 1}
                sourceUrl={o.url}
                selectable={canSelect && c.status === "done" && !busyUpload(c) && unpublished(c)}
                selected={selected.has(c.id)}
                onToggle={() => toggle(c.id)}
              />
            ))}
          </div>
          {publishing && (
            <PublishDialog
              jobId={job.id}
              clips={selectedClips}
              states={conn!.platforms}
              targets={targets ?? []}
              onTargetsChange={setTargets}
              onClose={() => {
                setPublishing(false);
                setPollKey((k) => k + 1); // pick up generated metadata
              }}
              onPublished={() => {
                setPublishing(false);
                setSelected(new Set());
                setPollKey((k) => k + 1);
              }}
            />
          )}
        </section>
      )}

      {/* Log */}
      {job.log.length > 0 && (
        <section className="mt-10">
          <button
            onClick={() => setShowLog((s) => !s)}
            className="inline-flex items-center gap-1.5 text-sm text-ink-400 transition hover:text-white"
          >
            <Terminal className="h-4 w-4" /> {showLog ? "Hide" : "Show"} processing log
          </button>
          {showLog && (
            <pre className="mt-3 max-h-80 overflow-auto rounded-2xl bg-black/40 p-4 text-xs leading-relaxed text-ink-300 ring-1 ring-white/5">
              {job.log.join("\n")}
            </pre>
          )}
        </section>
      )}
    </div>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-ink-200 ring-1 ring-white/[0.07]">
      <span className="text-ink-400">{icon}</span>
      {children}
    </span>
  );
}

function Stepper({ stages }: { stages: Stage[] }) {
  return (
    <ol className="mt-6 grid gap-2 sm:grid-cols-5">
      {stages.map((s) => {
        const Icon = STAGE_ICONS[s.id];
        return (
          <li
            key={s.id}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ring-1 transition sm:flex-col sm:items-start sm:gap-2 ${
              s.status === "running"
                ? "bg-white/[0.06] ring-brand-pink/40"
                : s.status === "error"
                  ? "bg-rose-500/10 ring-rose-400/30"
                  : "ring-white/5"
            }`}
          >
            <div className="flex items-center gap-2">
              <StatusIcon status={s.status} />
              <Icon className={`h-4 w-4 ${s.status === "pending" ? "text-ink-600" : "text-ink-300"}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-medium ${s.status === "pending" ? "text-ink-400" : "text-ink-100"}`}>{s.label}</p>
              {s.detail && <p className="truncate text-xs text-ink-400">{s.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StatusIcon({ status }: { status: Stage["status"] }) {
  if (status === "done") return <CircleCheck className="h-4 w-4 text-lime-400" />;
  if (status === "running") return <LoaderCircle className="h-4 w-4 animate-spin text-brand-pink" />;
  if (status === "skipped") return <CircleMinus className="h-4 w-4 text-amber-300" />;
  if (status === "error") return <TriangleAlert className="h-4 w-4 text-rose-400" />;
  return <Circle className="h-4 w-4 text-ink-600" />;
}

/**
 * Compare two polls of a job and notify about what just happened: Shorts
 * finished rendering, a platform finished publishing, or everything is done.
 */
interface Batch {
  published: string[];
  failed: number;
}

function announceChanges(prev: Job | null, next: Job, batch: Batch, onFinished: () => void) {
  if (!prev) return; // first load: nothing "just happened"
  const wasActive = prev.status === "running" || prev.status === "queued";
  if (wasActive && next.status === "done") {
    const n = next.clips.filter((c) => c.status === "done").length;
    notify({
      kind: "celebrate",
      title: `${n} Short${n === 1 ? " is" : "s are"} ready!`,
      body: next.video?.title ? `From "${next.video.title}". Select them below to publish.` : "Select them below to publish.",
    });
    onFinished();
  } else if (wasActive && next.status === "error") {
    notify({ kind: "error", title: "Couldn't finish this video", body: next.error });
  }

  const busy = (u?: { status: string }) => u?.status === "queued" || u?.status === "uploading";
  for (const c of next.clips) {
    const before = prev.clips.find((x) => x.id === c.id);
    for (const [p, u] of Object.entries(c.uploads || {}) as [PlatformId, NonNullable<Job["clips"][number]["uploads"]>[PlatformId]][]) {
      if (!u || !(p in PLATFORM_NAMES) || !busy(before?.uploads?.[p])) continue;
      const name = PLATFORM_NAMES[p];
      if (u.status === "published") {
        batch.published.push(name);
        notify({
          kind: "success",
          title: `Published on ${name}`,
          body: `"${u.title || c.title}"${u.actualPrivacy && u.actualPrivacy !== "public" ? ` (${u.actualPrivacy})` : ""}`,
          link: u.url ? { href: u.url, label: `View on ${name}` } : undefined,
        });
      } else if (u.status === "error") {
        batch.failed++;
        notify({ kind: "error", title: `${name} upload failed`, body: u.error });
      }
    }
  }
  const stillBusy = next.clips.some((c) => Object.values(c.uploads || {}).some((u) => busy(u)));
  const wasBusy = prev.clips.some((c) => Object.values(c.uploads || {}).some((u) => busy(u)));
  if (wasBusy && !stillBusy) {
    const { published, failed } = batch;
    const total = published.length;
    batch.published = [];
    batch.failed = 0;
    notify({
      kind: failed ? "info" : "celebrate",
      title: failed ? "Publishing finished with problems" : "All done: your Shorts are live!",
      body: failed
        ? `${failed} upload${failed === 1 ? "" : "s"} failed. See the cards below.`
        : `${total} post${total === 1 ? "" : "s"} published${published.length ? ` on ${[...new Set(published)].join(", ")}` : ""}.`,
    });
  }
}
