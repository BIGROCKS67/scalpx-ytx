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

/** Verified UC IDs (also in data/roster-channel-ids.json). */
export const ROSTER_YOUTUBE_CHANNEL_IDS: Record<string, string> = {
  chento: "UCmggCki2-WL6wlmJByoYSTA",
  thomas: "UCE07S_YqsrOZTYo6ZRCQitQ",
  "king-azoulay": "UCLXrengox-g_UvDNRI6_zFA",
  paladin: "UC6VmD2ktN00ijCVAEOm-3ZA",
  banter: "UCN9Nj4tjXbVTLYWN0EKly_Q",
};
