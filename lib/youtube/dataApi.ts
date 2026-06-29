import { getSettings, getOAuthTokens, saveOAuthTokens } from "@/lib/store";
import { refreshAccessToken } from "@/lib/youtubeOAuth";

const YT_API = "https://www.googleapis.com/youtube/v3";

export type LiveVideoStats = {
  concurrentViewers: number | null;
  viewCount: number | null;
  source: "youtube_api" | "simulated";
};

export type VideoBroadcastState = {
  videoId: string;
  liveBroadcastContent: "none" | "live" | "upcoming" | "completed";
  source: "youtube_api";
};

export type MetadataWriteResult = {
  ok: boolean;
  httpStatus: number;
  error?: string;
  videoId: string;
  fields: string[];
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
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${YT_API}${path}?${qs}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, data: null, error: error.slice(0, 500) };
  }
  return { ok: true, status: res.status, data: (await res.json()) as T };
}

async function ytGetWithKey<T>(
  apiKey: string,
  path: string,
  params: Record<string, string>
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const qs = new URLSearchParams({ ...params, key: apiKey });
  const res = await fetch(`${YT_API}${path}?${qs}`);
  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, data: null, error: error.slice(0, 500) };
  }
  return { ok: true, status: res.status, data: (await res.json()) as T };
}

/** Read-only YouTube GET: OAuth first, then API key fallback. */
async function ytGetRead<T>(
  channelId: string,
  path: string,
  params: Record<string, string>
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const token = await resolveAccessToken(channelId);
  if (token) {
    const oauth = await ytGet<T>(token, path, params);
    if (oauth.ok && oauth.data) return oauth;
  }

  const apiKey = await resolveApiKey();
  if (apiKey) return ytGetWithKey<T>(apiKey, path, params);
  return { ok: false, status: 0, data: null, error: "No YouTube credentials" };
}

/** Live concurrent viewers from YouTube Data API (OAuth or API key). */
export async function fetchLiveVideoStats(
  channelId: string,
  videoId: string
): Promise<LiveVideoStats | null> {
  const res = await ytGetRead<{
    items?: Array<{
      statistics?: { viewCount?: string };
      liveStreamingDetails?: { concurrentViewers?: string };
    }>;
  }>(channelId, "/videos", {
    part: "statistics,liveStreamingDetails",
    id: videoId,
  });

  const item = res.data?.items?.[0];
  if (!item) return null;

  return {
    concurrentViewers: item.liveStreamingDetails?.concurrentViewers
      ? Number(item.liveStreamingDetails.concurrentViewers)
      : null,
    viewCount: item.statistics?.viewCount ? Number(item.statistics.viewCount) : null,
    source: "youtube_api",
  };
}

export async function fetchVideoBroadcastState(
  channelId: string,
  videoId: string
): Promise<VideoBroadcastState | null> {
  const res = await ytGetRead<{
    items?: Array<{ snippet?: { liveBroadcastContent?: string } }>;
  }>(channelId, "/videos", {
    part: "snippet",
    id: videoId,
  });

  const snippet = res.data?.items?.[0]?.snippet;
  if (!snippet) return null;

  const state = (snippet.liveBroadcastContent ?? "none") as VideoBroadcastState["liveBroadcastContent"];
  return { videoId, liveBroadcastContent: state, source: "youtube_api" };
}

/** Patch video description + tags on YouTube (OAuth write scope). */
export async function updateVideoMetadata(
  channelId: string,
  videoId: string,
  patch: { description?: string; tags?: string[]; title?: string }
): Promise<MetadataWriteResult> {
  const fields: string[] = [];
  if (patch.title) fields.push("title");
  if (patch.description) fields.push("description");
  if (patch.tags) fields.push("tags");

  const token = await resolveAccessToken(channelId);
  if (!token) {
    return {
      ok: false,
      httpStatus: 401,
      error: "OAuth token missing — connect YouTube on roster",
      videoId,
      fields,
    };
  }

  const current = await ytGet<{
    items?: Array<{ snippet?: { title?: string; description?: string; tags?: string[]; categoryId?: string } }>;
  }>(token, "/videos", { part: "snippet", id: videoId });

  const snippet = current.data?.items?.[0]?.snippet;
  if (!snippet) {
    return {
      ok: false,
      httpStatus: current.status || 404,
      error: current.error ?? "Video not found on YouTube",
      videoId,
      fields,
    };
  }

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

  if (!res.ok) {
    const error = await res.text();
    return {
      ok: false,
      httpStatus: res.status,
      error: error.slice(0, 500),
      videoId,
      fields,
    };
  }

  return { ok: true, httpStatus: res.status, videoId, fields };
}

/** Channel subscriber count for waiting-room baseline comparison. */
export async function fetchChannelBaseline(channelId: string, youtubeChannelId: string) {
  const res = await ytGetRead<{
    items?: Array<{ statistics?: { subscriberCount?: string; viewCount?: string } }>;
  }>(channelId, "/channels", {
    part: "statistics",
    id: youtubeChannelId,
  });

  const stats = res.data?.items?.[0]?.statistics;
  if (!stats) return null;
  return {
    subscribers: stats.subscriberCount ? Number(stats.subscriberCount) : 0,
    views: stats.viewCount ? Number(stats.viewCount) : 0,
  };
}

export type YoutubeCommentThread = {
  authorDisplayName: string;
  textDisplay: string;
  likeCount: number;
  replyCount: number;
};

/** Public comment threads on a video — OAuth first, then API key (same as view counts). */
export async function fetchVideoCommentThreads(
  channelId: string,
  videoId: string,
  maxResults = 10
): Promise<{ ok: boolean; threads: YoutubeCommentThread[]; error?: string }> {
  const res = await ytGetRead<{
    items?: Array<{
      snippet?: {
        totalReplyCount?: number;
        topLevelComment?: {
          snippet?: {
            authorDisplayName?: string;
            textDisplay?: string;
            likeCount?: number;
          };
        };
      };
    }>;
  }>(channelId, "/commentThreads", {
    part: "snippet",
    videoId,
    maxResults: String(maxResults),
    order: "relevance",
    textFormat: "plainText",
  });

  if (!res.ok || !res.data) {
    return {
      ok: false,
      threads: [],
      error: res.error
        ? `YouTube API ${res.status}: ${res.error.slice(0, 120)}`
        : "YouTube returned no comment data",
    };
  }

  const threads: YoutubeCommentThread[] = [];
  for (const thread of res.data.items ?? []) {
    const top = thread.snippet?.topLevelComment?.snippet;
    if (!top?.textDisplay?.trim()) continue;
    threads.push({
      authorDisplayName: top.authorDisplayName ?? "YouTube viewer",
      textDisplay: top.textDisplay,
      likeCount: top.likeCount ?? 0,
      replyCount: thread.snippet?.totalReplyCount ?? 0,
    });
  }

  if (!threads.length) {
    return {
      ok: false,
      threads: [],
      error: "No comments returned — video may have comments disabled or none yet",
    };
  }

  return { ok: true, threads };
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

export async function getYoutubeGlobalStatus() {
  const settings = await getSettings();
  const apiKey = Boolean(
    settings.youtubeApiKey?.trim() || process.env.YTX_YOUTUBE_API_KEY?.trim()
  );
  const oauthConfig = Boolean(
    settings.googleClientId?.trim() && settings.googleClientSecret?.trim()
  );
  return { apiKey, oauthConfig };
}
