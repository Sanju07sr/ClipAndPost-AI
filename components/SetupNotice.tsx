"use client";

import { useEffect, useState } from "react";
import { Info, TriangleAlert } from "lucide-react";

interface Health {
  ok: boolean;
  ytdlp: string | null;
  ffmpeg: string | null;
  claude: boolean;
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
  if (!h.claude) {
    return (
      <div className="mx-auto mt-4 flex max-w-2xl items-start gap-2.5 rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-left text-sm text-amber-100">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Running without AI: add <code className="rounded bg-black/30 px-1">ANTHROPIC_API_KEY</code> to{" "}
          <code className="rounded bg-black/30 px-1">.env.local</code> so Claude picks the moments and frames the speaker.
          Until then a built-in picker is used.
        </p>
      </div>
    );
  }
  return null;
}
