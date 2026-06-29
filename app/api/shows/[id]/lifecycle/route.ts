import { NextRequest, NextResponse } from "next/server";
import { runShowLifecycle, type LifecycleOptions, type LifecycleResult } from "@/lib/lifecycle";
import { getShow } from "@/lib/store";
import type { PreflightMode } from "@/lib/readiness/preflight";
import type { LifecycleProgressEvent } from "@/lib/lifecycleProgress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function ndjsonLine(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(payload)}\n`);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as {
      mode?: PreflightMode;
      youtubeUrl?: string;
      stream?: boolean;
    };

    const opts: LifecycleOptions = {
      mode: body.mode ?? "full",
      youtubeUrl: body.youtubeUrl,
    };

    if (body.stream) {
      const stream = new ReadableStream({
        async start(controller) {
          let result: LifecycleResult | null = null;
          try {
            result = await runShowLifecycle(id, {
              ...opts,
              onProgress: (event: LifecycleProgressEvent) => {
                controller.enqueue(ndjsonLine({ kind: "progress", ...event }));
              },
            });
            controller.enqueue(ndjsonLine({ kind: "result", result }));
          } catch (e) {
            controller.enqueue(
              ndjsonLine({
                kind: "error",
                error: e instanceof Error ? e.message : "Lifecycle failed",
              })
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

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
