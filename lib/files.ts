import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { getJob, jobDir, JOB_ID_RE } from "./store";

/** Resolve a finished clip's file (video or thumbnail) safely. */
export function clipFile(id: string, clipId: string, kind: "file" | "thumb") {
  if (!JOB_ID_RE.test(id) || !/^c\d{1,2}$/.test(clipId)) return null;
  const clip = getJob(id)?.clips.find((c) => c.id === clipId);
  const name = clip?.[kind];
  if (!clip || !name) return null;
  const file = path.join(jobDir(id), path.basename(name));
  return fs.existsSync(file) ? { clip, file } : null;
}

/** Serve a file with HTTP Range support so browsers can seek in videos. */
export function sendFile(req: Request, file: string, type: string, extra: Record<string, string> = {}) {
  const size = fs.statSync(file).size;
  const range = req.headers.get("range");
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    ...extra,
  };
  const m = range?.match(/bytes=(\d*)-(\d*)/);
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
}

export function slug(text: string) {
  return (
    text
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase()
      .slice(0, 60) || "short"
  );
}
