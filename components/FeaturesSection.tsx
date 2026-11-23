import {
  AtSign,
  Bell,
  Brain,
  Captions,
  Clock,
  Copy,
  Crop,
  Download,
  Flag,
  Flame,
  Gauge,
  Hash,
  KeyRound,
  Layers,
  Library,
  ListChecks,
  MessageSquareText,
  MonitorSmartphone,
  Palette,
  PenLine,
  Repeat,
  ScanFace,
  Scissors,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Type,
  Volume2,
  Wand2,
  Zap,
  ZoomIn,
} from "lucide-react";
import { PlatformBadge } from "./PlatformBadge";

type Icon = typeof Brain;

interface Feature {
  icon: Icon;
  title: string;
  text: string;
  tag?: string;
}

interface Group {
  id: string;
  icon: Icon;
  eyebrow: string;
  title: string;
  intro: string;
  accent: string; // tailwind gradient for the group icon
  features: Feature[];
}

const GROUPS: Group[] = [
  {
    id: "ai",
    icon: Brain,
    eyebrow: "AI clipping",
    title: "Finds the moments worth posting",
    intro: "Paste one link. The AI watches for hooks, payoffs and quotable lines so you don't have to scrub through hours of footage.",
    accent: "from-violet-500 to-fuchsia-500",
    features: [
      { icon: Brain, title: "AI moment detection", text: "Claude reads the full transcript and picks self-contained moments with a strong hook and a real payoff.", tag: "AI" },
      { icon: Flame, title: "Virality score", text: "Every Short is scored 0–100 with a one-line reason why it should work, so you post the best ones first." },
      { icon: MessageSquareText, title: "Tell the AI what you want", text: "Type “funny moments only”, “the best tips” or “skip the sponsor” and the picks follow your direction." },
      { icon: Scissors, title: "Clean, natural cuts", text: "Clips start and end on full sentences, never mid-word or mid-thought." },
      { icon: Layers, title: "Up to 10 Shorts per video", text: "Choose how many Shorts you want from each video, ranked from strongest to weakest." },
      { icon: Clock, title: "Any length, 15s to 3 min", text: "Presets for Quick, Standard, Long and Max lengths, from 15 seconds up to YouTube's 3-minute limit." },
      { icon: Zap, title: "Fast on long videos", text: "Only the clip sections are downloaded, so a 3-hour podcast is ready in minutes, not hours." },
      { icon: Gauge, title: "Works even without AI or captions", text: "A built-in picker scores speech density, hook words and audio energy, so every video gets Shorts." },
    ],
  },
  {
    id: "video",
    icon: Crop,
    eyebrow: "Vertical video",
    title: "Reframed and polished for 9:16",
    intro: "Every Short comes out as a crisp 1080×1920 video that looks native on YouTube Shorts, Instagram Reels and Facebook Reels.",
    accent: "from-pink-500 to-rose-500",
    features: [
      { icon: ScanFace, title: "AI speaker framing", text: "The AI looks at the footage and centres the vertical crop on the person talking.", tag: "AI" },
      { icon: Crop, title: "Fill or Fit layouts", text: "Fill crops to full-screen vertical; Fit keeps the whole frame over a soft blurred background." },
      { icon: Palette, title: "Colour looks", text: "One-tap grades: Vivid, Warm, Cool, B&W and Cinematic (teal-orange with a subtle vignette)." },
      { icon: ZoomIn, title: "Slow zoom", text: "A gentle push-in that adds motion and keeps talking-head clips feeling alive." },
      { icon: Flag, title: "Progress bar", text: "A thin bar along the bottom fills as the Short plays, which helps viewers watch to the end." },
      { icon: Volume2, title: "Loudness levelled", text: "Audio is normalised to −14 LUFS, the level YouTube plays Shorts at, so you're never too quiet or too loud." },
      { icon: MonitorSmartphone, title: "1080×1920 HD export", text: "High-quality H.264 MP4 with fast-start, ready to upload anywhere." },
    ],
  },
  {
    id: "captions",
    icon: Captions,
    eyebrow: "Captions & branding",
    title: "Captions that keep people watching",
    intro: "Most people watch with the sound off. Word-by-word captions and on-screen hooks stop the scroll and hold attention.",
    accent: "from-orange-500 to-amber-400",
    features: [
      { icon: Captions, title: "7 animated caption styles", text: "Bold pop, Karaoke, Neon glow, Word reveal, One word, Comic and Minimal, each synced word by word." },
      { icon: Palette, title: "Any highlight colour", text: "Pick from seven brand-friendly colours or choose your own; captions can sit lower or in the middle." },
      { icon: Type, title: "Hook title card", text: "A punchy on-screen hook for the first three seconds, written for each clip." },
      { icon: AtSign, title: "Your @handle on screen", text: "Put your channel name on every Short so reposts still lead back to you." },
      { icon: Wand2, title: "End card", text: "Finish with “Follow for more”, “Full video on my channel” or your own call to action." },
      { icon: Repeat, title: "Remembers your style", text: "Your caption, look and branding choices are saved, so every new video matches your channel." },
    ],
  },
  {
    id: "publish",
    icon: Send,
    eyebrow: "Publishing",
    title: "Post everywhere in one click",
    intro: "Connect your accounts once. Then pick your Shorts, choose one platform or all of them, and publish.",
    accent: "from-sky-500 to-indigo-500",
    features: [
      { icon: Send, title: "YouTube, Instagram & Facebook", text: "Publish to YouTube Shorts, Instagram Reels and Facebook Reels at the same time, or to just one." },
      { icon: PenLine, title: "AI-written titles & descriptions", text: "Each Short gets a click-worthy title and a short description in the video's own language.", tag: "AI" },
      { icon: Hash, title: "Trending hashtags", text: "Hashtags are pulled from this week's most-viewed Shorts on the same topic, then matched to your clip." },
      { icon: SlidersHorizontal, title: "Review before posting", text: "Edit any title, description or hashtag, add trending tags with a tap, and choose public, unlisted or private." },
      { icon: ListChecks, title: "Select exactly what to post", text: "Tick individual Shorts or select them all; a Short is never posted twice to the same platform." },
      { icon: Bell, title: "Live progress & notifications", text: "Watch each upload progress, then get a pop-up with a “View” link, plus a desktop alert if you're in another tab." },
    ],
  },
  {
    id: "workflow",
    icon: Sparkles,
    eyebrow: "Workflow",
    title: "Made for creators who post every day",
    intro: "Everything is built to save you time, from the first paste to the last upload.",
    accent: "from-emerald-500 to-teal-400",
    features: [
      { icon: Gauge, title: "Live progress", text: "See each step as it happens: reading, transcript, finding moments, downloading and rendering." },
      { icon: Download, title: "Download any or all", text: "Grab a single MP4 or download every Short at once." },
      { icon: Copy, title: "Copy-ready captions", text: "Copy the title, or the description with hashtags, in one click for manual posting." },
      { icon: Library, title: "Your library", text: "Every video you've clipped is saved, so you can come back, re-download or publish later." },
      { icon: MonitorSmartphone, title: "Works on any device", text: "Use it from your laptop or your phone; the whole site adapts to small screens." },
      { icon: ShieldCheck, title: "Private by design", text: "Runs on your own computer. Your videos and API keys stay with you, and keys are never shown in full." },
      { icon: KeyRound, title: "Easy setup", text: "Paste your keys in Settings and they're checked instantly, with step-by-step guides for every platform." },
    ],
  },
];

