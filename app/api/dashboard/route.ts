import { NextResponse } from "next/server";
import {
  buildAttentionQueue,
  progressForShow,
  rosterHealth,
  shipMetrics,
} from "@/lib/dashboardInsights";
import { getDashboardBundle } from "@/lib/store";
import { automationStats } from "@/lib/checklistTasks";
import { CHECKLIST_TASKS } from "@/lib/checklistTasks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const bundle = await getDashboardBundle();
    const allItems = Object.values(bundle.checklistByShow).flat();
    const stats = automationStats(
      allItems.length
        ? allItems.map((i) => ({ mode: i.mode, status: i.status }))
        : CHECKLIST_TASKS.map((t) => ({ mode: t.mode, status: "pending" as const }))
    );

    const showProgress = bundle.shows.map((show) => ({
      showId: show.id,
      ...progressForShow(bundle.checklistByShow[show.id] ?? []),
    }));

    return NextResponse.json({
      ...bundle,
      stats,
      attention: buildAttentionQueue(bundle.shows, bundle.channels, bundle.checklistByShow),
      showProgress,
      rosterHealth: rosterHealth(bundle.channels),
      ship: shipMetrics(allItems),
    });
  } catch (e) {
    console.error("[dashboard]", e);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
