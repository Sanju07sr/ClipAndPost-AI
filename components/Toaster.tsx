"use client";

import { useEffect, useState } from "react";
import { CircleCheck, ExternalLink, Info, PartyPopper, TriangleAlert, X } from "lucide-react";

// Lightweight app-wide notifications: on-screen toasts, plus a desktop
// notification and a soft chime when the tab isn't visible.

type Kind = "success" | "error" | "info" | "celebrate";

export interface Toast {
  id: number;
  kind: Kind;
  title: string;
  body?: string;
  link?: { href: string; label: string };
}

type Listener = (t: Toast) => void;
const listeners = new Set<Listener>();
let nextId = 1;

export function toast(t: Omit<Toast, "id">) {
  const full = { ...t, id: nextId++ };
  listeners.forEach((l) => l(full));
}

/** Ask once for permission to show desktop notifications (must follow a click). */
export function requestDesktopNotifications() {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
  } catch {}
}

function chime() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, now + i * 0.12);
      g.gain.linearRampToValueAtTime(0.08, now + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(now + i * 0.12);
      o.stop(now + i * 0.12 + 0.55);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {}
}

/** Toast + (when the tab is in the background) a desktop notification and chime. */
export function notify(t: Omit<Toast, "id">) {
  toast(t);
  if (typeof document === "undefined" || !document.hidden) return;
  chime();
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const n = new Notification(t.title, { body: t.body, icon: "/icon.svg", tag: `${t.title}` });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    }
  } catch {}
}

const ICONS: Record<Kind, typeof Info> = { success: CircleCheck, error: TriangleAlert, info: Info, celebrate: PartyPopper };
const TONES: Record<Kind, string> = {
  success: "text-lime-300",
  error: "text-rose-300",
  info: "text-sky-300",
  celebrate: "text-pink-300",
};

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const onToast: Listener = (t) => {
      setItems((cur) => [...cur.slice(-3), t]);
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), t.kind === "error" ? 12000 : 8000);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-3 p-4 sm:inset-x-auto sm:right-4 sm:items-end"
    >
      {items.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className="toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-white/10 bg-ink-850/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl"
          >
            <span className={`mt-0.5 ${TONES[t.kind]}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">{t.title}</p>
              {t.body && <p className="mt-0.5 text-sm leading-snug text-ink-300">{t.body}</p>}
              {t.link && (
                <a
                  href={t.link.href}
                  target={t.link.href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-pink hover:underline"
                >
                  {t.link.label} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            <button
              onClick={() => setItems((cur) => cur.filter((x) => x.id !== t.id))}
              className="rounded-lg p-1 text-ink-400 hover:bg-white/5 hover:text-white"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
