export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="0.55" stopColor="#ec4899" />
          <stop offset="1" stopColor="#fb923c" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#logo-g)" />
      <rect x="22" y="13" width="20" height="38" rx="5" fill="none" stroke="#fff" strokeWidth="4" />
      <path d="M29 26.5v11l9-5.5z" fill="#fff" />
    </svg>
  );
}

/** Generic play-button glyph used next to video links. */
export function VideoGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" />
      <path d="M10 9v6l5-3z" fill="#06060a" />
    </svg>
  );
}
