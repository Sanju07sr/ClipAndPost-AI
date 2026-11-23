import fs from "node:fs";
import { AVATAR_FILE, hasAvatar } from "@/lib/avatar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasAvatar()) return new Response("No avatar", { status: 404 });
  return new Response(new Uint8Array(fs.readFileSync(AVATAR_FILE())), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
  });
}
