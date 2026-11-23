import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { run } from "@/lib/exec";
import { ffmpegHasAss } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function version(cmd: string, args: string[]) {
  try {
    const { stdout } = await run(cmd, args, { timeoutMs: 10_000 });
    return stdout.split("\n")[0].trim();
  } catch {
    return null;
  }
}

export async function GET() {
  const [ytdlp, ffmpeg] = await Promise.all([
    version(config.ytdlp, ["--version"]),
    version(config.ffmpeg, ["-version"]),
  ]);
  return NextResponse.json({
    ytdlp,
    ffmpeg: ffmpeg?.replace(/ Copyright.*/, "") ?? null,
    claude: config.hasClaude,
    captions: ffmpeg ? await ffmpegHasAss() : null,
    model: config.hasClaude ? config.claudeModel : null,
    ok: Boolean(ytdlp && ffmpeg),
  });
}
