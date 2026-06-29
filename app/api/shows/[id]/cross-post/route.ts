import { NextResponse } from "next/server";
import { generateCrossPosts } from "@/lib/adapters/content";
import { ACTION_TASKS, markTasksDone } from "@/lib/checklistAutomation";
import { getChannel, getShow, upsertCrossPosts } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const channel = await getChannel(show.channelId);
    if (!channel) return NextResponse.json({ error: "Channel missing" }, { status: 404 });
    const items = await generateCrossPosts(show, channel);
    await upsertCrossPosts(items);
    await markTasksDone(id, ACTION_TASKS.crossPost);
    return NextResponse.json({ crossPosts: items });
  } catch (e) {
    return NextResponse.json({ error: "Cross-post failed" }, { status: 500 });
  }
}
