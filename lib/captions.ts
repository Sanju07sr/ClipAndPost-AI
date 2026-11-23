import type { CaptionPosition, CaptionStyle, Layout } from "./types";
import type { Word } from "./transcript";

// Builds an ASS subtitle file (rendered by ffmpeg/libass) with animated
// captions, the hook title card, the @handle and the end card.

const W = 1080;
const H = 1920;

type Mode =
  | "highlight" // whole group shown, active word coloured
  | "reveal" // words appear one by one, newest coloured
  | "single" // one word at a time
  | "plain"; // whole group, no highlight

interface StyleSpec {
  size: number;
  maxWords: number;
  maxChars: number;
  upper: boolean;
  /** Base text colour; "accent" uses the chosen highlight colour. */
  primary: "white" | "accent";
  mode: Mode;
  outline: number;
  outlineColour: "black" | "accent";
  shadow: number;
  borderStyle: 1 | 3;
  back: string;
  pop: boolean;
  /** Extra ASS override tags for every caption line. */
  extra?: string;
  /** Scale the active word up (in %). */
  grow?: number;
  /** Tilt alternate groups by this many degrees. */
  tilt?: number;
  /** Draw a soft coloured glow layer behind crisp text. */
  glow?: boolean;
}

const STYLES: Record<Exclude<CaptionStyle, "none">, StyleSpec> = {
  bold: {
    size: 92, maxWords: 3, maxChars: 18, upper: true, primary: "white", mode: "highlight",
    outline: 7, outlineColour: "black", shadow: 2, borderStyle: 1, back: "&H80000000", pop: true,
  },
  karaoke: {
    size: 80, maxWords: 5, maxChars: 26, upper: false, primary: "white", mode: "highlight",
    outline: 6, outlineColour: "black", shadow: 2, borderStyle: 1, back: "&H80000000", pop: false, grow: 112,
  },
  minimal: {
    size: 62, maxWords: 7, maxChars: 34, upper: false, primary: "white", mode: "plain",
    outline: 14, outlineColour: "black", shadow: 0, borderStyle: 3, back: "&H99000000", pop: false,
  },
  neon: {
    size: 86, maxWords: 3, maxChars: 20, upper: true, primary: "white", mode: "highlight",
    outline: 2, outlineColour: "accent", shadow: 0, borderStyle: 1, back: "&H00000000", pop: true, glow: true,
  },
  reveal: {
    size: 84, maxWords: 6, maxChars: 30, upper: false, primary: "white", mode: "reveal",
    outline: 6, outlineColour: "black", shadow: 2, borderStyle: 1, back: "&H80000000", pop: false,
  },
  oneword: {
    size: 132, maxWords: 1, maxChars: 99, upper: true, primary: "white", mode: "single",
    outline: 9, outlineColour: "black", shadow: 3, borderStyle: 1, back: "&H80000000", pop: true,
  },
  comic: {
    size: 98, maxWords: 3, maxChars: 18, upper: true, primary: "accent", mode: "highlight",
    outline: 9, outlineColour: "black", shadow: 5, borderStyle: 1, back: "&H00000000", pop: true, tilt: 3,
  },
};

/** "#RRGGBB" -> ASS "&H00BBGGRR". */
export function assColour(hex: string | undefined, fallback = "#FFE500"): string {
  const h = /^#[0-9a-f]{6}$/i.test(hex || "") ? hex! : fallback;
  return `&H00${h.slice(5, 7)}${h.slice(3, 5)}${h.slice(1, 3)}`.toUpperCase();
}

