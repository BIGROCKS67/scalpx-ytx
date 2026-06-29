import { NextRequest, NextResponse } from "next/server";
import { checkClipsReadiness } from "@/lib/clips/readiness";
import { runClipsPipeline } from "@/lib/adapters/clips";
import { ACTION_TASKS, markTasksDone } from "@/lib/checklistAutomation";
import { getShow, updateClipBatch, updateShow } from "@/lib/store";
import { logVerification } from "@/lib/verificationLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const readiness = await checkClipsReadiness();
    if (!readiness.ready) {
      return NextResponse.json(
        { error: "Clips runtime not ready", blockers: readiness.blockers },
        { status: 422 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { youtubeUrl?: string };
    const url =
      body.youtubeUrl ??
      (show.youtubeVideoId ? `https://www.youtube.com/watch?v=${show.youtubeVideoId}` : null);
    if (!url) {
      return NextResponse.json({ error: "youtubeUrl or youtubeVideoId required" }, { status: 400 });
    }

    await updateClipBatch(id, { status: "importing", message: "Starting…" });
    const result = await runClipsPipeline(url);
    const batch = await updateClipBatch(id, result);
    if (result.scoutSourceId) {
      await updateShow(id, { clipSourceId: result.scoutSourceId });
    }

    const exportCount = result.exportUrls?.length ?? 0;
    if (result.status === "done" && exportCount > 0) {
      await markTasksDone(id, ACTION_TASKS.clips);
      await logVerification({
        showRunId: id,
        channelId: show.channelId,
        action: "clips_export",
        ok: true,
        source: "local_only",
        videoId: show.youtubeVideoId,
        detail: `${exportCount} MP4 exports`,
      });
      return NextResponse.json({ clipBatch: batch });
    }

    await logVerification({
      showRunId: id,
      channelId: show.channelId,
      action: "clips_export",
      ok: false,
      source: "blocked",
      videoId: show.youtubeVideoId,
      detail: result.message ?? "No MP4 exports produced",
    });

    return NextResponse.json(
      { error: result.message ?? "No MP4 exports produced", clipBatch: batch, blockers: readiness.blockers },
      { status: 422 }
    );
  } catch (e) {
    console.error("[clips]", e);
    return NextResponse.json({ error: "Clips pipeline failed" }, { status: 500 });
  }
}
