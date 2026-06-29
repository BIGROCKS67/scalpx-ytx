import type { NextConfig } from "next";

const basePath = "/ytx";

const barePathRedirects = [
  "/shows",
  "/channels",
  "/settings",
  "/viral",
].flatMap((segment) => [
  {
    source: segment,
    destination: `${basePath}${segment}`,
    permanent: false as const,
    basePath: false as const,
  },
  {
    source: `${segment}/:path*`,
    destination: `${basePath}${segment}/:path*`,
    permanent: false as const,
    basePath: false as const,
  },
]);

const nextConfig: NextConfig = {
  basePath,
  async redirects() {
    return [
      {
        source: "/",
        destination: basePath,
        permanent: false,
        basePath: false,
      },
      ...barePathRedirects,
    ];
  },
  serverExternalPackages: [
    "better-sqlite3",
    "ffmpeg-static",
    "ffprobe-static",
    "yt-dlp-static",
  ],
  env: {
    NEXT_PUBLIC_YTX_BASE_PATH: basePath,
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
