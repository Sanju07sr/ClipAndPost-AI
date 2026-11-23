import { NextResponse } from "next/server";
import { z } from "zod";
import { createJob, listJobs } from "@/lib/store";
import { enqueue } from "@/lib/pipeline";
import { normalizeYouTubeUrl } from "@/lib/youtube";
import { DEFAULT_OPTIONS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  url: z.string().min(5).max(500),
  clipCount: z.number().int().min(1).max(10).default(DEFAULT_OPTIONS.clipCount),
  minDuration: z.number().min(10).max(170).default(DEFAULT_OPTIONS.minDuration),
  maxDuration: z.number().min(15).max(180).default(DEFAULT_OPTIONS.maxDuration),
  layout: z.enum(["fill", "fit"]).default(DEFAULT_OPTIONS.layout),
  aiFraming: z.boolean().default(DEFAULT_OPTIONS.aiFraming),
  captionStyle: z.enum(["bold", "karaoke", "minimal", "none"]).default(DEFAULT_OPTIONS.captionStyle),
  hookOverlay: z.boolean().default(DEFAULT_OPTIONS.hookOverlay),
  instructions: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400 });
  }
  const url = normalizeYouTubeUrl(parsed.data.url);
  if (!url) {
    return NextResponse.json({ error: "That doesn't look like a YouTube video link." }, { status: 400 });
  }
  const opts = parsed.data;
  if (opts.minDuration + 5 > opts.maxDuration) {
    return NextResponse.json({ error: "The maximum length must be at least 5 seconds above the minimum." }, { status: 400 });
  }
  const job = createJob({ ...opts, url });
  enqueue(job.id);
  return NextResponse.json({ id: job.id }, { status: 201 });
}

export async function GET() {
  const jobs = listJobs(12).map((j) => ({
    id: j.id,
    createdAt: j.createdAt,
    status: j.status,
    progress: j.progress,
    title: j.video?.title,
    thumbnail: j.video?.thumbnail,
    url: j.options.url,
    clips: j.clips.filter((c) => c.status === "done").length,
  }));
  return NextResponse.json({ jobs });
}
