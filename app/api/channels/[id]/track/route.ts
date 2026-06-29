import { NextResponse } from "next/server";
import { getTrackContext } from "@/lib/adapters/track";
import { getChannel } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const channel = await getChannel(id);
    if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const track = await getTrackContext(channel.trackAccountId);
    return NextResponse.json({ channel, track });
  } catch {
    return NextResponse.json({ error: "Track load failed" }, { status: 500 });
  }
}
