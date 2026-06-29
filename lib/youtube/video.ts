/** Parse a YouTube watch, short, embed, or youtu.be URL → video id. */
export function parseYouTubeVideoId(url: string): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return id || null;
    }
    if (!host.includes("youtube.com") && !host.includes("youtube-nocookie.com")) return null;
    const v = u.searchParams.get("v");
    if (v) return v;
    const shorts = u.pathname.match(/\/shorts\/([^/?]+)/);
    if (shorts?.[1]) return shorts[1];
    const embed = u.pathname.match(/\/embed\/([^/?]+)/);
    if (embed?.[1]) return embed[1];
    const live = u.pathname.match(/\/live\/([^/?]+)/);
    if (live?.[1]) return live[1];
  } catch {
    // not a URL
  }
  return null;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function isYouTubeUrl(url: string): boolean {
  return Boolean(parseYouTubeVideoId(url));
}
