import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { run } from "./exec";
import type { Layout, Look } from "./types";

export const OUT_W = 1080;
export const OUT_H = 1920;

export interface Probe {
  width: number;
  height: number;
  duration: number;
  hasAudio: boolean;
}

let assSupport: Promise<boolean> | null = null;

/**
 * Whether this ffmpeg was built with libass (needed to burn in captions).
 * Some builds, such as Homebrew's default ffmpeg, leave it out.
 */
export function ffmpegHasAss(): Promise<boolean> {
  assSupport ??= run(config.ffmpeg, ["-hide_banner", "-filters"], { timeoutMs: 15_000 })
    .then(({ stdout }) => /^\s*\S*\s+ass\s/m.test(stdout))
    .catch(() => {
      assSupport = null; // retry next time (ffmpeg may be installed later)
      return false;
    });
  return assSupport;
}

export async function probe(file: string): Promise<Probe> {
  const { stdout } = await run(config.ffprobe, [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,width,height:format=duration",
    "-of",
    "json",
    file,
  ]);
  const data = JSON.parse(stdout) as {
    streams?: { codec_type: string; width?: number; height?: number }[];
    format?: { duration?: string };
  };
  const v = data.streams?.find((s) => s.codec_type === "video");
  return {
    width: v?.width || 0,
    height: v?.height || 0,
    duration: Number(data.format?.duration || 0),
    hasAudio: Boolean(data.streams?.some((s) => s.codec_type === "audio")),
  };
}

/** RMS loudness (dB) for every second of audio. */
export async function loudnessPerSecond(file: string, workDir: string): Promise<number[]> {
  const out = path.join(workDir, "loudness.txt");
  await run(
    config.ffmpeg,
    [
      "-hide_banner",
      "-nostats",
      "-i",
      file,
      "-vn",
      "-af",
      `aresample=8000,asetnsamples=n=8000,astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.RMS_level:file=${path.basename(out)}`,
      "-f",
      "null",
      "-",
    ],
    { cwd: workDir, timeoutMs: 60 * 60_000 },
  );
  const values: number[] = [];
  for (const line of fs.readFileSync(out, "utf8").split("\n")) {
    const m = line.match(/RMS_level=(.+)$/);
    if (m) {
      const v = Number(m[1]);
      values.push(Number.isFinite(v) ? v : -90);
    }
  }
  return values;
}

/** Grab a few small frames for the AI framing step. */
export async function extractFrames(file: string, times: number[], outPrefix: string): Promise<string[]> {
  const paths: string[] = [];
  for (let i = 0; i < times.length; i++) {
    const p = `${outPrefix}-${i}.jpg`;
    try {
      await run(config.ffmpeg, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        times[i].toFixed(2),
        "-i",
        file,
        "-frames:v",
        "1",
        "-vf",
        "scale=640:-2",
        "-q:v",
        "4",
        p,
      ]);
      paths.push(p);
    } catch {
      /* a missing frame isn't fatal */
    }
  }
  return paths;
}

function videoFilter(layout: Layout, src: { width: number; height: number }, focusX: number): string {
  if (layout === "fit") {
    // Blurred, darkened copy of the frame behind the full, uncropped video.
    // Blurring at quarter resolution keeps this fast.
    return [
      "split=2[bgsrc][fgsrc]",
      `[bgsrc]scale=${OUT_W / 4}:${OUT_H / 4}:force_original_aspect_ratio=increase,crop=${OUT_W / 4}:${OUT_H / 4},boxblur=18:2,eq=brightness=-0.14:saturation=1.25,scale=${OUT_W}:${OUT_H}[bg]`,
      `[fgsrc]scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=decrease,setsar=1[fg]`,
      "[bg][fg]overlay=(W-w)/2:(H-h)/2",
    ].join(";");
  }
  // Fill: scale to cover 1080x1920 and crop a strip centred on the subject.
  const scale = Math.max(OUT_W / src.width, OUT_H / src.height);
  const sw = Math.round((src.width * scale) / 2) * 2;
  const sh = Math.round((src.height * scale) / 2) * 2;
  const x = Math.round(Math.max(0, Math.min(sw - OUT_W, focusX * sw - OUT_W / 2)));
  const y = Math.round((sh - OUT_H) / 2);
  return `scale=${sw}:${sh},crop=${OUT_W}:${OUT_H}:${x}:${Math.max(0, y)}`;
}

