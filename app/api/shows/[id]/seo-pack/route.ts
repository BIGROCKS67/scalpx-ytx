import { NextResponse } from "next/server";
import { generateSeoPack } from "@/lib/seoPack";
import { ACTION_TASKS, markTasksDone } from "@/lib/checklistAutomation";
import { getChannel, getShow, updateShow } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const channel = await getChannel(show.channelId);
    if (!channel) return NextResponse.json({ error: "Channel missing" }, { status: 404 });
    const pack = await generateSeoPack(show, channel);
    const updated = await updateShow(id, {
      seoTitle: pack.titles[0] ?? null,
      seoDescription: pack.description,
      seoTags: pack.tags,
    });
    await markTasksDone(id, ACTION_TASKS.seoPack);
    return NextResponse.json({ pack, show: updated });
  } catch (e) {
    return NextResponse.json({ error: "SEO pack failed" }, { status: 500 });
  }
}
