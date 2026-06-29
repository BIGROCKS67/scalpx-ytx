import type { ShowFormat, ShowRun, YtChannel } from "@/lib/types";
import type { YoutubeChannelAnalytics, YoutubeDashboardAnalytics, YoutubeVideoAnalytics } from "@/lib/youtube/dashboardAnalytics";
import {
  channelContentDna,
  extractTopicsFromTitle,
  inferFormatFromTitle,
} from "@/lib/insights/channelDna";

export type ViralPick = {
  videoId: string;
  title: string;
  channelSlug: string;
  channelName: string;
  channelId: string;
  showId: string | null;
  thumbnailUrl: string;
  watchUrl: string;
  publishedAt: string;
  viewCount: number;
  viewVelocity: number;
  engagementRate: number;
  outlierFactor: number;
  score: number;
  why: string;
  topics: string[];
};

export type ChannelRhythm = {
  channelId: string;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  showFormats: ShowFormat[];
  typicalTopics: string[];
  dominantFormat: ShowFormat;
  avgViewsRecent: number;
  uploadsLast7Days: number;
  summary: string;
};

export type StreamReadySuggestion = {
  channelId: string;
  channelSlug: string;
  channelName: string;
  format: ShowFormat;
  title: string;
  rationale: string;
  urgency: "high" | "medium" | "low";
  trendTopics: string[];
  inspiredBy: string | null;
};

export type TrendStreamInsights = {
  ok: boolean;
  fetchedAt: string;
  viralNow: ViralPick[];
  channelRhythm: ChannelRhythm[];
  streamReady: StreamReadySuggestion[];
  crossTrendTopics: string[];
};

const VIRAL_WINDOW_DAYS = 14;

function hoursSince(iso: string): number {
  return Math.max(1, (Date.now() - new Date(iso).getTime()) / 3_600_000);
}

function viewVelocity(v: YoutubeVideoAnalytics): number {
  return v.viewCount / hoursSince(v.publishedAt);
}

function engagementRate(v: YoutubeVideoAnalytics): number {
  const likes = v.likeCount ?? 0;
  const comments = v.commentCount ?? 0;
  return (likes + comments * 3) / Math.max(v.viewCount, 1);
}

function scoreVideo(v: YoutubeVideoAnalytics, channelAvgVelocity: number): Omit<ViralPick, "why"> & { why: string } {
  const velocity = viewVelocity(v);
  const engagement = engagementRate(v);
  const outlier = channelAvgVelocity > 0 ? velocity / channelAvgVelocity : 1;
  const score = outlier * (1 + engagement * 12);
  const topics = extractTopicsFromTitle(v.title);

  let why = `${Math.round(velocity).toLocaleString()} views/hr`;
  if (outlier >= 1.4) why += ` · ${outlier.toFixed(1)}× channel pace`;
  if (engagement >= 0.08) why += " · strong engagement";

  return {
    videoId: v.videoId,
    title: v.title,
    channelSlug: v.channelSlug,
    channelName: v.channelName,
    channelId: v.channelId,
    showId: v.showId,
    thumbnailUrl: v.thumbnailUrl,
    watchUrl: v.watchUrl,
    publishedAt: v.publishedAt,
    viewCount: v.viewCount,
    viewVelocity: velocity,
    engagementRate: engagement,
    outlierFactor: outlier,
    score,
    why,
    topics,
  };
}

function buildViralPicks(analytics: YoutubeDashboardAnalytics): ViralPick[] {
  const cutoff = Date.now() - VIRAL_WINDOW_DAYS * 86_400_000;
  const byChannel = new Map<string, YoutubeVideoAnalytics[]>();

  for (const ch of analytics.channels) {
    byChannel.set(ch.slug, ch.recentVideos);
  }

  const picks: ViralPick[] = [];

  for (const [, videos] of byChannel) {
    const recent = videos.filter((v) => new Date(v.publishedAt).getTime() >= cutoff);
    if (!recent.length) continue;

    const avgVelocity =
      recent.reduce((sum, v) => sum + viewVelocity(v), 0) / Math.max(recent.length, 1);

    const scored = recent
      .map((v) => scoreVideo(v, avgVelocity))
      .sort((a, b) => b.score - a.score);

    for (const top of scored.slice(0, 2)) {
      if (top.score >= 1.1 || top.outlierFactor >= 1.25) {
        picks.push(top);
      }
    }
  }

  return picks.sort((a, b) => b.score - a.score).slice(0, 6);
}

function buildChannelRhythm(
  channel: YtChannel,
  channelAnalytics: YoutubeChannelAnalytics | undefined
): ChannelRhythm {
  const dna = channelContentDna(channel);
  const videos = channelAnalytics?.recentVideos ?? [];
  const weekAgo = Date.now() - 7 * 86_400_000;
  const uploadsLast7Days = videos.filter((v) => new Date(v.publishedAt).getTime() >= weekAgo).length;
  const avgViewsRecent =
    videos.length > 0 ? videos.reduce((n, v) => n + v.viewCount, 0) / videos.length : 0;

  const titleTopics = videos.flatMap((v) => extractTopicsFromTitle(v.title));
  const topicCounts = new Map<string, number>();
  for (const t of [...titleTopics, ...dna.topics.map((x) => x.toLowerCase())]) {
    topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
  }
  const typicalTopics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t);

  const formatCounts = new Map<ShowFormat, number>();
  for (const v of videos) {
    const fmt = inferFormatFromTitle(channel, v.title);
    formatCounts.set(fmt, (formatCounts.get(fmt) ?? 0) + 1);
  }
  const dominantFormat =
    [...formatCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    dna.formats[0] ??
    "stream";

  const formatLabel = dna.formats.map((f) => f).join(" · ");
  const summary = `Usually ${formatLabel} — ${typicalTopics.slice(0, 3).join(", ") || "crypto live content"}`;

  return {
    channelId: channel.id,
    slug: channel.slug,
    displayName: channel.displayName,
    avatarUrl: channel.avatarUrl,
    showFormats: dna.formats,
    typicalTopics,
    dominantFormat,
    avgViewsRecent: Math.round(avgViewsRecent),
    uploadsLast7Days,
    summary,
  };
}

