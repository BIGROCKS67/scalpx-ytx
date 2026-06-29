import { NextRequest, NextResponse } from "next/server";
import {
  getChannel,
  getClipBatch,
  getIgCarousel,
  getShow,
  listAnalytics,
  listChecklist,
  listCommentReplies,
  listCrossPosts,
  updateShow,
} from "@/lib/store";
import { listVerificationLog } from "@/lib/verificationLog";
import { ensureReplayCommentQueue } from "@/lib/replayComments";
import { ensureReplayAnalytics } from "@/lib/replayAnalytics";
import { isReplayShowView } from "@/lib/showFilters";
import { parseYouTubeVideoId } from "@/lib/youtube/video";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [channel, checklist, crossPosts, clipBatch, analytics, igCarousel, verification] =
      await Promise.all([
        getChannel(show.channelId),
        listChecklist(id),
        listCrossPosts(id),
        getClipBatch(id),
        listAnalytics(id),
        getIgCarousel(id),
        listVerificationLog(id),
      ]);

    let commentReplies = await listCommentReplies(id);
    let resolvedAnalytics = analytics;
    let commentSyncError: string | undefined;
    let commentsFromYoutube = false;
    let analyticsSyncError: string | undefined;
    let analyticsFromYoutube = false;
    if (isReplayShowView(show)) {
      const [commentResult, analyticsResult] = await Promise.all([
        ensureReplayCommentQueue(show, channel, { syncYoutube: true }),
        ensureReplayAnalytics(show, channel),
      ]);
      commentReplies = commentResult.items;
      commentSyncError = commentResult.syncError;
      commentsFromYoutube = commentResult.fromYoutube;
      resolvedAnalytics = analyticsResult.snapshots;
      analyticsSyncError = analyticsResult.syncError;
      analyticsFromYoutube = analyticsResult.fromYoutube;
    }
    return NextResponse.json({
      show,
      channel,
      checklist,
      crossPosts,
      clipBatch,
      analytics: resolvedAnalytics,
      igCarousel,
      commentReplies,
      commentsFromYoutube,
      commentSyncError,
      analyticsFromYoutube,
      analyticsSyncError,
      verification,
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load show" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown> & { youtubeUrl?: string };

    const patch = { ...body } as Parameters<typeof updateShow>[1];
    delete (patch as { youtubeUrl?: string }).youtubeUrl;

    if (body.youtubeUrl && typeof body.youtubeUrl === "string") {
      const videoId = parseYouTubeVideoId(body.youtubeUrl);
      if (!videoId) {
        return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
      }
      patch.youtubeVideoId = videoId;
    } else if (body.youtubeVideoId && typeof body.youtubeVideoId === "string") {
      const raw = body.youtubeVideoId.trim();
      patch.youtubeVideoId = parseYouTubeVideoId(raw) ?? raw;
    }

    const show = await updateShow(id, patch);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ show });
  } catch (e) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
