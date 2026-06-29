import type { AnalyticsSnapshot } from "@/lib/types";

const FAKE_ANALYTICS_SOURCES = new Set(["estimated", "demo_seed", "simulated"]);

export function isFakeAnalyticsSource(source: string): boolean {
  return FAKE_ANALYTICS_SOURCES.has(source);
}

export function isLegitAnalyticsSnapshot(s: AnalyticsSnapshot): boolean {
  const src = String(s.metadata?.source ?? "");
  if (!src) return false;
  return !isFakeAnalyticsSource(src);
}

export function legitAnalyticsOnly(snapshots: AnalyticsSnapshot[]): AnalyticsSnapshot[] {
  return snapshots.filter(isLegitAnalyticsSnapshot);
}
