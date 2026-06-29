import { parseYouTubeVideoId, youtubeThumbnailUrl } from "@/lib/youtube/video";

export type YouTubeVideoDetails = {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string | null;
  channelId: string | null;
  channelHandle: string | null;
  channelTitle: string | null;
  channelSubscribers: number;
};

const API = "https://api.scrapecreators.com";

function numField(obj: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return 0;
}

async function scFetch(path: string, apiKey: string): Promise<unknown> {
  const res = await fetch(`${API}${path}`, { headers: { "x-api-key": apiKey } });
  if (!res.ok) throw new Error(`ScrapeCreators ${res.status}`);
  return res.json();
}

/** Single video metadata via ScrapeCreators (optional - yt-dlp fallback in import). */
export async function getYouTubeVideo(
  videoUrl: string,
  apiKey: string
): Promise<YouTubeVideoDetails | null> {
  try {
    const data = (await scFetch(
      `/v1/youtube/video?url=${encodeURIComponent(videoUrl.trim())}&language=en`,
      apiKey
    )) as Record<string, unknown>;

    const videoId =
      (data.id as string) ??
      (data.videoId as string) ??
      parseYouTubeVideoId(videoUrl) ??
      "";
    if (!videoId) return null;

    const channel = (data.channel ?? {}) as Record<string, unknown>;
    const thumb =
      (data.thumbnail as string) ??
      (data.thumbnailUrl as string) ??
      (Array.isArray(data.thumbnails) ? (data.thumbnails as { url?: string }[])[0]?.url : undefined) ??
      youtubeThumbnailUrl(videoId);

    const published =
      (data.publishedTime as string) ??
      (data.publishTime as string) ??
      (data.publishedAt as string) ??
      null;

    return {
      videoId,
      title: (data.title as string) ?? "",
      description:
        (data.description as string) ??
        (data.videoDescription as string) ??
        (data.text as string) ??
        "",
      thumbnailUrl: thumb,
      views: numField(data, "viewCountInt", "views", "viewCount"),
      likes: numField(data, "likeCountInt", "likes", "likeCount"),
      comments: numField(data, "commentCountInt", "comments", "commentCount"),
      publishedAt: published ? new Date(published).toISOString() : null,
      channelId: (channel.id as string) ?? null,
      channelHandle: (channel.handle as string)?.replace(/^@/, "") ?? null,
      channelTitle: (channel.title as string) ?? null,
      channelSubscribers: numField(
        channel,
        "subscriberCount",
        "subscriberCountInt",
        "subscribers"
      ),
    };
  } catch {
    return null;
  }
}
