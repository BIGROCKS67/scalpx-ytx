import { NextRequest, NextResponse } from "next/server";
import { runClipsPipeline } from "@/lib/adapters/clips";
import { ACTION_TASKS, markTasksDone } from "@/lib/checklistAutomation";
import { getShow, updateClipBatch, updateShow } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    if (result.status === "done") {
      await markTasksDone(id, ACTION_TASKS.clips);
    }
    return NextResponse.json({ clipBatch: batch });
  } catch (e) {
    console.error("[clips]", e);
    return NextResponse.json({ error: "Clips pipeline failed" }, { status: 500 });
  }
}
