"use client";

import Link from "next/link";
import { Check, Layers, Lock } from "lucide-react";
import { PLATFORM_NAMES, type PlatformId } from "@/lib/types";
import { PlatformBadge } from "./PlatformBadge";

export interface PlatformState {
  configured: boolean;
  connected: boolean;
  account: string | null;
  problem?: string | null;
}

/** Why a platform can't be chosen, in plain words. */
export function disabledReason(p: PlatformId, s: PlatformState): string {
  const name = PLATFORM_NAMES[p];
  if (s.problem) return `${s.problem} Fix it in Settings.`;
  if (!s.configured) return `${name} isn't set up yet. Add your ${name} app keys in Settings, then connect your account.`;
  return `${name} isn't connected. Open Settings and click "Connect ${p === "youtube" ? "YouTube" : "Instagram & Facebook"}".`;
}

/**
 * Choose where to publish: one platform, several, or all. Platforms that
 * aren't connected are dimmed and disabled, with a tooltip explaining why.
 */
export function PlatformPicker(props: {
  platforms: PlatformId[];
  states: Record<PlatformId, PlatformState>;
  selected: PlatformId[];
  onChange: (next: PlatformId[]) => void;
  size?: "md" | "lg";
}) {
  const available = props.platforms.filter((p) => props.states[p]?.connected);
  const allOn = available.length > 0 && available.every((p) => props.selected.includes(p));
  const pad = props.size === "lg" ? "py-2 pl-2 pr-4" : "py-1.5 pl-1.5 pr-3.5";

  const toggle = (p: PlatformId) =>
    props.onChange(props.selected.includes(p) ? props.selected.filter((x) => x !== p) : [...props.selected, p]);

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Platforms to publish to">
      {available.length > 1 && (
        <button
          type="button"
          role="checkbox"
          aria-checked={allOn}
          onClick={() => props.onChange(allOn ? [] : available)}
          className={`inline-flex items-center gap-2 rounded-full text-sm font-medium ring-1 transition ${pad} ${
            allOn ? "bg-white text-ink-950 ring-white" : "bg-white/[0.04] text-ink-100 ring-white/15 hover:bg-white/[0.08]"
          }`}
        >
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-md ${allOn ? "bg-ink-950 text-white" : "bg-white/10 text-ink-200"}`}
          >
            <Layers className="h-3.5 w-3.5" />
          </span>
          All platforms
          {allOn && <Check className="h-4 w-4" />}
        </button>
      )}

      {props.platforms.map((p) => {
        const s = props.states[p];
        const on = props.selected.includes(p);
        if (!s?.connected) {
          return (
            <span key={p} className="group relative inline-flex">
              <button
                type="button"
                aria-disabled="true"
                aria-describedby={`why-${p}`}
                onClick={(e) => e.preventDefault()}
                className={`inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-white/[0.02] text-sm text-ink-400 ring-1 ring-white/[0.06] ${pad}`}
              >
                <span className="opacity-40 blur-[1.2px] grayscale">
                  <PlatformBadge platform={p} size="sm" />
                </span>
                <span className="opacity-60 blur-[0.4px]">{PLATFORM_NAMES[p]}</span>
                <Lock className="h-3.5 w-3.5 text-ink-400" />
              </button>
              {/* Tooltip: shown on hover and keyboard focus */}
              <span
                id={`why-${p}`}
                role="tooltip"
                className="pointer-events-none invisible absolute bottom-full left-1/2 z-30 mb-2 w-64 -translate-x-1/2 rounded-xl bg-ink-800 px-3.5 py-2.5 text-left text-sm leading-snug text-ink-100 opacity-0 shadow-2xl ring-1 ring-white/15 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
              >
                {disabledReason(p, s ?? { configured: false, connected: false, account: null })}
                <span className="absolute left-1/2 top-full -mt-1 h-2 w-2 -translate-x-1/2 rotate-45 bg-ink-800 ring-1 ring-white/15 [clip-path:polygon(100%_0,100%_100%,0_100%)]" />
              </span>
            </span>
          );
        }
        return (
          <button
            key={p}
            type="button"
            role="checkbox"
            aria-checked={on}
            title={s.account ? `${PLATFORM_NAMES[p]}: ${s.account}` : undefined}
            onClick={() => toggle(p)}
            className={`inline-flex items-center gap-2 rounded-full text-sm font-medium ring-1 transition ${pad} ${
              on
                ? "bg-white/[0.1] text-white ring-2 ring-brand-pink/80 shadow-lg shadow-brand-pink/10"
                : "bg-white/[0.03] text-ink-300 ring-white/15 hover:bg-white/[0.07] hover:text-white"
            }`}
          >
            <PlatformBadge platform={p} size="sm" />
            {PLATFORM_NAMES[p]}
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${
                on ? "border-transparent bg-lime-400 text-ink-950" : "border-ink-400"
              }`}
            >
              {on && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
          </button>
        );
      })}

      {props.platforms.some((p) => !props.states[p]?.connected) && (
        <Link href="/settings" className="ml-1 text-sm text-ink-300 underline decoration-white/20 underline-offset-4 hover:text-white">
          Connect more
        </Link>
      )}
    </div>
  );
}
