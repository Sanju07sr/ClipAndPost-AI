import { NextResponse } from "next/server";
import { z } from "zod";
import { loadAccount } from "@/lib/google";
import { queueUploads } from "@/lib/publish";
import { getJob, JOB_ID_RE } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  items: z
    .array(
      z.object({
        clipId: z.string().regex(/^c\d{1,2}$/),
        title: z.string().trim().min(1, "Every Short needs a title").max(100, "Titles can be at most 100 characters"),
        description: z.string().max(4500),
        hashtags: z.array(z.string().max(60)).max(15),
        privacy: z.enum(["public", "unlisted", "private"]),
      }),
    )
    .min(1)
    .max(10),
});

/** Queues the selected clips for upload to the connected YouTube channel. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = JOB_ID_RE.test(id) ? getJob(id) : undefined;
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!loadAccount()) return NextResponse.json({ error: "Connect your YouTube account first." }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400 });
  for (const item of parsed.data.items) {
    const clip = job.clips.find((c) => c.id === item.clipId);
    if (!clip || clip.status !== "done") return NextResponse.json({ error: `Clip ${item.clipId} isn't ready` }, { status: 400 });
    if (clip.upload && (clip.upload.status === "queued" || clip.upload.status === "uploading"))
      return NextResponse.json({ error: `"${clip.title}" is already uploading` }, { status: 409 });
  }
  queueUploads(id, parsed.data.items);
  return NextResponse.json({ ok: true }, { status: 202 });
}
