import { NextResponse } from "next/server";
import { syncRosterFromYoutube } from "@/lib/youtube/rosterSync";
import { seedChannels } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    await seedChannels();
    const result = await syncRosterFromYoutube();
    return NextResponse.json(result);
  } catch (e) {
    console.error("[roster/sync-youtube]", e);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
