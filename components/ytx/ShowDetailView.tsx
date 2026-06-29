"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Button } from "@/components/ui";
import { progressForShow } from "@/lib/dashboardInsights";
import { taskById } from "@/lib/checklistTasks";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { ShowVideoHero } from "@/components/ytx/ShowVideoHero";
import {
  LifecycleProgressBar,
  createEmptyRunProgress,
  type LifecycleRunProgress,
} from "@/components/ytx/LifecycleProgressBar";
import { ShowNextStepCard } from "@/components/ytx/ShowNextStepCard";
import { ShowDetailsFold } from "@/components/ytx/ShowDetailsFold";
import { ShowStudioNav, ShowStudioPanel } from "@/components/ytx/studio/ShowStudioNav";
import { ShowStudioDashboard } from "@/components/ytx/studio/ShowStudioDashboard";
import { ShowStudioDetails } from "@/components/ytx/studio/ShowStudioDetails";
import { ShowStudioChecks } from "@/components/ytx/studio/ShowStudioChecks";
import {
  ShowStudioVisibility,
  visibilityToShowStatus,
} from "@/components/ytx/studio/ShowStudioVisibility";
import { ShowStudioCommunity } from "@/components/ytx/studio/ShowStudioCommunity";
import { ShowStudioVideoElements } from "@/components/ytx/studio/ShowStudioVideoElements";
import { computeShowNextStep } from "@/lib/showNextStep";
import { showNeedsDraftBootstrap } from "@/lib/showDraftBootstrap";
import { isReplayShowView } from "@/lib/showFilters";
import { runModeLabel, type StudioTab } from "@/lib/studioLabels";
import { ShowReplayView } from "@/components/ytx/replay/ShowReplayView";

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
  commentsFromYoutube?: boolean;
  commentSyncError?: string;
  analyticsFromYoutube?: boolean;
  analyticsSyncError?: string;
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

import { runLifecycleStream } from "@/lib/lifecycleStreamClient";

type RunMode = "full" | "metadata_only" | "preview";

