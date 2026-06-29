"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ShowFormat, ShowPipeline, ShowRun, YtChannel } from "@/lib/types";
import { PIPELINE_LABELS } from "@/lib/pipelines";
import { fetchJson } from "@/lib/clientFetch";
import ErrorBanner from "@/components/ErrorBanner";
import { ContextHeader } from "@/components/shell/ContextHeader";
import { Badge, Button } from "@/components/ui";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

export function ShowsView() {
  const searchParams = useSearchParams();
  const preChannel = searchParams.get("channel");
  const [channels, setChannels] = useState<YtChannel[]>([]);
  const [shows, setShows] = useState<ShowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    channelId: preChannel ?? "",
    title: "",
    format: "stream" as ShowFormat,
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
    }));
    setLoading(false);
  }, [preChannel]);

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
            {creating ? "Creating…" : "Create show"}
          </Button>
        </div>
      }
    >
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <ContextHeader title="Shows" subtitle="Show runs and lifecycle checklists" />

      {loading ? (
        <p className="text-dim text-sm">Loading…</p>
      ) : shows.length === 0 ? (
        <div className="track-panel text-center py-12">
          <p className="text-dim mb-2">No shows yet. Use the panel to create one.</p>
        </div>
      ) : (
        <ul className="ytx-queue">
          {shows.map((show) => {
            const ch = channels.find((c) => c.id === show.channelId);
            return (
              <li key={show.id}>
                <Link href={`/shows/${show.id}`} className="ytx-queue-row">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{show.title}</p>
                    <p className="text-xs text-dim">
                      {ch?.displayName} · {PIPELINE_LABELS[show.pipeline]}
                      {show.scheduledAt
                        ? ` · ${new Date(show.scheduledAt).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <Badge tone={show.status === "live" ? "warn" : show.status === "completed" ? "good" : "neutral"}>
                    {show.status}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </WorkspaceShell>
  );
}
