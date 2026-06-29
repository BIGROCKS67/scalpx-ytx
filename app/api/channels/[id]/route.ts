import { NextRequest, NextResponse } from "next/server";
import { updateChannel } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as {
      youtubeChannelId?: string | null;
      trackAccountId?: string | null;
      descriptionTemplate?: string;
      tags?: string[];
      socialLinks?: Record<string, string>;
    };
    const channel = await updateChannel(id, body);
    if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ channel });
  } catch (e) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
