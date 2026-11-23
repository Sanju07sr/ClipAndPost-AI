import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Toaster } from "@/components/Toaster";

export const metadata: Metadata = {
  title: "ClipAndPost AI: Clip YouTube videos into Shorts and post them everywhere",
  description:
    "Paste a YouTube link and get vertical, captioned Shorts of the best moments, picked by AI and ready to upload.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#06060a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <div className="aurora" aria-hidden />
        <AnimatedBackground />
        <div className="grid-bg" aria-hidden />
        <div className="grain" aria-hidden />
        <Header />
        <main>{children}</main>
        <Toaster />
        <footer className="mx-auto mt-24 max-w-6xl px-4 pb-10 text-sm text-ink-400 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 sm:flex-row">
            <p>ClipAndPost AI · Clip long videos into Shorts and post them everywhere</p>
            <p>Only clip videos you own or have permission to reuse.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