const STATS = [
  { value: "10", label: "Shorts per video" },
  { value: "7", label: "caption styles" },
  { value: "3", label: "platforms in one click" },
  { value: "4h", label: "videos supported" },
];

export function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-24 pt-28">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-pink">Features</p>
        <h2 className="mx-auto mt-2 max-w-3xl font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Everything you need to turn one video into <span className="text-gradient">a week of Shorts</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-300">
          AI that finds the moments, an editor that makes them look great, and a publisher that posts them everywhere.
        </p>
      </div>

      {/* Stats */}
      <dl className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="glass rounded-2xl px-4 py-5 text-center">
            <dt className="sr-only">{s.label}</dt>
            <dd>
              <span className="block font-display text-4xl font-bold text-gradient">{s.value}</span>
              <span className="mt-1 block text-sm text-ink-300">{s.label}</span>
            </dd>
          </div>
        ))}
      </dl>

      {/* Quick jump */}
      <nav aria-label="Feature groups" className="mt-10 flex flex-wrap justify-center gap-2">
        {GROUPS.map((g) => (
          <a
            key={g.id}
            href={`#f-${g.id}`}
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-4 py-2 text-sm font-medium text-ink-200 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:text-white"
          >
            <g.icon className="h-4 w-4" />
            {g.eyebrow}
          </a>
        ))}
      </nav>

      <div className="mt-14 space-y-20">
        {GROUPS.map((g) => (
          <div key={g.id} id={`f-${g.id}`} className="scroll-mt-28">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${g.accent} shadow-lg`}>
                    <g.icon className="h-5 w-5 text-white" />
                  </span>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-ink-300">{g.eyebrow}</p>
                </div>
                <h3 className="mt-4 font-display text-2xl font-bold text-white sm:text-3xl">{g.title}</h3>
                <p className="mt-2 text-ink-300">{g.intro}</p>
              </div>
              {g.id === "publish" && (
                <div className="flex items-center gap-2">
                  <PlatformBadge platform="youtube" size="lg" />
                  <PlatformBadge platform="instagram" size="lg" />
                  <PlatformBadge platform="facebook" size="lg" />
                </div>
              )}
            </div>
            <div className={`mt-7 grid gap-3 sm:grid-cols-2 ${g.features.length % 3 === 0 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
              {g.features.map((f, i) => (
                <div
                  key={f.title}
                  className={`glass group relative rounded-2xl p-5 transition duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.06] ${
                    // Odd-sized groups: widen the first card so every row is full.
                    i === 0 && g.features.length % 2 === 1 ? "sm:col-span-2" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-brand-pink ring-1 ring-white/10 transition group-hover:bg-white/[0.1]">
                      <f.icon className="h-[1.1rem] w-[1.1rem]" />
                    </span>
                    {f.tag && (
                      <span className="bg-brand rounded-full px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider text-white">
                        {f.tag}
                      </span>
                    )}
                  </div>
                  <h4 className="mt-4 font-semibold text-white">{f.title}</h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Closing call to action */}
      <div className="glass ring-brand mt-20 flex flex-col items-center gap-5 rounded-3xl px-6 py-10 text-center">
        <h3 className="font-display text-2xl font-bold text-white sm:text-3xl">Ready to make your first batch?</h3>
        <p className="max-w-xl text-ink-300">Paste any YouTube link and get Shorts ready to publish in minutes.</p>
        <a
          href="#create"
          className="bg-brand inline-flex items-center gap-2 rounded-xl px-6 py-3 font-display font-semibold text-white shadow-lg shadow-brand-pink/25 transition hover:brightness-110"
        >
          <Sparkles className="h-5 w-5" /> Create Shorts now
        </a>
      </div>
    </section>
  );
}
