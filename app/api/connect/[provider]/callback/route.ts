import { NextRequest, NextResponse } from "next/server";
import { metaConnect } from "@/lib/platforms/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONNECT: Record<string, (code: string) => Promise<void>> = { meta: metaConnect };

/** Meta redirects here after the user approves (or cancels) access. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const connect = CONNECT[provider];
  if (!connect) return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  const q = req.nextUrl.searchParams;
  const back = req.cookies.get(`oauth_return_${provider}`)?.value || "/settings";
  const returnTo = back.startsWith("/") && !back.startsWith("//") ? back : "/settings";
  const done = (error?: string) => {
    const url = new URL(returnTo, req.url);
    url.searchParams.set("connect", provider);
    if (error) url.searchParams.set("connect_error", error.slice(0, 300));
    const res = NextResponse.redirect(url);
    res.cookies.delete(`oauth_state_${provider}`);
    res.cookies.delete(`oauth_return_${provider}`);
    return res;
  };

  const denied = q.get("error");
  if (denied) return done(q.get("error_description") || q.get("error_reason") || (denied === "access_denied" ? "Access was not granted." : denied));
  const state = q.get("state");
  if (!state || state !== req.cookies.get(`oauth_state_${provider}`)?.value) {
    return done("The sign-in link expired. Please try connecting again.");
  }
  const code = q.get("code");
  if (!code) return done("No authorization code was returned.");
  try {
    await connect(code);
    return done();
  } catch (err) {
    return done((err as Error).message);
  }
}
