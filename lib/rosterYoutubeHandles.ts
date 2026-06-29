/**
 * Known YouTube @handles for roster sync (API: channels.list?forHandle=).
 * Override UC IDs in data/roster-channel-ids.json when handle lookup is wrong.
 */
export const ROSTER_YOUTUBE_HANDLES: Record<string, string> = {
  chento: "ChentoTrades",
  banter: "CryptoBanter",
};

/** Verified UC IDs (also in data/roster-channel-ids.json). */
export const ROSTER_YOUTUBE_CHANNEL_IDS: Record<string, string> = {
  chento: "UCmggCki2-WL6wlmJByoYSTA",
  banter: "UCN9Nj4tjXbVTLYWN0EKly_Q",
};

/** Crypto Banter @handle for roster sync */
export const CRYPTO_BANTER_HANDLE = "CryptoBanter";
