import type { ShowFormat, YtChannel } from "@/lib/types";
import { ACTIVE_CHANNEL_SLUGS } from "@/lib/activeChannels";
import { ROSTER_BOOTSTRAP } from "@/lib/rosterProfiles";

/** Active release channels — Chento Trades + Crypto Banter */
export const TRADER_ROSTER = [{ slug: "chento", displayName: "Chento Trades", xHandle: "chentotrades" }] as const;

export const ROSTER_SLUG_ORDER = [...ACTIVE_CHANNEL_SLUGS];

export function rosterSeedData(): Omit<YtChannel, "id" | "createdAt" | "updatedAt" | "oauthConnected">[] {
  return ROSTER_BOOTSTRAP.map((p) => ({
    slug: p.slug,
    displayName: p.displayName,
    youtubeChannelId: p.youtubeChannelId,
    trackAccountId: p.trackAccountId,
    descriptionTemplate: p.descriptionTemplate,
    tags: p.tags,
    socialLinks: p.socialLinks,
    showFormats: p.showFormats as ShowFormat[],
    isShowFormat: p.isShowFormat,
    channelTrailerDraft: null,
    avatarUrl: null,
  }));
}
