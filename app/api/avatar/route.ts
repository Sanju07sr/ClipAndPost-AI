import { NextResponse } from "next/server";
import { avatarInfo, createAvatar, deleteAvatar, type AvatarStyle } from "@/lib/avatar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 15 * 1024 * 1024;

export async function GET() {
  return NextResponse.json(avatarInfo());
}

/** Upload a photo (multipart field "photo") and turn it into an avatar badge. */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Please choose a photo to upload." }, { status: 400 });
  }
  const file = form.get("photo");
  const style = String(form.get("style") || "cartoon") as AvatarStyle;
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Please choose a photo to upload." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That photo is over 15 MB. Please use a smaller one." }, { status: 413 });
  if (!["ai", "cartoon", "photo"].includes(style)) return NextResponse.json({ error: "Unknown avatar style" }, { status: 400 });
  try {
    const result = await createAvatar(Buffer.from(await file.arrayBuffer()), style);
    return NextResponse.json({ ...avatarInfo(), ...result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE() {
  deleteAvatar();
  return NextResponse.json({ exists: false });
}
