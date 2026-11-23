// Browser-safe helpers (no Node imports) shared by the UI and the server.

const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

/** Extracts the 11-character video id from any YouTube link format. */
export function youTubeId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim().startsWith("http") ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  if (!YT_HOSTS.has(url.hostname.toLowerCase())) return null;
  let id: string | null = null;
  if (url.hostname.toLowerCase().endsWith("youtu.be")) {
    id = url.pathname.split("/")[1] || null;
  } else if (url.pathname === "/watch") {
    id = url.searchParams.get("v");
  } else {
    const m = url.pathname.match(/^\/(shorts|live|embed|v)\/([^/?#]+)/);
    if (m) id = m[2];
  }
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  return id;
}

/** Returns a canonical watch URL, or null if this isn't a YouTube video link. */
export function normalizeYouTubeUrl(input: string): string | null {
  const id = youTubeId(input);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}
