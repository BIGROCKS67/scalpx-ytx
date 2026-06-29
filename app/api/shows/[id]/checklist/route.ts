import { NextRequest, NextResponse } from "next/server";
import { canManuallyUpdateTask } from "@/lib/checklistAutomation";
import { listChecklist, updateChecklistItem } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const checklist = await listChecklist(id);
  return NextResponse.json({ checklist });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { taskId?: string; status?: string; notes?: string };
    if (!body.taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });
    if (body.status && !canManuallyUpdateTask(body.taskId, body.status)) {
      return NextResponse.json(
        { error: "Auto tasks can only complete from verified lifecycle actions" },
        { status: 403 }
      );
    }
    const item = await updateChecklistItem(id, body.taskId, {
      status: body.status as "pending" | "in_progress" | "done" | "skipped" | undefined,
      notes: body.notes,
    });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
