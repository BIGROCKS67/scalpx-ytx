import { NextRequest, NextResponse } from "next/server";
import { createShow, ensureRosterData, listShows } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await ensureRosterData();
    const channelId = req.nextUrl.searchParams.get("channelId") ?? undefined;
    const shows = await listShows(channelId);
    return NextResponse.json({ shows });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load shows" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      channelId?: string;
      title?: string;
      format?: "banter" | "stream" | "education";
      pipeline?: "live" | "prerecorded";
      scheduledAt?: string | null;
      guestName?: string | null;
      dealId?: string | null;
    };
    if (!body.channelId || !body.title?.trim()) {
      return NextResponse.json({ error: "channelId and title required" }, { status: 400 });
    }
    const result = await createShow({
      channelId: body.channelId,
      title: body.title.trim(),
      format: body.format,
      pipeline: body.pipeline,
      scheduledAt: body.scheduledAt,
      guestName: body.guestName,
      dealId: body.dealId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to create show" }, { status: 500 });
  }
}
