import { NextResponse } from "next/server";
import { buildSponsorBlock } from "@/lib/adapters/deals";
import { ACTION_TASKS, markTasksDone } from "@/lib/checklistAutomation";
import { getShow } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const block = await buildSponsorBlock(show.dealId);
    await markTasksDone(id, ACTION_TASKS.sponsorBlock);
    return NextResponse.json({ sponsorBlock: block });
  } catch (e) {
    return NextResponse.json({ error: "Sponsor block failed" }, { status: 500 });
  }
}
