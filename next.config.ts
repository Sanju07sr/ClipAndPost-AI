import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Video processing runs in the Node.js server; nothing to bundle for the edge.
  poweredByHeader: false,
  images: { unoptimized: true },
};

export default nextConfig;
