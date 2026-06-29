import type { ShowFormat, YtChannel } from "@/lib/types";
import { CHANNEL_PROFILES, demoYoutubeIdForSlug } from "@/lib/demoProfiles";
import { youtubeIdForSlug as resolveYoutubeId } from "@/lib/rosterChannelIds";

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

export function rosterSeedData(): Omit<YtChannel, "id" | "createdAt" | "updatedAt" | "oauthConnected">[] {
  return CHANNEL_PROFILES.map((p) => ({
    slug: p.slug,
    displayName: p.displayName,
    youtubeChannelId: resolveYoutubeId(p.slug) ?? demoYoutubeIdForSlug(p.slug),
    trackAccountId: p.trackAccountId,
    descriptionTemplate: p.descriptionTemplate,
    tags: p.tags,
    socialLinks: p.socialLinks,
    showFormats: p.showFormats as ShowFormat[],
    isShowFormat: p.isShowFormat,
    channelTrailerDraft: p.channelTrailerDraft,
  }));
}
