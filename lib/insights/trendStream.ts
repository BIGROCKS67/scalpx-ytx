import type { ShowFormat, ShowRun, YtChannel } from "@/lib/types";
import type { YoutubeChannelAnalytics, YoutubeDashboardAnalytics, YoutubeVideoAnalytics } from "@/lib/youtube/dashboardAnalytics";
import {
  channelContentDna,
  extractTopicsFromTitle,
  inferFormatFromTitle,
} from "@/lib/insights/channelDna";

export type ViralStreamSuggestion = {
  title: string;
  format: ShowFormat;
  topics: string[];
};

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
  /** Action-oriented copy: why to stream off this upload now. */
  streamPitch: string;
  suggestedStream: ViralStreamSuggestion;
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

export function streamCreateHref(params: {
  channelId: string;
  title: string;
  format: ShowFormat;
}): string {
  return `/shows?channel=${params.channelId}&title=${encodeURIComponent(params.title)}&format=${params.format}`;
}

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

type ScoredViralPick = Omit<ViralPick, "streamPitch" | "suggestedStream">;

function scoreVideo(v: YoutubeVideoAnalytics, channelAvgVelocity: number): ScoredViralPick {
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

function buildViralPicks(analytics: YoutubeDashboardAnalytics): ScoredViralPick[] {
  const cutoff = Date.now() - VIRAL_WINDOW_DAYS * 86_400_000;
  const byChannel = new Map<string, YoutubeVideoAnalytics[]>();

  for (const ch of analytics.channels) {
    byChannel.set(ch.slug, ch.recentVideos);
  }

  const picks: ScoredViralPick[] = [];

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

function topicLabel(topic: string): string {
  return topic.replace(/-/g, " ");
}

function capTopic(topic: string): string {
  return topicLabel(topic)
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s$]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TITLE_STOPWORDS = new Set([
  "bitcoin",
  "btc",
  "live",
  "trading",
  "crypto",
  "banter",
  "stream",
  "analysis",
  "market",
  "session",
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "here",
  "why",
  "what",
  "how",
  "your",
]);

function distinctiveTitleWords(title: string): string[] {
  return normalizeTitle(title)
    .split(" ")
    .filter((w) => w.length > 3 && !TITLE_STOPWORDS.has(w));
}

function hasFollowUpAngle(title: string): boolean {
  return /ep\.?\s*\d+|part\s*\d+|after|post-|check-in|follow-up|continuation|update|next setup|fresh levels|not a replay|reality check|where we left|what changed|did we hold|new session|hot topic|trending|momentum|riding/i.test(
    title
  );
}

/** Reject stream titles that read like a rerun of the viral upload. */
export function titlesTooSimilar(suggested: string, source: string): boolean {
  const a = normalizeTitle(suggested);
  const b = normalizeTitle(source);
  if (!a || !b) return false;
  if (a === b) return true;

  const probe = b.slice(0, Math.min(40, b.length));
  if (probe.length >= 22 && a.includes(probe.slice(0, 22))) return true;

  const srcDistinct = distinctiveTitleWords(source);
  const sugDistinct = new Set(distinctiveTitleWords(suggested));
  if (srcDistinct.length >= 2) {
    const overlap = srcDistinct.filter((w) => sugDistinct.has(w)).length;
    const ratio = overlap / srcDistinct.length;
    if (ratio >= 0.85 && !hasFollowUpAngle(suggested)) return true;
    if (ratio === 1 && !hasFollowUpAngle(suggested)) return true;
  }

  return false;
}

/**
 * Stream title tied to a trending upload's topic — same cluster, fresh angle (not a rerun).
 */
export function buildTrendFollowUpTitle(
  channel: YtChannel,
  format: ShowFormat,
  viralTitle: string,
  topics: string[],
  dna: ReturnType<typeof channelContentDna>
): string {
  const topic = topics[0] ?? extractTopicsFromTitle(viralTitle)[0] ?? "bitcoin";
  const label = capTopic(topic);
  const candidates: string[] = [];

  const epMatch = viralTitle.match(/\bep\.?\s*(\d+)\b/i);
  if (epMatch || /part\s*\d+/i.test(viralTitle)) {
    const nextEp = epMatch ? String(Number(epMatch[1]) + 1) : "2";
    if (channel.slug === "chento") {
      candidates.push(`${dna.streamStyle}: Prop Firm Challenge | EP ${nextEp} — Live Continuation`);
    }
    candidates.push(`Live Stream · Part ${nextEp} — Where We Left Off`);
  }

  if (/prop firm|challenge|\$1k to \$100k/i.test(viralTitle) || topics.includes("prop firm")) {
    candidates.push(`${dna.streamStyle}: Prop Firm — Live Progress Check-In`);
    candidates.push(`Bitcoin Live Trading · Challenge Update — New Trades, Same Rules`);
  }

  if (/saylor/i.test(viralTitle)) {
    candidates.push(`Banter Live · After Saylor — What Bitcoin's Move Means Now`);
    candidates.push(`Crypto Banter: Post-Saylor Bitcoin — Live Hot Take`);
  }

  const priceMatch = viralTitle.match(/\$[\d,]+(?:\.\d+)?k?/i);
  if (priceMatch || /price target|level fails|if this level/i.test(viralTitle)) {
    const price = priceMatch?.[0] ?? "Key Level";
    if (channel.slug === "banter") {
      candidates.push(`Banter Live · Bitcoin ${price} — Did We Hold? Live Update`);
    } else {
      candidates.push(`Bitcoin Analysis Live · ${price} Test — What Changed Since Yesterday`);
    }
  }

  if (/fomc|fed\b|macro|inflation/i.test(viralTitle) || topics.includes("macro")) {
    candidates.push(`Bitcoin Live · Post-FOMC Reaction — Fresh Levels`);
    candidates.push(`Crypto Banter: Macro Live — BTC After the Fed`);
  }

  if (/pump|moon|rally|break(?:ing)? out|about to/i.test(viralTitle)) {
    candidates.push(`Banter Live · Bitcoin Rally — Live Reality Check`);
    candidates.push(`${dna.streamStyle}: Riding BTC Momentum — Live Trades on the Trend`);
  }

  if (/analysis|setup|next move/i.test(viralTitle) || topics.includes("analysis")) {
    candidates.push(`Bitcoin Analysis Live · Next Setup After Yesterday's Move`);
    candidates.push(`${dna.streamStyle}: Fresh Levels — Live Trend Follow-Up`);
  }

  if (/live trading/i.test(viralTitle) || topics.includes("live trading")) {
    candidates.push(`${dna.streamStyle}: ${label} — Live Session on What's Hot`);
    candidates.push(`Bitcoin Live · Trending ${label} — Not a Replay`);
  }

  if (channel.slug === "banter") {
    if (format === "banter") {
      candidates.push(`Banter Live · ${label} — Live Take on What's Trending`);
      candidates.push(`Crypto Banter: ${label} — Hot Topic Stream (Live)`);
    } else {
      candidates.push(`Crypto Banter: ${label} Market — Live Breakdown`);
    }
  } else if (format === "education") {
    candidates.push(`Bitcoin Analysis: ${label} — Live Follow-Up Setup`);
  } else if (format === "banter") {
    candidates.push(`Banter · ${label} — Live Hot Take on the Trend`);
  } else {
    candidates.push(`${dna.streamStyle}: ${label} — Live Trend Follow-Up`);
    candidates.push(`BITCOIN LIVE TRADING: ${label} Momentum — Live (New Session)`);
  }

  for (const candidate of candidates) {
    if (!titlesTooSimilar(candidate, viralTitle)) return candidate;
  }

  return `${dna.streamStyle}: Live ${label} Update — Trend Follow-Up`;
}

function buildTitleSuggestion(
  channel: YtChannel,
  format: ShowFormat,
  topic: string,
  dna: ReturnType<typeof channelContentDna>,
  viralTitle?: string
): string {
  if (viralTitle) {
    return buildTrendFollowUpTitle(channel, format, viralTitle, [topic], dna);
  }

  const t = capTopic(topic);
  if (channel.slug === "banter") {
    if (format === "banter") return `Banter Live · ${t} — What Everyone's Getting Wrong`;
    return `Crypto Banter: ${t} Market Breakdown (Live)`;
  }
  if (format === "education") return `Bitcoin Analysis: ${t} Setup & Next Move`;
  if (format === "banter") return `Banter · ${t} — Live With Chento`;
  if (/prop firm|challenge/i.test(topic)) return `BITCOIN LIVE TRADING: ${t} | Live Session`;
  return `${dna.streamStyle}: ${t} — Live Session`;
}

function buildStreamPitch(pick: ScoredViralPick, gap: boolean): string {
  const topic = pick.topics[0] ?? "bitcoin";
  const label = topicLabel(topic);
  const fresh = hoursSince(pick.publishedAt) < 36;

  if (fresh && pick.outlierFactor >= 1.4) {
    return gap
      ? `Spiking right now (${pick.why}). No stream queued — go live on ${label} today while YouTube is still pushing this cluster.`
      : `Spiking right now (${pick.why}). Queue a live ${label} follow-up while viewers from this upload are still active.`;
  }

  if (pick.outlierFactor >= 1.4) {
    return `Outperforming your channel (${pick.why}). Stream a ${label} session that picks up where this upload left off.`;
  }

  if (pick.engagementRate >= 0.08) {
    return `Strong engagement on ${label}. Hop on the trend with a live stream before interest moves on.`;
  }

  return gap
    ? `This upload is beating your usual pace. Ride ${label} momentum with a live follow-up.`
    : `This upload is beating your usual pace — double down on ${label} in your next stream.`;
}

function enrichViralPicks(
  picks: ScoredViralPick[],
  channels: YtChannel[],
  shows: ShowRun[]
): ViralPick[] {
  const channelBySlug = new Map(channels.map((c) => [c.slug, c]));

  return picks.map((pick) => {
    const channel = channelBySlug.get(pick.channelSlug);
    const topic = pick.topics[0] ?? "bitcoin";
    const gap = channel ? !hasUpcomingStream(shows, channel.id) : true;

    if (!channel) {
      return {
        ...pick,
        streamPitch: buildStreamPitch(pick, gap),
        suggestedStream: {
          title: `Live Trend Follow-Up — ${capTopic(topic)}`,
          format: "stream",
          topics: pick.topics.length ? pick.topics : [topic],
        },
      };
    }

    const dna = channelContentDna(channel);
    const fmt = inferFormatFromTitle(channel, pick.title);

    return {
      ...pick,
      streamPitch: buildStreamPitch(pick, gap),
      suggestedStream: {
        title: buildTrendFollowUpTitle(channel, fmt, pick.title, pick.topics, dna),
        format: fmt,
        topics: pick.topics.length ? pick.topics : [topic],
      },
    };
  });
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
        title: buildTrendFollowUpTitle(
          channel,
          fmt,
          inspired.title,
          inspired.topics.length ? inspired.topics : [topic],
          dna
        ),
        rationale: gap
          ? `Hop on the trend — viewers are still clicking “${inspired.title.slice(0, 48)}…” (${inspired.why})`
          : `Keep the momentum — stream a follow-up while this upload is still hot (${inspired.why})`,
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

  const viralNow = enrichViralPicks(buildViralPicks(analytics), channels, shows);
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
