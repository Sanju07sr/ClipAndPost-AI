import type { StageId } from "@/lib/types";

// Animated "your Short is being made" illustration for the progress panel:
// footage scrolls past, a scan line reads it, crop guides lock onto the
// vertical frame and captions pop in. Purely decorative.

const CAPTION = ["THE", "BEST", "MOMENT"];

const STAGE_LABEL: Record<StageId, string> = {
  metadata: "Reading the video",
  transcript: "Listening to every word",
  moments: "Finding the best moments",
  download: "Grabbing the footage",
  render: "Cutting & captioning",
};

export function ProcessingVisual({ stage, done = false }: { stage: StageId | null; done?: boolean }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-3" aria-hidden>
      <div className="relative h-44 w-[6.2rem] overflow-hidden rounded-[1.1rem] border border-white/15 bg-ink-900 shadow-2xl shadow-brand-violet/20">
        {/* Scrolling footage */}
        <div className="pv-film absolute inset-y-0 left-0 flex w-[400%] gap-1 py-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-full flex-1 rounded-md"
              style={{
                background: `linear-gradient(160deg, hsl(${265 + i * 18} 70% ${38 + (i % 3) * 6}%), hsl(${330 + i * 10} 75% ${30 + (i % 2) * 8}%))`,
              }}
            >
              <div className="mx-auto mt-[38%] h-6 w-6 rounded-full bg-orange-200/40" />
            </div>
          ))}
        </div>
        {/* Vertical crop guides */}
        <div className="pv-crop absolute inset-x-2 inset-y-2 rounded-lg border-2 border-white/80" />
        {/* Scan line */}
        {!done && <div className="pv-scan absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-white/25 to-transparent" />}
        {/* Captions */}
        <div className="absolute inset-x-0 bottom-7 flex justify-center gap-1 font-display text-[10px] font-black text-white [text-shadow:0_1px_0_#000,0_0_4px_#000]">
          {CAPTION.map((w, i) => (
            <span key={w} className="pv-word" style={{ animationDelay: `${i * 0.45}s` }}>
              {w}
            </span>
          ))}
        </div>
        {done && (
          <div className="pv-done absolute inset-0 flex items-center justify-center bg-ink-950/50 backdrop-blur-[2px]">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lime-400 text-ink-950 shadow-lg shadow-lime-400/40">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                <path className="pv-check" d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
          </div>
        )}
      </div>
      <p className="text-center text-xs font-medium text-ink-300">{done ? "All done" : stage ? STAGE_LABEL[stage] : "Getting ready"}</p>
    </div>
  );
}

/** Small animated equaliser used on clip cards while they render. */
export function WorkingBars() {
  return (
    <span className="flex h-6 items-end gap-1" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="pv-bar w-1.5 rounded-full bg-brand-pink" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </span>
  );
}
