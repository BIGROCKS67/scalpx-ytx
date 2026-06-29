import { NextRequest, NextResponse } from "next/server";
import { preflightShowRun, type PreflightMode } from "@/lib/readiness/preflight";
import { getShow } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const show = await getShow(id);
  if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const mode = (req.nextUrl.searchParams.get("mode") ?? "full") as PreflightMode;
  const preflight = await preflightShowRun(id, mode);
  return NextResponse.json(preflight);
}
