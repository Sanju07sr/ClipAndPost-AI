import { NextResponse } from "next/server";
import { z } from "zod";
import { metaSelectPage } from "@/lib/platforms/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Choose which Facebook Page (and its linked Instagram account) to post to. */
export async function POST(req: Request) {
  const body = z.object({ pageId: z.string().min(1).max(40) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    metaSelectPage(body.data.pageId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
