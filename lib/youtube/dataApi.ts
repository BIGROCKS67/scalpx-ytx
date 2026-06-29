import { getSettings, getOAuthTokens, saveOAuthTokens } from "@/lib/store";
import { refreshAccessToken } from "@/lib/youtubeOAuth";

const YT_API = "https://www.googleapis.com/youtube/v3";

export type LiveVideoStats = {
  concurrentViewers: number | null;
  viewCount: number | null;
  source: "youtube_api" | "simulated";
};

async function resolveAccessToken(channelId: string): Promise<string | null> {
  const tokens = await getOAuthTokens(channelId);
  if (!tokens?.accessToken) return null;

  const expires = new Date(tokens.expiresAt).getTime();
  if (expires > Date.now() + 60_000) return tokens.accessToken;

  if (!tokens.refreshToken) return tokens.accessToken;

  const settings = await getSettings();
  try {
    const refreshed = await refreshAccessToken(settings, tokens.refreshToken);
    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await saveOAuthTokens(channelId, {
      accessToken: refreshed.access_token,
      refreshToken: tokens.refreshToken,
      expiresAt,
      scopes: tokens.scopes,
    });
    return refreshed.access_token;
  } catch {
    return tokens.accessToken;
  }
}

async function resolveApiKey(): Promise<string | null> {
  const settings = await getSettings();
  const key = settings.youtubeApiKey?.trim() || process.env.YTX_YOUTUBE_API_KEY?.trim();
  return key || null;
}

async function ytGet<T>(
  accessToken: string,
  path: string,
  params: Record<string, string>
): Promise<T | null> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${YT_API}${path}?${qs}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

async function ytGetWithKey<T>(
  apiKey: string,
  path: string,
  params: Record<string, string>
): Promise<T | null> {
  const qs = new URLSearchParams({ ...params, key: apiKey });
  const res = await fetch(`${YT_API}${path}?${qs}`);
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

/** Read-only YouTube GET: OAuth first, then API key fallback. */
async function ytGetRead<T>(
  channelId: string,
  path: string,
  params: Record<string, string>
): Promise<T | null> {
  const token = await resolveAccessToken(channelId);
  if (token) {
    const data = await ytGet<T>(token, path, params);
    if (data) return data;
  }

  const apiKey = await resolveApiKey();
  if (apiKey) return ytGetWithKey<T>(apiKey, path, params);
  return null;
}

/** Live concurrent viewers from YouTube Data API (OAuth or API key). */
export async function fetchLiveVideoStats(
  channelId: string,
  videoId: string
): Promise<LiveVideoStats | null> {
  const data = await ytGetRead<{
    items?: Array<{
      statistics?: { viewCount?: string };
      liveStreamingDetails?: { concurrentViewers?: string };
    }>;
  }>(channelId, "/videos", {
    part: "statistics,liveStreamingDetails",
    id: videoId,
  });

  const item = data?.items?.[0];
  if (!item) return null;

  return {
    concurrentViewers: item.liveStreamingDetails?.concurrentViewers
      ? Number(item.liveStreamingDetails.concurrentViewers)
      : null,
    viewCount: item.statistics?.viewCount ? Number(item.statistics.viewCount) : null,
    source: "youtube_api",
  };
}

/** Patch video description + tags on YouTube (OAuth write scope). */
export async function updateVideoMetadata(
  channelId: string,
  videoId: string,
  patch: { description?: string; tags?: string[]; title?: string }
): Promise<boolean> {
  const token = await resolveAccessToken(channelId);
  if (!token) return false;

  const current = await ytGet<{
    items?: Array<{ snippet?: { title?: string; description?: string; tags?: string[]; categoryId?: string } }>;
  }>(token, "/videos", { part: "snippet", id: videoId });

  const snippet = current?.items?.[0]?.snippet;
  if (!snippet) return false;

  const body = {
    id: videoId,
    snippet: {
      ...snippet,
      title: patch.title ?? snippet.title,
      description: patch.description ?? snippet.description,
      tags: patch.tags ?? snippet.tags,
    },
  };

  const res = await fetch(`${YT_API}/videos?part=snippet`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

/** Channel subscriber count for waiting-room baseline comparison. */
export async function fetchChannelBaseline(channelId: string, youtubeChannelId: string) {
  const data = await ytGetRead<{
    items?: Array<{ statistics?: { subscriberCount?: string; viewCount?: string } }>;
  }>(channelId, "/channels", {
    part: "statistics",
    id: youtubeChannelId,
  });

  const stats = data?.items?.[0]?.statistics;
  if (!stats) return null;
  return {
    subscribers: stats.subscriberCount ? Number(stats.subscriberCount) : 0,
    views: stats.viewCount ? Number(stats.viewCount) : 0,
  };
}

export async function youtubeApiReady(channelId: string): Promise<boolean> {
  const tokens = await getOAuthTokens(channelId);
  if (tokens?.accessToken) return true;
  return Boolean(await resolveApiKey());
}

export async function youtubeWriteReady(channelId: string): Promise<boolean> {
  const tokens = await getOAuthTokens(channelId);
  return Boolean(tokens?.accessToken);
}
