import { NextResponse } from "next/server";
import { runChannelSetup } from "@/lib/channelSetup";
import { getChannel } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const channel = await getChannel(id);
    if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const result = await runChannelSetup(id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Channel setup failed" },
      { status: 500 }
    );
  }
}
