"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  AtSign,
  Captions,
  ChevronDown,
  ClipboardPaste,
  Crop,
  Flag,
  LoaderCircle,
  Palette,
  ScanFace,
  SlidersHorizontal,
  Sparkles,
  Type,
  Wand2,
  ZoomIn,
} from "lucide-react";
import { youTubeId } from "@/lib/url";
import { requestDesktopNotifications } from "./Toaster";
import type { CaptionPosition, CaptionStyle, Layout, Look } from "@/lib/types";

const LENGTHS = [
  { id: "auto", label: "Auto", hint: "20–60s", min: 20, max: 60 },
  { id: "quick", label: "Quick", hint: "15–30s", min: 15, max: 30 },
  { id: "standard", label: "Standard", hint: "30–60s", min: 30, max: 60 },
  { id: "long", label: "Long", hint: "60–90s", min: 60, max: 90 },
  { id: "max", label: "Max", hint: "90s–3m", min: 90, max: 180 },
] as const;

const COLORS = ["#FFE500", "#4ADE80", "#22D3EE", "#F472B6", "#FB923C", "#A78BFA", "#FFFFFF"];

const LOOKS: { id: Look; label: string; swatch: string }[] = [
  { id: "none", label: "Original", swatch: "linear-gradient(135deg,#64748b,#94a3b8)" },
  { id: "vivid", label: "Vivid", swatch: "linear-gradient(135deg,#f43f5e,#facc15,#22c55e)" },
  { id: "warm", label: "Warm", swatch: "linear-gradient(135deg,#f97316,#fde68a)" },
  { id: "cool", label: "Cool", swatch: "linear-gradient(135deg,#0ea5e9,#a5f3fc)" },
  { id: "bw", label: "B&W", swatch: "linear-gradient(135deg,#111,#eee)" },
  { id: "cinematic", label: "Cinematic", swatch: "linear-gradient(135deg,#0f766e,#f59e0b)" },
];

const END_CARDS = ["Follow for more", "Full video on my channel", "Subscribe for part 2"];

interface Prefs {
  clipCount: number;
  length: (typeof LENGTHS)[number]["id"];
  layout: Layout;
  aiFraming: boolean;
  captionStyle: CaptionStyle;
  captionColor: string;
  captionPosition: CaptionPosition;
  hookOverlay: boolean;
  look: Look;
  zoom: boolean;
  progressBar: boolean;
  handle: string;
  endCard: string;
}

const DEFAULTS: Prefs = {
  clipCount: 5,
  length: "auto",
  layout: "fill",
  aiFraming: true,
  captionStyle: "bold",
  captionColor: "#FFE500",
  captionPosition: "lower",
  hookOverlay: true,
  look: "none",
  zoom: false,
  progressBar: true,
  handle: "",
  endCard: "",
};

const PREFS_KEY = "clipandpost:prefs";
const OLD_PREFS_KEY = "clipforge:prefs"; // before the rename

