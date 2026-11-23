import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Video processing runs in the Node.js server; nothing to bundle for the edge.
  poweredByHeader: false,
  images: { unoptimized: true },
  // Pin the project root so a stray package-lock.json in a parent folder
  // (e.g. the home folder) doesn't confuse Turbopack.
  turbopack: { root: path.resolve(".") },
};

export default nextConfig;
