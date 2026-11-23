import Link from "next/link";
import { Logo } from "./Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="ClipForge AI home">
          <Logo className="h-8 w-8" />
          <span className="font-display text-lg font-semibold tracking-tight">
            ClipForge <span className="text-gradient">AI</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm text-ink-300">
          <Link href="/#how" className="hidden rounded-lg px-3 py-2 transition hover:bg-white/5 hover:text-white sm:block">
            How it works
          </Link>
          <Link href="/#features" className="hidden rounded-lg px-3 py-2 transition hover:bg-white/5 hover:text-white sm:block">
            Features
          </Link>
          <Link href="/#recent" className="rounded-lg px-3 py-2 transition hover:bg-white/5 hover:text-white">
            My clips
          </Link>
          <Link
            href="/#create"
            className="ml-1 rounded-lg bg-white px-3.5 py-2 font-medium text-ink-950 transition hover:bg-ink-100"
          >
            Create Shorts
          </Link>
        </nav>
      </div>
    </header>
  );
}
