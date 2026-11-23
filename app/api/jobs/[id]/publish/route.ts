import { NextResponse } from "next/server";
import { z } from "zod";
import { allStatuses } from "@/lib/platforms";
import { PLATFORM_NAMES } from "@/lib/types";
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
  platforms: z.array(z.enum(["youtube", "instagram", "facebook"])).min(1, "Choose at least one platform").max(3),
});

/** Queues the selected clips for upload to the connected YouTube channel. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = JOB_ID_RE.test(id) ? getJob(id) : undefined;
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400 });
  const platforms = [...new Set(parsed.data.platforms)];
  const statuses = allStatuses().platforms;
  for (const p of platforms) {
    if (!statuses[p].connected) return NextResponse.json({ error: `Connect ${PLATFORM_NAMES[p]} first.` }, { status: 401 });
  }
  for (const item of parsed.data.items) {
    const clip = job.clips.find((c) => c.id === item.clipId);
    if (!clip || clip.status !== "done") return NextResponse.json({ error: `Clip ${item.clipId} isn't ready` }, { status: 400 });
    for (const p of platforms) {
      const u = clip.uploads?.[p];
      if (u && (u.status === "queued" || u.status === "uploading"))
        return NextResponse.json({ error: `"${clip.title}" is already uploading to ${PLATFORM_NAMES[p]}` }, { status: 409 });
    }
  }
  // Never post the same Short twice to a platform.
  const work = parsed.data.items
    .map((item) => {
      const clip = job.clips.find((c) => c.id === item.clipId)!;
      return { ...item, platforms: platforms.filter((p) => clip.uploads?.[p]?.status !== "published") };
    })
    .filter((item) => item.platforms.length);
  if (!work.length) return NextResponse.json({ error: "These Shorts are already published on the chosen platforms." }, { status: 409 });
  queueUploads(id, work);
  return NextResponse.json({ ok: true }, { status: 202 });
}
