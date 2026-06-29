import { NextRequest, NextResponse } from "next/server";
import { ACTION_TASKS, markTasksDone } from "@/lib/checklistAutomation";
import { getChannel, updateChannel } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const channel = await getChannel(id);
    if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { generateChannelTrailer } = await import("@/lib/channelTrailer");
    const draft = await generateChannelTrailer(id);
    return NextResponse.json({ draft, channel: await getChannel(id) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Trailer generation failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as {
      action?: "approve" | "reject";
      script?: string;
      showRunId?: string;
    };
    const channel = await getChannel(id);
    if (!channel?.channelTrailerDraft) {
      return NextResponse.json({ error: "Generate trailer first" }, { status: 404 });
    }
    const updated = await updateChannel(id, {
      channelTrailerDraft: {
        ...channel.channelTrailerDraft,
        script: body.script ?? channel.channelTrailerDraft.script,
        status: body.action === "approve" ? "approved" : body.action === "reject" ? "rejected" : "pending_qc",
      },
    });
    if (body.action === "approve" && body.showRunId) {
      await markTasksDone(body.showRunId, ACTION_TASKS.channelTrailer);
    }
    return NextResponse.json({ channel: updated });
  } catch {
    return NextResponse.json({ error: "Trailer QC failed" }, { status: 500 });
  }
}
