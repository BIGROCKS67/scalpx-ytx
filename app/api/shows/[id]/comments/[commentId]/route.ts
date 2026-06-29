import { NextRequest, NextResponse } from "next/server";
import { ACTION_TASKS, markTasksDone } from "@/lib/checklistAutomation";
import { listCommentReplies, updateCommentReply } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function maybeMarkCommentsDone(showRunId: string) {
  const items = await listCommentReplies(showRunId);
  if (
    items.length > 0 &&
    items.every((i) => i.status === "approved" || i.status === "posted" || i.status === "skipped")
  ) {
    await markTasksDone(showRunId, ACTION_TASKS.comments);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id, commentId } = await params;
    const body = (await req.json()) as {
      draftReply?: string;
      status?: "pending" | "approved" | "posted" | "skipped";
    };
    const item = await updateCommentReply(commentId, body);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await maybeMarkCommentsDone(id);
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
