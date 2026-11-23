import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { buildAss } from "./captions";
import { findFocusWithClaude, pickMomentsWithClaude } from "./ai";
import { dedupe, pickMomentsHeuristic, snapToSegments } from "./moments";
import { extractFrames, loudnessPerSecond, makeThumbnail, probe, renderShort } from "./media";
import { jobDir, getJob, updateJob } from "./store";
import { parseJson3, toSegments, transcriptForPrompt, wordsInRange, formatTime } from "./transcript";
import type { Segment, Word } from "./transcript";
import type { Clip, ClipPlan, Job, StageId, StageStatus } from "./types";
import {
  downloadAudio,
  downloadFull,
  downloadSection,
  downloadSubtitles,
  fetchMetadata,
  pickSubtitleTrack,
} from "./youtube";

// ---------------------------------------------------------------- queue

const g = globalThis as unknown as { __clipQueue?: { waiting: string[]; running: Set<string> } };
const queue = (g.__clipQueue ??= { waiting: [], running: new Set() });

export function enqueue(jobId: string) {
  queue.waiting.push(jobId);
  pump();
}

function pump() {
  while (queue.running.size < config.maxConcurrentJobs && queue.waiting.length) {
    const id = queue.waiting.shift()!;
    queue.running.add(id);
    processJob(id)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        updateJob(id, (j) => {
          j.status = "error";
          j.error = friendlyError(msg);
          j.message = j.error;
          j.log.push(`ERROR: ${msg}`);
          const running = j.stages.find((s) => s.status === "running");
          if (running) running.status = "error";
        });
      })
      .finally(() => {
        queue.running.delete(id);
        pump();
      });
  }
}

export function queuePosition(jobId: string): number {
  return queue.waiting.indexOf(jobId) + 1;
}

function friendlyError(msg: string): string {
  if (/not installed or not on PATH/.test(msg)) return msg + ". Run `npm run doctor` to check your setup.";
  if (/Sign in to confirm|not a bot/i.test(msg))
    return "YouTube is asking this server to sign in. Set YTDLP_COOKIES to a cookies.txt export (see README).";
  if (/Private video|Video unavailable|This video is unavailable/i.test(msg))
    return "This video is private or unavailable.";
  if (/age/i.test(msg) && /restrict|confirm your age/i.test(msg))
    return "This video is age-restricted. Set YTDLP_COOKIES to download it (see README).";
  return msg.length > 400 ? msg.slice(0, 400) + "…" : msg;
}

// ---------------------------------------------------------------- helpers

const WEIGHTS: Record<StageId, [number, number]> = {
  metadata: [0, 5],
  transcript: [5, 12],
  moments: [12, 25],
  download: [25, 55],
  render: [55, 100],
};

function stage(id: string, sid: StageId, status: StageStatus, detail?: string) {
  updateJob(id, (j) => {
    const s = j.stages.find((x) => x.id === sid)!;
    s.status = status;
    if (detail !== undefined) s.detail = detail;
    if (status === "running") j.progress = Math.max(j.progress, WEIGHTS[sid][0]);
    if (status === "done" || status === "skipped") j.progress = Math.max(j.progress, WEIGHTS[sid][1]);
  });
}

function progress(id: string, sid: StageId, fraction: number, message?: string) {
  const [a, b] = WEIGHTS[sid];
  const p = Math.round(a + (b - a) * Math.max(0, Math.min(1, fraction)));
  const job = getJob(id);
  // Avoid rewriting job.json for every tiny progress tick.
  if (job && p === job.progress && (!message || message === job.message)) return;
  updateJob(id, (j) => {
    j.progress = Math.max(j.progress, p);
    if (message) j.message = message;
  });
}

function log(id: string, line: string) {
  updateJob(id, (j) => {
    j.log.push(`[${new Date().toISOString().slice(11, 19)}] ${line}`);
    if (j.log.length > 200) j.log.splice(0, j.log.length - 200);
  });
}

function setClip(id: string, clipId: string, fn: (c: Clip) => void) {
  updateJob(id, (j) => {
    const c = j.clips.find((x) => x.id === clipId);
    if (c) fn(c);
  });
}

// ---------------------------------------------------------------- main

