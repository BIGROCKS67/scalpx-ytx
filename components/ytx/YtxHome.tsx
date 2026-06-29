"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ShowRun, YtChannel } from "@/lib/types";
import type { AttentionItem, ShowProgress } from "@/lib/dashboardInsights";
import { statusLabel } from "@/lib/dashboardInsights";
import { fetchJson } from "@/lib/clientFetch";
import ErrorBanner from "@/components/ErrorBanner";
import { ContextHeader } from "@/components/shell/ContextHeader";
import { Badge, Button, SkeletonStatTile, StatTile } from "@/components/ui";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { YoutubeAnalyticsSection } from "@/components/ytx/YoutubeAnalyticsSection";
import type { YoutubeDashboardAnalytics } from "@/lib/youtube/dashboardAnalytics";

type DashboardPayload = {
  channels: YtChannel[];
  shows: ShowRun[];
  stats: { auto: number; assist: number; manual: number; doneAuto: number; total: number };
  attention: AttentionItem[];
  showProgress: ShowProgress[];
  rosterHealth: { oauth: number; ids: number; total: number };
  ship: { autoTotal: number; autoDone: number; shipTarget: number };
  counts: { qcPending: number; previewRuns: number; actionable: number; totalQcTasks: number };
  youtube: YoutubeDashboardAnalytics;
};

export function YtxHome() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchJson<DashboardPayload>("/api/dashboard");
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const liveCount = data?.shows.filter((s) => s.status === "live").length ?? 0;
  const qcCount = data?.counts.totalQcTasks ?? 0;
  const actionableShows = data?.shows.filter((s) => {
    if (["live", "blocked", "preview", "draft", "scheduled"].includes(s.status)) return true;
    if (s.status === "completed") {
      const prog = data.showProgress.find((p) => p.showId === s.id);
      return (prog?.qcPending ?? 0) > 0 || (prog?.pct ?? 0) > 0;
    }
    return false;
  });

  return (
    <WorkspaceShell
      title="Overview"
      panel={
        <div className="track-rail-block space-y-4 text-sm text-dim">
          <div>
            <p className="track-rail-label">Active channels</p>
            <p>Chento Trades · Crypto Banter</p>
            <p className="text-xs mt-1">
              {data?.rosterHealth.ids ?? 2}/{data?.rosterHealth.total ?? 2} synced from YouTube
            </p>
          </div>
          <Link href="/shows" className="track-rail-pill text-left w-full">
            All shows
          </Link>
          <Link href="/channels" className="track-rail-pill text-left w-full">
            Open roster
          </Link>
        </div>
      }
    >
      {error ? <ErrorBanner message={error} onDismiss={() => void load()} /> : null}

      <ContextHeader
        title="Overview"
        subtitle="YouTube stats, recent uploads, and lifecycle ops"
      />

      <YoutubeAnalyticsSection analytics={data?.youtube} loading={loading} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        {loading ? (
          <>
            <SkeletonStatTile />
            <SkeletonStatTile />
            <SkeletonStatTile />
            <SkeletonStatTile />
          </>
        ) : (
          <>
            <StatTile
              label="Action queue"
              value={data?.counts.actionable ?? 0}
              sub="QC · preview · live"
              tone={data?.counts.actionable ? "text-amber-300" : undefined}
            />
            <StatTile
              label="QC pending"
              value={qcCount}
              sub="Trailer · comments · carousel"
              tone={qcCount ? "text-amber-300" : undefined}
            />
            <StatTile
              label="Preview runs"
              value={data?.counts.previewRuns ?? 0}
              sub="Drafts ready to review"
            />
            <StatTile label="Live now" value={liveCount} sub="Active broadcasts" />
          </>
        )}
      </div>

      {!loading && data ? (
        <div className="ytx-ship-bar mb-6">
          <div className="flex justify-between text-xs text-dim mb-1">
            <span>Lifecycle automation</span>
            <span className="font-mono">
              {data.ship.autoDone}/{data.ship.autoTotal} auto · {data.ship.shipTarget}/38 target
            </span>
          </div>
          <div className="ytx-progress-track">
            <div
              className="ytx-progress-fill"
              style={{
                width: `${Math.min(100, Math.round((data.ship.autoDone / data.ship.shipTarget) * 100))}%`,
              }}
            />
            <div className="ytx-progress-marker" style={{ left: "70%" }} title="70% ship target" />
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="track-panel lg:col-span-3">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold text-ink">Action queue</h2>
            {qcCount > 0 ? <Badge tone="warn">{qcCount} QC</Badge> : null}
          </div>
          {loading ? (
            <p className="text-dim text-sm">Loading…</p>
          ) : data?.attention.length ? (
            <ul className="ytx-queue">
              {data.attention.slice(0, 8).map((item) => (
                <li key={item.showId}>
                  <Link href={item.href} className="ytx-queue-row">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink truncate">{item.title}</p>
                      <p className="text-xs text-dim">
                        {item.channelName} · {item.reason}
                      </p>
                    </div>
                    <Badge tone={item.urgency === "high" ? "bad" : item.urgency === "medium" ? "warn" : "neutral"}>
                      {item.urgency}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-dim text-sm">
              Nothing queued. Link a video on a show and hit Run preview to populate the board.
            </p>
          )}
        </section>

        <section className="track-panel lg:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold text-ink">Show runs</h2>
            <Link href="/shows" className="text-xs text-accent hover:underline">
              All
            </Link>
          </div>
          {loading ? (
            <p className="text-dim text-sm">Loading…</p>
          ) : actionableShows?.length ? (
            <ul className="ytx-queue">
              {actionableShows.slice(0, 6).map((show) => {
                const ch = data!.channels.find((c) => c.id === show.channelId);
                const prog = data!.showProgress.find((p) => p.showId === show.id);
                return (
                  <li key={show.id}>
                    <Link href={`/shows/${show.id}`} className="ytx-queue-row">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink truncate">{show.title}</p>
                        <p className="text-xs text-dim">
                          {ch?.displayName}
                          {prog ? ` · ${prog.pct}%` : ""}
                          {prog?.nextAction ? ` · ${prog.nextAction}` : ""}
                        </p>
                      </div>
                      <Badge
                        tone={
                          show.status === "live"
                            ? "warn"
                            : show.status === "preview"
                              ? "good"
                              : show.status === "blocked"
                                ? "bad"
                                : "neutral"
                        }
                      >
                        {statusLabel(show.status)}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : data?.shows.length ? (
            <ul className="ytx-queue">
              {data.shows.slice(0, 6).map((show) => {
                const ch = data.channels.find((c) => c.id === show.channelId);
                const prog = data.showProgress.find((p) => p.showId === show.id);
                return (
                  <li key={show.id}>
                    <Link href={`/shows/${show.id}`} className="ytx-queue-row">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink truncate">{show.title}</p>
                        <p className="text-xs text-dim">
                          {ch?.displayName}
                          {prog ? ` · ${prog.pct}%` : ""}
                        </p>
                      </div>
                      <Badge tone="neutral">{statusLabel(show.status)}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-6 text-center">
              <p className="text-dim text-sm mb-3">No show runs yet</p>
              <Link href="/shows">
                <Button>Create show</Button>
              </Link>
            </div>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}