const LOOKS: Record<Exclude<Look, "none">, string> = {
  vivid: "eq=saturation=1.35:contrast=1.08",
  warm: "colorbalance=rs=0.08:gs=0.02:bs=-0.08:rm=0.05:bm=-0.05,eq=saturation=1.1",
  cool: "colorbalance=rs=-0.06:bs=0.08:bm=0.05,eq=saturation=1.05",
  bw: "hue=s=0,eq=contrast=1.15",
  cinematic: "eq=contrast=1.12:saturation=0.9,colorbalance=rs=-0.05:bs=0.06:rh=0.06:bh=-0.04,vignette=PI/5",
};

/**
 * Cut [offset, offset+duration] out of `input`, reframe to 1080x1920, apply
 * the look, zoom and progress bar, burn the captions, and normalise
 * loudness for Shorts (-14 LUFS).
 */
export async function renderShort(opts: {
  input: string;
  offset: number;
  duration: number;
  output: string;
  assFile: string | null;
  layout: Layout;
  focusX: number;
  src: Probe;
  look?: Look;
  zoom?: boolean;
  progressBar?: { color: string } | null;
  onProgress?: (pct: number) => void;
}): Promise<void> {
  const cwd = path.dirname(opts.output);
  const D = opts.duration.toFixed(3);
  const graph: string[] = [];

  let base = `[0:v]${videoFilter(opts.layout, opts.src, opts.focusX)},setsar=1`;
  if (opts.zoom) {
    // Slow push-in to 108% over the clip.
    base += `,scale=w='trunc(${OUT_W}*(1+0.08*t/${D})/2)*2':h=-2:eval=frame,crop=${OUT_W}:${OUT_H},setsar=1`;
  }
  if (opts.look && opts.look !== "none") base += `,${LOOKS[opts.look]}`;
  graph.push(`${base}[base]`);
  let last = "base";

  const inputs = ["-ss", opts.offset.toFixed(3), "-t", D, "-i", opts.input];
  if (opts.progressBar) {
    const c = /^#[0-9a-f]{6}$/i.test(opts.progressBar.color) ? `0x${opts.progressBar.color.slice(1)}` : "white";
    graph.push(`color=c=${c}@0.95:s=${OUT_W}x12:r=30:d=${D}[pb]`);
    graph.push(`[${last}][pb]overlay=x='-W+W*t/${D}':y=H-h[withpb]`);
    last = "withpb";
  }
  let tail = `[${last}]format=yuv420p`;
  if (opts.assFile) {
    // Relative file name + cwd avoids filter-path escaping issues.
    const fontsdir = config.fontsDir ? `:fontsdir=${config.fontsDir.replace(/[:\\']/g, "\\$&")}` : "";
    tail += `,ass=filename=${path.basename(opts.assFile)}${fontsdir}`;
  }
  graph.push(`${tail}[v]`);

  const args = ["-hide_banner", "-y", ...inputs, "-filter_complex", graph.join(";"), "-map", "[v]"];
  if (opts.src.hasAudio) {
    args.push("-map", "0:a:0", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "160k");
  }
  args.push(
    "-c:v",
    "libx264",
    "-preset",
    config.x264Preset,
    "-crf",
    "20",
    "-profile:v",
    "high",
    "-t",
    D,
    "-movflags",
    "+faststart",
    path.basename(opts.output),
  );
  await run(config.ffmpeg, args, {
    cwd,
    timeoutMs: 60 * 60_000,
    onLine: (line) => {
      const m = line.match(/time=(\d+):(\d+):([\d.]+)/);
      if (m && opts.onProgress) {
        const t = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
        opts.onProgress(Math.min(100, (t / opts.duration) * 100));
      }
    },
  });
}

export async function makeThumbnail(video: string, at: number, out: string) {
  await run(config.ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    at.toFixed(2),
    "-i",
    video,
    "-frames:v",
    "1",
    "-vf",
    "scale=540:-2",
    "-q:v",
    "3",
    out,
  ]);
}
