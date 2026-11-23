// Decorative vertical-video mockups for the hero. Pure CSS, no media files.

const MOCKS = [
  {
    hook: "NOBODY TALKS ABOUT THIS",
    words: ["THE", "REAL", "SECRET"],
    hi: 1,
    tint: "from-violet-600/70 via-fuchsia-500/40 to-ink-900",
    score: 94,
    r: "-8deg",
    delay: "0s",
  },
  {
    hook: "I was SO wrong",
    words: ["THIS", "CHANGED", "EVERYTHING"],
    hi: 1,
    tint: "from-pink-600/70 via-rose-500/40 to-ink-900",
    score: 88,
    r: "0deg",
    delay: "-2.3s",
  },
  {
    hook: "Try this tomorrow",
    words: ["DO", "THIS", "FIRST"],
    hi: 2,
    tint: "from-orange-500/70 via-amber-400/30 to-ink-900",
    score: 81,
    r: "8deg",
    delay: "-4.6s",
  },
];

export function PhoneMocks() {
  return (
    <div className="relative mx-auto flex h-[420px] w-full max-w-[520px] items-center justify-center" aria-hidden>
      {MOCKS.map((m, i) => (
        <div
          key={i}
          style={{ ["--r" as string]: m.r, animationDelay: m.delay }}
          className={`animate-float absolute w-[170px] sm:w-[190px] ${
            i === 0 ? "-translate-x-[105px] sm:-translate-x-[150px]" : i === 2 ? "translate-x-[105px] sm:translate-x-[150px]" : "z-10"
          }`}
        >
          <div className="rounded-[30px] border border-white/15 bg-ink-900 p-1.5 shadow-2xl shadow-black/60">
            <div className={`relative aspect-[9/16] overflow-hidden rounded-[24px] bg-gradient-to-b ${m.tint}`}>
              {/* "speaker" */}
              <div className="absolute left-1/2 top-[30%] h-20 w-20 -translate-x-1/2 rounded-full bg-gradient-to-b from-orange-200/60 to-orange-300/20 blur-[1px]" />
              <div className="absolute left-1/2 top-[46%] h-32 w-36 -translate-x-1/2 rounded-t-[60px] bg-ink-950/50" />
              {/* hook card */}
              <div className="absolute inset-x-3 top-6 rounded-lg bg-white px-2 py-1.5 text-center font-display text-[10px] font-bold leading-tight text-ink-950">
                {m.hook}
              </div>
              {/* captions */}
              <div className="absolute inset-x-2 bottom-[26%] text-center font-display text-[17px] font-black leading-none tracking-tight text-white [text-shadow:0_2px_0_#000,0_0_8px_#000]">
                {m.words.map((w, wi) => (
                  <span key={wi} className={wi === m.hi ? "text-yellow-300" : ""}>
                    {w}{" "}
                  </span>
                ))}
              </div>
              {/* progress + score */}
              <div className="absolute inset-x-3 bottom-4 h-1 overflow-hidden rounded-full bg-white/20">
                <div className="h-full w-2/5 rounded-full bg-white" />
              </div>
              <div className="absolute right-2.5 top-[42%] flex flex-col items-center gap-3 text-white/90">
                <div className="h-6 w-6 rounded-full bg-white/20" />
                <div className="h-6 w-6 rounded-full bg-white/20" />
                <div className="h-6 w-6 rounded-full bg-white/20" />
              </div>
            </div>
          </div>
          <div className="glass absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />
            Virality {m.score}
          </div>
        </div>
      ))}
    </div>
  );
}
