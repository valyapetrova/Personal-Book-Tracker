import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Book covers are served by Project Gutenberg's cache.
    remotePatterns: [new URL("https://www.gutenberg.org/cache/epub/**")],
  },
  // The bookcase used to live at /shelves; it is the home page now.
  async redirects() {
    return [{ source: "/shelves", destination: "/", permanent: true }];
  },
};

export default nextConfig;
