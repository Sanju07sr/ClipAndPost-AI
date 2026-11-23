import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { config } from "./config";
import type { ClipPlan, JobOptions, VideoInfo } from "./types";

// Claude does two jobs here: choosing the best moments from the transcript,
// and (optionally) looking at frames to decide where to crop for 9:16.

let client: { key: string; sdk: Anthropic } | null = null;
function anthropic() {
  // The key can change at runtime from the Settings page, so rebuild the
  // client when it does. With no key, the SDK falls back to ANTHROPIC_AUTH_TOKEN.
  const key = config.anthropicApiKey;
  if (!client || client.key !== key) {
    client = { key, sdk: new Anthropic({ maxRetries: 3, ...(key ? { apiKey: key } : {}) }) };
  }
  return client.sdk;
}

/** Checks a key with a free API call. Returns an error message, or null if it works. */
export async function checkAnthropicKey(apiKey: string): Promise<string | null> {
  try {
    await new Anthropic({ apiKey, maxRetries: 1, timeout: 20_000 }).models.retrieve(config.claudeModel);
    return null;
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return "Anthropic rejected this key. Check that you copied all of it.";
    if (err instanceof Anthropic.PermissionDeniedError) return "This key doesn't have access to the API. Check your Anthropic console.";
    if (err instanceof Anthropic.NotFoundError) return null; // key works; model id just isn't listed for it
    if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach Anthropic to check the key. Check your internet connection.";
    return (err as Error).message;
  }
}

// Server-side fallback: if a request is declined, the API re-runs it on a
// fallback model instead of failing the job.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

const MomentsSchema = z.object({
  clips: z.array(
    z.object({
      start: z.number().describe("Start time in seconds, taken from the transcript timestamps"),
      end: z.number().describe("End time in seconds"),
      title: z.string().describe("Short, punchy YouTube Shorts title, under 70 characters"),
      hook: z.string().describe("2-6 word on-screen hook shown in the first seconds"),
      reason: z.string().describe("One sentence on why this moment works as a Short"),
      description: z.string().describe("1-2 sentence YouTube description for the Short"),
      hashtags: z.array(z.string()).describe("3-6 relevant hashtags without the # sign"),
      score: z.number().describe("Virality score from 0 to 100"),
    }),
  ),
});

const SYSTEM = `You are a senior short-form video editor who turns long YouTube videos into viral YouTube Shorts.

You receive a timestamped transcript. Each line is "[start-end] text" with times in seconds.

Choose the strongest self-contained moments. A great Short:
- opens with a hook in the first 2 seconds (a bold claim, a question, a surprising fact, a punchline setup, strong emotion)
- makes sense without the rest of the video: no dangling "as I said earlier", no missing context
- has a payoff: an answer, a twist, a laugh, a useful insight or a quotable line
- starts at the beginning of a sentence and ends after a complete thought, never mid-sentence

Rules:
- Use only timestamps that appear in the transcript. Start at a line's start time and end at a line's end time.
- Respect the requested duration range exactly.
- Clips must not overlap.
- Rank by how well they would perform as Shorts; the score is your honest estimate (most moments are 50-85; reserve 90+ for exceptional ones).
- Write titles, hooks and descriptions in the same language as the transcript.`;

export async function pickMomentsWithClaude(
  transcript: string,
  video: VideoInfo,
  opts: JobOptions,
): Promise<ClipPlan[]> {
  const ask = Math.min(10, opts.clipCount + 2); // a few extras survive snapping/overlap filtering
  const user = `Video title: ${video.title}
Channel: ${video.channel}
Video length: ${Math.round(video.duration)} seconds

Find the ${ask} best moments for YouTube Shorts.
Each clip must be between ${opts.minDuration} and ${opts.maxDuration} seconds long.${
    opts.instructions?.trim()
      ? `\n\nCreator's guidance (follow it when choosing moments):\n<guidance>${opts.instructions.trim().slice(0, 500)}</guidance>`
      : ""
  }

