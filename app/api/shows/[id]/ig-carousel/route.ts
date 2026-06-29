import { NextRequest, NextResponse } from "next/server";
import { generateIgCarouselDraft } from "@/lib/adapters/content";
import { ACTION_TASKS, markTasksDone } from "@/lib/checklistAutomation";
import { getChannel, getIgCarousel, getShow, upsertIgCarousel } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const carousel = await getIgCarousel(id);
  return NextResponse.json({ carousel });
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const show = await getShow(id);
    if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const channel = await getChannel(show.channelId);
    if (!channel) return NextResponse.json({ error: "Channel missing" }, { status: 404 });
    const draft = await generateIgCarouselDraft(show, channel);
    const carousel = await upsertIgCarousel(id, {
      slides: draft.slides,
      caption: draft.caption,
      status: "pending_qc",
    });
    return NextResponse.json({ carousel });
  } catch (e) {
    return NextResponse.json({ error: "IG carousel generation failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as {
      action?: "approve" | "reject";
      caption?: string;
      slides?: string[];
    };
    const existing = await getIgCarousel(id);
    if (!existing) return NextResponse.json({ error: "Generate carousel first" }, { status: 404 });
    const carousel = await upsertIgCarousel(id, {
      slides: body.slides ?? existing.slides,
      caption: body.caption ?? existing.caption,
      status: body.action === "approve" ? "approved" : body.action === "reject" ? "rejected" : existing.status,
    });
    if (body.action === "approve") {
      await markTasksDone(id, ACTION_TASKS.igCarousel);
    }
    return NextResponse.json({ carousel });
  } catch {
    return NextResponse.json({ error: "QC update failed" }, { status: 500 });
  }
}
