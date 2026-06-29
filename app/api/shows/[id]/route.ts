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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [channel, checklist, crossPosts, clipBatch, analytics, igCarousel, commentReplies] =
      await Promise.all([
      getChannel(show.channelId),
      listChecklist(id),
      listCrossPosts(id),
      getClipBatch(id),
      listAnalytics(id),
      getIgCarousel(id),
      listCommentReplies(id),
    ]);
    return NextResponse.json({
      show,
      channel,
      checklist,
      crossPosts,
      clipBatch,
      analytics,
      igCarousel,
      commentReplies,
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load show" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const show = await updateShow(id, body);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ show });
  } catch (e) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
