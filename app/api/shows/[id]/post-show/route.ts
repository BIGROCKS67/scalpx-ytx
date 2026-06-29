import { NextResponse } from "next/server";
import { runPostShowSeoPass } from "@/lib/postShow";
import { getChannel, getShow, listEndScreenEdges, updateShow } from "@/lib/store";
import { logVerification } from "@/lib/verificationLog";
import { updateVideoMetadata, youtubeWriteReady } from "@/lib/youtube/dataApi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!show.youtubeVideoId) {
      return NextResponse.json({ edges: [], fromVideoId: null });
    }
    const edges = await listEndScreenEdges(show.youtubeVideoId);
    return NextResponse.json({ edges, fromVideoId: show.youtubeVideoId });
  } catch {
    return NextResponse.json({ error: "End screen load failed" }, { status: 500 });
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const channel = await getChannel(show.channelId);
    if (!channel) return NextResponse.json({ error: "Channel missing" }, { status: 404 });

    const seo = await runPostShowSeoPass(show, show.clipSourceId);
    const desc = `${show.seoDescription ?? ""}${seo.descriptionAppend}`.trim();
    const updated = await updateShow(id, {
      seoTags: seo.tags,
      seoDescription: desc,
    });

    let pushedToYoutube = false;
    if (show.youtubeVideoId && (await youtubeWriteReady(channel.id))) {
      const write = await updateVideoMetadata(channel.id, show.youtubeVideoId, {
        description: desc,
        tags: seo.tags,
        title: show.seoTitle ?? show.title,
      });
      pushedToYoutube = write.ok;
      await logVerification({
        showRunId: id,
        channelId: channel.id,
        action: "metadata_update",
        ok: write.ok,
        source: write.ok ? "youtube_api" : "blocked",
        videoId: show.youtubeVideoId,
        httpStatus: write.httpStatus,
        detail: write.ok ? "Post-show metadata pushed" : write.error ?? "Write failed",
      });
    }

    const edges = show.youtubeVideoId ? await listEndScreenEdges(show.youtubeVideoId) : [];

    return NextResponse.json({
      show: updated,
      seo,
      edges,
      pushedToYoutube,
      abReminderAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    });
  } catch (e) {
    console.error("[post-show]", e);
    return NextResponse.json({ error: "Post-show pipeline failed" }, { status: 500 });
  }
}
