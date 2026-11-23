import { NextResponse } from "next/server";
import { buildPublishMeta } from "@/lib/publish";
import { getJob, JOB_ID_RE } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generates (or regenerates) the YouTube title, description and trending hashtags for a clip. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; clipId: string }> }) {
  const { id, clipId } = await params;
  const clip = JOB_ID_RE.test(id) ? getJob(id)?.clips.find((c) => c.id === clipId) : undefined;
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  try {
    return NextResponse.json({ meta: await buildPublishMeta(id, clipId) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
