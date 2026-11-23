"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleCheck, Film, LoaderCircle, TriangleAlert } from "lucide-react";

interface Row {
  id: string;
  createdAt: string;
  status: "queued" | "running" | "done" | "error";
  progress: number;
  title?: string;
  thumbnail?: string;
  url: string;
  clips: number;
}

export function RecentJobs() {
  const [jobs, setJobs] = useState<Row[] | null>(null);

  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch("/api/jobs", { cache: "no-store" })
        .then((r) => r.json())
        .then((d: { jobs: Row[] }) => !stop && setJobs(d.jobs))
        .catch(() => !stop && setJobs([]));
    load();
    const t = setInterval(load, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  if (jobs === null) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (!jobs.length) {
    return (
      <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-10 text-center text-ink-300">
        <Film className="h-6 w-6 text-ink-400" />
        <p>Your Shorts will show up here. Paste a link above to make your first batch.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((j) => (
        <Link
          key={j.id}
          href={`/jobs/${j.id}`}
          className="glass group flex items-center gap-3 rounded-2xl p-3 transition hover:border-white/15 hover:bg-white/[0.06]"
        >
          <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl bg-ink-800">
            {j.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={j.thumbnail}
                alt=""
                onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                className="h-full w-full object-cover transition group-hover:scale-105" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-medium text-ink-100">{j.title || "Reading video…"}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-400">
              {j.status === "done" && (
                <>
                  <CircleCheck className="h-3.5 w-3.5 text-lime-400" /> {j.clips} Short{j.clips === 1 ? "" : "s"}
                </>
              )}
              {(j.status === "running" || j.status === "queued") && (
                <>
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin text-brand-pink" />
                  {j.status === "queued" ? "Queued" : `${j.progress}%`}
                </>
              )}
              {j.status === "error" && (
                <>
                  <TriangleAlert className="h-3.5 w-3.5 text-rose-400" /> Failed
                </>
              )}
              <span className="text-ink-600">·</span>
              {new Date(j.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
