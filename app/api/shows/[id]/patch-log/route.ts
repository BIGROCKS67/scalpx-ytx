import { NextRequest, NextResponse } from "next/server";
import { ACTION_TASKS, markTasksDone } from "@/lib/checklistAutomation";
import { appendDescriptionPatch, getShow } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = (await req.json().catch(() => ({}))) as { note?: string; snippet?: string };
    const note = body.note?.trim() || "Live link update";
    const snippet = body.snippet?.trim() || "";
    const patch = {
      at: new Date().toISOString(),
      note,
      snippet,
    };
    const updated = await appendDescriptionPatch(id, patch);
    await markTasksDone(id, ACTION_TASKS.patchLog);
    return NextResponse.json({ show: updated, patch });
  } catch {
    return NextResponse.json({ error: "Patch log failed" }, { status: 500 });
  }
}
