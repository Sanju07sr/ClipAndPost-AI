import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { metaAuthUrl, metaConfigured } from "@/lib/platforms/meta";
import { tiktokAuthUrl, tiktokConfigured } from "@/lib/platforms/tiktok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDERS = {
  meta: { configured: metaConfigured, authUrl: metaAuthUrl },
  tiktok: { configured: tiktokConfigured, authUrl: tiktokAuthUrl },
};

/** Sends the browser to Meta's or TikTok's login/consent screen. */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const p = PROVIDERS[provider as keyof typeof PROVIDERS];
  const back = new URL(req.url).searchParams.get("returnTo") || "/settings";
  const returnTo = back.startsWith("/") && !back.startsWith("//") ? back : "/settings";
  if (!p) return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  if (!p.configured()) return NextResponse.redirect(new URL(`/settings?connect=${provider}&connect_error=not-configured`, req.url));
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(p.authUrl(state));
  const cookie = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 600 };
  res.cookies.set(`oauth_state_${provider}`, state, cookie);
  res.cookies.set(`oauth_return_${provider}`, returnTo, cookie);
  return res;
}
