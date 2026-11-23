import { Brain, Captions, Crop, Flame, Link2, ScanFace, Scissors, Send, Volume2, Wand2, Zap } from "lucide-react";
import { ClipForm } from "@/components/ClipForm";
import { HeroHighlights } from "@/components/HeroHighlights";
import { PhoneMocks } from "@/components/PhoneMock";
import { RecentJobs } from "@/components/RecentJobs";
import { SetupNotice } from "@/components/SetupNotice";

const STEPS = [
  { icon: Link2, title: "Paste a link", text: "Any YouTube video, podcast, stream VOD or lecture." },
  { icon: Brain, title: "AI finds the moments", text: "Claude reads the full transcript and ranks the most clip-worthy moments." },
  { icon: Crop, title: "Reframed to 9:16", text: "Cut on sentence boundaries, cropped around the speaker, captions burned in." },
  { icon: Send, title: "Publish or download", text: "Post to YouTube, Instagram and Facebook in one click, or download the HD MP4s." },
];

const FEATURES = [
  { icon: Flame, title: "Virality score", text: "Every clip is ranked 0–100 with the reason it should work, so you post the best first." },
  { icon: ScanFace, title: "AI speaker framing", text: "Claude looks at the footage and keeps the person talking centred in the vertical crop." },
  { icon: Captions, title: "Animated captions", text: "Word-by-word captions in three styles that keep viewers watching with the sound off." },
  { icon: Wand2, title: "Hook title cards", text: "A punchy on-screen hook for the first three seconds to stop the scroll." },
  { icon: Scissors, title: "Clean cuts", text: "Clips start and end on full sentences, never mid-word or mid-thought." },
  { icon: Volume2, title: "Loudness normalised", text: "Audio levelled to −14 LUFS, the loudness YouTube plays Shorts at." },
  { icon: Zap, title: "Only what's needed", text: "Downloads just the clip sections, so a 3-hour podcast doesn't take 3 hours." },
  { icon: Send, title: "Publish everywhere", text: "Post to YouTube Shorts, Instagram Reels and Facebook Reels in one click, with notifications when they're live." },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Hero */}
      <section id="create" className="grid scroll-mt-24 items-start gap-10 pt-12 sm:pt-20 lg:grid-cols-[1.15fr_1fr]">
        <div className="animate-fade-up min-w-0">
          <HeroHighlights />
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
            One long video.
            <br />
            <span className="text-gradient">A week of Shorts.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-300">
            Paste a YouTube link. ClipForge finds the best moments, reframes them to vertical, adds animated captions and
            hands you upload-ready Shorts.
          </p>
          <div className="mt-8">
            <ClipForm />
            <SetupNotice />
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-400">
            <span>✓ 1080×1920 HD Shorts</span>
            <span>✓ Up to 10 clips per video</span>
            <span>✓ Publish to 3 platforms at once</span>
          </div>
        </div>
        <div className="hidden pt-10 lg:sticky lg:top-24 lg:block">
          <PhoneMocks />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-24 pt-28">
        <SectionTitle eyebrow="How it works" title="From link to Shorts in four steps" />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="glass relative rounded-2xl p-5">
              <span className="absolute right-4 top-4 font-display text-4xl font-bold text-white/[0.06]">{i + 1}</span>
              <div className="bg-brand mb-4 flex h-10 w-10 items-center justify-center rounded-xl shadow-lg shadow-brand-pink/20">
                <s.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-display text-lg font-semibold text-white">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-24 pt-28">
        <SectionTitle eyebrow="Features" title="Everything a Short needs, done for you" />
        <div className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-ink-950/90 p-6 transition hover:bg-ink-900/90">
              <f.icon className="h-5 w-5 text-brand-pink" />
              <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent */}
      <section id="recent" className="scroll-mt-24 pt-28">
        <SectionTitle eyebrow="Library" title="Your recent videos" />
        <div className="mt-8">
          <RecentJobs />
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-pink">{eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
    </div>
  );
}
