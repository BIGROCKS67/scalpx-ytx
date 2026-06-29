import { NextResponse } from "next/server";
import { runChannelSetup } from "@/lib/channelSetup";
import { ACTION_TASKS, markTasksDone } from "@/lib/checklistAutomation";
import { getChannel, getShow } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const channel = await getChannel(show.channelId);
    if (!channel) return NextResponse.json({ error: "Channel missing" }, { status: 404 });
    const result = await runChannelSetup(channel.id);
    await markTasksDone(id, ACTION_TASKS.channelSetup);
    if (show.guestName) await markTasksDone(id, ACTION_TASKS.guestTag);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Channel setup failed" },
      { status: 500 }
    );
  }
}