function hasUpcomingStream(shows: ShowRun[], channelId: string, withinHours = 72): boolean {
  const cutoff = Date.now() + withinHours * 3_600_000;
  return shows.some(
    (s) =>
      s.channelId === channelId &&
      ["scheduled", "live", "draft"].includes(s.status) &&
      (!s.scheduledAt || new Date(s.scheduledAt).getTime() <= cutoff)
  );
}

function buildTitleSuggestion(
  channel: YtChannel,
  format: ShowFormat,
  topic: string,
  dna: ReturnType<typeof channelContentDna>
): string {
  const t = topic.charAt(0).toUpperCase() + topic.slice(1);
  if (channel.slug === "banter") {
    if (format === "banter") return `Banter Live · ${t} — What Everyone's Getting Wrong`;
    return `Crypto Banter: ${t} Market Breakdown (Live)`;
  }
  if (format === "education") return `Bitcoin Analysis: ${t} Setup & Next Move`;
  if (format === "banter") return `Banter · ${t} — Live With Chento`;
  if (/prop firm|challenge/i.test(topic)) return `BITCOIN LIVE TRADING: ${t} | Live Session`;
  return `${dna.streamStyle}: ${t} — Live Session`;
}

function buildStreamSuggestions(
  channels: YtChannel[],
  rhythms: ChannelRhythm[],
  viralNow: ViralPick[],
  crossTopics: string[],
  shows: ShowRun[]
): StreamReadySuggestion[] {
  const suggestions: StreamReadySuggestion[] = [];

  for (const channel of channels) {
    const rhythm = rhythms.find((r) => r.slug === channel.slug);
    const dna = channelContentDna(channel);
    const channelViral = viralNow.filter((v) => v.channelSlug === channel.slug);
    const gap = !hasUpcomingStream(shows, channel.id);
    const urgency: StreamReadySuggestion["urgency"] = gap ? "high" : "medium";

    const hotTopics = [
      ...new Set([
        ...channelViral.flatMap((v) => v.topics),
        ...crossTopics,
        ...rhythm!.typicalTopics.slice(0, 3),
      ]),
    ].slice(0, 4);

    if (channelViral[0]) {
      const inspired = channelViral[0];
      const fmt = inferFormatFromTitle(channel, inspired.title);
      const topic = inspired.topics[0] ?? hotTopics[0] ?? "bitcoin";
      suggestions.push({
        channelId: channel.id,
        channelSlug: channel.slug,
        channelName: channel.displayName,
        format: fmt,
        title: buildTitleSuggestion(channel, fmt, topic, dna),
        rationale: gap
          ? `No stream queued — ride momentum from “${inspired.title.slice(0, 48)}…”`
          : `Double down on what's working (${inspired.why})`,
        urgency,
        trendTopics: inspired.topics.length ? inspired.topics : [topic],
        inspiredBy: inspired.title,
      });
    }

    const altFormat =
      rhythm!.dominantFormat === "stream"
        ? dna.formats.find((f) => f !== "stream") ?? "education"
        : "stream";
    const altTopic = hotTopics.find((t) => t !== channelViral[0]?.topics[0]) ?? hotTopics[0] ?? "macro";

    suggestions.push({
      channelId: channel.id,
      channelSlug: channel.slug,
      channelName: channel.displayName,
      format: altFormat,
      title: buildTitleSuggestion(channel, altFormat, altTopic, dna),
      rationale:
        crossTopics.includes(altTopic)
          ? `Cross-channel trend: ${altTopic} is hot on both Chento + Banter right now`
          : `Fits ${channel.displayName}'s usual ${altFormat} rhythm · avg ${rhythm!.avgViewsRecent.toLocaleString()} views on recent uploads`,
      urgency: gap ? "medium" : "low",
      trendTopics: [altTopic],
      inspiredBy: null,
    });
  }

  return suggestions
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.urgency] - order[b.urgency];
    })
    .slice(0, 6);
}

function computeCrossTrendTopics(viralNow: ViralPick[], rhythms: ChannelRhythm[]): string[] {
  const counts = new Map<string, number>();
  for (const v of viralNow) {
    for (const t of v.topics) counts.set(t, (counts.get(t) ?? 0) + 2);
  }
  for (const r of rhythms) {
    for (const t of r.typicalTopics.slice(0, 3)) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);
}

export function buildTrendStreamInsights(
  analytics: YoutubeDashboardAnalytics,
  channels: YtChannel[],
  shows: ShowRun[]
): TrendStreamInsights {
  if (!analytics.ok) {
    return {
      ok: false,
      fetchedAt: new Date().toISOString(),
      viralNow: [],
      channelRhythm: [],
      streamReady: [],
      crossTrendTopics: [],
    };
  }

  const viralNow = buildViralPicks(analytics);
  const channelRhythm = channels.map((ch) => {
    const stats = analytics.channels.find((c) => c.slug === ch.slug);
    return buildChannelRhythm(ch, stats);
  });
  const crossTrendTopics = computeCrossTrendTopics(viralNow, channelRhythm);
  const streamReady = buildStreamSuggestions(channels, channelRhythm, viralNow, crossTrendTopics, shows);

  return {
    ok: true,
    fetchedAt: analytics.fetchedAt,
    viralNow,
    channelRhythm,
    streamReady,
    crossTrendTopics,
  };
}
