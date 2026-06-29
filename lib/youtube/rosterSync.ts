import { profileBySlug } from "@/lib/demoProfiles";
import {
  ROSTER_YOUTUBE_CHANNEL_IDS,
  ROSTER_YOUTUBE_HANDLES,
} from "@/lib/rosterYoutubeHandles";
import { youtubeIdForSlug } from "@/lib/rosterChannelIds";
import { getSettings, listChannels, listShows, createShow, updateChannel, updateShow } from "@/lib/store";
import type { ShowFormat, YtChannel } from "@/lib/types";

const YT_API = "https://www.googleapis.com/youtube/v3";

export type RosterSyncResult = {
  ok: boolean;
  channelsUpdated: number;
  showsImported: number;
  errors: string[];
};

async function apiKey(): Promise<string | null> {
  const settings = await getSettings();
  return settings.youtubeApiKey?.trim() || process.env.YTX_YOUTUBE_API_KEY?.trim() || null;
}

async function ytGet<T>(key: string, path: string, params: Record<string, string>): Promise<T | null> {
  const qs = new URLSearchParams({ ...params, key });
  const res = await fetch(`${YT_API}${path}?${qs}`);
  if (!res.ok) {
    const err = await res.text();
    console.warn("[rosterSync]", path, err.slice(0, 200));
    return null;
  }
  return res.json() as Promise<T>;
}

function parseChannelKeywords(keywords: string | undefined): string[] {
  if (!keywords?.trim()) return [];
  const quoted = [...keywords.matchAll(/"([^"]+)"/g)].map((m) => m[1].trim());
  if (quoted.length) return [...new Set(quoted)].slice(0, 15);
  return [...new Set(keywords.split(/\s+/).filter(Boolean))].slice(0, 15);
}

async function resolveYoutubeId(slug: string, key: string): Promise<string | null> {
  const fromFile = youtubeIdForSlug(slug);
  if (fromFile) return fromFile;

  const staticId = ROSTER_YOUTUBE_CHANNEL_IDS[slug];
  if (staticId) return staticId;

  const handle = ROSTER_YOUTUBE_HANDLES[slug];
  if (!handle) return null;

  const data = await ytGet<{ items?: Array<{ id: string }> }>(key, "/channels", {
    part: "id",
    forHandle: handle,
  });
  return data?.items?.[0]?.id ?? null;
}

type ChannelPayload = {
  id: string;
  snippet: {
    title?: string;
    description?: string;
    customUrl?: string;
  };
  statistics?: { subscriberCount?: string; viewCount?: string };
  brandingSettings?: { channel?: { keywords?: string } };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
};

async function fetchChannel(youtubeId: string, key: string): Promise<ChannelPayload | null> {
  const data = await ytGet<{ items?: ChannelPayload[] }>(key, "/channels", {
    part: "snippet,statistics,brandingSettings,contentDetails",
    id: youtubeId,
  });
  return data?.items?.[0] ?? null;
}

type VideoSnippet = {
  title: string;
  description: string;
  tags?: string[];
  publishedAt: string;
  liveBroadcastContent?: string;
};

async function fetchRecentVideos(
  uploadsPlaylistId: string,
  key: string,
  maxResults = 5
): Promise<Array<{ videoId: string; snippet: VideoSnippet }>> {
  const list = await ytGet<{
    items?: Array<{ snippet?: { resourceId?: { videoId?: string }; title?: string; description?: string; publishedAt?: string } }>;
  }>(key, "/playlistItems", {
    part: "snippet",
    playlistId: uploadsPlaylistId,
    maxResults: String(maxResults),
  });

  const ids =
    list?.items
      ?.map((i) => i.snippet?.resourceId?.videoId)
      .filter((id): id is string => Boolean(id)) ?? [];

  if (!ids.length) return [];

  const details = await ytGet<{ items?: Array<{ id: string; snippet?: VideoSnippet }> }>(key, "/videos", {
    part: "snippet",
    id: ids.join(","),
  });

  return (
    details?.items?.map((v) => ({
      videoId: v.id,
      snippet: v.snippet ?? { title: "Untitled", description: "", publishedAt: new Date().toISOString() },
    })) ?? []
  );
}