<transcript>
${transcript}
</transcript>`;

  const res = await anthropic().beta.messages.parse({
    model: config.claudeModel,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: config.claudeEffort, format: betaZodOutputFormat(MomentsSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude declined to analyse this transcript");
  if (res.stop_reason === "max_tokens") throw new Error("Claude's answer was cut off");
  const out = res.parsed_output;
  if (!out) throw new Error("Claude returned an unreadable answer");
  return out.clips.map((c) => ({
    ...c,
    hashtags: c.hashtags.map((h) => h.replace(/^#/, "").replace(/\s+/g, "")).filter(Boolean).slice(0, 8),
    score: Math.max(0, Math.min(100, Math.round(c.score))),
  }));
}

const FramingSchema = z.object({
  focus_x: z
    .number()
    .describe("Horizontal centre of the main subject as a fraction of frame width: 0 = left edge, 1 = right edge"),
  subject: z.string().describe("A few words naming the subject you centred on"),
});

/**
 * Ask Claude where the main subject (usually the speaker's face) sits in a
 * few frames from the clip, so the 9:16 crop follows them.
 */
export async function findFocusWithClaude(framePaths: string[], title: string): Promise<number | null> {
  const images = framePaths
    .filter((p) => fs.existsSync(p))
    .map((p) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: "image/jpeg" as const, data: fs.readFileSync(p).toString("base64") },
    }));
  if (!images.length) return null;
  const res = await anthropic().beta.messages.parse({
    model: config.claudeModel,
    max_tokens: 4000,
    ...FALLBACK,
    output_config: { effort: "low", format: betaZodOutputFormat(FramingSchema) },
    messages: [
      {
        role: "user",
        content: [
          ...images,
          {
            type: "text",
            text: `These frames come from one moment of the video "${title}". It will be cropped to a vertical 9:16 Short, keeping only a narrow vertical strip. Where should that strip be centred so the main subject (the person speaking, or the key action if nobody is on screen) stays in view across these frames?`,
          },
        ],
      },
    ],
  });
  const x = res.parsed_output?.focus_x;
  if (res.stop_reason === "refusal" || typeof x !== "number" || !Number.isFinite(x)) return null;
  return Math.max(0, Math.min(1, x));
}

const PublishSchema = z.object({
  title: z.string().describe("YouTube Shorts title, 40-90 characters, no hashtags"),
  description: z.string().describe("2-4 short lines: a hook line, what the viewer gets, a soft call to action. No hashtags."),
  hashtags: z
    .array(z.string())
    .describe("4-7 hashtags without the # sign, most important first; the first three show above the title"),
});

/** Writes upload-ready Shorts metadata, preferring hashtags that are trending on YouTube right now. */
export async function writePublishMetaWithClaude(input: {
  videoTitle: string;
  channel: string;
  clip: ClipPlan;
  transcript: string;
  trending: string[];
}): Promise<{ title: string; description: string; hashtags: string[] }> {
  const trending = input.trending.length
    ? `Hashtags used most by the most-viewed Shorts on this topic in the last 14 days (most popular first):\n${input.trending.map((t) => `#${t}`).join(" ")}`
    : "No live trending data is available; choose hashtags people actually search for on this topic.";
  const res = await anthropic().beta.messages.parse({
    model: config.claudeModel,
    max_tokens: 4000,
    ...FALLBACK,
    output_config: { effort: "low", format: betaZodOutputFormat(PublishSchema) },
    system: `You write YouTube Shorts metadata that gets clicks and search traffic without being misleading.
- Title: curiosity or a clear payoff, front-load the key words, sentence case, no clickbait lies, no hashtags.
- Description: short and skimmable, in the same language as the clip.
- Hashtags: mix 2-3 trending hashtags that genuinely fit this clip with 2-3 specific topic hashtags. Never use a trending hashtag that is unrelated to the clip. Do not include #shorts (it is added automatically).`,
    messages: [
      {
        role: "user",
        content: `Original video: "${input.videoTitle}" by ${input.channel}

Clip draft title: ${input.clip.title}
Clip hook: ${input.clip.hook}
Why it works: ${input.clip.reason}

<clip_transcript>
${input.transcript || "(no transcript)"}
</clip_transcript>

${trending}`,
      },
    ],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("Claude couldn't write the metadata");
  return res.parsed_output;
}

/**
 * Draws a flat, illustrated avatar of the person in the photo as SVG code.
 * Claude describes the likeness with simple vector shapes; the caller
 * sanitises and rasterises the SVG.
 */
export async function drawAvatarWithClaude(photoPng: Buffer): Promise<string> {
  const res = await anthropic().beta.messages.create({
    model: config.claudeModel,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: "medium" },
    system: `You are an illustrator who draws friendly, modern flat-vector avatars (the style of a polished app profile picture).
Reply with a single complete SVG document and nothing else: no markdown fences, no commentary.`,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: photoPng.toString("base64") } },
          {
            type: "text",
            text: `Draw a head-and-shoulders avatar of this person as an SVG with viewBox="0 0 512 512" width="512" height="512".

Capture their likeness with simple shapes: face shape, skin tone, hair style and colour, eyebrows, eye colour, any glasses, beard or moustache, earrings or hats, and the colour and neckline of their clothing. Give them a warm, friendly expression.

Style rules:
- Flat colours with at most subtle linear or radial gradients; clean, smooth curves (use paths, not pixel-like shapes).
- Fill the whole 512x512 square: a soft gradient background, the head roughly centred and large (face about 45% of the width), shoulders reaching the bottom edge.
- No text, no <image>, <script>, <foreignObject>, external references or filters.`,
          },
        ],
      },
    ],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude declined to draw this photo");
  if (res.stop_reason === "max_tokens") throw new Error("the drawing was cut off");
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  if (!/<svg[\s\S]*<\/svg>/i.test(text)) throw new Error("no SVG in the reply");
  return text;
}
