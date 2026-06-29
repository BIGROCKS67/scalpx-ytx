import { NextResponse } from "next/server";
import { ACTION_TASKS, markTasksDone } from "@/lib/checklistAutomation";
import { getShow, listCommentReplies, seedCommentQueue } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const items = await listCommentReplies(id);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Comment queue failed" }, { status: 500 });
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const items = await seedCommentQueue(id, show.title);
    await markTasksDone(id, ACTION_TASKS.abReminder);
    return NextResponse.json({
      items,
      abReminderAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Comment queue failed" }, { status: 500 });
  }
}
