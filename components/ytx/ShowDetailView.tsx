"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AnalyticsSnapshot,
  ChecklistItem,
  ClipBatch,
  CommentReply,
  CrossPostItem,
  IgCarouselDraft,
  SeoPack,
  ShowRun,
  SponsorBlock,
  YtChannel,
} from "@/lib/types";
import { PHASE_LABELS, PHASE_ORDER, type ShowPhase } from "@/lib/types";
import { fetchJson } from "@/lib/clientFetch";
import ErrorBanner from "@/components/ErrorBanner";
import { Badge, Button, SegmentedControl } from "@/components/ui";
import { progressForShow } from "@/lib/dashboardInsights";
import { taskById } from "@/lib/checklistTasks";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { ReadinessPanel } from "@/components/ytx/ReadinessPanel";
import { ShowVideoHero } from "@/components/ytx/ShowVideoHero";
import {
  LifecycleProgressBar,
  createEmptyRunProgress,
  type LifecycleRunProgress,
} from "@/components/ytx/LifecycleProgressBar";
import { runLifecycleStream } from "@/lib/lifecycleStreamClient";

type PreflightPayload = {
  ready: boolean;
  blockers: { code: string; message: string; fix: string }[];
  warnings: string[];
  host?: {
    serverless: boolean;
    previewClips: "local" | "scout_or_skip";
    persistData: boolean;
    appOrigin: string;
  };
};

type VerificationRow = {
  id: string;
  action: string;
  ok: boolean;
  source: string;
  detail: string;
};

type ShowPayload = {
  show: ShowRun;
  channel: YtChannel | null;
  checklist: ChecklistItem[];
  crossPosts: CrossPostItem[];
  clipBatch: ClipBatch | null;
  analytics: AnalyticsSnapshot[];
  igCarousel: IgCarouselDraft | null;
  commentReplies: CommentReply[];
  verification?: VerificationRow[];
};

type LifecycleResultPayload = {
  ok: boolean;
  blockers?: { code: string; message: string; fix: string }[];
  steps: { step: string; ok: boolean; detail?: string; proof?: string }[];
  proof: {
    youtubeVideoId: string | null;
    metadataWriteOk: boolean;
    metadataWriteStatus: number | null;
    analyticsSource: string;
    clipsExportCount: number;
    qcStillPending: string[];
  };
  checklist: { done: number; pending: number; autoDone: number; autoTotal: number };
};

type Tab = "checklist" | "pre_show" | "live" | "post_show";

type RunMode = "full" | "metadata_only" | "preview";

