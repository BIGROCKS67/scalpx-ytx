import { NextResponse } from "next/server";
import { generateLiveChapters } from "@/lib/liveOps";
import { ACTION_TASKS, markTasksDone } from "@/lib/checklistAutomation";
import { getShow, updateShow } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (show.pipeline !== "live") {
      return NextResponse.json({ error: "Live chapters only for live stream pipeline" }, { status: 400 });
    }
    const chapters = await generateLiveChapters(show);
    const updated = await updateShow(id, { liveChapters: chapters });
    await markTasksDone(id, ["1.12"]);
    return NextResponse.json({ show: updated, chapters });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chapter generation failed" },
      { status: 500 }
    );
  }
}
