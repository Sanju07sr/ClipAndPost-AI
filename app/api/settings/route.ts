import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAnthropicKey } from "@/lib/ai";
import { publicSettings, saveSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(publicSettings());
}

const Body = z.object({
  anthropicApiKey: z.string().max(300).optional(),
  googleClientId: z.string().max(300).optional(),
  googleClientSecret: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const body = parsed.data;

  const key = body.anthropicApiKey?.trim();
  if (key) {
    if (!key.startsWith("sk-ant-")) {
      return NextResponse.json({ error: "That isn't an Anthropic API key. Keys start with \"sk-ant-\"." }, { status: 400 });
    }
    const problem = await checkAnthropicKey(key);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  }
  const id = body.googleClientId?.trim();
  if (id && !id.endsWith(".apps.googleusercontent.com")) {
    return NextResponse.json(
      { error: "That doesn't look like a Google OAuth client ID. It ends with \".apps.googleusercontent.com\"." },
      { status: 400 },
    );
  }
  saveSettings(body);
  return NextResponse.json(publicSettings());
}
