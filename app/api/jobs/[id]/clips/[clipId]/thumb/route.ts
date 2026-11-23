import { clipFile, sendFile } from "@/lib/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string; clipId: string }> }) {
  const { id, clipId } = await params;
  const found = clipFile(id, clipId, "thumb");
  if (!found) return new Response("Not found", { status: 404 });
  return sendFile(req, found.file, "image/jpeg");
}
