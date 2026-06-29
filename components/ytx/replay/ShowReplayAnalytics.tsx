"use client";

import Link from "next/link";
import type { AnalyticsSnapshot } from "@/lib/types";
import { legitAnalyticsOnly } from "@/lib/analyticsLegit";
import { formatCompactCount } from "@/lib/formatNumbers";
import { Button } from "@/components/ui";

export function ShowReplayAnalytics({
  analytics,
  fromYoutube,
  syncError,
  canRefresh,
  busy,
  onRefresh,
}: {
  analytics: AnalyticsSnapshot[];
  fromYoutube: boolean;
  syncError?: string | null;
  canRefresh: boolean;
  busy?: boolean;
  onRefresh?: () => void;
}) {
  const legit = legitAnalyticsOnly(analytics);
  const peak = legit.find((a) => a.snapshotType === "peak_viewers");
  const waiting = legit.find((a) => a.snapshotType === "waiting_room");
  const views = legit.find((a) => a.snapshotType === "views_24h");
  const viewsMetric = views?.metadata?.metric === "total_views" ? "Video views (YouTube)" : "Views (24h)";

  const cards = [
    {
      label: "Peak live viewers",
      value: peak?.concurrentViewers ?? null,
      hint: peak ? "From YouTube live stats" : "Only available if captured while live",
    },
    {
      label: "Waiting room",
      value: waiting?.concurrentViewers ?? null,
      hint: "Captured during pre-show (YouTube API)",
    },
    {
      label: viewsMetric,
      value: views?.views24h ?? null,
      hint: views ? "From YouTube Data API" : "Needs linked video + API access",
    },
  ];

  const hasAny = cards.some((c) => c.value != null);

  return (
    <section className="ytx-replay-analytics">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="ytx-autofill-label">Stream analytics</p>
          <h2 className="text-base font-semibold text-ink mt-1">
            {fromYoutube && hasAny ? "YouTube-verified stats" : "No verified stats yet"}
          </h2>
          <p className="text-xs text-dim mt-1">
            Only numbers returned by YouTube — we never fill in fake viewer counts or topics.
          </p>
        </div>
        {canRefresh && onRefresh ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={onRefresh}>
            {busy ? "Syncing…" : "Sync from YouTube"}
          </Button>
        ) : null}
      </header>

      {!hasAny ? (
        <div className="ytx-show-status-banner ytx-show-status-banner-warn mb-4 text-sm">
          {syncError ?? "Link the real YouTube URL and connect OAuth on"}{" "}
          {!syncError ? (
            <Link href="/channels" className="text-accent hover:underline">
              Roster
            </Link>
          ) : null}
          {syncError ? null : " to pull verified analytics."}
        </div>
      ) : (
        <div className="ytx-show-status-banner ytx-show-status-banner-info mb-4 text-sm">
          Verified via YouTube Data API — not estimated.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="ytx-replay-stat">
            <p className="ytx-autofill-label">{card.label}</p>
            <p className="text-xl font-bold font-mono text-ink mt-1 tabular-nums">
              {card.value == null ? "—" : formatCompactCount(Number(card.value))}
            </p>
            <p className="text-[11px] text-dim mt-1">{card.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
