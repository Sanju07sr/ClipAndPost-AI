import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { googleConfigured, loadAccount } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const account = loadAccount();
  return NextResponse.json({
    configured: googleConfigured(),
    connected: Boolean(account),
    channel: account?.channel ?? null,
    redirectUri: config.googleRedirectUri,
  });
}