export function ClipForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [p, setP] = useState<Prefs>(DEFAULTS);
  const [instructions, setInstructions] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Remember the creator's choices between visits.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || localStorage.getItem(OLD_PREFS_KEY) || "null");
      if (saved) setP({ ...DEFAULTS, ...saved });
    } catch {}
  }, []);
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) =>
    setP((cur) => {
      const next = { ...cur, [k]: v };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

  const videoId = useMemo(() => youTubeId(url), [url]);
  const invalid = url.trim().length > 6 && !videoId;
  const extrasOn = [p.look !== "none", p.zoom, p.handle.trim(), p.endCard.trim()].filter(Boolean).length;

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text.trim());
    } catch {
      /* clipboard permission denied: user can paste manually */
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!videoId || submitting) return;
    requestDesktopNotifications(); // so we can tell them when the Shorts are ready
    setSubmitting(true);
    setError(null);
    const len = LENGTHS.find((l) => l.id === p.length)!;
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          clipCount: p.clipCount,
          minDuration: len.min,
          maxDuration: len.max,
          layout: p.layout,
          aiFraming: p.aiFraming,
          captionStyle: p.captionStyle,
          captionColor: p.captionColor,
          captionPosition: p.captionPosition,
          hookOverlay: p.hookOverlay,
          look: p.look,
          zoom: p.zoom,
          progressBar: p.progressBar,
          handle: p.handle.trim(),
          endCard: p.endCard.trim(),
          instructions: instructions.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error || "Something went wrong");
      router.push(`/jobs/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="ring-brand glass rounded-3xl p-3 shadow-2xl shadow-brand-violet/10 sm:p-4">
      {/* URL row */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex min-w-0 flex-1 items-center rounded-2xl bg-ink-900/80 ring-1 ring-white/10 focus-within:ring-brand-pink/60">
          <div className="pointer-events-none pl-4 text-ink-400">
            {videoId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
                alt=""
                onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                className="h-8 w-14 rounded-md bg-ink-700 object-cover ring-1 ring-white/10"
              />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
          </div>
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube link…"
            aria-label="YouTube video link"
            aria-invalid={invalid}
            className="h-14 min-w-0 flex-1 bg-transparent px-3 text-base text-white placeholder:text-ink-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={paste}
            className="mr-2 hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-ink-300 transition hover:bg-white/5 hover:text-white sm:flex"
          >
            <ClipboardPaste className="h-4 w-4" /> Paste
          </button>
        </div>
        <button
          type="submit"
          disabled={!videoId || submitting}
          className="bg-brand group flex h-14 items-center justify-center gap-2 rounded-2xl px-6 font-display text-base font-semibold text-white shadow-lg shadow-brand-pink/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {submitting ? (
            <>
              <LoaderCircle className="h-5 w-5 animate-spin" /> Starting…
            </>
          ) : (
            <>
              Get Shorts <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </div>

      {(invalid || error) && (
        <p role="alert" className="px-2 pt-3 text-sm text-rose-300">
          {error || "That doesn't look like a YouTube video link. Try youtube.com/watch?v=… or youtu.be/…"}
        </p>
      )}

      {/* Quick settings */}
      <div className="flex flex-wrap items-center gap-2 px-1 pt-3">
        <div className="flex items-center gap-1 rounded-xl bg-white/[0.03] p-1 ring-1 ring-white/5">
          {LENGTHS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => set("length", l.id)}
              title={l.hint}
              aria-pressed={p.length === l.id}
              className={`flex flex-col items-center whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium leading-tight transition sm:px-3 sm:text-sm ${
                p.length === l.id ? "bg-white text-ink-950" : "text-ink-300 hover:text-white"
              }`}
            >
              {l.label}
              <span className={`hidden text-xs font-normal sm:block ${p.length === l.id ? "text-ink-600" : "text-ink-400"}`}>
                {l.hint}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowSettings((s) => !s)}
          aria-expanded={showSettings}
          className="ml-auto flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-ink-300 transition hover:bg-white/5 hover:text-white"
        >
          <SlidersHorizontal className="h-4 w-4" /> Customize
          {extrasOn > 0 && (
            <span className="bg-brand rounded-full px-1.5 text-xs font-bold text-white">{extrasOn}</span>
          )}
          <ChevronDown className={`h-4 w-4 transition ${showSettings ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Advanced settings */}
      <div
        className={`grid transition-all duration-300 ${showSettings ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="grid gap-4 px-1 pb-1 pt-4 md:grid-cols-2">
            {/* ---------- Basics */}
            <Field icon={<Sparkles className="h-4 w-4" />} label="Number of Shorts" value={`${p.clipCount}`}>
              <input
                type="range"
                min={1}
                max={10}
                value={p.clipCount}
                onChange={(e) => set("clipCount", Number(e.target.value))}
                className="w-full"
                aria-label="Number of Shorts"
              />
              <div className="mt-1 flex justify-between text-xs text-ink-400">
                <span>1</span>
                <span>10</span>
              </div>
            </Field>

            <Field icon={<Crop className="h-4 w-4" />} label="Vertical layout">
              <div className="grid grid-cols-2 gap-2">
                <LayoutOption
                  active={p.layout === "fill"}
                  onClick={() => set("layout", "fill")}
                  title="Fill"
                  hint="Crop to the speaker"
                  preview={<div className="h-full w-full rounded-[3px] bg-gradient-to-b from-violet-400/70 to-pink-400/70" />}
                />
                <LayoutOption
                  active={p.layout === "fit"}
                  onClick={() => set("layout", "fit")}
                  title="Fit"
                  hint="Full frame, blurred bg"
                  preview={
                    <div className="flex h-full w-full items-center rounded-[3px] bg-gradient-to-b from-violet-400/20 to-pink-400/20">
                      <div className="h-[34%] w-full bg-gradient-to-r from-violet-400/80 to-pink-400/80" />
                    </div>
                  }
                />
              </div>
            </Field>

            {/* ---------- Captions */}
            <SectionHeading>Captions</SectionHeading>
            <Field icon={<Captions className="h-4 w-4" />} label="Caption style" className="md:col-span-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {captionStyles(p.captionColor).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => set("captionStyle", c.id)}
                    aria-pressed={p.captionStyle === c.id}
                    className={`group flex flex-col items-center gap-2 rounded-xl p-2 text-xs ring-1 transition ${
                      p.captionStyle === c.id
                        ? "bg-white/[0.07] text-white ring-brand-pink/70"
                        : "text-ink-300 ring-white/5 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <div className="flex h-14 w-full items-center justify-center overflow-hidden rounded-lg bg-[url('/caption-bg.svg')] bg-cover bg-center px-1 text-white">
                      {c.sample}
                    </div>
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-300">Highlight</span>
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set("captionColor", c)}
                      aria-label={`Highlight colour ${c}`}
                      aria-pressed={p.captionColor.toUpperCase() === c}
                      style={{ background: c }}
                      className={`h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-ink-900 transition ${
                        p.captionColor.toUpperCase() === c ? "ring-white" : "ring-transparent hover:ring-white/40"
                      }`}
                    />
                  ))}
                  <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full ring-1 ring-white/20" title="Custom colour">
                    <span className="absolute inset-0 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" />
                    <input
                      type="color"
                      value={p.captionColor}
                      onChange={(e) => set("captionColor", e.target.value.toUpperCase())}
                      className="absolute inset-0 cursor-pointer opacity-0"
                      aria-label="Custom highlight colour"
                    />
                  </label>
                </div>
                <Segmented
                  label="Position"
                  value={p.captionPosition}
                  onChange={(v) => set("captionPosition", v)}
                  options={[
                    { id: "lower", label: "Lower" },
                    { id: "middle", label: "Middle" },
                  ]}
                />
              </div>
            </Field>
            <Toggle
              icon={<Type className="h-4 w-4" />}
              label="Hook title card"
              hint="The clip's hook on screen for the first 3 seconds"
              checked={p.hookOverlay}
              onChange={(v) => set("hookOverlay", v)}
            />
            <Toggle
              icon={<Flag className="h-4 w-4" />}
              label="Progress bar"
              hint="A thin bar along the bottom that fills as the Short plays"
              checked={p.progressBar}
              onChange={(v) => set("progressBar", v)}
            />

            {/* ---------- Make it yours */}
            <SectionHeading>Make it yours</SectionHeading>
            <Field icon={<Palette className="h-4 w-4" />} label="Colour look" className="md:col-span-2">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {LOOKS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => set("look", l.id)}
                    aria-pressed={p.look === l.id}
                    className={`flex flex-col items-center gap-1.5 rounded-xl p-2 text-xs ring-1 transition ${
                      p.look === l.id ? "bg-white/[0.07] text-white ring-brand-pink/70" : "text-ink-300 ring-white/5 hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="h-8 w-full rounded-lg" style={{ background: l.swatch }} />
                    {l.label}
                  </button>
                ))}
              </div>
            </Field>
            <Toggle
              icon={<ZoomIn className="h-4 w-4" />}
              label="Slow zoom"
              hint="A gentle push-in that adds motion to talking-head clips"
              checked={p.zoom}
              onChange={(v) => set("zoom", v)}
            />
            <Field icon={<AtSign className="h-4 w-4" />} label="Your @handle on screen">
              <input
                value={p.handle}
                onChange={(e) => set("handle", e.target.value.replace(/\s/g, "").slice(0, 30))}
                placeholder="@yourchannel"
                className="h-10 w-full rounded-xl bg-ink-900/80 px-3 text-sm text-white ring-1 ring-white/10 placeholder:text-ink-400 focus:outline-none focus:ring-brand-pink/60"
              />
            </Field>
            <Field icon={<Wand2 className="h-4 w-4" />} label="End card (last 2.5 seconds)" className="md:col-span-2">
              <input
                value={p.endCard}
                onChange={(e) => set("endCard", e.target.value.slice(0, 40))}
                placeholder="Leave empty for no end card"
                className="h-10 w-full rounded-xl bg-ink-900/80 px-3 text-sm text-white ring-1 ring-white/10 placeholder:text-ink-400 focus:outline-none focus:ring-brand-pink/60"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {END_CARDS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("endCard", p.endCard === t ? "" : t)}
                    className={`rounded-full px-2.5 py-1 text-xs ring-1 transition ${
                      p.endCard === t ? "bg-white text-ink-950 ring-white" : "text-ink-300 ring-white/10 hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>

            {/* ---------- AI */}
            <SectionHeading>AI</SectionHeading>
            <Toggle
              icon={<ScanFace className="h-4 w-4" />}
              label="AI speaker framing"
              hint="Claude looks at the footage and keeps the speaker in the crop"
              checked={p.aiFraming}
              disabled={p.layout === "fit"}
              onChange={(v) => set("aiFraming", v)}
            />
            <Field icon={<Sparkles className="h-4 w-4" />} label="What should the AI look for? (optional)">
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value.slice(0, 500))}
                rows={2}
                placeholder="e.g. Funny moments only · The best tips"
                className="w-full resize-none rounded-xl bg-ink-900/80 px-3 py-2.5 text-sm text-white ring-1 ring-white/10 placeholder:text-ink-400 focus:outline-none focus:ring-brand-pink/60"
              />
            </Field>
          </div>
        </div>
      </div>
    </form>
  );
}

