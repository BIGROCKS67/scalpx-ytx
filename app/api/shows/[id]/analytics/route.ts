import { NextResponse } from "next/server";
import { ACTION_TASKS, markTasksDone } from "@/lib/checklistAutomation";
import {
  addAnalyticsSnapshot,
  getChannel,
  getShow,
  listAnalytics,
} from "@/lib/store";
import {
  fetchChannelBaseline,
  fetchLiveVideoStats,
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

    let waitingRoom = Math.floor(80 + Math.random() * 120);
    let peak = waitingRoom + Math.floor(20 + Math.random() * 200);
    let source: "youtube_api" | "simulated" = "simulated";

    if (show.youtubeVideoId && (await youtubeApiReady(channel.id))) {
      const live = await fetchLiveVideoStats(channel.id, show.youtubeVideoId);
      if (live?.concurrentViewers != null) {
        waitingRoom = live.concurrentViewers;
        peak = Math.max(peak, waitingRoom + Math.floor(waitingRoom * 0.2));
        source = "youtube_api";
      }
      if (channel.youtubeChannelId) {
        const baseline = await fetchChannelBaseline(channel.id, channel.youtubeChannelId);
        if (baseline) {
          waitingRoom = Math.max(waitingRoom, Math.floor(baseline.subscribers * 0.002));
        }
      }
    }

    const [waiting, peakSnap] = await Promise.all([
      addAnalyticsSnapshot({
        showRunId: id,
        snapshotType: "waiting_room",
        concurrentViewers: waitingRoom,
        views24h: null,
        metadata: { source, videoId: show.youtubeVideoId },
        capturedAt: new Date().toISOString(),
      }),
      addAnalyticsSnapshot({
        showRunId: id,
        snapshotType: "peak_viewers",
        concurrentViewers: peak,
        views24h: null,
        metadata: { source },
        capturedAt: new Date().toISOString(),
      }),
    ]);

    await markTasksDone(id, [...ACTION_TASKS.analyticsWaiting, ...ACTION_TASKS.analyticsPeak]);

    return NextResponse.json({ snapshots: [waiting, peakSnap], source });
  } catch (e) {
    return NextResponse.json({ error: "Analytics failed" }, { status: 500 });
  }
}
