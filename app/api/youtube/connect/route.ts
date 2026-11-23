import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { authUrl, googleConfigured } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sends the browser to Google's consent screen. */
export async function GET(req: Request) {
  const back = new URL(req.url).searchParams.get("returnTo") || "/";
  const returnTo = back.startsWith("/") && !back.startsWith("//") ? back : "/";
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL(`${returnTo}?youtube=not-configured`, req.url));
  }
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authUrl(state));
  const cookie = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 600 };
  res.cookies.set("yt_oauth_state", state, cookie);
  res.cookies.set("yt_oauth_return", returnTo, cookie);
  return res;
}
