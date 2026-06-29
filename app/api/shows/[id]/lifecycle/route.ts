import { NextRequest, NextResponse } from "next/server";
import { runShowLifecycle } from "@/lib/lifecycle";
import { getShow } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = (await req.json().catch(() => ({}))) as {
      skipClips?: boolean;
      youtubeUrl?: string;
    };
    const result = await runShowLifecycle(id, {
      skipClips: body.skipClips ?? !show.youtubeVideoId,
      youtubeUrl: body.youtubeUrl,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[lifecycle]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lifecycle failed" },
      { status: 500 }
    );
  }
}
