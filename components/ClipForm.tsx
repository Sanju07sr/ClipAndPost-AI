"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Captions,
  ChevronDown,
  ClipboardPaste,
  Crop,
  LoaderCircle,
  ScanFace,
  SlidersHorizontal,
  Sparkles,
  Type,
} from "lucide-react";
import { youTubeId } from "@/lib/url";
import type { CaptionStyle, Layout } from "@/lib/types";

const LENGTHS = [
  { id: "auto", label: "Auto", hint: "20–60s", min: 20, max: 60 },
  { id: "quick", label: "Quick", hint: "15–30s", min: 15, max: 30 },
  { id: "standard", label: "Standard", hint: "30–60s", min: 30, max: 60 },
  { id: "long", label: "Long", hint: "60–90s", min: 60, max: 90 },
  { id: "max", label: "Max", hint: "90s–3m", min: 90, max: 180 },
] as const;

const CAPTIONS: { id: CaptionStyle; label: string; sample: React.ReactNode }[] = [
  {
    id: "bold",
    label: "Bold pop",
    sample: (
      <span className="font-display text-[15px] font-black uppercase tracking-tight [text-shadow:0_2px_0_#000,0_0_6px_#000]">
        THIS <span className="text-yellow-300">CHANGED</span>
      </span>
    ),
  },
  {
    id: "karaoke",
    label: "Karaoke",
    sample: (
      <span className="text-[13px] font-bold [text-shadow:0_1px_0_#000,0_0_5px_#000]">
        this <span className="text-lime-400">changed</span> everything
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

export function ClipForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [clipCount, setClipCount] = useState(5);
  const [length, setLength] = useState<(typeof LENGTHS)[number]["id"]>("auto");
  const [layout, setLayout] = useState<Layout>("fill");
  const [aiFraming, setAiFraming] = useState(true);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>("bold");
  const [hookOverlay, setHookOverlay] = useState(true);
  const [instructions, setInstructions] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoId = useMemo(() => youTubeId(url), [url]);
  const invalid = url.trim().length > 6 && !videoId;

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
    setSubmitting(true);
    setError(null);
    const len = LENGTHS.find((l) => l.id === length)!;
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          clipCount,
          minDuration: len.min,
          maxDuration: len.max,
          layout,
          aiFraming,
          captionStyle,
          hookOverlay,
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
              onClick={() => setLength(l.id)}
              title={l.hint}
              aria-pressed={length === l.id}
              className={`flex flex-col items-center whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium leading-tight transition sm:px-3 sm:text-sm ${
                length === l.id ? "bg-white text-ink-950" : "text-ink-300 hover:text-white"
              }`}
            >
              {l.label}
              <span className={`hidden text-[10px] font-normal sm:block ${length === l.id ? "text-ink-600" : "text-ink-400"}`}>
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
          <ChevronDown className={`h-4 w-4 transition ${showSettings ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Advanced settings */}
      <div
        className={`grid transition-all duration-300 ${showSettings ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="grid gap-4 px-1 pb-1 pt-4 md:grid-cols-2">
            {/* Number of clips */}
            <Field icon={<Sparkles className="h-4 w-4" />} label="Number of Shorts" value={`${clipCount}`}>
              <input
                type="range"
                min={1}
                max={10}
                value={clipCount}
                onChange={(e) => setClipCount(Number(e.target.value))}
                className="w-full"
                aria-label="Number of Shorts"
              />
              <div className="mt-1 flex justify-between text-[11px] text-ink-400">
                <span>1</span>
                <span>10</span>
              </div>
            </Field>

            {/* Layout */}
            <Field icon={<Crop className="h-4 w-4" />} label="Vertical layout">
              <div className="grid grid-cols-2 gap-2">
                <LayoutOption
                  active={layout === "fill"}
                  onClick={() => setLayout("fill")}
                  title="Fill"
                  hint="Crop to the speaker"
                  preview={<div className="h-full w-full rounded-[3px] bg-gradient-to-b from-violet-400/70 to-pink-400/70" />}
                />
                <LayoutOption
                  active={layout === "fit"}
                  onClick={() => setLayout("fit")}
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

            {/* Captions */}
            <Field icon={<Captions className="h-4 w-4" />} label="Caption style" className="md:col-span-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CAPTIONS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCaptionStyle(c.id)}
                    aria-pressed={captionStyle === c.id}
                    className={`group flex flex-col items-center gap-2 rounded-xl p-2 text-xs ring-1 transition ${
                      captionStyle === c.id
                        ? "bg-white/[0.07] text-white ring-brand-pink/70"
                        : "text-ink-300 ring-white/5 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <div className="flex h-14 w-full items-center justify-center rounded-lg bg-[url('/caption-bg.svg')] bg-cover bg-center px-1 text-white">
                      {c.sample}
                    </div>
                    {c.label}
                  </button>
                ))}
              </div>
            </Field>

            {/* Toggles */}
            <Toggle
              icon={<ScanFace className="h-4 w-4" />}
              label="AI speaker framing"
              hint="Claude looks at the footage and keeps the speaker in the crop"
              checked={aiFraming}
              disabled={layout === "fit"}
              onChange={setAiFraming}
            />
            <Toggle
              icon={<Type className="h-4 w-4" />}
              label="Hook title card"
              hint="Shows the clip's hook on screen for the first 3 seconds"
              checked={hookOverlay}
              onChange={setHookOverlay}
            />

            {/* Instructions */}
            <Field icon={<Sparkles className="h-4 w-4" />} label="What should the AI look for? (optional)" className="md:col-span-2">
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value.slice(0, 500))}
                rows={2}
                placeholder="e.g. Funny moments only · The best productivity tips · Skip the sponsor segment"
                className="w-full resize-none rounded-xl bg-ink-900/80 px-3 py-2.5 text-sm text-white ring-1 ring-white/10 placeholder:text-ink-400 focus:outline-none focus:ring-brand-pink/60"
              />
            </Field>
          </div>
        </div>
      </div>
    </form>
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
        <div className="text-[11px] leading-tight text-ink-400">{props.hint}</div>
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
