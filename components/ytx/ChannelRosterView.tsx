"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { YtChannel } from "@/lib/types";
import { fetchJson } from "@/lib/clientFetch";
import { withBasePath } from "@/lib/basePath";
import ErrorBanner from "@/components/ErrorBanner";
import { ContextHeader } from "@/components/shell/ContextHeader";
import { Badge, Button } from "@/components/ui";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

export function ChannelRosterView() {
  const [channels, setChannels] = useState<YtChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<YtChannel | null>(null);
  const [trackInfo, setTrackInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchJson<{ channels: YtChannel[] }>("/api/channels");
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setChannels(res.data.channels);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function connectOAuth(channelId: string) {
    window.location.href = withBasePath(`/api/youtube/connect?channelId=${encodeURIComponent(channelId)}`);
  }

  async function runChannelSetup(channelId: string) {
    setBusy("setup");
    const res = await fetchJson<{ description: string; tags: string[] }>(
      `/api/channels/${channelId}/setup`,
      { method: "POST" }
    );
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    void load();
  }

  async function loadTrack(channelId: string) {
    setBusy("track");
    const res = await fetchJson<{
      track: { account?: { handle: string }; avgViews: number } | null;
    }>(`/api/channels/${channelId}/track`);
    setBusy(null);
    if (res.ok && res.data.track?.account) {
      setTrackInfo(
        `@${res.data.track.account.handle} · avg views ${Math.round(res.data.track.avgViews)}`
      );
    } else {
      setTrackInfo("Track offline - link trackAccountId or configure Scout");
    }
  }

  async function syncFromYoutube() {
    setBusy("sync");
    const res = await fetchJson<{
      ok: boolean;
      channelsUpdated: number;
      showsImported: number;
      errors: string[];
    }>("/api/roster/sync-youtube", { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.data.errors.length) {
      setError(
        `Synced ${res.data.channelsUpdated} channel${res.data.channelsUpdated === 1 ? "" : "s"}. ${res.data.errors.slice(0, 2).join(" · ")}`
      );
    }
    void load();
  }

  return (
    <WorkspaceShell
      title="Channels"
      panel={
        <div className="track-rail-block">
          <p className="track-rail-label">Jump to channel</p>
          <div className="flex flex-col gap-1 max-h-[50vh] overflow-y-auto">
            {channels.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setSelected(ch)}
                className={`track-rail-pill text-left w-full ${selected?.id === ch.id ? "track-rail-pill-on" : ""}`}
              >
                {ch.displayName}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {error ? <ErrorBanner message={error} onDismiss={() => void load()} /> : null}

      <ContextHeader
        title="Roster"
        subtitle="Active release: Chento Trades + Crypto Banter · connect OAuth before running end to end"
      />

      <div className="mb-4">
        <Button size="sm" disabled={busy === "sync"} onClick={() => void syncFromYoutube()}>
          {busy === "sync" ? "Syncing…" : "Sync from YouTube"}
        </Button>
      </div>

      {loading ? (
        <p className="text-dim">Loading roster…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {channels.map((ch) => (
            <article
              key={ch.id}
              className={`track-panel p-4 cursor-pointer transition-colors ${
                selected?.id === ch.id ? "border-accent/30" : ""
              }`}
              onClick={() => setSelected(ch)}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-bold text-ink">{ch.displayName}</h3>
                  <p className="text-[11px] font-mono text-dim">{ch.slug}</p>
                </div>
                {ch.isShowFormat ? (
                  <span className="text-[10px] text-dim">Show format</span>
                ) : null}
              </div>
              <dl className="space-y-1.5 text-[11px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-dim">YouTube ID</dt>
                  <dd className="font-mono text-right truncate max-w-[140px]">
                    {ch.youtubeChannelId ?? <span className="text-amber-300">Pending</span>}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-dim">OAuth</dt>
                  <dd className={ch.oauthConnected ? "text-accent" : "text-amber-300"}>
                    {ch.oauthConnected ? "Connected" : "Not connected"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-dim">Formats</dt>
                  <dd className="text-right">{ch.showFormats.join(" · ")}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy === "setup"}
                  onClick={(e) => {
                    e.stopPropagation();
                    void runChannelSetup(ch.id);
                  }}
                >
                  Auto setup
                </Button>
                <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); void connectOAuth(ch.id); }}>
                  Connect OAuth
                </Button>
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); void loadTrack(ch.id); }}>
                  Track
                </Button>
                <Link href={`/shows?channel=${ch.id}`} onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost">New show</Button>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {selected && (
        <section className="track-panel mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-dim mb-3">{selected.displayName}</h2>
          <pre className="text-[11px] text-dim whitespace-pre-wrap font-mono bg-black/30 p-4 rounded-lg border border-white/5">
            {selected.descriptionTemplate || "No description template yet."}
          </pre>
          {selected.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selected.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-dim border border-white/10"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-6 border-t border-white/5 pt-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="font-bold text-ink text-sm">Channel trailer</h3>
                <p className="text-[10px] text-dim">Task 1.5 · auto + QC</p>
              </div>
              <Button
                size="sm"
                disabled={busy === "trailer"}
                onClick={async () => {
                  setBusy("trailer");
                  const res = await fetchJson<{ channel: YtChannel }>(
                    `/api/channels/${selected.id}/trailer`,
                    { method: "POST" }
                  );
                  setBusy(null);
                  if (res.ok) {
                    setSelected(res.data.channel);
                    void load();
                  } else {
                    setError(res.error);
                  }
                }}
              >
                Generate
              </Button>
            </div>
            {selected.channelTrailerDraft ? (
              <>
                <textarea
                  className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-[11px] font-mono text-dim min-h-[120px]"
                  value={selected.channelTrailerDraft.script}
                  onChange={(e) =>
                    setSelected({
                      ...selected,
                      channelTrailerDraft: {
                        ...selected.channelTrailerDraft!,
                        script: e.target.value,
                      },
                    })
                  }
                />
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await fetchJson(`/api/channels/${selected.id}/trailer`, {
                        method: "PATCH",
                        body: JSON.stringify({
                          action: "approve",
                          script: selected.channelTrailerDraft?.script,
                        }),
                      });
                      void load();
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await fetchJson(`/api/channels/${selected.id}/trailer`, {
                        method: "PATCH",
                        body: JSON.stringify({ action: "reject" }),
                      });
                      void load();
                    }}
                  >
                    Reject
                  </Button>
                  <Badge
                    tone={selected.channelTrailerDraft.status === "approved" ? "good" : "warn"}
                  >
                    {selected.channelTrailerDraft.status}
                  </Badge>
                </div>
              </>
            ) : (
              <p className="text-dim text-sm">AI script + highlight picks · approve before YT upload</p>
            )}
          </div>

          {trackInfo ? (
            <p className="text-[11px] text-accent mt-3 font-mono">{trackInfo}</p>
          ) : null}
          <p className="text-[10px] text-dim mt-3">
            Ops: copy <code className="text-accent">data/roster-channel-ids.example.json</code> →{" "}
            <code className="text-accent">data/roster-channel-ids.json</code> with real UC IDs
          </p>
        </section>
      )}
    </WorkspaceShell>
  );
}
