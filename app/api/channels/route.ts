import { NextResponse } from "next/server";
import { seedChannels } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const channels = await seedChannels();
    return NextResponse.json({ channels });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load channels" }, { status: 500 });
  }
}
