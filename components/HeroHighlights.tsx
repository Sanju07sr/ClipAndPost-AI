"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

const ITEMS = [
  { text: "One-click publishing to YouTube, Instagram & Facebook", href: "#features" },
  { text: "AI finds your most viral moments and scores them", href: "#how" },
  { text: "Animated captions in 7 styles, plus your own @handle", href: "#features" },
  { text: "Trending hashtags pulled from this week's top Shorts", href: "#features" },
];

/** "New" pill that rotates through the product's highlights. */
export function HeroHighlights() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % ITEMS.length), 3800);
    return () => clearInterval(t);
  }, [paused]);

  const item = ITEMS[i];
  return (
    <a
      href={item.href}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="glass group mb-6 inline-flex max-w-full items-center gap-2.5 rounded-3xl py-1.5 pl-1.5 pr-4 sm:rounded-full text-sm text-ink-100 transition hover:border-white/20"
    >
      <span className="bg-brand shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white">New</span>
      <span key={i} className="hero-hl min-w-0 leading-snug sm:truncate">
        {item.text}
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-white" />
    </a>
  );
}
