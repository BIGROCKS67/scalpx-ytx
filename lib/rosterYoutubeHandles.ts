/**
 * Known YouTube @handles for roster sync (API: channels.list?forHandle=).
 * Override UC IDs in data/roster-channel-ids.json when handle lookup is wrong.
 */
export const ROSTER_YOUTUBE_HANDLES: Record<string, string> = {
  chento: "ChentoTrades",
  thomas: "tfxtradez",
  "king-azoulay": "KingAzoulay",
  paladin: "PaladinTrading",
};

/** When handle lookup fails or entity has no handle (e.g. Banter = Crypto Banter). */
export const ROSTER_YOUTUBE_CHANNEL_IDS: Record<string, string> = {
  banter: "UCN9Nj4tjXbVTLYWN0EKly_Q",
};
