import { NextResponse } from "next/server";
import { filterActiveChannels } from "@/lib/activeChannels";
import { buildTrendStreamInsights } from "@/lib/insights/trendStream";
import { getDashboardBundle } from "@/lib/store";
import { fetchYoutubeDashboardAnalytics } from "@/lib/youtube/dashboardAnalytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const bundle = await getDashboardBundle();
    const activeChannels = filterActiveChannels(bundle.channels);
    const youtube = await fetchYoutubeDashboardAnalytics(8);
    const trends = buildTrendStreamInsights(youtube, activeChannels, bundle.shows);

    return NextResponse.json({ trends, youtube });
  } catch (e) {
    console.error("[trends]", e);
    return NextResponse.json({ error: "Failed to load trends" }, { status: 500 });
  }
}
