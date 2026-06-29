import { NextRequest, NextResponse } from "next/server";
import { runShowLifecycle, type LifecycleOptions } from "@/lib/lifecycle";
import { getShow } from "@/lib/store";
import type { PreflightMode } from "@/lib/readiness/preflight";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as {
      mode?: PreflightMode;
      youtubeUrl?: string;
    };

    const opts: LifecycleOptions = {
      mode: body.mode ?? "full",
      youtubeUrl: body.youtubeUrl,
    };

    const result = await runShowLifecycle(id, opts);

    if (!result.ok && result.blockers?.length) {
      return NextResponse.json(result, { status: 422 });
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error("[lifecycle]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lifecycle failed" },
      { status: 500 }
    );
  }
}
