import { NextResponse } from "next/server";
import { ensureDemoLoaded, listChannels } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureDemoLoaded();
    const channels = await listChannels();
    return NextResponse.json({ channels });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load channels" }, { status: 500 });
  }
}
