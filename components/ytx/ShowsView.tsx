"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ShowFormat, ShowPipeline, ShowRun, YtChannel } from "@/lib/types";
import { PIPELINE_LABELS } from "@/lib/pipelines";
import { fetchJson } from "@/lib/clientFetch";
import ErrorBanner from "@/components/ErrorBanner";
import { ContextHeader } from "@/components/shell/ContextHeader";
import { Button } from "@/components/ui";
import { ShowVideoCard } from "@/components/ytx/ShowVideoCard";
import { sortShowsForDashboard } from "@/lib/dashboardInsights";
import { filterActiveShows, filterArchivedShows, groupShowsByArchiveDate } from "@/lib/showFilters";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

export function ShowsView() {
  const searchParams = useSearchParams();
  const preChannel = searchParams.get("channel");
  const preTitle = searchParams.get("title");
  const preFormat = searchParams.get("format") as ShowFormat | null;
  const [channels, setChannels] = useState<YtChannel[]>([]);
  const [shows, setShows] = useState<ShowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [form, setForm] = useState({
    channelId: preChannel ?? "",
    title: preTitle ?? "",
    format: (preFormat && ["banter", "stream", "education"].includes(preFormat)
      ? preFormat
      : "stream") as ShowFormat,
    pipeline: "live" as ShowPipeline,
    guestName: "",
    dealId: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [chRes, shRes] = await Promise.all([
      fetchJson<{ channels: YtChannel[] }>("/api/channels"),
      fetchJson<{ shows: ShowRun[] }>("/api/shows"),
    ]);
    if (!chRes.ok) {
      setError(chRes.error);
      setLoading(false);
      return;
    }
    setChannels(chRes.data.channels);
    setShows(shRes.ok ? shRes.data.shows : []);
    setForm((f) => ({
      ...f,
      channelId: f.channelId || preChannel || chRes.data.channels[0]?.id || "",
      title: f.title || preTitle || "",
      format:
        f.title || !preFormat
          ? f.format
          : (["banter", "stream", "education"].includes(preFormat) ? preFormat : f.format) as ShowFormat,
    }));
    setLoading(false);
  }, [preChannel, preTitle, preFormat]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createShow() {
    if (!form.channelId || !form.title.trim()) return;
    setCreating(true);
    const res = await fetchJson<{ show: ShowRun }>("/api/shows", {
      method: "POST",
      body: JSON.stringify({
        channelId: form.channelId,
        title: form.title.trim(),
        format: form.format,
        pipeline: form.pipeline,
        guestName: form.guestName || null,
        dealId: form.dealId || null,
      }),
    });
    setCreating(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    window.location.href = `/shows/${res.data.show.id}`;
  }

  const activeShows = sortShowsForDashboard(filterActiveShows(shows));
  const archiveGroups = groupShowsByArchiveDate(filterArchivedShows(shows));
  const archivedCount = archiveGroups.reduce((n, g) => n + g.shows.length, 0);

  return (
    <WorkspaceShell
      title="New show"
      panel={
        <div className="track-rail-block space-y-3">
          <p className="track-rail-label">Create ShowRun</p>
          <select
            className="ytx-input w-full"
            value={form.channelId}
            onChange={(e) => setForm((f) => ({ ...f, channelId: e.target.value }))}
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
          <input
            className="ytx-input w-full"
            placeholder="Show title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <select
            className="ytx-input w-full"
            value={form.format}
            onChange={(e) => {
              const format = e.target.value as ShowFormat;
              setForm((f) => ({
                ...f,
                format,
                pipeline: format === "education" ? "prerecorded" : f.pipeline,
              }));
            }}
          >
            <option value="stream">Stream</option>
            <option value="banter">Banter</option>
            <option value="education">Education</option>
          </select>
          <select
            className="ytx-input w-full"
            value={form.pipeline}
            onChange={(e) => setForm((f) => ({ ...f, pipeline: e.target.value as ShowPipeline }))}
          >
            <option value="live">{PIPELINE_LABELS.live}</option>
            <option value="prerecorded">{PIPELINE_LABELS.prerecorded}</option>
          </select>
          <input
            className="ytx-input w-full"
            placeholder="Guest (optional)"
            value={form.guestName}
            onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
          />
          <Button className="w-full" disabled={creating} onClick={() => void createShow()}>
            {creating ? "Creating & preparing…" : "Create show"}
          </Button>
        </div>
      }
    >
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <ContextHeader
        title="Shows"
        subtitle="New ShowRuns only — create a stream, run the lifecycle, then archive when done. Past YouTube uploads live on Home."
      />

      {loading ? (
        <div className="ytx-show-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="ytx-show-card ytx-show-card-skeleton" aria-hidden />
          ))}
        </div>
      ) : activeShows.length === 0 ? (
        <div className="track-panel text-center py-12">
          <p className="text-ink font-medium mb-2">No active show runs</p>
          <p className="text-dim text-sm mb-4 max-w-md mx-auto">
            Create a ShowRun in the panel for your next stream or VOD. Link a YouTube URL on the show board, then Run preview or Full E2E.
          </p>
          {archivedCount > 0 ? (
            <button
              type="button"
              className="text-xs text-accent hover:underline"
              onClick={() => setShowArchive(true)}
            >
              View {archivedCount} archived run{archivedCount === 1 ? "" : "s"}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="ytx-show-grid">
          {activeShows.map((show) => (
            <ShowVideoCard
              key={show.id}
              show={show}
              channel={channels.find((c) => c.id === show.channelId)}
            />
          ))}
        </div>
      )}

      {!loading && archivedCount > 0 ? (
        <div className="mt-8">
          <button
            type="button"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-dim hover:text-ink mb-3"
            onClick={() => setShowArchive((v) => !v)}
          >
            {showArchive ? "Hide" : "Show"} archive · {archivedCount} past & completed
          </button>
          {showArchive ? (
            <div className="space-y-6 opacity-90">
              {archiveGroups.map((group) => (
                <section key={group.key}>
                  <h3 className="ytx-archive-date-label">{group.label}</h3>
                  <div className="ytx-show-grid mt-3">
                    {group.shows.map((show) => (
                      <ShowVideoCard
                        key={show.id}
                        show={show}
                        channel={channels.find((c) => c.id === show.channelId)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </WorkspaceShell>
  );
}