/** Caption style tiles with live previews in the chosen colour. */
function captionStyles(color: string): { id: CaptionStyle; label: string; sample: React.ReactNode }[] {
  const stroke = "[text-shadow:0_2px_0_#000,0_0_6px_#000]";
  return [
    {
      id: "bold",
      label: "Bold pop",
      sample: (
        <span className={`font-display text-[15px] font-black uppercase tracking-tight ${stroke}`}>
          THIS <span style={{ color }}>CHANGED</span>
        </span>
      ),
    },
    {
      id: "karaoke",
      label: "Karaoke",
      sample: (
        <span className={`text-[13px] font-bold ${stroke}`}>
          this <span style={{ color }}>changed</span> everything
        </span>
      ),
    },
    {
      id: "neon",
      label: "Neon glow",
      sample: (
        <span
          className="font-display text-[15px] font-black uppercase tracking-tight"
          style={{ textShadow: `0 0 4px ${color}, 0 0 10px ${color}, 0 0 18px ${color}` }}
        >
          THIS <span style={{ color }}>CHANGED</span>
        </span>
      ),
    },
    {
      id: "reveal",
      label: "Word reveal",
      sample: (
        <span className={`text-[13px] font-bold ${stroke}`}>
          this changed <span style={{ color }}>every</span>
          <span className="opacity-0">thing</span>
        </span>
      ),
    },
    {
      id: "oneword",
      label: "One word",
      sample: <span className={`font-display text-[22px] font-black uppercase ${stroke}`}>CHANGED</span>,
    },
    {
      id: "comic",
      label: "Comic",
      sample: (
        <span
          className="inline-block -rotate-3 font-display text-[16px] font-black uppercase"
          style={{ color, textShadow: "2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 3px 3px 0 #000" }}
        >
          THIS <span className="text-white">CHANGED</span>
        </span>
      ),
    },
    {
      id: "minimal",
      label: "Minimal",
      sample: <span className="rounded bg-black/70 px-1.5 py-0.5 text-[12px] font-semibold">this changed everything</span>,
    },
    { id: "none", label: "No captions", sample: <span className="text-[12px] text-ink-400">—</span> },
  ];
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="-mb-1 mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-400 md:col-span-2">{children}</p>
  );
}

