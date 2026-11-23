import { NextResponse } from "next/server";
import { metaDisconnect } from "@/lib/platforms/meta";
import { tiktokDisconnect } from "@/lib/platforms/tiktok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider === "meta") metaDisconnect();
  else if (provider === "tiktok") tiktokDisconnect();
  else return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