function ts(sec: number): string {
  const cs = Math.round(Math.max(0, sec) * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}

function clean(text: string): string {
  return text.replace(/[{}\\]/g, "").replace(/\s+/g, " ").trim();
}

function groupWords(words: Word[], spec: StyleSpec): Word[][] {
  const groups: Word[][] = [];
  let cur: Word[] = [];
  let chars = 0;
  for (const w of words) {
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
  font: string;
  hook?: string;
  color?: string;
  position?: CaptionPosition;
  handle?: string;
  endCard?: string;
}): string {
  const spec = opts.style === "none" ? null : STYLES[opts.style];
  const accent = assColour(opts.color);
  const white = "&H00FFFFFF";
  const font = opts.font;
  // Lower third by default; "middle" sits just below centre.
  const marginV = opts.position === "middle" ? 820 : opts.layout === "fill" ? 560 : 470;
  // Keep the hook card clear of the @handle in the top corner.
  const topBusy = Boolean(opts.handle?.trim());
  const hookMarginV = topBusy ? 450 : 250;
  const lines: string[] = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
  ];
  if (spec) {
    const primary = spec.primary === "accent" ? accent : white;
    const outline = spec.outlineColour === "accent" ? accent : "&H00000000";
    lines.push(
      `Style: Cap,${font},${spec.size},${primary},${primary},${outline},${spec.back},-1,0,0,0,100,100,0,0,${spec.borderStyle},${spec.outline},${spec.shadow},2,80,80,${marginV},1`,
    );
  }
  lines.push(
    `Style: Hook,${font},66,&H00111111,&H00111111,&H00FFFFFF,&H00FFFFFF,-1,0,0,0,100,100,0,0,3,22,0,8,110,110,${hookMarginV},1`,
    `Style: Handle,${font},44,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,3,1,7,0,0,0,1`,
    `Style: End,${font},96,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,7,3,5,90,90,0,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  );

  // Hook title card for the first ~3 seconds.
  if (opts.hook?.trim()) {
    lines.push(
      `Dialogue: 3,${ts(0)},${ts(Math.min(3.2, opts.duration))},Hook,,0,0,0,,{\\fad(150,250)\\fscx90\\fscy90\\t(0,180,\\fscx100\\fscy100)}${clean(opts.hook)}`,
    );
  }

  // @handle in the top-left corner.
  const handle = clean(opts.handle || "").replace(/^@?/, "@");
  if (handle.length > 1) {
    const x = 56;
    const y = 160;
    const align = 7;
    lines.push(`Dialogue: 2,${ts(0)},${ts(opts.duration)},Handle,,0,0,0,,{\\an${align}\\pos(${x},${y})\\alpha&H20&}${handle}`);
  }

  // End card for the last 2.5 seconds; captions stop when it appears.
  const endText = clean(opts.endCard || "");
  const endStart = endText && opts.duration > 8 ? opts.duration - 2.5 : opts.duration;
  if (endText && endStart < opts.duration) {
    lines.push(
      `Dialogue: 4,${ts(endStart)},${ts(opts.duration)},End,,0,0,0,,{\\fad(200,0)\\c${accent}\\fscx70\\fscy70\\t(0,220,\\fscx105\\fscy105)\\t(220,320,\\fscx100\\fscy100)}${endText}`,
    );
  }

  if (spec && opts.words.length) {
    const words = opts.words.filter((w) => w.start < endStart);
    const groups = groupWords(words, spec);
    const extra = spec.extra || "";
    groups.forEach((g, gi) => {
      const nextStart = groups[gi + 1]?.[0].start ?? endStart;
      const groupEnd = Math.min(nextStart, g[g.length - 1].end + 0.45, endStart);
      const text = g.map((w) => clean(spec.upper ? w.text.toUpperCase() : w.text));
      const tilt = spec.tilt ? `\\frz${gi % 2 ? -spec.tilt : spec.tilt}` : "";
      const pop = (on: boolean) =>
        spec.pop && on ? "\\fscx80\\fscy80\\t(0,90,\\fscx106\\fscy106)\\t(90,150,\\fscx100\\fscy100)" : "";
      const base = spec.primary === "accent" ? accent : white;
      // Comic style is drawn in the accent colour, so its highlight is white.
      const hi = spec.primary === "accent" ? white : accent;

      if (spec.mode === "plain") {
        lines.push(`Dialogue: 1,${ts(g[0].start)},${ts(groupEnd)},Cap,,0,0,0,,{\\fad(60,60)${extra}${tilt}}${text.join(" ")}`);
        return;
      }
      g.forEach((w, wi) => {
        const start = w.start;
        const end = wi < g.length - 1 ? g[wi + 1].start : groupEnd;
        if (end - start < 0.02) return;
        let body: string;
        if (spec.mode === "single") {
          // Long words get the accent colour for emphasis.
          const emph = text[wi].replace(/[^\p{L}\p{N}]/gu, "").length >= 6;
          body = emph ? `{\\c${accent}}${text[wi]}` : text[wi];
        } else {
          const visible = spec.mode === "reveal" ? text.slice(0, wi + 1) : text;
          body = spec.glow
            ? // Neon: all words white over the glow; inactive words dimmed.
              visible.map((t, ti) => (ti === wi ? t : `{\\alpha&H70&}${t}{\\alpha&H00&}`)).join(" ")
            : visible
                .map((t, ti) =>
                  ti === wi ? `{\\c${hi}${spec.grow ? `\\fscx${spec.grow}\\fscy${spec.grow}` : ""}}${t}{\\c${base}\\fscx100\\fscy100}` : t,
                )
                .join(" ");
        }
        const first = spec.mode === "single" || wi === 0;
        if (spec.glow) {
          // Blurred, fill-less copy underneath: a coloured halo around crisp text.
          const plain = (spec.mode === "reveal" ? text.slice(0, wi + 1) : spec.mode === "single" ? [text[wi]] : text).join(" ");
          lines.push(
            `Dialogue: 0,${ts(start)},${ts(end)},Cap,,0,0,0,,{\\bord16\\blur14\\3c${accent}\\1a&HFF&${tilt}${pop(first)}}${plain}`,
          );
        }
        lines.push(`Dialogue: 1,${ts(start)},${ts(end)},Cap,,0,0,0,,{${extra}${tilt}${pop(first)}}${body}`);
      });
    });
  }
  return lines.join("\n") + "\n";
}
