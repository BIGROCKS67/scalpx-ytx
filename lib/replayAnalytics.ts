import { hasLinkedYoutubeVideo } from "@/lib/showMedia";
import { isLegitAnalyticsSnapshot } from "@/lib/analyticsLegit";
import {
  addAnalyticsSnapshot,
  listAnalytics,
  purgeFakeAnalytics,
} from "@/lib/store";
import { isReplayShowView } from "@/lib/showFilters";
import type { AnalyticsSnapshot, ShowRun, YtChannel } from "@/lib/types";
import { fetchLiveVideoStats, youtubeApiReady } from "@/lib/youtube/dataApi";

export type ReplayAnalyticsResult = {
  snapshots: AnalyticsSnapshot[];
  fromYoutube: boolean;
  syncError?: string;
};

function hasLegitType(
  snapshots: AnalyticsSnapshot[],
  type: AnalyticsSnapshot["snapshotType"]
): boolean {
  return snapshots.some((s) => s.snapshotType === type && isLegitAnalyticsSnapshot(s));
}

/** Sync only verified YouTube metrics — never invent numbers. */
export async function ensureReplayAnalytics(
  show: ShowRun,
  channel: YtChannel | null
): Promise<ReplayAnalyticsResult> {
  if (!isReplayShowView(show)) {
    const snapshots = await listAnalytics(show.id);
    return { snapshots, fromYoutube: snapshots.some(isLegitAnalyticsSnapshot) };
  }

  await purgeFakeAnalytics(show.id);

  const legit = (await listAnalytics(show.id)).filter(isLegitAnalyticsSnapshot);
  if (legit.length > 0) {
    return { snapshots: legit, fromYoutube: true };
  }

  if (!hasLinkedYoutubeVideo(show)) {
    return {
      snapshots: [],
      fromYoutube: false,
      syncError: "Link the real YouTube watch URL on this show first",
    };
  }

  if (!channel || !(await youtubeApiReady(channel.id))) {
    return {
      snapshots: [],
      fromYoutube: false,
      syncError: "Connect YouTube OAuth on Roster or add a YouTube API key in Settings",
    };
  }

  const stats = await fetchLiveVideoStats(channel.id, show.youtubeVideoId!);
  if (!stats) {
    return {
      snapshots: [],
      fromYoutube: false,
      syncError: "YouTube returned no data for this video",
    };
  }

  const now = new Date().toISOString();
  const inserted: AnalyticsSnapshot[] = [];

  if (stats.concurrentViewers != null && !hasLegitType(await listAnalytics(show.id), "peak_viewers")) {
    inserted.push(
      await addAnalyticsSnapshot({
        showRunId: show.id,
        snapshotType: "peak_viewers",
        concurrentViewers: stats.concurrentViewers,
        views24h: null,
        metadata: { source: "youtube_api", metric: "concurrent_viewers" },
        capturedAt: now,
      })
    );
  }

  if (stats.viewCount != null && stats.viewCount > 0) {
    inserted.push(
      await addAnalyticsSnapshot({
        showRunId: show.id,
        snapshotType: "views_24h",
        concurrentViewers: null,
        views24h: stats.viewCount,
        metadata: { source: "youtube_api", metric: "total_views" },
        capturedAt: now,
      })
    );
  }

  if (!inserted.length) {
    return {
      snapshots: [],
      fromYoutube: false,
      syncError: "YouTube has no public view or live viewer stats for this video yet",
    };
  }

  const snapshots = (await listAnalytics(show.id)).filter(isLegitAnalyticsSnapshot);
  return { snapshots, fromYoutube: true };
}
