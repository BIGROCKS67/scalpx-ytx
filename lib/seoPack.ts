import {
  buildSeoDescription,
  buildSeoTags,
  buildSeoTitles,
  buildShowDraftIntel,
  buildThumbnailBrief,
} from "@/lib/showDraftIntel";
import type { SeoPack, ShowRun, YtChannel } from "@/lib/types";
import { fetchYoutubeDashboardAnalytics } from "@/lib/youtube/dashboardAnalytics";

export async function generateSeoPack(show: ShowRun, channel: YtChannel): Promise<SeoPack> {
  let recentUploadTitles: string[] = [];
  try {
    const yt = await fetchYoutubeDashboardAnalytics(8);
    if (yt.ok) {
      recentUploadTitles =
        yt.channels.find((c) => c.slug === channel.slug)?.recentVideos.map((v) => v.title) ?? [];
    }
  } catch {
    /* optional */
  }

  const intel = buildShowDraftIntel(show, channel, recentUploadTitles);

  return {
    titles: buildSeoTitles(show, channel, intel),
    description: buildSeoDescription(show, channel, intel),
    tags: buildSeoTags(show, channel, intel),
    thumbnailBrief: buildThumbnailBrief(show, channel, intel),
  };
}

export { buildShowDraftIntel } from "@/lib/showDraftIntel";
