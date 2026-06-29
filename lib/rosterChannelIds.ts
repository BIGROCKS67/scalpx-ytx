import fs from "fs";
import path from "path";
import { ROSTER_YOUTUBE_CHANNEL_IDS } from "@/lib/rosterYoutubeHandles";
import { dataDirectory } from "@/lib/storage";

/** Ops file: data/roster-channel-ids.json - { "chento": "UC…", "banter": "UC…" } */
export function loadRosterChannelIds(): Record<string, string> {
  const fromEnv = process.env.YTX_ROSTER_CHANNEL_IDS?.trim();
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv) as Record<string, string>;
    } catch {
      /* fall through */
    }
  }

  const file = path.join(dataDirectory(), "roster-channel-ids.json");
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, string>;
    } catch {
      return {};
    }
  }
  return {};
}

export function youtubeIdForSlug(slug: string): string | null {
  const map = loadRosterChannelIds();
  const id = map[slug]?.trim();
  if (id) return id;
  return ROSTER_YOUTUBE_CHANNEL_IDS[slug] ?? null;
}
