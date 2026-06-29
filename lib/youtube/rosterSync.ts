import { ROSTER_YOUTUBE_CHANNEL_IDS, ROSTER_YOUTUBE_HANDLES } from "@/lib/rosterYoutubeHandles";
import { youtubeIdForSlug } from "@/lib/rosterChannelIds";
import { getSettings, listChannels, updateChannel } from "@/lib/store";

const YT_API = "https://www.googleapis.com/youtube/v3";

export type RosterSyncResult = {
  ok: boolean;
  channelsUpdated: number;
  /** Legacy field — roster sync no longer auto-creates ShowRuns from old uploads. */
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
    thumbnails?: { high?: { url?: string }; default?: { url?: string } };
  };
  statistics?: { subscriberCount?: string; viewCount?: string };
  brandingSettings?: { channel?: { keywords?: string } };
};

async function fetchChannel(youtubeId: string, key: string): Promise<ChannelPayload | null> {
  const data = await ytGet<{ items?: ChannelPayload[] }>(key, "/channels", {
    part: "snippet,statistics,brandingSettings",
    id: youtubeId,
  });
  return data?.items?.[0] ?? null;
}

function socialFromCustomUrl(customUrl: string | undefined): Record<string, string> {
  if (!customUrl) return {};
  const handle = customUrl.replace(/^@/, "");
  return { youtube: `https://www.youtube.com/@${handle}` };
}

/** Sync channel metadata from YouTube — does not import past videos as ShowRuns. */
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
      const avatarUrl =
        payload.snippet.thumbnails?.high?.url ??
        payload.snippet.thumbnails?.default?.url ??
        channel.avatarUrl;

      await updateChannel(channel.id, {
        youtubeChannelId: youtubeId,
        displayName: payload.snippet.title?.trim() || channel.displayName,
        descriptionTemplate: description,
        tags: tags.length ? tags : channel.tags,
        socialLinks,
        avatarUrl,
      });
      result.channelsUpdated++;
    } catch (e) {
      result.errors.push(`${channel.slug}: ${e instanceof Error ? e.message : "sync failed"}`);
    }
  }

  result.ok = result.channelsUpdated > 0;
  return result;
}
