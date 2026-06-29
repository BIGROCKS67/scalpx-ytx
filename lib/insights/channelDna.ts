import type { ShowFormat, YtChannel } from "@/lib/types";
import { CHANNEL_PROFILES } from "@/lib/demoProfiles";

/** Fallback content patterns when YouTube sync has not filled tags yet. */
const DNA_FALLBACK: Record<
  string,
  { topics: string[]; formats: ShowFormat[]; streamStyle: string }
> = {
  chento: {
    topics: ["bitcoin", "btc live trading", "market structure", "altcoins", "macro", "risk management"],
    formats: ["stream", "education", "banter"],
    streamStyle: "BITCOIN LIVE TRADING",
  },
  banter: {
    topics: ["crypto news", "macro", "altcoins", "guest banter", "community ama", "market breakdown"],
    formats: ["banter", "stream"],
    streamStyle: "Banter Live",
  },
};

const TITLE_TOPIC_PATTERNS: Array<{ re: RegExp; topic: string }> = [
  { re: /\bbitcoin\b|\bbtc\b/i, topic: "bitcoin" },
  { re: /\blive trading\b|\blive stream\b/i, topic: "live trading" },
  { re: /\banalysis\b|\bsetup\b|\btechnical\b/i, topic: "analysis" },
  { re: /\bfomc\b|\bfed\b|\bmacro\b|\binflation\b/i, topic: "macro" },
  { re: /\baltcoin\b|\balt season\b|\baltcoins\b/i, topic: "altcoins" },
  { re: /\bbanter\b|\bguest\b|\bama\b/i, topic: "banter" },
  { re: /\beducation\b|\blearn\b|\bguide\b|\bhow to\b/i, topic: "education" },
  { re: /\bprop firm\b|\bchallenge\b/i, topic: "prop firm" },
  { re: /\bbreaking\b|\bnews\b|\bwtf\b|\bhappening\b/i, topic: "breaking news" },
  { re: /\bethereum\b|\beth\b/i, topic: "ethereum" },
];

export function extractTopicsFromTitle(title: string): string[] {
  const found = new Set<string>();
  for (const { re, topic } of TITLE_TOPIC_PATTERNS) {
    if (re.test(title)) found.add(topic);
  }
  return [...found];
}

export function channelContentDna(channel: YtChannel): {
  topics: string[];
  formats: ShowFormat[];
  streamStyle: string;
} {
  const demo = CHANNEL_PROFILES.find((p) => p.slug === channel.slug);
  const fallback = DNA_FALLBACK[channel.slug] ?? {
    topics: channel.tags.slice(0, 8),
    formats: channel.showFormats,
    streamStyle: channel.displayName,
  };

  const topics = [
    ...new Set([
      ...(channel.tags.length ? channel.tags : demo?.tags ?? fallback.topics),
      ...fallback.topics,
    ]),
  ].slice(0, 10);

  return {
    topics,
    formats: channel.showFormats.length ? channel.showFormats : fallback.formats,
    streamStyle: fallback.streamStyle,
  };
}

export function inferFormatFromTitle(channel: YtChannel, title: string): ShowFormat {
  if (channel.slug === "banter" || /\bbanter\b|\bama\b|\bguest\b/i.test(title)) return "banter";
  if (/education|lesson|how to|guide|101|learn/i.test(title)) return "education";
  return channel.showFormats.includes("stream") ? "stream" : (channel.showFormats[0] ?? "stream");
}
