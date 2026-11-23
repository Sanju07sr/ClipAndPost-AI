import type { ClipPlan, JobOptions } from "./types";
import type { Segment } from "./transcript";

/**
 * Snap a proposed clip to sentence boundaries and enforce the duration range,
 * so clips never start or end mid-word.
 */
export function snapToSegments(
  plan: ClipPlan,
  segs: Segment[],
  opts: Pick<JobOptions, "minDuration" | "maxDuration">,
  videoDuration: number,
): ClipPlan | null {
  if (!segs.length) return clampOnly(plan, opts, videoDuration);
  // Start: the segment whose start is closest to the proposed start.
  let si = 0;
  let best = Infinity;
  segs.forEach((s, i) => {
    const d = Math.abs(s.start - plan.start);
    if (d < best) {
      best = d;
      si = i;
    }
  });
  if (best > 8) return clampOnly(plan, opts, videoDuration);
  const start = segs[si].start;
  // End: the last segment ending at or before the proposed end, then fix duration.
  let ei = si;
  for (let i = si; i < segs.length; i++) {
    if (segs[i].end <= plan.end + 1.5) ei = i;
    else break;
  }
  while (ei > si && segs[ei].end - start > opts.maxDuration) ei--;
  while (ei < segs.length - 1 && segs[ei].end - start < opts.minDuration && segs[ei + 1].end - start <= opts.maxDuration) ei++;
  let end = segs[ei].end;
  // A single very long line: cut inside it rather than exceed the maximum.
  if (end - start > opts.maxDuration) end = start + opts.maxDuration;
  if (end - start < Math.min(opts.minDuration, 8) * 0.75) return null;
  return {
    ...plan,
    start: Math.max(0, start - 0.12),
    end: Math.min(videoDuration || Infinity, end + 0.3),
  };
}

function clampOnly(plan: ClipPlan, opts: Pick<JobOptions, "minDuration" | "maxDuration">, videoDuration: number) {
  const start = Math.max(0, plan.start);
  let end = Math.min(plan.end, start + opts.maxDuration);
  if (end - start < opts.minDuration) end = start + opts.minDuration;
  if (videoDuration) end = Math.min(end, videoDuration);
  if (end - start < 5) return null;
  return { ...plan, start, end };
}

/** Keep the highest-scoring clips that don't overlap each other. */
export function dedupe(plans: ClipPlan[], count: number): ClipPlan[] {
  const kept: ClipPlan[] = [];
  for (const p of [...plans].sort((a, b) => b.score - a.score)) {
    const overlaps = kept.some((k) => Math.min(k.end, p.end) - Math.max(k.start, p.start) > 2);
    if (!overlaps) kept.push(p);
    if (kept.length >= count) break;
  }
  return kept;
}

const HOOK_WORDS =
  /\b(secret|never|always|mistake|why|how|truth|crazy|insane|best|worst|nobody|everyone|stop|wrong|actually|money|million|biggest|first|last|shocking|important|hack|tip|problem|wait|imagine|literally|honestly|seriously)\b/i;

/**
 * Score windows without AI: speech density, hook words, questions,
 * exclamations and audio energy. Used when no Claude credentials are set.
 */
export function pickMomentsHeuristic(
  segs: Segment[],
  loudness: number[] | null,
  opts: JobOptions,
  videoDuration: number,
  title: string,
): ClipPlan[] {
  const target = Math.min(opts.maxDuration, Math.max(opts.minDuration, (opts.minDuration + opts.maxDuration) / 2));
  const loudAt = (a: number, b: number) => {
    if (!loudness?.length) return 0;
    const xs = loudness.slice(Math.floor(a), Math.ceil(b)).filter(Number.isFinite);
    return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
  };
  const loudMean = loudness?.length ? loudAt(0, loudness.length) : 0;
  const candidates: ClipPlan[] = [];

  if (segs.length) {
    for (let i = 0; i < segs.length; i++) {
      let j = i;
      while (j < segs.length - 1 && segs[j + 1].end - segs[i].start <= target) j++;
      const start = segs[i].start;
      const end = segs[j].end;
      const dur = end - start;
      if (dur < opts.minDuration * 0.9) continue;
      const text = segs.slice(i, j + 1).map((s) => s.text).join(" ");
      const words = text.split(/\s+/).length;
      const density = words / dur; // ~2.5 words/s is lively speech
      const opener = segs[i].text;
      let score = 40 + Math.min(20, density * 6);
      if (HOOK_WORDS.test(opener)) score += 12;
      if (/\?/.test(opener)) score += 8;
      score += Math.min(10, (text.match(/[!?]/g) || []).length * 2);
      score += Math.min(10, (text.match(HOOK_WORDS) || []).length * 2);
      if (loudness?.length) score += Math.max(-8, Math.min(12, (loudAt(start, end) - loudMean) * 1.5));
      if (/^(and|but|so|because|which|that)\b/i.test(opener)) score -= 10; // needs earlier context
      candidates.push(makePlan(start, end, opener, Math.round(Math.max(0, Math.min(95, score))), title));
    }
  } else if (loudness?.length) {
    for (let start = 0; start + target <= (videoDuration || loudness.length); start += 5) {
      const lift = loudAt(start, start + target) - loudMean;
      candidates.push(
        makePlan(start, start + target, "", Math.round(Math.max(0, Math.min(90, 55 + lift * 4))), title),
      );
    }
  }
  return dedupe(candidates, opts.clipCount);
}

function makePlan(start: number, end: number, opener: string, score: number, title: string): ClipPlan {
  const sentence = opener.replace(/\s+/g, " ").trim();
  const words = sentence.split(" ").filter(Boolean);
  // Whole opening line when it fits a title, otherwise a clean word-boundary cut.
  let headline = sentence;
  if (headline.length > 70) headline = `${words.slice(0, 10).join(" ").replace(/[,;:.]$/, "")}…`;
  const nice = headline ? headline.charAt(0).toUpperCase() + headline.slice(1) : title.slice(0, 60);
  const hook = words.length <= 6 ? sentence : `${words.slice(0, 5).join(" ").replace(/[,;:.]$/, "")}…`;
  return {
    start,
    end,
    title: nice.length > 80 ? `${nice.slice(0, 77)}…` : nice,
    hook: hook || "Watch this",
    reason: opener
      ? "Lively, dense speech with a strong opening line."
      : "One of the most energetic stretches of audio in the video.",
    description: `${nice} — clipped from "${title}".`,
    hashtags: ["shorts", "viral", "clips"],
    score,
  };
}
