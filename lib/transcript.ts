import fs from "node:fs";

export interface Word {
  start: number;
  end: number;
  text: string;
}

export interface Segment {
  start: number;
  end: number;
  text: string;
  /** Index of the first word in the transcript's word list. */
  firstWord: number;
  lastWord: number;
}

interface Json3 {
  events?: {
    tStartMs?: number;
    dDurationMs?: number;
    segs?: { utf8?: string; tOffsetMs?: number }[];
  }[];
}

const NOISE = /^\[[^\]]*\]$|^\([^)]*\)$/; // [Music], (applause)

/**
 * Parse YouTube's json3 caption format into timed words. Auto captions carry
 * per-word offsets; manual captions only have per-line timing, so words are
 * spread across the line in proportion to their length.
 */
export function parseJson3(file: string): Word[] {
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as Json3;
  const words: Word[] = [];
  for (const ev of data.events || []) {
    if (!ev.segs || ev.tStartMs === undefined) continue;
    const evStart = ev.tStartMs / 1000;
    const evEnd = evStart + (ev.dDurationMs || 0) / 1000;
    const segs = ev.segs
      .map((s) => ({ text: (s.utf8 || "").replace(/\s+/g, " ").trim(), off: s.tOffsetMs }))
      .filter((s) => s.text);
    segs.forEach((seg, i) => {
      const segStart = evStart + (seg.off || 0) / 1000;
      const next = segs[i + 1];
      const segEnd = next?.off !== undefined ? evStart + next.off / 1000 : evEnd;
      const tokens = seg.text.split(" ").filter((t) => t && !NOISE.test(t));
      if (!tokens.length) return;
      const span = Math.max(0.05, segEnd - segStart);
      const totalChars = tokens.reduce((n, t) => n + t.length + 1, 0);
      let t = segStart;
      for (const tok of tokens) {
        const d = (span * (tok.length + 1)) / totalChars;
        words.push({ start: t, end: t + d, text: tok });
        t += d;
      }
    });
  }
  words.sort((a, b) => a.start - b.start);
  // Remove duplicates from rolling captions and tidy up the end times.
  const out: Word[] = [];
  for (const w of words) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.start - w.start) < 0.01 && prev.text === w.text) continue;
    if (prev && prev.end > w.start) prev.end = w.start;
    out.push({ ...w, end: Math.min(w.end, w.start + 1.5) });
  }
  return out;
}

/** Group words into sentence-like lines for the AI prompt and for snapping cut points. */
export function toSegments(words: Word[]): Segment[] {
  const segs: Segment[] = [];
  let first = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = words[i + 1];
    const count = i - first + 1;
    const endsSentence = /[.!?…]["')\]]?$/.test(w.text);
    const gap = next ? next.start - w.end : Infinity;
    if (!next || endsSentence || gap > 0.9 || count >= 22 || (count >= 12 && gap > 0.4)) {
      segs.push({
        start: words[first].start,
        end: w.end,
        text: words.slice(first, i + 1).map((x) => x.text).join(" "),
        firstWord: first,
        lastWord: i,
      });
      first = i + 1;
    }
  }
  return segs;
}

export function formatTime(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = Math.floor(s % 60);
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return `${h ? `${h}:` : ""}${mm}:${String(r).padStart(2, "0")}`;
}

/** Transcript text with timestamps in seconds, one line per segment. */
export function transcriptForPrompt(segs: Segment[]): string {
  return segs.map((s) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text}`).join("\n");
}

/** Words that fall inside [start, end], re-timed relative to `start`. */
export function wordsInRange(words: Word[], start: number, end: number): Word[] {
  return words
    .filter((w) => w.end > start + 0.05 && w.start < end - 0.05)
    .map((w) => ({
      text: w.text,
      start: Math.max(0, w.start - start),
      end: Math.min(end, w.end) - start,
    }));
}
