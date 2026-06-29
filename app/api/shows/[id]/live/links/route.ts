import { NextResponse } from "next/server";
import { applyLiveLinkAndChapterUpdate } from "@/lib/liveOps";
import { ACTION_TASKS, markTasksDone } from "@/lib/checklistAutomation";
import { getShow } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (show.pipeline !== "live") {
      return NextResponse.json({ error: "Live link updates only for live stream pipeline" }, { status: 400 });
    }
    const result = await applyLiveLinkAndChapterUpdate(id);
    await markTasksDone(id, ACTION_TASKS.patchLog);
    await markTasksDone(id, ["1.13"]);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Live link update failed" },
      { status: 500 }
    );
  }
}