export function ShowDetailView({ showId }: { showId: string }) {
  const [data, setData] = useState<ShowPayload | null>(null);
  const [tab, setTab] = useState<Tab>("checklist");
  const [phase, setPhase] = useState<ShowPhase>("channel_setup");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [seoPack, setSeoPack] = useState<SeoPack | null>(null);
  const [sponsorBlock, setSponsorBlock] = useState<SponsorBlock | null>(null);
  const [commentItems, setCommentItems] = useState<CommentReply[]>([]);
  const [igCarousel, setIgCarousel] = useState<IgCarouselDraft | null>(null);
  const [endScreenMsg, setEndScreenMsg] = useState<string | null>(null);
  const [lifecycleMsg, setLifecycleMsg] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<PreflightPayload | null>(null);
  const [lifecycleProof, setLifecycleProof] = useState<LifecycleResultPayload["proof"] | null>(null);
  const [youtubeUrlInput, setYoutubeUrlInput] = useState("");
  const [runMode, setRunMode] = useState<RunMode>("preview");
  const [runProgress, setRunProgress] = useState<LifecycleRunProgress>(createEmptyRunProgress);

  const loadPreflight = useCallback(async () => {
    const res = await fetchJson<PreflightPayload>(
      `/api/shows/${showId}/preflight?mode=${runMode}`
    );
    if (res.ok) setPreflight(res.data);
  }, [showId, runMode]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchJson<ShowPayload>(`/api/shows/${showId}`);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setData(res.data);
    setCommentItems(res.data.commentReplies);
    setIgCarousel(res.data.igCarousel);
    if (res.data.show.youtubeVideoId) {
      setYoutubeUrlInput((prev) =>
        prev ? prev : `https://www.youtube.com/watch?v=${res.data.show.youtubeVideoId}`
      );
    }
    setLoading(false);
    void loadPreflight();
  }, [showId, loadPreflight]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadPreflight();
  }, [loadPreflight]);

  async function bindYoutubeVideo() {
    setBusy("bind-video");
    const res = await fetchJson<{ show: ShowRun }>(`/api/shows/${showId}`, {
      method: "PATCH",
      body: JSON.stringify({ youtubeUrl: youtubeUrlInput }),
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    void load();
  }

  async function runEndToEnd() {
    setBusy("lifecycle");
    setLifecycleMsg(null);
    setError(null);
    const initial = { ...createEmptyRunProgress(), running: true };
    setRunProgress(initial);

    const res = await runLifecycleStream(showId, runMode, setRunProgress, initial);
    setBusy(null);

    if (!res.data) {
      setError(!res.ok ? res.error : "Lifecycle run failed");
      return;
    }

    if (!res.ok) {
      const blockers = res.data.blockers;
      if (blockers?.length) {
        setPreflight({ ready: false, blockers, warnings: [] });
        setError(blockers.map((b) => b.message).join(" · "));
      } else {
        setError(res.error);
      }
      setLifecycleProof(res.data.proof);
      return;
    }

    setLifecycleProof(res.data.proof);
    const okSteps = res.data.steps.filter((s) => s.ok).length;
    setLifecycleMsg(
      res.data.ok
        ? runMode === "preview"
          ? `Preview complete · ${okSteps}/${res.data.steps.length} steps · drafts local · ${res.data.proof.clipsExportCount} clips · connect OAuth to publish`
          : `Verified end-to-end · ${okSteps}/${res.data.steps.length} steps · YouTube write OK · ${res.data.proof.clipsExportCount} clips`
        : runMode === "preview"
          ? `Preview blocked · ${res.data.checklist.autoDone}/${res.data.checklist.autoTotal} auto tasks done · check proof panel`
          : `Run blocked · ${res.data.checklist.autoDone}/${res.data.checklist.autoTotal} auto tasks done · check proof panel`
    );
    void load();
  }

  const phaseItems = useMemo(() => {
    if (!data) return [];
    return data.checklist.filter((i) => i.phase === phase);
  }, [data, phase]);

  const progress = useMemo(() => {
    if (!data) return { done: 0, total: 0, pct: 0, qcPending: 0 };
    const p = progressForShow(data.checklist);
    return { done: p.done, total: p.total, pct: p.pct, qcPending: p.qcPending };
  }, [data]);

  async function runAction(label: string, url: string, method = "POST") {
    setBusy(label);
    const res = await fetchJson(url, { method });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if ("pack" in (res.data as object)) setSeoPack((res.data as { pack: SeoPack }).pack);
    if ("sponsorBlock" in (res.data as object))
      setSponsorBlock((res.data as { sponsorBlock: SponsorBlock }).sponsorBlock);
    if ("edge" in (res.data as object)) {
      const d = res.data as { edge?: { fromVideoId: string; toVideoId: string }; abReminderAt?: string };
      setEndScreenMsg(
        d.edge
          ? `EndScreenDB · ${d.edge.fromVideoId} → ${d.edge.toVideoId}${d.abReminderAt ? ` · A/B +48h ${d.abReminderAt}` : ""}`
          : "Post-show pass complete"
      );
    }
    void load();
  }

  async function toggleTask(taskId: string, status: ChecklistItem["status"]) {
    await fetchJson(`/api/shows/${showId}/checklist`, {
      method: "PATCH",
      body: JSON.stringify({ taskId, status }),
    });
    void load();
  }

  async function setShowStatus(status: ShowRun["status"]) {
    await fetchJson(`/api/shows/${showId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    void load();
  }

  if (loading && !data) {
    return (
      <div className="track-workspace min-h-[60vh] flex items-center justify-center text-dim">
        Loading show…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="track-workspace p-8">
        <ErrorBanner message={error ?? "Show not found"} />
        <Link href="/shows" className="text-accent text-sm mt-4 inline-block">
          ← Back to shows
        </Link>
      </div>
    );
  }

  const { show, channel, crossPosts, clipBatch, analytics } = data;

  return (
    <WorkspaceShell
      title={show.title.slice(0, 20)}
      panel={
        <>
          <div className="track-rail-block">
            <p className="track-rail-label">Progress</p>
            <p className="text-2xl font-bold font-mono text-ink tabular-nums">{progress.pct}%</p>
            <p className="text-xs text-dim">
              {progress.done}/{progress.total} applicable
              {progress.qcPending ? ` · ${progress.qcPending} QC` : ""}
            </p>
            <div className="ytx-progress-track mt-3">
              <div className="ytx-progress-fill" style={{ width: `${progress.pct}%` }} />
            </div>
          </div>
          <div className="track-rail-block">
            <p className="track-rail-label">Phase</p>
            <div className="flex flex-col gap-1">
              {PHASE_ORDER.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPhase(p);
                    setTab("checklist");
                  }}
                  className={`track-rail-pill text-left w-full ${phase === p ? "track-rail-pill-on" : ""}`}
                >
                  {PHASE_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          <div className="track-rail-block">
            <p className="track-rail-label">Status</p>
            <SegmentedControl
              value={show.status}
              options={[
                { value: "draft", label: "Draft" },
                { value: "scheduled", label: "Sched" },
                { value: "live", label: "Live" },
                { value: "blocked", label: "Blocked" },
                { value: "preview", label: "Preview" },
                { value: "completed", label: "Done" },
              ]}
              onChange={(v) => void setShowStatus(v as ShowRun["status"])}
              className="w-full flex flex-wrap"
            />
          </div>
        </>
      }
    >
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <Link href="/shows" className="text-xs text-dim hover:text-accent mb-3 inline-block">
        ← Shows
      </Link>

      <ShowVideoHero
        show={show}
        channel={channel}
        progressPct={progress.pct}
        actions={
          <>
            <select
              className="ytx-mobile-full ytx-select"
              value={runMode}
              onChange={(e) => setRunMode(e.target.value as RunMode)}
            >
              <option value="preview">Preview run (no OAuth)</option>
              <option value="full">Full E2E (OAuth)</option>
              <option value="metadata_only">Metadata only</option>
            </select>
            <Button
              className="ytx-mobile-full"
              size="sm"
              disabled={busy === "lifecycle" || preflight?.ready === false}
              onClick={() => void runEndToEnd()}
            >
              {busy === "lifecycle" ? "Running…" : runMode === "preview" ? "Run preview" : "Run end to end"}
            </Button>
          </>
        }
      />

      <ReadinessPanel
        blockers={preflight?.blockers ?? []}
        warnings={preflight?.warnings ?? []}
        ready={preflight?.ready ?? false}
        mode={runMode}
        host={preflight?.host}
        proof={lifecycleProof ?? undefined}
        verification={data.verification}
      />

      <LifecycleProgressBar
        progress={runProgress}
        modeLabel={runMode === "preview" ? "Preview run" : runMode === "full" ? "Full E2E" : "Metadata run"}
      />

      <div className="track-panel mb-4 ytx-bind-video">
        <label className="flex-1 text-sm block">
          <span className="text-dim text-xs block mb-1">YouTube video (required for E2E)</span>
          <input
            className="ytx-input w-full"
            placeholder="https://www.youtube.com/watch?v=…"
            value={youtubeUrlInput}
            onChange={(e) => setYoutubeUrlInput(e.target.value)}
          />
        </label>
        <Button size="sm" variant="secondary" className="ytx-mobile-full shrink-0" disabled={busy === "bind-video"} onClick={() => void bindYoutubeVideo()}>
          {busy === "bind-video" ? "Saving…" : "Link video"}
        </Button>
      </div>

      {preflight?.host?.serverless ? (
        <div className="mb-4 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">
          Demo host — Preview run works here (SEO + drafts). Shorts MP4 export runs on local{" "}
          <span className="font-mono">:3001</span> or via Scout when wired. Data resets on cold start.
        </div>
      ) : null}

      {show.status === "preview" ? (
        <div className="mb-4 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
          Preview run complete — SEO, clips, and drafts are saved locally. Connect channel OAuth and use Full E2E to publish to YouTube.
        </div>
      ) : null}

      {show.status === "blocked" ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Show blocked — last end-to-end run did not pass verification. Fix blockers and run again.
        </div>
      ) : null}

      {lifecycleMsg ? <p className="text-xs text-dim font-mono mb-4">{lifecycleMsg}</p> : null}

      {show.status === "live" ? (
        <div className="tdesk-header mb-4">
          <span className="tdesk-live-dot" />
          <span className="text-sm font-semibold text-ink">Live</span>
          <span className="text-xs text-dim ml-auto">{channel?.oauthConnected ? "OAuth connected" : "OAuth offline"}</span>
        </div>
      ) : null}

      <div className="ytx-phase-stepper mb-4">
        {PHASE_ORDER.map((p) => {
          const items = data.checklist.filter((i) => i.phase === p && i.status !== "skipped");
          const done = items.filter((i) => i.status === "done").length;
          return (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPhase(p);
                setTab("checklist");
              }}
              className={`ytx-phase-step ${phase === p ? "ytx-phase-step-on" : ""}`}
            >
              <span className="text-xs font-medium">{PHASE_LABELS[p]}</span>
              <span className="text-[10px] font-mono text-dim">
                {done}/{items.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-6 ytx-tabs-scroll">
        <SegmentedControl
          value={tab}
          options={[
            { value: "checklist", label: "Checklist" },
            { value: "pre_show", label: "Pre-show" },
            { value: "live", label: "Live" },
            { value: "post_show", label: "Post-show" },
          ]}
          onChange={(v) => setTab(v as Tab)}
          className="ytx-segmented-mobile"
        />
      </div>

      {tab === "checklist" && (
        <section className="track-panel">
          <h2 className="text-sm font-bold uppercase tracking-wider text-dim mb-4">
            {PHASE_LABELS[phase]}
          </h2>
          <ul className="space-y-2">
            {phaseItems.map((item) => {
              const def = taskById(item.taskId);
              const skipped = item.status === "skipped";
              const qcGate = def?.needsQc && item.status !== "done";
              return (
                <li
                  key={item.id}
                  className={`ytx-task-row ${qcGate ? "ytx-task-row-qc" : ""} ${skipped ? "opacity-50" : ""}`}
                >
                  {skipped ? (
                    <span className="w-5 h-5 shrink-0 text-dim text-xs">⊘</span>
                  ) : def?.needsQc ? (
                    <span className="w-5 h-5 shrink-0 rounded-full border-2 border-amber-500/60" title="QC required" />
                  ) : def?.mode === "auto" ? (
                    <span
                      className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                        item.status === "done"
                          ? "bg-accent border-accent text-black"
                          : "border-white/20"
                      }`}
                      title="Auto tasks complete from verified lifecycle actions only"
                    >
                      {item.status === "done" ? "✓" : ""}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        void toggleTask(
                          item.taskId,
                          item.status === "done" ? "pending" : "done"
                        )
                      }
                      className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                        item.status === "done"
                          ? "bg-accent border-accent text-black"
                          : "border-white/20"
                      }`}
                    >
                      {item.status === "done" ? "✓" : ""}
                    </button>
                  )}
                  <div className="flex-1 min-w-[200px]">
                    <p className={`text-sm font-medium text-ink ${skipped ? "line-through" : ""}`}>
                      {def?.label ?? item.taskId}
                    </p>
                    <p className="text-[10px] font-mono text-dim">{item.taskId}</p>
                  </div>
                  <span className="text-[10px] text-dim">
                    {skipped ? "skipped" : def?.needsQc ? "auto · QC" : item.mode}
                  </span>
                  {def?.needsQc && !skipped ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setTab(def?.phase === "live" ? "live" : "post_show")}
                    >
                      Review
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {tab === "pre_show" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ActionPanel
            title="Channel setup"
            hint="Tasks 3.1 · 3.2 · auto description + tags"
            busy={busy === "chsetup"}
            onRun={() => void runAction("chsetup", `/api/shows/${showId}/channel-setup`)}
          >
            <p className="text-dim text-sm">
              Generate channel description + tags from roster template · marks channel setup tasks
            </p>
          </ActionPanel>

          <ActionPanel
            title="SEO pack"
            hint="Tasks 1.1 · 1.2 · 1.3 · 3.4"
            busy={busy === "seo"}
            onRun={() => void runAction("seo", `/api/shows/${showId}/seo-pack`)}
          >
            {seoPack || show.seoTitle ? (
              <div className="space-y-2 text-[11px] font-mono text-dim">
                <p className="text-accent font-bold">{show.seoTitle ?? seoPack?.titles[0]}</p>
                <pre className="whitespace-pre-wrap bg-black/30 p-3 rounded-lg max-h-40 overflow-y-auto">
                  {show.seoDescription ?? seoPack?.description}
                </pre>
              </div>
            ) : (
              <p className="text-dim text-sm">Generate title, description, tags, thumbnail brief</p>
            )}
          </ActionPanel>

          <ActionPanel
            title="Sponsor block"
            hint="Task 2.1 · Scout TrackingLinks"
            busy={busy === "sponsor"}
            onRun={() => void runAction("sponsor", `/api/shows/${showId}/sponsor-block`)}
          >
            {sponsorBlock ? (
              <pre className="text-[11px] whitespace-pre-wrap text-dim bg-black/30 p-3 rounded-lg">
                {sponsorBlock.copy}
              </pre>
            ) : (
              <p className="text-dim text-sm">Pull sponsor URLs from FlowX Scout by dealId</p>
            )}
          </ActionPanel>

          <ActionPanel
            title="Cross-post queue"
            hint="Tasks 1.7–3.6 · 6 platforms"
            busy={busy === "cross"}
            onRun={() => void runAction("cross", `/api/shows/${showId}/cross-post`)}
            className="lg:col-span-2"
          >
            {crossPosts.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {crossPosts.map((cp) => (
                  <div key={cp.id} className="p-3 rounded-lg bg-black/25 border border-white/5">
                    <p className="text-xs font-bold text-accent uppercase">{cp.platform}</p>
                    <p className="text-[11px] text-dim mt-1 line-clamp-3">{cp.draftBody}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-dim text-sm">Generate pre-show drafts (T-60min schedule)</p>
            )}
          </ActionPanel>
        </div>
      )}

      {tab === "live" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {show.pipeline !== "live" ? (
            <section className="track-panel lg:col-span-2">
              <p className="text-sm text-dim">
                Live-only tasks (1.11-1.14, 2.3) are skipped on the pre-recorded pipeline.
              </p>
            </section>
          ) : null}
          <ActionPanel
            title="Live analytics"
            hint="Tasks 1.11 · 3.7"
            busy={busy === "analytics"}
            onRun={() => void runAction("analytics", `/api/shows/${showId}/analytics`)}
          >
            {analytics.length ? (
              <ul className="space-y-2">
                {analytics.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex justify-between text-sm">
                    <span className="text-dim">{a.snapshotType.replace("_", " ")}</span>
                    <span className="font-mono text-accent">
                      {a.concurrentViewers ?? "-"} viewers
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-dim text-sm">Capture waiting room + peak concurrentViewers</p>
            )}
          </ActionPanel>

          <section className="track-panel">
            <h3 className="text-sm font-bold text-ink mb-2">Auto live ops</h3>
            <p className="text-[11px] text-dim mb-3">Tasks 1.12 · 1.13 - AI generates · no manual paste</p>
            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                size="sm"
                disabled={busy === "chapters" || show.pipeline !== "live"}
                onClick={() => void runAction("chapters", `/api/shows/${showId}/live/chapters`)}
              >
                Auto chapters
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy === "livelinks" || show.pipeline !== "live"}
                onClick={() => void runAction("livelinks", `/api/shows/${showId}/live/links`)}
              >
                Auto update links
              </Button>
            </div>
            {show.liveChapters.length > 0 ? (
              <pre className="text-[11px] bg-black/30 p-2 rounded-lg text-accent font-mono whitespace-pre-wrap">
                {show.liveChapters
                  .map((c) => {
                    const m = Math.floor(c.atSec / 60);
                    const s = String(Math.floor(c.atSec % 60)).padStart(2, "0");
                    return `${m}:${s} ${c.label}`;
                  })
                  .join("\n")}
              </pre>
            ) : (
              <p className="text-dim text-sm">Chapters auto-generated from moments or default milestones</p>
            )}
            <div className="mt-4">
              <p className="text-dim text-[11px] uppercase mb-1">Description patch log</p>
              {show.descriptionPatchLog.length > 0 ? (
                <ul className="text-[11px] text-dim space-y-1">
                  {show.descriptionPatchLog.slice(-3).map((p, i) => (
                    <li key={i}>
                      {p.note} · {new Date(p.at).toLocaleTimeString()}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-dim text-sm">Live link updates logged automatically</p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => void setShowStatus("live")}
            >
              Mark live
            </Button>
          </section>
        </div>
      )}

      {tab === "post_show" && (
        <div className="grid gap-4">
          <ActionPanel
            title="Clips pipeline"
            hint="Tasks 1.23 · 1.24 · Shorts export"
            busy={busy === "clips"}
            onRun={() =>
              void runAction(
                "clips",
                `/api/shows/${showId}/clips`,
                "POST"
              )
            }
          >
            {clipBatch ? (
              <div className="space-y-2">
                <Badge tone={clipBatch.status === "done" ? "good" : "warn"}>{clipBatch.status}</Badge>
                <p className="text-sm text-dim">{clipBatch.message}</p>
                {clipBatch.exportUrls.length > 0 && (
                  <ul className="text-[11px] font-mono text-accent space-y-1">
                    {clipBatch.exportUrls.map((u) => (
                      <li key={u} className="truncate">
                        {u}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-dim text-sm">
                Local Clips pipeline (yt-dlp · Whisper · ffmpeg) - Scout fallback if configured
              </p>
            )}
          </ActionPanel>

          <ActionPanel
            title="Post-show SEO + EndScreenDB"
            hint="Tasks 1.16–1.21 · transcript SEO · end cards"
            busy={busy === "postshow"}
            onRun={() => void runAction("postshow", `/api/shows/${showId}/post-show`)}
          >
            {endScreenMsg ? (
              <p className="text-sm text-dim">{endScreenMsg}</p>
            ) : (
              <p className="text-dim text-sm">Tags cleanup · chapters · end-screen graph edge</p>
            )}
          </ActionPanel>

          <ActionPanel
            title="Comment reply queue"
            hint="Task 1.22 · auto + QC"
            busy={busy === "comments"}
            onRun={async () => {
              setBusy("comments");
              const res = await fetchJson<{ items: CommentReply[]; abReminderAt?: string }>(
                `/api/shows/${showId}/comments`,
                { method: "POST" }
              );
              setBusy(null);
              if (res.ok) {
                setCommentItems(res.data.items);
                setEndScreenMsg(`A/B test reminder · +48h · ${res.data.abReminderAt ?? "scheduled"}`);
              }
              void load();
            }}
          >
            {commentItems.length ? (
              <ul className="space-y-3">
                {commentItems.map((c) => (
                  <li key={c.id} className="p-3 rounded bg-black/25 border border-white/5">
                    <p className="text-[11px] text-accent">{c.authorHint}</p>
                    <p className="text-xs text-dim">{c.commentText}</p>
                    <textarea
                      className="w-full mt-2 bg-black/30 border border-white/10 rounded px-2 py-1 text-[11px] text-ink min-h-[48px]"
                      value={c.draftReply}
                      onChange={async (e) => {
                        const reply = e.target.value;
                        setCommentItems((items) =>
                          items.map((x) => (x.id === c.id ? { ...x, draftReply: reply } : x))
                        );
                        await fetchJson(`/api/shows/${showId}/comments/${c.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ draftReply: reply }),
                        });
                      }}
                    />
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          await fetchJson(`/api/shows/${showId}/comments/${c.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ status: "approved" }),
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
                          await fetchJson(`/api/shows/${showId}/comments/${c.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ status: "skipped" }),
                          });
                          void load();
                        }}
                      >
                        Reject
                      </Button>
                      <Badge tone={c.status === "approved" ? "good" : "neutral"}>{c.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-dim text-sm">AI draft replies · approve or edit before posting</p>
            )}
          </ActionPanel>

          <ActionPanel
            title="IG carousel"
            hint="Task 2.4 · auto + QC"
            busy={busy === "igcarousel"}
            onRun={async () => {
              setBusy("igcarousel");
              const res = await fetchJson<{ carousel: IgCarouselDraft }>(
                `/api/shows/${showId}/ig-carousel`,
                { method: "POST" }
              );
              setBusy(null);
              if (res.ok) setIgCarousel(res.data.carousel);
              void load();
            }}
          >
            {igCarousel ? (
              <div className="space-y-3">
                {igCarousel.slides.map((slide, i) => (
                  <pre
                    key={i}
                    className="text-[11px] whitespace-pre-wrap text-dim bg-black/30 p-2 rounded-lg"
                  >
                    {slide}
                  </pre>
                ))}
                <p className="text-xs text-ink">{igCarousel.caption}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await fetchJson(`/api/shows/${showId}/ig-carousel`, {
                        method: "PATCH",
                        body: JSON.stringify({ action: "approve" }),
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
                      await fetchJson(`/api/shows/${showId}/ig-carousel`, {
                        method: "PATCH",
                        body: JSON.stringify({ action: "reject" }),
                      });
                      void load();
                    }}
                  >
                    Reject
                  </Button>
                  <Badge tone={igCarousel.status === "approved" ? "good" : "warn"}>
                    {igCarousel.status}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-dim text-sm">AI carousel slides + caption · human QC before publish</p>
            )}
          </ActionPanel>

          {channel?.channelTrailerDraft ? (
            <section className="track-panel">
              <h3 className="font-bold text-ink mb-2">Channel trailer (task 1.5)</h3>
              <p className="text-[10px] text-dim uppercase mb-2">Auto + QC on roster</p>
              <pre className="text-[11px] whitespace-pre-wrap text-dim bg-black/30 p-3 rounded-lg max-h-40 overflow-y-auto">
                {channel.channelTrailerDraft.script}
              </pre>
              <Badge tone={channel.channelTrailerDraft.status === "approved" ? "good" : "warn"} className="mt-2">
                {channel.channelTrailerDraft.status}
              </Badge>
            </section>
          ) : null}

          <Button variant="secondary" size="sm" onClick={() => void setShowStatus("completed")}>
            Mark completed
          </Button>
        </div>
      )}
    </WorkspaceShell>
  );
}

function ActionPanel({
  title,
  hint,
  busy,
  onRun,
  children,
  className = "",
}: {
  title: string;
  hint: string;
  busy: boolean;
  onRun: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`track-panel ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-bold text-ink">{title}</h3>
          <p className="text-[10px] text-dim uppercase tracking-wider mt-0.5">{hint}</p>
        </div>
        <Button size="sm" disabled={busy} onClick={onRun}>
          {busy ? "Running…" : "Run"}
        </Button>
      </div>
      {children}
    </section>
  );
}
