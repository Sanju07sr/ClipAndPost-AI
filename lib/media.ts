import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { run } from "./exec";
import type { Layout } from "./types";

export const OUT_W = 1080;
export const OUT_H = 1920;

export interface Probe {
  width: number;
  height: number;
  duration: number;
  hasAudio: boolean;
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

/**
 * Cut [offset, offset+duration] out of `input`, reframe to 1080x1920, burn the
 * captions and normalise loudness for Shorts (-14 LUFS).
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
  onProgress?: (pct: number) => void;
}): Promise<void> {
  const cwd = path.dirname(opts.output);
  let vf = videoFilter(opts.layout, opts.src, opts.focusX);
  vf += ",setsar=1,format=yuv420p";
  if (opts.assFile) {
    // Relative file name + cwd avoids filter-path escaping issues.
    const fontsdir = config.fontsDir ? `:fontsdir=${config.fontsDir.replace(/[:\\']/g, "\\$&")}` : "";
    vf += `,ass=${path.basename(opts.assFile)}${fontsdir}`;
  }
  const args = [
    "-hide_banner",
    "-y",
    "-ss",
    opts.offset.toFixed(3),
    "-t",
    opts.duration.toFixed(3),
    "-i",
    opts.input,
    "-filter_complex",
    `[0:v]${vf}[v]`,
    "-map",
    "[v]",
  ];
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
