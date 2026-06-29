import { NextResponse } from "next/server";
import { ACTION_TASKS, markTasksDone } from "@/lib/checklistAutomation";
import { runPostShowSeoPass } from "@/lib/postShow";
import { addEndScreenEdge, getShow, listEndScreenEdges, updateShow } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const fromId = show.youtubeVideoId ?? show.id;
    const edges = await listEndScreenEdges(fromId);
    return NextResponse.json({ edges, fromVideoId: fromId });
  } catch {
    return NextResponse.json({ error: "End screen load failed" }, { status: 500 });
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const seo = await runPostShowSeoPass(show, show.clipSourceId);
    const desc = `${show.seoDescription ?? ""}${seo.descriptionAppend}`.trim();
    const updated = await updateShow(id, {
      seoTags: seo.tags,
      seoDescription: desc,
    });

    const fromId = show.youtubeVideoId ?? show.id;
    const relatedId = show.youtubeVideoId ? `${show.youtubeVideoId}-prev` : `${show.channelId}-trailer`;
    const edge = await addEndScreenEdge(fromId, relatedId, 1);

    await markTasksDone(id, [...ACTION_TASKS.postShowSeo, ...ACTION_TASKS.endScreen, ...ACTION_TASKS.transcript]);

    return NextResponse.json({
      show: updated,
      seo,
      edge,
      abReminderAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    });
  } catch (e) {
    console.error("[post-show]", e);
    return NextResponse.json({ error: "Post-show pipeline failed" }, { status: 500 });
  }
}