function inferFormat(channel: YtChannel, title: string): ShowFormat {
  if (channel.slug === "banter" || /banter|ama|guest/i.test(title)) return "banter";
  if (/education|lesson|how to|guide|101/i.test(title)) return "education";
  return channel.showFormats[0] ?? "stream";
}

function socialFromCustomUrl(customUrl: string | undefined): Record<string, string> {
  if (!customUrl) return {};
  const handle = customUrl.replace(/^@/, "");
  return { youtube: `https://www.youtube.com/@${handle}` };
}

export async function syncRosterFromYoutube(): Promise<RosterSyncResult> {
  const key = await apiKey();
  const result: RosterSyncResult = {
    ok: false,
    channelsUpdated: 0,
    showsImported: 0,
    errors: [],
  };

  if (!key) {
    result.errors.push("No YouTube API key — add YTX_YOUTUBE_API_KEY or Settings → API key");
    return result;
  }

  const channels = await listChannels();
  const existingShows = await listShows();
  const videoIds = new Set(existingShows.map((s) => s.youtubeVideoId).filter(Boolean));
  const syncedSlugs = new Set<string>();

  for (const channel of channels) {
    try {
      const youtubeId = await resolveYoutubeId(channel.slug, key);
      if (!youtubeId) continue;

      const payload = await fetchChannel(youtubeId, key);
      if (!payload) {
        result.errors.push(`${channel.slug}: YouTube channel not found (${youtubeId})`);
        continue;
      }

      const tags = parseChannelKeywords(payload.brandingSettings?.channel?.keywords);
      const description = payload.snippet.description?.trim() || channel.descriptionTemplate;
      const socialLinks = {
        ...channel.socialLinks,
        ...socialFromCustomUrl(payload.snippet.customUrl),
      };

      await updateChannel(channel.id, {
        youtubeChannelId: youtubeId,
        displayName: payload.snippet.title?.trim() || channel.displayName,
        descriptionTemplate: description,
        tags: tags.length ? tags : channel.tags,
        socialLinks,
      });
      result.channelsUpdated++;
      syncedSlugs.add(channel.slug);

      const uploads = payload.contentDetails?.relatedPlaylists?.uploads;
      if (!uploads) continue;

      const videos = await fetchRecentVideos(uploads, key, 5);
      for (const video of videos) {
        if (videoIds.has(video.videoId)) continue;

        const isLive = video.snippet.liveBroadcastContent === "live";
        const { show } = await createShow({
          channelId: channel.id,
          title: video.snippet.title,
          format: inferFormat(channel, video.snippet.title),
          pipeline: "live",
          scheduledAt: video.snippet.publishedAt,
        });

        await updateShow(show.id, {
          youtubeVideoId: video.videoId,
          status: isLive ? "live" : "completed",
          seoTitle: video.snippet.title,
          seoDescription: video.snippet.description?.slice(0, 5000) ?? "",
          seoTags: video.snippet.tags?.slice(0, 15) ?? tags.slice(0, 15),
        });

        videoIds.add(video.videoId);
        result.showsImported++;
      }
    } catch (e) {
      result.errors.push(`${channel.slug}: ${e instanceof Error ? e.message : "sync failed"}`);
    }
  }

  for (const channel of channels) {
    if (syncedSlugs.has(channel.slug)) continue;
    const profile = profileBySlug(channel.slug);
    if (!profile) continue;
    await updateChannel(channel.id, {
      descriptionTemplate: profile.descriptionTemplate,
      tags: profile.tags,
      socialLinks: { ...profile.socialLinks, ...channel.socialLinks },
      channelTrailerDraft: channel.channelTrailerDraft ?? profile.channelTrailerDraft,
    });
    result.channelsUpdated++;
    result.errors.push(`${channel.slug}: no public YouTube yet · using roster copy until UC ID added`);
  }

  result.ok = result.channelsUpdated > 0;
  return result;
}
