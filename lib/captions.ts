import type { CaptionStyle, Layout } from "./types";
import type { Word } from "./transcript";

// Builds an ASS subtitle file (rendered by ffmpeg/libass) with word-by-word
// animated captions in the style of popular Shorts.

const W = 1080;
const H = 1920;

interface StyleSpec {
  size: number;
  maxWords: number;
  maxChars: number;
  upper: boolean;
  primary: string; // ASS colour &HAABBGGRR
  highlight: string | null;
  outline: number;
  borderStyle: 1 | 3;
  back: string;
  pop: boolean;
}

const STYLES: Record<Exclude<CaptionStyle, "none">, StyleSpec> = {
  bold: {
    size: 92,
    maxWords: 3,
    maxChars: 18,
    upper: true,
    primary: "&H00FFFFFF",
    highlight: "&H0000E5FF", // warm yellow
    outline: 7,
    borderStyle: 1,
    back: "&H80000000",
    pop: true,
  },
  karaoke: {
    size: 80,
    maxWords: 5,
    maxChars: 26,
    upper: false,
    primary: "&H00FFFFFF",
    highlight: "&H0066FF33", // electric green
    outline: 6,
    borderStyle: 1,
    back: "&H80000000",
    pop: false,
  },
  minimal: {
    size: 62,
    maxWords: 7,
    maxChars: 34,
    upper: false,
    primary: "&H00FFFFFF",
    highlight: null,
    outline: 14,
    borderStyle: 3,
    back: "&H99000000",
    pop: false,
  },
};

function ts(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const cs = Math.round((r - Math.floor(r)) * 100);
  const whole = Math.floor(r) + (cs === 100 ? 1 : 0);
  return `${h}:${String(m).padStart(2, "0")}:${String(whole).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}

function clean(text: string): string {
  return text.replace(/[{}\\]/g, "").replace(/\s+/g, " ").trim();
}

function groupWords(words: Word[], spec: StyleSpec): Word[][] {
  const groups: Word[][] = [];
  let cur: Word[] = [];
  let chars = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = cur[cur.length - 1];
    const gap = prev ? w.start - prev.end : 0;
    if (cur.length && (cur.length >= spec.maxWords || chars + w.text.length > spec.maxChars || gap > 0.6)) {
      groups.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(w);
    chars += w.text.length + 1;
    if (/[.!?,;:]$/.test(w.text) && cur.length >= 2) {
      groups.push(cur);
      cur = [];
      chars = 0;
    }
  }
  if (cur.length) groups.push(cur);
  return groups;
}

export function buildAss(opts: {
  words: Word[];
  duration: number;
  style: CaptionStyle;
  layout: Layout;
  hook?: string;
  font: string;
}): string {
  const lines: string[] = [];
  const spec = opts.style === "none" ? null : STYLES[opts.style];
  // Fill: captions in the lower third. Fit: just under the letterboxed video.
  const marginV = opts.layout === "fill" ? 560 : 470;
  const font = opts.font;

  lines.push(
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
  );
  if (spec) {
    lines.push(
      `Style: Cap,${font},${spec.size},${spec.primary},${spec.primary},&H00000000,${spec.back},-1,0,0,0,100,100,0,0,${spec.borderStyle},${spec.outline},${spec.borderStyle === 1 ? 2 : 0},2,90,90,${marginV},1`,
    );
  }
  lines.push(
    `Style: Hook,${font},66,&H00111111,&H00111111,&H00FFFFFF,&H00FFFFFF,-1,0,0,0,100,100,0,0,3,22,0,8,110,110,250,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  );

  if (opts.hook?.trim()) {
    const end = Math.min(3.2, opts.duration);
    lines.push(
      `Dialogue: 2,${ts(0)},${ts(end)},Hook,,0,0,0,,{\\fad(150,250)\\fscx90\\fscy90\\t(0,180,\\fscx100\\fscy100)}${clean(opts.hook)}`,
    );
  }

  if (spec && opts.words.length) {
    const groups = groupWords(opts.words, spec);
    groups.forEach((g, gi) => {
      const nextStart = groups[gi + 1]?.[0].start ?? opts.duration;
      const groupEnd = Math.min(nextStart, g[g.length - 1].end + 0.45);
      const text = g.map((w) => clean(spec.upper ? w.text.toUpperCase() : w.text));
      if (!spec.highlight) {
        lines.push(`Dialogue: 1,${ts(g[0].start)},${ts(groupEnd)},Cap,,0,0,0,,{\\fad(60,60)}${text.join(" ")}`);
        return;
      }
      g.forEach((w, wi) => {
        const start = w.start;
        const end = wi < g.length - 1 ? g[wi + 1].start : groupEnd;
        if (end - start < 0.02) return;
        const body = text
          .map((t, ti) =>
            ti === wi
              ? `{\\c${spec.highlight}${opts.style === "karaoke" ? "\\fscx112\\fscy112" : ""}}${t}{\\c${spec.primary}\\fscx100\\fscy100}`
              : t,
          )
          .join(" ");
        const pop = spec.pop && wi === 0 ? "{\\fscx80\\fscy80\\t(0,90,\\fscx104\\fscy104)\\t(90,150,\\fscx100\\fscy100)}" : "";
        lines.push(`Dialogue: 1,${ts(start)},${ts(end)},Cap,,0,0,0,,${pop}${body}`);
      });
    });
  }
  return lines.join("\n") + "\n";
}
