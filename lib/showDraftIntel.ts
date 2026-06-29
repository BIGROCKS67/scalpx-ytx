import { channelContentDna, extractTopicsFromTitle } from "@/lib/insights/channelDna";
import type { ShowRun, YtChannel } from "@/lib/types";

export type ShowDraftIntel = {
  topics: string[];
  formatLabel: string;
  styleNote: string;
  similarUpload: string | null;
  hookLine: string;
};

function pickSimilarUpload(title: string, recentTitles: string[]): string | null {
  const topics = extractTopicsFromTitle(title);
  if (!recentTitles.length) return null;

  let best: { title: string; score: number } | null = null;
  for (const t of recentTitles) {
    const shared = extractTopicsFromTitle(t).filter((x) => topics.includes(x)).length;
    const score = shared + (/\blive\b/i.test(t) && /\blive\b/i.test(title) ? 1 : 0);
    if (!best || score > best.score) best = { title: t, score };
  }
  return best && best.score > 0 ? best.title : recentTitles[0] ?? null;
}

function chentoTitle(show: ShowRun, topics: string[]): string {
  const core = show.title.trim();
  if (/prop firm|challenge/i.test(core)) {
    return `BITCOIN LIVE TRADING: ${core} | Live Session`;
  }
  if (/weekly|playbook|alt season/i.test(core)) {
    return `BITCOIN LIVE TRADING: ${core} | Chento Trades LIVE`;
  }
  if (topics.includes("analysis") || show.format === "education") {
    return `Bitcoin Analysis: ${core} | Chento Trades`;
  }
  return `BITCOIN LIVE TRADING: ${core} — Live Session`;
}

function banterTitle(show: ShowRun, topics: string[]): string {
  const core = show.title.trim();
  const topic = topics[0] ?? "crypto";
  const label = topic.charAt(0).toUpperCase() + topic.slice(1);
  if (show.format === "banter") {
    return `Banter Live · ${label} — ${core.slice(0, 48)}`;
  }
  return `Crypto Banter: ${core} (Live)`;
}

export function buildShowDraftIntel(
  show: ShowRun,
  channel: YtChannel,
  recentUploadTitles: string[] = []
): ShowDraftIntel {
  const dna = channelContentDna(channel);
  const topics = [
    ...new Set([...extractTopicsFromTitle(show.title), ...dna.topics.slice(0, 4).map((t) => t.toLowerCase())]),
  ].slice(0, 6);

  const formatLabel =
    show.format === "banter"
      ? "Banter Live"
      : show.format === "education"
        ? "Market Education"
        : channel.slug === "chento"
          ? "Bitcoin Live Trading"
          : "Live Stream";

  const similarUpload = pickSimilarUpload(show.title, recentUploadTitles);
  const similarHint = similarUpload
    ? `Styled like your upload “${similarUpload.slice(0, 52)}${similarUpload.length > 52 ? "…" : ""}”`
    : `Matches ${channel.displayName}'s usual ${dna.formats.slice(0, 2).join(" · ")} format`;

  const topicPhrase = topics.slice(0, 3).join(", ") || "bitcoin, live trading";
  const hookLine =
    topics.includes("altcoins") || /alt season/i.test(show.title)
      ? "Alt season rotations, BTC levels, and what to watch this week."
      : topics.includes("prop firm")
        ? "Live prop firm trading — entries, risk, and real-time P&L."
        : topics.includes("macro")
          ? "Macro catalysts, Fed path, and how to position for the move."
          : `Live ${topicPhrase} — levels, setups, and Q&A.`;

  return {
    topics,
    formatLabel,
    styleNote: similarHint,
    similarUpload,
    hookLine,
  };
}

export function buildSeoTitles(
  show: ShowRun,
  channel: YtChannel,
  intel: ShowDraftIntel
): string[] {
  const guest = show.guestName ? ` ft. ${show.guestName}` : "";
  const primary =
    channel.slug === "chento"
      ? chentoTitle(show, intel.topics)
      : channel.slug === "banter"
        ? banterTitle(show, intel.topics)
        : `${show.title}${guest} | ${channel.displayName}`;

  const when = show.scheduledAt
    ? new Date(show.scheduledAt).toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" })
    : new Date().toLocaleDateString("en-GB", { month: "short", day: "numeric" });

  return [
    primary,
    `${intel.formatLabel}: ${show.title} (${when})`,
    `LIVE: ${show.title} | ${channel.displayName}`,
  ];
}

export function buildSeoDescription(
  show: ShowRun,
  channel: YtChannel,
  intel: ShowDraftIntel
): string {
  const guest = show.guestName ? `\nGuest: ${show.guestName}.` : "";
  const when = show.scheduledAt
    ? `\n📅 ${new Date(show.scheduledAt).toLocaleString("en-GB", {
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "";

  const tags = [
    ...intel.topics,
    ...channel.tags,
    channel.slug === "chento" ? "chento trades" : channel.displayName.toLowerCase(),
    "live",
  ];

  return [
    `${show.title} — ${channel.displayName} ${intel.formatLabel}.${when}`,
    "",
    intel.hookLine,
    guest,
    "",
    channel.descriptionTemplate || "Join live for market structure, levels, and community Q&A.",
    "",
    "🔔 Subscribe and hit the bell for live alerts",
    "",
    [...new Set(tags)].slice(0, 10).map((k) => `#${k.replace(/\s+/g, "")}`).join(" "),
    "",
    "Not financial advice.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSeoTags(show: ShowRun, channel: YtChannel, intel: ShowDraftIntel): string[] {
  return [
    ...new Set([
      ...intel.topics,
      ...channel.tags,
      show.format,
      "live",
      "crypto",
      "bitcoin",
      "trading",
      channel.slug === "chento" ? "chento trades" : channel.displayName.toLowerCase(),
    ]),
  ].slice(0, 15);
}

export function buildThumbnailBrief(
  show: ShowRun,
  channel: YtChannel,
  intel: ShowDraftIntel
): string {
  const headline = show.title.slice(0, 42);
  return [
    `Thumbnail — ${show.title}`,
    `Channel: ${channel.displayName} · ${intel.formatLabel}`,
    intel.styleNote,
    `A: Face cam + "${headline}" + LIVE badge + chart (${intel.topics[0] ?? "BTC"})`,
    `B: Bold text on near-black (#050705) · mint accent #3dff8b`,
  ].join("\n");
}

export function buildSeedMetadata(
  title: string,
  channel: YtChannel | null
): Pick<ShowRun, "seoTitle" | "seoDescription" | "seoTags" | "thumbnailVariant"> {
  if (!channel) {
    return {
      seoTitle: title.trim(),
      seoDescription: `${title.trim()} — live session.`,
      seoTags: ["live", "crypto", "bitcoin"],
      thumbnailVariant: "pending",
    };
  }

  const stubShow: ShowRun = {
    id: "seed",
    channelId: channel.id,
    title: title.trim(),
    format: "stream",
    pipeline: "live",
    scheduledAt: null,
    guestName: null,
    dealId: null,
    youtubeVideoId: null,
    youtubeBroadcastId: null,
    status: "draft",
    seoTitle: null,
    seoDescription: null,
    seoTags: [],
    thumbnailVariant: null,
    clipSourceId: null,
    descriptionPatchLog: [],
    liveChapters: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const intel = buildShowDraftIntel(stubShow, channel);
  return {
    seoTitle: buildSeoTitles(stubShow, channel, intel)[0],
    seoDescription: buildSeoDescription(stubShow, channel, intel),
    seoTags: buildSeoTags(stubShow, channel, intel),
    thumbnailVariant: "pending",
  };
}
