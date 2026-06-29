import { NextResponse } from "next/server";
import { ensureRosterData, listChannels } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureRosterData();
    const channels = await listChannels();
    return NextResponse.json({ channels });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load channels" }, { status: 500 });
  }
}
