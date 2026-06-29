import type { ShowFormat, YtChannel } from "@/lib/types";
import { youtubeIdForSlug } from "@/lib/rosterChannelIds";

/** Canonical trader slugs - mirrors FlowX Scout traderRoster.ts + Banter */
export const TRADER_ROSTER = [
  { slug: "chento", displayName: "Chento Trades", xHandle: "chentotrades" },
  { slug: "king-azoulay", displayName: "King Azoulay", xHandle: null },
  { slug: "paladin", displayName: "Paladin", xHandle: null },
  { slug: "dmitry", displayName: "Dmitry", xHandle: null },
  { slug: "thomas", displayName: "Thomas", xHandle: "tfxtradez" },
  { slug: "piltr", displayName: "PILTR", xHandle: "nico_pltrs" },
  { slug: "madda", displayName: "Madda", xHandle: null },
  { slug: "nick-scalps", displayName: "Nick", xHandle: null },
  { slug: "yassin", displayName: "Yassin", xHandle: "tagouguiy" },
] as const;

export const ROSTER_SLUG_ORDER = [...TRADER_ROSTER.map((t) => t.slug), "banter"];

const CHENTO_FORMATS: ShowFormat[] = ["banter", "stream", "education"];

export function rosterSeedData(): Omit<YtChannel, "id" | "createdAt" | "updatedAt" | "oauthConnected">[] {
  const traders = TRADER_ROSTER.map((t) => {
    const socialLinks: Record<string, string> = {};
    if (t.xHandle) socialLinks.x = `https://x.com/${t.xHandle}`;
    return {
      slug: t.slug,
      displayName: t.displayName,
      youtubeChannelId: youtubeIdForSlug(t.slug),
      trackAccountId: null,
      descriptionTemplate:
        t.slug === "chento"
          ? "Daily market streams, education, and Banter live talk. Not financial advice."
          : `${t.displayName} - FlowX trader channel.`,
      tags: t.slug === "chento" ? ["crypto", "trading", "bitcoin", "live"] : ["crypto", "trading"],
      socialLinks,
      showFormats: t.slug === "chento" ? CHENTO_FORMATS : (["stream"] as ShowFormat[]),
      isShowFormat: false,
      channelTrailerDraft: null,
    };
  });

  return [
    ...traders,
    {
      slug: "banter",
      displayName: "Banter",
      youtubeChannelId: youtubeIdForSlug("banter"),
      trackAccountId: null,
      descriptionTemplate:
        "Live talk show - guests, market banter, community Q&A. Show format entity · not a trader signal channel.",
      tags: ["banter", "live", "crypto", "talk", "guests"],
      socialLinks: {},
      showFormats: ["banter", "stream"] as ShowFormat[],
      isShowFormat: true,
      channelTrailerDraft: null,
    },
  ];
}
