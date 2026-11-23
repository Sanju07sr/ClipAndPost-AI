import { Brain, Crop, Link2, Send } from "lucide-react";
import { ClipForm } from "@/components/ClipForm";
import { FeaturesSection } from "@/components/FeaturesSection";
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
            Paste a YouTube link. ClipAndPost AI finds the best moments, reframes them to vertical, adds animated captions and
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

      <FeaturesSection />

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
