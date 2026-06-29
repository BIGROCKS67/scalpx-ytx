import type { NextConfig } from "next";

const basePath = "/ytx";

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