function Segmented<T extends string>(props: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink-300">{props.label}</span>
      <div className="flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/5">
        {props.options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => props.onChange(o.id)}
            aria-pressed={props.value === o.id}
            className={`rounded-md px-2.5 py-1 text-xs transition ${
              props.value === o.id ? "bg-white text-ink-950" : "text-ink-300 hover:text-white"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  children,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-white/[0.025] p-3.5 ring-1 ring-white/5 ${className}`}>
      <div className="mb-2.5 flex items-center gap-2 text-sm font-medium text-ink-200">
        <span className="text-brand-pink">{icon}</span>
        {label}
        {value && <span className="ml-auto font-display text-base font-semibold text-white">{value}</span>}
      </div>
      {children}
    </div>
  );
}

function LayoutOption(props: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
  preview: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.active}
      className={`flex items-center gap-3 rounded-xl p-2 text-left ring-1 transition ${
        props.active ? "bg-white/[0.07] ring-brand-pink/70" : "ring-white/5 hover:bg-white/[0.04]"
      }`}
    >
      <div className="h-12 w-7 shrink-0 rounded-md border border-white/20 p-[3px]">{props.preview}</div>
      <div>
        <div className="text-sm font-medium text-white">{props.title}</div>
        <div className="text-xs leading-tight text-ink-400">{props.hint}</div>
      </div>
    </button>
  );
}

function Toggle(props: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  const on = props.checked && !props.disabled;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
      className="flex items-center gap-3 rounded-2xl bg-white/[0.025] p-3.5 text-left ring-1 ring-white/5 transition hover:bg-white/[0.04] disabled:opacity-45"
    >
      <span className="text-brand-pink">{props.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink-100">{props.label}</span>
        <span className="block text-xs text-ink-400">{props.disabled ? "Only used with the Fill layout" : props.hint}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-brand" : "bg-ink-600"}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}