export function ShowDetailView({ showId }: { showId: string }) {
  const [data, setData] = useState<ShowPayload | null>(null);
  const [phase, setPhase] = useState<ShowPhase>("channel_setup");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [seoPack, setSeoPack] = useState<SeoPack | null>(null);
  const [sponsorBlock, setSponsorBlock] = useState<SponsorBlock | null>(null);
  const [commentItems, setCommentItems] = useState<CommentReply[]>([]);
  const [commentsFromYoutube, setCommentsFromYoutube] = useState(false);
  const [commentSyncError, setCommentSyncError] = useState<string | null>(null);
  const [analyticsFromYoutube, setAnalyticsFromYoutube] = useState(false);
  const [analyticsSyncError, setAnalyticsSyncError] = useState<string | null>(null);
  const [igCarousel, setIgCarousel] = useState<IgCarouselDraft | null>(null);
  const [endScreenMsg, setEndScreenMsg] = useState<string | null>(null);
  const [lifecycleMsg, setLifecycleMsg] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<PreflightPayload | null>(null);
  const [lifecycleProof, setLifecycleProof] = useState<LifecycleResultPayload["proof"] | null>(null);
  const [youtubeUrlInput, setYoutubeUrlInput] = useState("");
  const [runMode, setRunMode] = useState<RunMode>("preview");
  const [preflightLoading, setPreflightLoading] = useState(true);
  const [runProgress, setRunProgress] = useState<LifecycleRunProgress>(createEmptyRunProgress);
  const [studioTab, setStudioTab] = useState<StudioTab>("dashboard");
  const [autoBootstrapping, setAutoBootstrapping] = useState(false);
  const autoBootstrapRef = useRef(false);
  const replayDraftsRef = useRef(false);
  const bindVideoRef = useRef<HTMLDivElement>(null);

  const loadPreflight = useCallback(async () => {
    setPreflightLoading(true);
    const res = await fetchJson<PreflightPayload>(
      `/api/shows/${showId}/preflight?mode=${runMode}`
    );
    if (res.ok) setPreflight(res.data);
    setPreflightLoading(false);
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
    setCommentsFromYoutube(Boolean(res.data.commentsFromYoutube));
    setCommentSyncError(res.data.commentSyncError ?? null);
    setAnalyticsFromYoutube(Boolean(res.data.analyticsFromYoutube));
    setAnalyticsSyncError(res.data.analyticsSyncError ?? null);
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
    autoBootstrapRef.current = false;
    replayDraftsRef.current = false;
  }, [showId]);

  useEffect(() => {
    if (!data?.show || replayDraftsRef.current || busy === "comments") return;
    if (!isReplayShowView(data.show)) return;
    const needsDrafts = data.commentReplies.some(
      (c) => c.status === "pending" && !c.draftReply.trim()
    );
    if (!needsDrafts) return;

    replayDraftsRef.current = true;
    setBusy("comments");
    void fetchJson<{ items: CommentReply[]; fromYoutube?: boolean; syncError?: string }>(
      `/api/shows/${showId}/comments`,
      { method: "POST", body: JSON.stringify({ syncYoutube: false, force: true }) }
    )
      .then((res) => {
        if (res.ok) {
          setCommentItems(res.data.items);
          setCommentsFromYoutube(Boolean(res.data.fromYoutube));
          setCommentSyncError(res.data.syncError ?? null);
        }
        void load();
      })
      .finally(() => setBusy(null));
  }, [data?.show, data?.commentReplies, showId, busy]);

  async function runCommentAction(opts: { syncYoutube: boolean; force: boolean }) {
    setBusy("comments");
    const res = await fetchJson<{
      items: CommentReply[];
      fromYoutube?: boolean;
      syncError?: string;
    }>(`/api/shows/${showId}/comments`, {
      method: "POST",
      body: JSON.stringify(opts),
    });
    setBusy(null);
    if (res.ok) {
      setCommentItems(res.data.items);
      setCommentsFromYoutube(Boolean(res.data.fromYoutube));
      setCommentSyncError(res.data.syncError ?? null);
    } else {
      setError(res.error);
    }
    void load();
  }

  async function pullCommentsFromYoutube() {
    await runCommentAction({ syncYoutube: true, force: true });
  }

  async function regenerateCommentReplies() {
    await runCommentAction({ syncYoutube: false, force: true });
  }

  async function syncAnalyticsFromYoutube() {
    setBusy("analytics");
    const res = await fetchJson<{ snapshots: AnalyticsSnapshot[]; fromYoutube?: boolean; error?: string }>(
      `/api/shows/${showId}/analytics`,
      { method: "POST" }
    );
    setBusy(null);
    if (res.ok) {
      setData((prev) =>
        prev ? { ...prev, analytics: res.data.snapshots, analyticsFromYoutube: true } : prev
      );
      setAnalyticsFromYoutube(true);
      setAnalyticsSyncError(null);
    } else {
      setAnalyticsSyncError(res.error);
      setError(res.error);
    }
    void load();
  }

  useEffect(() => {
    void loadPreflight();
  }, [loadPreflight]);

  useEffect(() => {
    if (!data?.show || autoBootstrapRef.current || busy === "lifecycle") return;
    if (isReplayShowView(data.show)) return;
    if (!showNeedsDraftBootstrap(data.show)) return;

    autoBootstrapRef.current = true;
    setAutoBootstrapping(true);
    void runEndToEnd("preview").finally(() => setAutoBootstrapping(false));
  }, [data?.show, busy]);

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
    if (isReplayShowView(res.data.show)) {
      setData((prev) => (prev ? { ...prev, show: res.data.show } : prev));
      await pullCommentsFromYoutube();
      return;
    }
    void load();
  }

  async function runEndToEnd(modeOverride?: RunMode) {
    const mode = modeOverride ?? runMode;
    if (mode === "preview" && data?.show.status === "blocked") {
      await fetchJson(`/api/shows/${showId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "scheduled" }),
      });
    }
    setRunMode(mode);
    setBusy("lifecycle");
    setLifecycleMsg(null);
    setError(null);
    const initial = { ...createEmptyRunProgress(), running: true };
    setRunProgress(initial);

    const res = await runLifecycleStream(showId, mode, setRunProgress, initial);
    setBusy(null);

    if (!res.data) {
      setRunProgress((p) => ({ ...p, running: false, runOk: false }));
      setError(!res.ok ? res.error : "Lifecycle run failed");
      void loadPreflight();
      return;
    }

    if (!res.ok) {
      setRunProgress((p) => ({ ...p, running: false, runOk: res.data?.ok ?? false }));
      const blockers = res.data.blockers;
      if (blockers?.length) {
        setError(blockers.map((b) => b.message).join(" · "));
      } else {
        setError(res.error);
      }
      setLifecycleProof(res.data.proof);
      void loadPreflight();
      return;
    }

    setLifecycleProof(res.data.proof);
    const okSteps = res.data.steps.filter((s) => s.ok).length;
    setLifecycleMsg(
      res.data.ok
        ? mode === "preview"
          ? `Preview complete · ${okSteps}/${res.data.steps.length} steps · drafts saved locally`
          : `Verified end-to-end · ${okSteps}/${res.data.steps.length} steps · YouTube write OK · ${res.data.proof.clipsExportCount} clips`
        : mode === "preview"
          ? `Preview blocked · ${res.data.checklist.autoDone}/${res.data.checklist.autoTotal} auto tasks done`
          : `Run blocked · ${res.data.checklist.autoDone}/${res.data.checklist.autoTotal} auto tasks done`
    );
    void load();
  }

  async function clearBlockedStatus() {
    await fetchJson(`/api/shows/${showId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "scheduled" }),
    });
    void load();
  }

  function scrollToBindVideo() {
    setStudioTab("visibility");
  }

  function scrollToChecklist() {
    setStudioTab("community");
  }

  function scrollToPromote() {
    setStudioTab("dashboard");
    requestAnimationFrame(() => {
      document.getElementById("studio-promote")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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

  async function refreshComments() {
    await runCommentAction({ syncYoutube: true, force: true });
  }

  async function patchComment(id: string, patch: { draftReply?: string; status?: CommentReply["status"] }) {
    await fetchJson(`/api/shows/${showId}/comments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
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

  const previewReady = !preflightLoading && (preflight?.ready ?? false);
  const heroStatus =
    show.status === "blocked" && previewReady ? ("scheduled" as const) : show.status;
  const showBlockedBanner =
    show.status === "blocked" && runMode === "full" && !previewReady;

  const nextStep = computeShowNextStep({
    show,
    progressPct: progress.pct,
    qcPending: progress.qcPending,
    preflightReady: previewReady,
    runMode,
    lifecycleRunning: busy === "lifecycle",
  });

  const replayMode = isReplayShowView(show);
  const pendingCommentReplies = commentItems.filter((c) => c.status === "pending").length;

  if (replayMode) {
    return (
      <WorkspaceShell
        title={show.title.slice(0, 20)}
        panel={
          <div className="track-rail-block">
            <p className="track-rail-label">Comments</p>
            <p className="text-2xl font-bold font-mono text-ink tabular-nums">{commentItems.length}</p>
            <p className="text-xs text-dim mt-1">
              {pendingCommentReplies} repl{pendingCommentReplies === 1 ? "y" : "ies"} to review
            </p>
          </div>
        }
      >
        {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
        <div className="ytx-show-page-top mb-4">
          <Link href="/shows" className="text-xs text-dim hover:text-accent">
            ← Shows
          </Link>
        </div>
        <ShowReplayView
          show={show}
          channel={channel}
          analytics={analytics}
          analyticsFromYoutube={analyticsFromYoutube}
          analyticsSyncError={analyticsSyncError}
          analyticsBusy={busy === "analytics"}
          onSyncAnalytics={() => void syncAnalyticsFromYoutube()}
          commentItems={commentItems}
          commentsFromYoutube={commentsFromYoutube}
          commentSyncError={commentSyncError}
          commentsBusy={busy === "comments"}
          youtubeUrlInput={youtubeUrlInput}
          onYoutubeUrlChange={setYoutubeUrlInput}
          onSaveYoutubeUrl={() => void bindYoutubeVideo()}
          bindVideoBusy={busy === "bind-video"}
          onPullFromYoutube={() => void pullCommentsFromYoutube()}
          onRegenerateReplies={() => void regenerateCommentReplies()}
          onUpdateReply={(id, reply) => {
            setCommentItems((items) => items.map((x) => (x.id === id ? { ...x, draftReply: reply } : x)));
            void fetchJson(`/api/shows/${showId}/comments/${id}`, {
              method: "PATCH",
              body: JSON.stringify({ draftReply: reply }),
            });
          }}
          onApproveComment={(id) => void patchComment(id, { status: "approved" })}
          onSkipComment={(id) => void patchComment(id, { status: "skipped" })}
        />
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      title={show.title.slice(0, 20)}
      panel={
        <div className="track-rail-block">
          <p className="track-rail-label">Progress</p>
          <p className="text-2xl font-bold font-mono text-ink tabular-nums">{progress.pct}%</p>
          <p className="text-xs text-dim mt-1">
            {progress.done}/{progress.total} tasks
            {progress.qcPending ? ` · ${progress.qcPending} to review` : ""}
          </p>
          <div className="ytx-progress-track mt-3">
            <div className="ytx-progress-fill" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      }
    >
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <div className="ytx-show-page-top mb-4">
        <Link href="/shows" className="text-xs text-dim hover:text-accent">
          ← Shows
        </Link>
      </div>

      {autoBootstrapping ? (
        <div className="ytx-show-status-banner ytx-show-status-banner-info mb-4">
          Preparing title, description, tags, and social drafts…
        </div>
      ) : null}
      {!autoBootstrapping && showBlockedBanner ? (
        <div className="ytx-show-status-banner ytx-show-status-banner-warn mb-4">
          Publish blocked — open <button type="button" className="text-accent hover:underline" onClick={() => setStudioTab("checks")}>Checks</button> to fix.
        </div>
      ) : null}
      {!autoBootstrapping && show.status === "live" ? (
        <div className="ytx-show-status-banner ytx-show-status-banner-live mb-4">
          <span className="tdesk-live-dot" />
          Live now · {channel?.oauthConnected ? "YouTube connected" : "Connect on Roster"}
        </div>
      ) : null}

      <ShowVideoHero show={show} channel={channel} statusOverride={heroStatus} compact />

      <ShowStudioNav
        active={studioTab}
        onChange={setStudioTab}
        badges={{
          community: progress.qcPending,
          checks: preflight?.blockers.length,
        }}
      />

      <ShowStudioPanel>
      {studioTab === "dashboard" ? (
          <ShowStudioDashboard
            show={show}
            channel={channel}
            nextStep={nextStep}
            lifecycleMsg={lifecycleMsg}
            runProgress={runProgress}
            runModeLabel={runModeLabel(runMode)}
            showBlocked={show.status === "blocked"}
            autoBootstrapping={autoBootstrapping}
            crossPosts={crossPosts}
            commentItems={commentItems}
            igCarousel={igCarousel}
            onClearBlocked={() => void clearBlockedStatus()}
            onRunPreview={() => void runEndToEnd("preview")}
            onRunFull={() => void runEndToEnd("full")}
            onLinkVideo={scrollToBindVideo}
            onReviewQc={scrollToChecklist}
            onOpenTab={setStudioTab}
            onScrollToPromote={scrollToPromote}
            promoteBusy={busy}
            onGenerateCrossPosts={() => void runAction("cross", `/api/shows/${showId}/cross-post`)}
            onGenerateIgCarousel={async () => {
              setBusy("igcarousel");
              const res = await fetchJson<{ carousel: IgCarouselDraft }>(
                `/api/shows/${showId}/ig-carousel`,
                { method: "POST" }
              );
              setBusy(null);
              if (res.ok) setIgCarousel(res.data.carousel);
              void load();
            }}
            onApproveIgCarousel={async () => {
              await fetchJson(`/api/shows/${showId}/ig-carousel`, {
                method: "PATCH",
                body: JSON.stringify({ action: "approve" }),
              });
              void load();
            }}
            onRejectIgCarousel={async () => {
              await fetchJson(`/api/shows/${showId}/ig-carousel`, {
                method: "PATCH",
                body: JSON.stringify({ action: "reject" }),
              });
              void load();
            }}
          />
      ) : null}

      {studioTab === "details" ? (
        <ShowStudioDetails
          show={show}
          seoPack={seoPack}
          busy={busy === "seo"}
          onGenerateSeo={() => void runAction("seo", `/api/shows/${showId}/seo-pack`)}
        />
      ) : null}

      {studioTab === "visibility" ? (
        <div ref={bindVideoRef}>
          <ShowStudioVisibility
            show={show}
            youtubeUrlInput={youtubeUrlInput}
            onYoutubeUrlChange={setYoutubeUrlInput}
            onSaveYoutubeUrl={() => void bindYoutubeVideo()}
            onVisibilityChange={(v) => void setShowStatus(visibilityToShowStatus(v, show.status))}
            onPublish={() => void runEndToEnd()}
            bindBusy={busy === "bind-video"}
            publishBusy={busy === "lifecycle"}
            publishDisabled={runMode === "full" && !preflight?.ready}
            runMode={runMode}
            onRunModeChange={setRunMode}
            analytics={analytics}
            liveBusy={busy}
            onMarkLive={() => void setShowStatus("live")}
            onMarkCompleted={() => void setShowStatus("completed")}
            onCaptureAnalytics={() => void runAction("analytics", `/api/shows/${showId}/analytics`)}
            onUpdateLiveLinks={() => void runAction("livelinks", `/api/shows/${showId}/live/links`)}
          />
        </div>
      ) : null}

      {studioTab === "checks" ? (
        <ShowStudioChecks
          preflight={preflight}
          preflightLoading={preflightLoading}
          runMode={runMode}
          onRunModeChange={setRunMode}
          onRunAgain={() => void runEndToEnd()}
          runBusy={busy === "lifecycle"}
          lifecycleProof={lifecycleProof ?? undefined}
          verification={data.verification}
        >
          <ShowDetailsFold
            id="show-checklist"
            title="All tasks (advanced)"
            summary={`${progress.done}/${progress.total} done`}
          >
            <section className="track-panel !p-0 !bg-transparent !border-0 !shadow-none">
              <div className="flex flex-wrap gap-1 mb-4">
                {PHASE_ORDER.map((p) => {
                  const items = data.checklist.filter((i) => i.phase === p && i.status !== "skipped");
                  const done = items.filter((i) => i.status === "done").length;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPhase(p)}
                      className={`track-rail-pill text-xs ${phase === p ? "track-rail-pill-on" : ""}`}
                    >
                      {PHASE_LABELS[p]} · {done}/{items.length}
                    </button>
                  );
                })}
              </div>
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
                        <span
                          className="w-5 h-5 shrink-0 rounded-full border-2 border-amber-500/60"
                          title="Needs review"
                        />
                      ) : def?.mode === "auto" ? (
                        <span
                          className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                            item.status === "done"
                              ? "bg-accent border-accent text-black"
                              : "border-white/20"
                          }`}
                        >
                          {item.status === "done" ? "✓" : ""}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            void toggleTask(item.taskId, item.status === "done" ? "pending" : "done")
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
                      </div>
                      {def?.needsQc && !skipped ? (
                        <Button size="sm" variant="secondary" onClick={() => setStudioTab("community")}>
                          Review
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          </ShowDetailsFold>
        </ShowStudioChecks>
      ) : null}

      {studioTab === "community" ? (
        <ShowStudioCommunity
          items={commentItems}
          busy={busy === "comments"}
          onGenerate={async () => {
            setBusy("comments");
            const res = await fetchJson<{ items: CommentReply[] }>(`/api/shows/${showId}/comments`, {
              method: "POST",
            });
            setBusy(null);
            if (res.ok) setCommentItems(res.data.items);
            void load();
          }}
          onUpdateReply={(id, reply) => {
            setCommentItems((items) => items.map((x) => (x.id === id ? { ...x, draftReply: reply } : x)));
            void fetchJson(`/api/shows/${showId}/comments/${id}`, {
              method: "PATCH",
              body: JSON.stringify({ draftReply: reply }),
            });
          }}
          onApprove={(id) => {
            void fetchJson(`/api/shows/${showId}/comments/${id}`, {
              method: "PATCH",
              body: JSON.stringify({ status: "approved" }),
            }).then(() => void load());
          }}
          onSkip={(id) => {
            void fetchJson(`/api/shows/${showId}/comments/${id}`, {
              method: "PATCH",
              body: JSON.stringify({ status: "skipped" }),
            }).then(() => void load());
          }}
        />
      ) : null}

      {studioTab === "video-elements" ? (
        <ShowStudioVideoElements
          show={show}
          sponsorBlock={sponsorBlock}
          clipBatch={clipBatch}
          endScreenMsg={endScreenMsg}
          busy={busy}
          onGenerateChapters={() => void runAction("chapters", `/api/shows/${showId}/live/chapters`)}
          onGenerateSponsor={() => void runAction("sponsor", `/api/shows/${showId}/sponsor-block`)}
          onRunClips={() => void runAction("clips", `/api/shows/${showId}/clips`, "POST")}
          onRunEndScreen={() => void runAction("postshow", `/api/shows/${showId}/post-show`)}
        />
      ) : null}
      </ShowStudioPanel>
    </WorkspaceShell>
  );
}