async function processJob(id: string) {
  const dir = jobDir(id);
  fs.mkdirSync(dir, { recursive: true });
  updateJob(id, (j) => {
    j.status = "running";
    j.message = "Reading video details…";
  });
  const { options } = getJob(id)!;

  // 1. Metadata -------------------------------------------------------
  stage(id, "metadata", "running");
  const { info, raw } = await fetchMetadata(options.url);
  if (!info.duration) throw new Error("Couldn't read the video's length.");
  if (info.duration > config.maxVideoSeconds)
    throw new Error(`This video is ${formatTime(info.duration)} long; the limit is ${formatTime(config.maxVideoSeconds)}.`);
  if (info.duration < options.minDuration + 2)
    throw new Error("This video is shorter than the minimum clip length. It's already a Short!");
  updateJob(id, (j) => {
    j.video = info;
  });
  log(id, `Video: "${info.title}" by ${info.channel} (${formatTime(info.duration)})`);
  stage(id, "metadata", "done", `${formatTime(info.duration)} · ${info.channel}`);

  // 2. Transcript -----------------------------------------------------
  stage(id, "transcript", "running");
  progress(id, "transcript", 0, "Fetching the transcript…");
  let words: Word[] = [];
  const track = pickSubtitleTrack(raw);
  if (track) {
    try {
      const file = await downloadSubtitles(options.url, dir, track);
      if (file) words = parseJson3(file);
    } catch (err) {
      log(id, `Transcript download failed: ${(err as Error).message}`);
    }
  }
  const segs: Segment[] = toSegments(words);
  updateJob(id, (j) => {
    j.hasTranscript = segs.length > 0;
  });
  if (segs.length) {
    log(id, `Transcript: ${words.length} words (${track!.auto ? "auto-generated" : "creator"} captions, ${track!.lang})`);
    stage(id, "transcript", "done", `${words.length.toLocaleString()} words · ${track!.auto ? "auto captions" : "captions"}`);
  } else {
    log(id, "No captions available: moments will be picked from audio energy and clips will have no subtitles.");
    stage(id, "transcript", "skipped", "No captions on this video");
  }

  // 3. Moments --------------------------------------------------------
  stage(id, "moments", "running");
  let plans: ClipPlan[] = [];
  let picker: Job["picker"] = "heuristic";
  if (segs.length && config.hasClaude) {
    progress(id, "moments", 0.2, "Claude is watching for the best moments…");
    try {
      const raw = await pickMomentsWithClaude(transcriptForPrompt(segs), info, options);
      plans = raw
        .map((p) => snapToSegments(p, segs, options, info.duration))
        .filter((p): p is ClipPlan => Boolean(p));
      plans = dedupe(plans, options.clipCount);
      picker = "claude";
      log(id, `Claude proposed ${raw.length} moments; ${plans.length} kept after trimming to sentence boundaries.`);
    } catch (err) {
      log(id, `Claude moment picking failed, using the built-in picker instead: ${(err as Error).message}`);
    }
  }
  if (!plans.length) {
    let loudness: number[] | null = null;
    if (!segs.length) {
      progress(id, "moments", 0.2, "Analysing audio energy…");
      const audio = await downloadAudio(options.url, path.join(dir, "audio"), (p) =>
        progress(id, "moments", 0.2 + (p / 100) * 0.6),
      );
      loudness = await loudnessPerSecond(audio, dir);
      fs.rmSync(audio, { force: true });
    }
    plans = pickMomentsHeuristic(segs, loudness, options, info.duration, info.title).map(
      (p) => snapToSegments(p, segs, options, info.duration) ?? p,
    );
    plans = dedupe(plans, options.clipCount);
    log(id, `Built-in picker chose ${plans.length} moments.`);
  }
  if (!plans.length) throw new Error("Couldn't find any moments that fit the chosen clip length.");
  plans.sort((a, b) => b.score - a.score);
  updateJob(id, (j) => {
    j.picker = picker;
    j.clips = plans.map((p, i) => ({ ...p, id: `c${i + 1}`, index: i + 1, status: "pending" }));
  });
  stage(id, "moments", "done", `${plans.length} moments · ${picker === "claude" ? "picked by Claude" : "built-in picker"}`);

  // 4. Download -------------------------------------------------------
  stage(id, "download", "running");
  const clips = getJob(id)!.clips;
  const sources = new Map<string, { file: string; offset: number }>();
  let full: string | null = null;
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    setClip(id, c.id, (x) => (x.status = "downloading"));
    const base = i / clips.length;
    const span = 1 / clips.length;
    progress(id, "download", base, `Downloading clip ${i + 1} of ${clips.length}…`);
    if (config.sectionDownloads && !full) {
      try {
        const file = await downloadSection(options.url, path.join(dir, `${c.id}-src`), c.start, c.end, (p) =>
          progress(id, "download", base + (p / 100) * span),
        );
        sources.set(c.id, { file, offset: 0 });
        continue;
      } catch (err) {
        log(id, `Section download failed (${(err as Error).message.slice(0, 160)}); downloading the full video instead.`);
      }
    }
    if (!full) {
      progress(id, "download", base, "Downloading the full video…");
      full = await downloadFull(options.url, path.join(dir, "source"), (p) =>
        progress(id, "download", base + (p / 100) * (1 - base)),
      );
    }
    sources.set(c.id, { file: full, offset: c.start });
  }
  stage(id, "download", "done");

  // 5. Render ---------------------------------------------------------
  stage(id, "render", "running");
  let ok = 0;
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    const src = sources.get(c.id)!;
    const base = i / clips.length;
    const span = 1 / clips.length;
    setClip(id, c.id, (x) => (x.status = "rendering"));
    progress(id, "render", base, `Rendering Short ${i + 1} of ${clips.length}…`);
    try {
      const meta = await probe(src.file);
      if (!meta.width || !meta.height) throw new Error("The downloaded file has no video stream");
      let duration = c.end - c.start;
      if (src.offset === 0 && meta.duration && meta.duration < duration) duration = meta.duration;

      // Where to crop: ask Claude to find the subject, else centre.
      let focusX = 0.5;
      const wide = meta.width / meta.height > OUT_RATIO + 0.02;
      if (options.layout === "fill" && wide && options.aiFraming && config.hasClaude) {
        try {
          const frames = await extractFrames(
            src.file,
            [0.15, 0.5, 0.85].map((f) => src.offset + duration * f),
            path.join(dir, `${c.id}-frame`),
          );
          const fx = await findFocusWithClaude(frames, info.title);
          if (fx !== null) focusX = fx;
          frames.forEach((f) => fs.rmSync(f, { force: true }));
          log(id, `Clip ${i + 1}: AI framing centred at ${Math.round(focusX * 100)}% of the width.`);
        } catch (err) {
          log(id, `Clip ${i + 1}: AI framing skipped (${(err as Error).message.slice(0, 120)}).`);
        }
      }

      const clipWords = wordsInRange(words, c.start, c.start + duration);
      const ass =
        options.captionStyle !== "none" || options.hookOverlay
          ? buildAss({
              words: options.captionStyle === "none" ? [] : clipWords,
              duration,
              style: options.captionStyle,
              layout: options.layout,
              hook: options.hookOverlay ? c.hook : undefined,
              font: config.captionFont,
            })
          : null;
      const assFile = ass ? path.join(dir, `${c.id}.ass`) : null;
      if (assFile) fs.writeFileSync(assFile, ass!);

      const output = path.join(dir, `${c.id}.mp4`);
      await renderShort({
        input: src.file,
        offset: src.offset,
        duration,
        output,
        assFile,
        layout: options.layout,
        focusX,
        src: meta,
        onProgress: (p) => progress(id, "render", base + (p / 100) * span * 0.95),
      });
      const thumb = path.join(dir, `${c.id}.jpg`);
      await makeThumbnail(output, Math.min(duration * 0.35, 4), thumb).catch(() => undefined);
      const size = fs.statSync(output).size;
      setClip(id, c.id, (x) => {
        x.status = "done";
        x.focusX = focusX;
        x.end = x.start + duration;
        x.file = path.basename(output);
        x.thumb = fs.existsSync(thumb) ? path.basename(thumb) : undefined;
        x.sizeBytes = size;
      });
      ok++;
      log(id, `Clip ${i + 1} ready: "${c.title}" (${duration.toFixed(1)}s)`);
    } catch (err) {
      const msg = (err as Error).message;
      setClip(id, c.id, (x) => {
        x.status = "error";
        x.error = msg.slice(0, 300);
      });
      log(id, `Clip ${i + 1} failed: ${msg}`);
    } finally {
      if (src.offset === 0) fs.rmSync(src.file, { force: true });
    }
  }
  if (full) fs.rmSync(full, { force: true });
  if (!ok) throw new Error("Every clip failed to render. See the log for details.");
  stage(id, "render", "done", `${ok} Short${ok === 1 ? "" : "s"} ready`);
  updateJob(id, (j) => {
    j.status = "done";
    j.progress = 100;
    j.message = `${ok} Short${ok === 1 ? "" : "s"} ready to post`;
  });
}

const OUT_RATIO = 9 / 16;
