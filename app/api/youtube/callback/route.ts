import { NextRequest, NextResponse } from "next/server";
import { connectWithCode } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Google redirects here after the user approves (or cancels) access. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const back = req.cookies.get("yt_oauth_return")?.value || "/";
  const returnTo = back.startsWith("/") && !back.startsWith("//") ? back : "/";
  const done = (status: string, message?: string) => {
    const url = new URL(returnTo, req.url);
    url.searchParams.set("youtube", status);
    if (message) url.searchParams.set("youtube_error", message.slice(0, 200));
    const res = NextResponse.redirect(url);
    res.cookies.delete("yt_oauth_state");
    res.cookies.delete("yt_oauth_return");
    return res;
  };

  if (params.get("error")) return done("error", params.get("error") === "access_denied" ? "Access was not granted." : params.get("error")!);
  const state = params.get("state");
  if (!state || state !== req.cookies.get("yt_oauth_state")?.value) {
    return done("error", "The sign-in link expired. Please try connecting again.");
  }
  const code = params.get("code");
  if (!code) return done("error", "Google didn't send an authorization code.");
  try {
    await connectWithCode(code);
    return done("connected");
  } catch (err) {
    return done("error", (err as Error).message);
  }
}
