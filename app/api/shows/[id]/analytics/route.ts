import { NextResponse } from "next/server";
import { ACTION_TASKS, markTasksDone } from "@/lib/checklistAutomation";
import { ensureReplayAnalytics } from "@/lib/replayAnalytics";
import {
  addAnalyticsSnapshot,
  getChannel,
  getShow,
  listAnalytics,
} from "@/lib/store";
import { isReplayShowView } from "@/lib/showFilters";
import { logVerification } from "@/lib/verificationLog";
import {
  fetchLiveVideoStats,
  fetchVideoBroadcastState,
  youtubeApiReady,
} from "@/lib/youtube/dataApi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshots = await listAnalytics(id);
  return NextResponse.json({ snapshots });
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const channel = await getChannel(show.channelId);
    if (!channel) return NextResponse.json({ error: "Channel missing" }, { status: 404 });

    if (isReplayShowView(show)) {
      const result = await ensureReplayAnalytics(show, channel);
      if (!result.fromYoutube) {
        await logVerification({
          showRunId: id,
          channelId: channel.id,
          action: "analytics_capture",
          ok: false,
          source: "blocked",
          videoId: show.youtubeVideoId,
          detail: result.syncError ?? "YouTube returned no verified metrics",
        });
        return NextResponse.json(
          { error: result.syncError ?? "YouTube returned no verified metrics", source: "unavailable" },
          { status: 422 }
        );
      }
      await logVerification({
        showRunId: id,
        channelId: channel.id,
        action: "analytics_capture",
        ok: true,
        source: "youtube_api",
        videoId: show.youtubeVideoId,
        detail: "YouTube Data API metrics",
      });
      return NextResponse.json({
        snapshots: result.snapshots,
        source: "youtube_api",
        fromYoutube: true,
      });
    }

    if (!show.youtubeVideoId) {
      return NextResponse.json(
        { error: "Link a YouTube video before capturing analytics" },
        { status: 422 }
      );
    }

    if (!(await youtubeApiReady(channel.id))) {
      return NextResponse.json(
        { error: "YouTube API key or OAuth required for analytics" },
        { status: 422 }
      );
    }

    const broadcast = await fetchVideoBroadcastState(channel.id, show.youtubeVideoId);
    const live = await fetchLiveVideoStats(channel.id, show.youtubeVideoId);
    const now = new Date().toISOString();
    const inserted = [];

    if (live?.concurrentViewers != null) {
      const snapshotType =
        broadcast?.liveBroadcastContent === "upcoming" ? "waiting_room" : "peak_viewers";
      inserted.push(
        await addAnalyticsSnapshot({
          showRunId: id,
          snapshotType,
          concurrentViewers: live.concurrentViewers,
          views24h: null,
          metadata: { source: "youtube_api", metric: "concurrent_viewers" },
          capturedAt: now,
        })
      );
    }

    if (live?.viewCount != null && live.viewCount > 0) {
      inserted.push(
        await addAnalyticsSnapshot({
          showRunId: id,
          snapshotType: "views_24h",
          concurrentViewers: null,
          views24h: live.viewCount,
          metadata: { source: "youtube_api", metric: "total_views" },
          capturedAt: now,
        })
      );
    }

    if (!inserted.length) {
      await logVerification({
        showRunId: id,
        channelId: channel.id,
        action: "analytics_capture",
        ok: false,
        source: "blocked",
        videoId: show.youtubeVideoId,
        detail: "YouTube returned no metrics",
      });
      return NextResponse.json(
        { error: "YouTube returned no metrics for this video", source: "unavailable" },
        { status: 422 }
      );
    }

    await logVerification({
      showRunId: id,
      channelId: channel.id,
      action: "analytics_capture",
      ok: true,
      source: "youtube_api",
      videoId: show.youtubeVideoId,
      detail: "YouTube API metrics",
    });

    if (inserted.some((s) => s.snapshotType === "waiting_room")) {
      await markTasksDone(id, ACTION_TASKS.analyticsWaiting);
    }
    if (inserted.some((s) => s.snapshotType === "peak_viewers")) {
      await markTasksDone(id, ACTION_TASKS.analyticsPeak);
    }

    return NextResponse.json({
      snapshots: inserted,
      source: "youtube_api",
      tasksCompleted: true,
    });
  } catch (e) {
    return NextResponse.json({ error: "Analytics failed" }, { status: 500 });
  }
}
