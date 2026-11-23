"use client";

import { useEffect, useRef, useState } from "react";
import { Brush, Camera, ImagePlus, LoaderCircle, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import type { AvatarPosition } from "@/lib/types";

type Style = "ai" | "cartoon" | "photo";

const STYLES: { id: Style; label: string; hint: string; icon: typeof Sparkles }[] = [
  { id: "ai", label: "AI illustrated", hint: "Claude draws you", icon: Sparkles },
  { id: "cartoon", label: "Cartoon", hint: "Comic-style filter", icon: Brush },
  { id: "photo", label: "Photo", hint: "Your photo, framed", icon: Camera },
];

interface Info {
  exists: boolean;
  style?: Style;
  updatedAt?: number;
}

export function AvatarPicker(props: {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  position: AvatarPosition;
  onPositionChange: (v: AvatarPosition) => void;
  onAvailabilityChange: (v: boolean) => void;
}) {
  const [info, setInfo] = useState<Info | null>(null);
  const [style, setStyle] = useState<Style>("ai");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { onAvailabilityChange } = props;

  useEffect(() => {
    fetch("/api/avatar", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Info) => setInfo(d))
      .catch(() => setInfo({ exists: false }));
  }, []);
  useEffect(() => onAvailabilityChange(Boolean(info?.exists)), [info, onAvailabilityChange]);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      fd.append("style", style);
      const res = await fetch("/api/avatar", { method: "POST", body: fd });
      const data = (await res.json()) as Info & { error?: string; note?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't make the avatar");
      setInfo(data);
      if (data.note) setNote(data.note);
      props.onEnabledChange(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove() {
    if (!confirm("Delete your avatar?")) return;
    await fetch("/api/avatar", { method: "DELETE" });
    setInfo({ exists: false });
    props.onEnabledChange(false);
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {/* Preview */}
      <div className="flex shrink-0 flex-col items-center gap-2">
        <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-white/[0.04] ring-1 ring-white/10">
          {busy ? (
            <div className="flex flex-col items-center gap-1 text-[11px] text-ink-300">
              <LoaderCircle className="h-6 w-6 animate-spin text-brand-pink" />
              {style === "ai" ? "Drawing…" : "Working…"}
            </div>
          ) : info?.exists ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/avatar/image?v=${info.updatedAt}`} alt="Your avatar" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-8 w-8 text-ink-400" />
          )}
        </div>
        {info?.exists && !busy && (
          <button type="button" onClick={remove} className="inline-flex items-center gap-1 text-[11px] text-ink-400 hover:text-rose-300">
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="min-w-0 flex-1 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyle(s.id)}
              aria-pressed={style === s.id}
              className={`flex flex-col items-center gap-1 rounded-xl p-2 text-center ring-1 transition ${
                style === s.id ? "bg-white/[0.07] text-white ring-brand-pink/70" : "text-ink-300 ring-white/5 hover:bg-white/[0.04]"
              }`}
            >
              <s.icon className="h-4 w-4" />
              <span className="text-xs font-medium">{s.label}</span>
              <span className="text-[10px] leading-tight text-ink-400">{s.hint}</span>
            </button>
          ))}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2.5 text-sm font-medium text-white ring-1 ring-white/10 transition hover:bg-white/[0.1] disabled:opacity-50"
        >
          <ImagePlus className="h-4 w-4" />
          {info?.exists ? "Upload a new photo" : "Upload your photo"}
        </button>
        {error && (
          <p className="flex items-start gap-1.5 text-xs text-rose-300">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
          </p>
        )}
        {note && <p className="text-xs text-amber-200">{note}</p>}

        {info?.exists && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              role="switch"
              aria-checked={props.enabled}
              onClick={() => props.onEnabledChange(!props.enabled)}
              className="flex items-center gap-2 text-sm text-ink-100"
            >
              <span className={`relative h-6 w-11 rounded-full transition ${props.enabled ? "bg-brand" : "bg-ink-600"}`}>
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${props.enabled ? "left-6" : "left-1"}`} />
              </span>
              Show in my Shorts
            </button>
            {props.enabled && (
              <div className="flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/5">
                {(["top-left", "top-right"] as AvatarPosition[]).map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => props.onPositionChange(pos)}
                    className={`rounded-md px-2.5 py-1 text-xs transition ${
                      props.position === pos ? "bg-white text-ink-950" : "text-ink-300 hover:text-white"
                    }`}
                  >
                    {pos === "top-left" ? "Top left" : "Top right"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-ink-400">
          Use a clear, front-facing photo of yourself. It&apos;s processed and stored only on this computer
          {style === "ai" ? "; AI drawing sends it to Claude once" : ""}.
        </p>
      </div>
    </div>
  );
}
