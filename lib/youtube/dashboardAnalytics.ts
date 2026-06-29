import { filterActiveChannels } from "@/lib/activeChannels";
import { getSettings, listChannels, listShows } from "@/lib/store";
import { youtubeThumbnailUrl } from "@/lib/youtube/video";
import type { YtChannel } from "@/lib/types";

const YT_API = "https://www.googleapis.com/youtube/v3";

export type YoutubeVideoAnalytics = {
  videoId: string;
  title: string;
  channelSlug: string;
  channelName: string;
  channelId: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  thumbnailUrl: string;
  showId: string | null;
  watchUrl: string;
};

export type YoutubeChannelAnalytics = {
  channelId: string;
  slug: string;
  displayName: string;
  youtubeChannelId: string;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  avatarUrl: string | null;
  recentVideos: YoutubeVideoAnalytics[];
};

export type YoutubeDashboardAnalytics = {
  ok: boolean;
  source: "youtube_api" | "unavailable";
  fetchedAt: string;
  channels: YoutubeChannelAnalytics[];
  recentVideos: YoutubeVideoAnalytics[];
  totals: {
    subscribers: number;
    views: number;
    recentVideoViews: number;
  };
  error?: string;
};

async function resolveApiKey(): Promise<string | null> {
  const settings = await getSettings();
  return settings.youtubeApiKey?.trim() || process.env.YTX_YOUTUBE_API_KEY?.trim() || null;
}

async function ytGet<T>(key: string, path: string, params: Record<string, string>): Promise<T | null> {
  const qs = new URLSearchParams({ ...params, key });
  const res = await fetch(`${YT_API}${path}?${qs}`);
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

async function fetchRecentVideoIds(
  uploadsPlaylistId: string,
  key: string,
  maxResults: number
): Promise<string[]> {
  const list = await ytGet<{
    items?: Array<{ snippet?: { resourceId?: { videoId?: string } } }>;
  }>(key, "/playlistItems", {
    part: "snippet",
    playlistId: uploadsPlaylistId,
    maxResults: String(maxResults),
  });

  return (
    list?.items
      ?.map((i) => i.snippet?.resourceId?.videoId)
      .filter((id): id is string => Boolean(id)) ?? []
  );
}

async function fetchVideoAnalytics(
  ids: string[],
  channel: YtChannel,
  showByVideoId: Map<string, string>
): Promise<YoutubeVideoAnalytics[]> {
  const key = await resolveApiKey();
  if (!key || !ids.length) return [];

  const details = await ytGet<{
    items?: Array<{
      id: string;
      snippet?: { title?: string; publishedAt?: string };
      statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
    }>;
  }>(key, "/videos", {
    part: "snippet,statistics",
    id: ids.join(","),
  });

  return (
    details?.items?.map((v) => ({
      videoId: v.id,
      title: v.snippet?.title ?? "Untitled",
      channelSlug: channel.slug,
      channelName: channel.displayName,
      channelId: channel.id,
      publishedAt: v.snippet?.publishedAt ?? new Date().toISOString(),
      viewCount: v.statistics?.viewCount ? Number(v.statistics.viewCount) : 0,
      likeCount: v.statistics?.likeCount ? Number(v.statistics.likeCount) : null,
      commentCount: v.statistics?.commentCount ? Number(v.statistics.commentCount) : null,
      thumbnailUrl: youtubeThumbnailUrl(v.id),
      showId: showByVideoId.get(v.id) ?? null,
      watchUrl: `https://www.youtube.com/watch?v=${v.id}`,
    })) ?? []
  );
}

async function fetchChannelAnalytics(
  channel: YtChannel,
  showByVideoId: Map<string, string>,
  videosPerChannel: number
): Promise<YoutubeChannelAnalytics | null> {
  const key = await resolveApiKey();
  const youtubeId = channel.youtubeChannelId?.trim();
  if (!key || !youtubeId) return null;

  const payload = await ytGet<{
    items?: Array<{
      statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }>;
  }>(key, "/channels", {
    part: "statistics,contentDetails",
    id: youtubeId,
  });

  const item = payload?.items?.[0];
  if (!item) return null;

  const uploads = item.contentDetails?.relatedPlaylists?.uploads;
  const videoIds = uploads ? await fetchRecentVideoIds(uploads, key, videosPerChannel) : [];
  const recentVideos = await fetchVideoAnalytics(videoIds, channel, showByVideoId);

  return {
    channelId: channel.id,
    slug: channel.slug,
    displayName: channel.displayName,
    youtubeChannelId: youtubeId,
    subscribers: item.statistics?.subscriberCount ? Number(item.statistics.subscriberCount) : 0,
    totalViews: item.statistics?.viewCount ? Number(item.statistics.viewCount) : 0,
    videoCount: item.statistics?.videoCount ? Number(item.statistics.videoCount) : 0,
    avatarUrl: channel.avatarUrl,
    recentVideos,
  };
}

/** Real YouTube channel + recent video stats for the home dashboard (API key). */
export async function fetchYoutubeDashboardAnalytics(
  videosPerChannel = 4
): Promise<YoutubeDashboardAnalytics> {
  const key = await resolveApiKey();
  if (!key) {
    return {
      ok: false,
      source: "unavailable",
      fetchedAt: new Date().toISOString(),
      channels: [],
      recentVideos: [],
      totals: { subscribers: 0, views: 0, recentVideoViews: 0 },
      error: "YouTube API key not configured",
    };
  }

  const channels = filterActiveChannels(await listChannels());
  const shows = await listShows();
  const showByVideoId = new Map<string, string>();
  for (const show of shows) {
    if (show.youtubeVideoId) showByVideoId.set(show.youtubeVideoId, show.id);
  }

  const results = await Promise.all(
    channels.map((ch) => fetchChannelAnalytics(ch, showByVideoId, videosPerChannel))
  );
  const channelStats = results.filter((r): r is YoutubeChannelAnalytics => r !== null);

  const recentVideos = channelStats
    .flatMap((c) => c.recentVideos)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, videosPerChannel * 2);

  const totals = {
    subscribers: channelStats.reduce((n, c) => n + c.subscribers, 0),
    views: channelStats.reduce((n, c) => n + c.totalViews, 0),
    recentVideoViews: recentVideos.reduce((n, v) => n + v.viewCount, 0),
  };

  return {
    ok: channelStats.length > 0,
    source: channelStats.length > 0 ? "youtube_api" : "unavailable",
    fetchedAt: new Date().toISOString(),
    channels: channelStats,
    recentVideos,
    totals,
    error: channelStats.length === 0 ? "Could not load channel stats from YouTube" : undefined,
  };
}
