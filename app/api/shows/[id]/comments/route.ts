import { NextResponse } from "next/server";
import { getChannel, getShow, listCommentReplies } from "@/lib/store";
import { ensureReplayCommentQueue } from "@/lib/replayComments";
import { isReplayShowView } from "@/lib/showFilters";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const channel = await getChannel(show.channelId);
    if (isReplayShowView(show)) {
      const result = await ensureReplayCommentQueue(show, channel, { syncYoutube: true });
      return NextResponse.json({
        items: result.items,
        fromYoutube: result.fromYoutube,
        syncError: result.syncError,
      });
    }
    const items = await listCommentReplies(id);
    return NextResponse.json({ items, fromYoutube: false });
  } catch {
    return NextResponse.json({ error: "Comment queue failed" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const channel = await getChannel(show.channelId);

    let body: { syncYoutube?: boolean; force?: boolean } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = { syncYoutube: true, force: true };
    }

    const result = await ensureReplayCommentQueue(show, channel, {
      syncYoutube: body.syncYoutube ?? true,
      force: body.force ?? true,
    });

    return NextResponse.json({
      items: result.items,
      fromYoutube: result.fromYoutube,
      syncError: result.syncError,
      abReminderAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    });
  } catch (e) {
    console.error("[comments POST]", e);
    return NextResponse.json({ error: "Comment queue failed" }, { status: 500 });
  }
}
