import { clipFile, sendFile, slug } from "@/lib/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string; clipId: string }> }) {
  const { id, clipId } = await params;
  const found = clipFile(id, clipId, "file");
  if (!found) return new Response("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.has("download");
  const extra: Record<string, string> = download
    ? { "Content-Disposition": `attachment; filename="${slug(found.clip.title)}-${found.clip.index}.mp4"` }
    : {};
  return sendFile(req, found.file, "video/mp4", extra);
}
