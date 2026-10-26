import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Book covers are served by Project Gutenberg's cache.
    remotePatterns: [new URL("https://www.gutenberg.org/cache/epub/**")],
  },
};

export default nextConfig;
