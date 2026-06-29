import type { ShowFormat } from "@/lib/types";
import { ROSTER_YOUTUBE_CHANNEL_IDS } from "@/lib/rosterYoutubeHandles";
import { youtubeIdForSlug } from "@/lib/rosterChannelIds";

/** Minimal roster bootstrap — real UC IDs only; descriptions/tags filled by YouTube sync. */
export type RosterBootstrap = {
  slug: string;
  displayName: string;
  trackAccountId: string;
  descriptionTemplate: string;
  tags: string[];
  socialLinks: Record<string, string>;
  showFormats: ShowFormat[];
  isShowFormat: boolean;
  youtubeChannelId: string | null;
};

export const ROSTER_BOOTSTRAP: RosterBootstrap[] = [
  {
    slug: "chento",
    displayName: "Chento Trades",
    trackAccountId: "chento-trades",
    descriptionTemplate: "",
    tags: [],
    socialLinks: {
      x: "https://x.com/chentotrades",
      youtube: "https://www.youtube.com/@ChentoTrades",
    },
    showFormats: ["banter", "stream", "education"],
    isShowFormat: false,
    youtubeChannelId: youtubeIdForSlug("chento") ?? ROSTER_YOUTUBE_CHANNEL_IDS.chento ?? null,
  },
  {
    slug: "banter",
    displayName: "Crypto Banter",
    trackAccountId: "banter-show",
    descriptionTemplate: "",
    tags: [],
    socialLinks: {
      youtube: "https://www.youtube.com/@CryptoBanter",
    },
    showFormats: ["banter", "stream"],
    isShowFormat: true,
    youtubeChannelId: youtubeIdForSlug("banter") ?? ROSTER_YOUTUBE_CHANNEL_IDS.banter ?? null,
  },
];
