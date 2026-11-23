import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { config } from "./config";
import { run } from "./exec";
import { drawAvatarWithClaude } from "./ai";

// Turns an uploaded photo into a round avatar badge (PNG with transparency)
// that the renderer overlays on every Short.

export type AvatarStyle = "ai" | "cartoon" | "photo";

export const AVATAR_DIR = () => path.join(config.dataDir, "avatar");
export const AVATAR_FILE = () => path.join(AVATAR_DIR(), "avatar.png");
const BADGE = 400;

export function hasAvatar() {
  return fs.existsSync(AVATAR_FILE());
}

export function avatarInfo(): { exists: boolean; style?: AvatarStyle; updatedAt?: number } {
  if (!hasAvatar()) return { exists: false };
  let style: AvatarStyle | undefined;
  try {
    style = JSON.parse(fs.readFileSync(path.join(AVATAR_DIR(), "meta.json"), "utf8")).style;
  } catch {}
  return { exists: true, style, updatedAt: Math.round(fs.statSync(AVATAR_FILE()).mtimeMs) };
}

export function deleteAvatar() {
  fs.rmSync(AVATAR_DIR(), { recursive: true, force: true });
}

/** Decode any common photo (incl. HEIC via ffmpeg) into a square, face-focused PNG. */
async function normalise(input: Buffer, work: string): Promise<Buffer> {
  let img: sharp.Sharp;
  try {
    await sharp(input).metadata();
    img = sharp(input);
  } catch {
    // sharp can't read it (e.g. HEIC from an iPhone): let ffmpeg convert it.
    const src = path.join(work, "upload.bin");
    const out = path.join(work, "upload.png");
    fs.writeFileSync(src, input);
    try {
      await run(config.ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", src, "-frames:v", "1", out]);
    } catch {
      throw new Error("Couldn't read that image. Please use a JPG or PNG photo.");
    }
    img = sharp(fs.readFileSync(out));
  }
  return img
    .rotate() // respect phone camera orientation
    .resize(768, 768, { fit: "cover", position: sharp.strategy.attention })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
}

/** Cartoon look with ffmpeg: smooth skin, flatten colours, add ink outlines. */
async function cartoonise(png: Buffer, work: string): Promise<Buffer> {
  const src = path.join(work, "base.png");
  const out = path.join(work, "cartoon.png");
  fs.writeFileSync(src, png);
  const q = (c: string) => `floor(${c}/40)*40+20`;
  await run(config.ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    src,
    "-filter_complex",
    [
      "[0:v]format=rgb24,split[a][b]",
      `[a]bilateral=sigmaS=10:sigmaR=0.12,bilateral=sigmaS=10:sigmaR=0.12,eq=saturation=1.35:contrast=1.06,lutrgb=r='${q("val")}':g='${q("val")}':b='${q("val")}'[flat]`,
      "[b]format=gray,gblur=sigma=1.2,edgedetect=low=0.08:high=0.2,negate,format=rgb24[ink]",
      "[flat][ink]blend=all_mode=multiply",
    ].join(";"),
    "-frames:v",
    "1",
    out,
  ]);
  return fs.readFileSync(out);
}

/** Remove anything in the SVG that could load files or run code before rasterising. */
function sanitiseSvg(svg: string): string {
  const m = svg.match(/<svg[\s\S]*<\/svg>/i);
  if (!m) throw new Error("Claude didn't return an SVG");
  return m[0]
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<(image|foreignObject|use)\b[\s\S]*?(\/>|<\/\1>)/gi, "")
    .replace(/\s(href|xlink:href)\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/url\(\s*['"]?(?!#)[^)]*\)/gi, "none");
}

/** Round badge with a gradient ring. */
async function toBadge(img: Buffer): Promise<Buffer> {
  const inner = BADGE - 28;
  const face = await sharp(img)
    .resize(inner, inner, { fit: "cover" })
    .composite([
      {
        input: Buffer.from(`<svg width="${inner}" height="${inner}"><circle cx="${inner / 2}" cy="${inner / 2}" r="${inner / 2}" fill="#fff"/></svg>`),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();
  const ring = Buffer.from(`<svg width="${BADGE}" height="${BADGE}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b5cf6"/><stop offset="0.55" stop-color="#ec4899"/><stop offset="1" stop-color="#fb923c"/>
    </linearGradient></defs>
    <circle cx="${BADGE / 2}" cy="${BADGE / 2}" r="${BADGE / 2}" fill="url(#g)"/>
    <circle cx="${BADGE / 2}" cy="${BADGE / 2}" r="${BADGE / 2 - 8}" fill="#ffffff"/>
  </svg>`);
  return sharp(ring)
    .composite([{ input: face, left: 14, top: 14 }])
    .png()
    .toBuffer();
}

export async function createAvatar(input: Buffer, style: AvatarStyle): Promise<{ style: AvatarStyle; note?: string }> {
  const work = fs.mkdtempSync(path.join(config.dataDir, "avatar-work-"));
  try {
    const base = await normalise(input, work);
    let art = base;
    let used: AvatarStyle = style;
    let note: string | undefined;
    if (style === "ai") {
      if (!config.hasClaude) {
        used = "cartoon";
        note = "AI avatars need your Anthropic API key, so a cartoon avatar was made instead.";
      } else {
        try {
          const svg = sanitiseSvg(await drawAvatarWithClaude(base));
          art = await sharp(Buffer.from(svg), { density: 144 }).resize(768, 768).png().toBuffer();
        } catch (err) {
          used = "cartoon";
          note = `The AI avatar didn't work (${(err as Error).message.slice(0, 120)}), so a cartoon avatar was made instead.`;
        }
      }
    }
    if (used === "cartoon") art = await cartoonise(base, work);

    const badge = await toBadge(art);
    fs.mkdirSync(AVATAR_DIR(), { recursive: true });
    fs.writeFileSync(path.join(AVATAR_DIR(), "avatar.png.tmp"), badge);
    fs.renameSync(path.join(AVATAR_DIR(), "avatar.png.tmp"), AVATAR_FILE());
    fs.writeFileSync(path.join(AVATAR_DIR(), "meta.json"), JSON.stringify({ style: used }));
    return { style: used, note };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}
