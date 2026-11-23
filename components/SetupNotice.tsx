"use client";

import { useEffect, useState } from "react";
import { Brain, CircleCheck, Eye, EyeOff, LoaderCircle, TriangleAlert } from "lucide-react";

interface Health {
  ok: boolean;
  ytdlp: string | null;
  ffmpeg: string | null;
  claude: boolean;
  captions: boolean | null;
}

/** Tells the person running the site what's missing from their setup. */
export function SetupNotice() {
  const [h, setH] = useState<Health | null>(null);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setH)
      .catch(() => undefined);
  }, []);
  if (!h) return null;
  if (!h.ok) {
    const missing = [!h.ytdlp && "yt-dlp", !h.ffmpeg && "ffmpeg"].filter(Boolean).join(" and ");
    return (
      <div className="mx-auto mt-4 flex max-w-2xl items-start gap-2.5 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-left text-sm text-rose-200">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          The server is missing <b>{missing}</b>, so videos can&apos;t be processed yet. Install it and run{" "}
          <code className="rounded bg-black/30 px-1">npm run doctor</code>.
        </p>
      </div>
    );
  }
  if (h.captions === false) {
    return (
      <div className="mx-auto mt-4 flex max-w-2xl items-start gap-2.5 rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-left text-sm text-amber-100">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p>
            Your ffmpeg can&apos;t draw captions (it was built without <b>libass</b>), so Shorts will render without
            captions or hook cards. On a Mac, swap in the full ffmpeg build in Terminal, then restart the site:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-2.5 text-xs leading-relaxed text-amber-50">
            brew uninstall --ignore-dependencies ffmpeg{"\n"}brew tap homebrew-ffmpeg/ffmpeg{"\n"}brew install homebrew-ffmpeg/ffmpeg/ffmpeg
          </pre>
        </div>
      </div>
    );
  }
  if (!h.claude) return <AiKeyBox onSaved={() => setH({ ...h, claude: true })} />;
  return null;
}

/** Inline box under the link field for pasting an Anthropic API key. */
function AiKeyBox({ onSaved }: { onSaved: () => void }) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anthropicApiKey: key }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't save the key");
      setKey("");
      setDone(true);
      setTimeout(onSaved, 2500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 py-3 text-sm font-medium text-lime-100">
        <CircleCheck className="h-4 w-4" /> Key saved. Claude AI is on for your next video.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="glass mt-4 rounded-2xl p-3.5 text-left">
      <label htmlFor="ai-key" className="block">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink-100">
          <Brain className="h-4 w-4 shrink-0 text-brand-pink" /> Turn on Claude AI
        </span>
        <span className="mt-0.5 block text-xs text-ink-400">
          Optional: smarter moment picking, speaker framing and YouTube titles.
        </span>
      </label>
      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <input
            id="ai-key"
            type={show ? "text" : "password"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste your Anthropic API key (sk-ant-…)"
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full rounded-xl bg-ink-950/70 pl-3.5 pr-10 font-mono text-sm text-white ring-1 ring-white/10 placeholder:font-sans placeholder:text-ink-400 focus:outline-none focus:ring-brand-pink/60"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-400 hover:text-white"
            aria-label={show ? "Hide key" : "Show key"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <button
          type="submit"
          disabled={!key.trim() || busy}
          className="bg-brand flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {busy ? "Checking…" : "Save key"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-rose-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      <p className="mt-2 text-xs text-ink-400">
        Get a key at{" "}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-brand-pink underline">
          console.anthropic.com
        </a>
        . It&apos;s checked, then saved only on this computer.
      </p>
    </form>
  );
}
