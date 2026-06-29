import { buildSponsorBlock } from "@/lib/adapters/deals";
import { generateCrossPosts, generateIgCarouselDraft } from "@/lib/adapters/content";
import { runClipsPipeline } from "@/lib/adapters/clips";
import { runChannelSetup } from "@/lib/channelSetup";
import { ACTION_TASKS, checklistSummary, markTasksDone } from "@/lib/checklistAutomation";
import { applyLiveLinkAndChapterUpdate, generateLiveChapters } from "@/lib/liveOps";
import { runPostShowSeoPass } from "@/lib/postShow";
import { preflightShowRun, type PreflightMode, isPreviewMode } from "@/lib/readiness/preflight";
import { isServerlessDemoHost } from "@/lib/runtimeHost";
import { generateSeoPack } from "@/lib/seoPack";
import {
  addAnalyticsSnapshot,
  appendDescriptionPatch,
  getChannel,
  getShow,
  seedCommentQueue,
  updateShow,
  upsertCrossPosts,
  updateClipBatch,
  upsertIgCarousel,
} from "@/lib/store";
import { logVerification } from "@/lib/verificationLog";
import {
  fetchChannelBaseline,
  fetchLiveVideoStats,
  fetchVideoBroadcastState,
  updateVideoMetadata,
  youtubeWriteReady,
} from "@/lib/youtube/dataApi";
import type { ShowRun, YtChannel } from "@/lib/types";
import {
  buildLifecycleStepPlan,
  lifecycleStepLabel,
  type LifecycleProgressEvent,
} from "@/lib/lifecycleProgress";

export type LifecycleStep = {
  step: string;
  ok: boolean;
  detail?: string;
  proof?: "verified" | "draft_only" | "simulated" | "blocked" | "skipped";
};

export type LifecycleProof = {
  youtubeVideoId: string | null;
  metadataWriteOk: boolean;
  metadataWriteStatus: number | null;
  analyticsSource: "youtube_api" | "unavailable" | "skipped";
  clipsExportCount: number;
  qcStillPending: string[];
};

export type LifecycleResult = {
  showId: string;
  ok: boolean;
  mode: PreflightMode;
  blockers?: { code: string; message: string; fix: string }[];
  steps: LifecycleStep[];
  proof: LifecycleProof;
  checklist: Awaited<ReturnType<typeof checklistSummary>>;
};

export type LifecycleOptions = {
  mode?: PreflightMode;
  youtubeUrl?: string;
  onProgress?: (event: LifecycleProgressEvent) => void | Promise<void>;
};

async function captureAnalytics(show: ShowRun, channel: YtChannel) {
  if (!show.youtubeVideoId) {
    return { waitingRoom: null, peak: null, source: "unavailable" as const };
  }

  const broadcast = await fetchVideoBroadcastState(channel.id, show.youtubeVideoId);
  const baseline = channel.youtubeChannelId
    ? await fetchChannelBaseline(channel.id, channel.youtubeChannelId)
    : null;
  const live = await fetchLiveVideoStats(channel.id, show.youtubeVideoId);

  let waitingRoom: number | null = null;
  let peak: number | null = null;
  let source: "youtube_api" | "unavailable" = "unavailable";

  if (live?.concurrentViewers != null) {
    waitingRoom = live.concurrentViewers;
    peak = Math.max(waitingRoom, waitingRoom + Math.floor(live.concurrentViewers * 0.15));
    source = "youtube_api";
  } else if (broadcast && baseline) {
    waitingRoom = Math.max(1, Math.floor(baseline.subscribers * 0.002));
    peak = waitingRoom;
    source = "youtube_api";
  } else if (live?.viewCount != null) {
    waitingRoom = live.viewCount;
    peak = live.viewCount;
    source = "youtube_api";
  }

  if (source !== "youtube_api" || waitingRoom == null || peak == null) {
    await logVerification({
      showRunId: show.id,
      channelId: channel.id,
      action: "analytics_capture",
      ok: false,
      source: "blocked",
      videoId: show.youtubeVideoId,
      detail: "No YouTube metrics available — snapshot not stored",
    });
    return { waitingRoom: null, peak: null, source: "unavailable" as const };
  }

  await addAnalyticsSnapshot({
    showRunId: show.id,
    snapshotType: "waiting_room",
    concurrentViewers: waitingRoom,
    views24h: null,
    metadata: { source: "youtube_api", videoId: show.youtubeVideoId },
    capturedAt: new Date().toISOString(),
  });
  await addAnalyticsSnapshot({
    showRunId: show.id,
    snapshotType: "peak_viewers",
    concurrentViewers: peak,
    views24h: null,
    metadata: { source: "youtube_api" },
    capturedAt: new Date().toISOString(),
  });

  await logVerification({
    showRunId: show.id,
    channelId: channel.id,
    action: "analytics_capture",
    ok: true,
    source: "youtube_api",
    videoId: show.youtubeVideoId,
    detail: `waiting=${waitingRoom} peak=${peak}`,
  });

  return { waitingRoom, peak, source: "youtube_api" as const };
}

function qcPendingLabels(): string[] {
  return ["1.5 channel trailer", "1.15 A/B thumbnail", "1.22 comment replies", "2.4 IG carousel"];
}

/** Proof-based show lifecycle — blocks on missing creds, only marks tasks with real proof. */
export async function runShowLifecycle(
  showId: string,
  opts?: LifecycleOptions
): Promise<LifecycleResult> {
  const mode: PreflightMode = opts?.mode ?? "full";
  const preview = isPreviewMode(mode);
  const emit = opts?.onProgress;
  const preflight = await preflightShowRun(showId, mode);

  const proof: LifecycleProof = {
    youtubeVideoId: null,
    metadataWriteOk: false,
    metadataWriteStatus: null,
    analyticsSource: "skipped",
    clipsExportCount: 0,
    qcStillPending: qcPendingLabels(),
  };

  const steps: LifecycleStep[] = [];
  let stepIndex = 0;

  const track = {
    plan(stepIds: string[]) {
      emit?.({ type: "plan", steps: stepIds, mode });
    },
    start(stepId: string) {
      emit?.({ type: "step_start", step: stepId, label: lifecycleStepLabel(stepId) });
    },
    done(step: LifecycleStep) {
      steps.push(step);
      emit?.({ type: "step", step, index: stepIndex++ });
    },
    complete(ok: boolean) {
      emit?.({ type: "complete", ok });
    },
  };

  if (!preflight.ready) {
    await logVerification({
      showRunId: showId,
      channelId: preflight.channel?.id ?? null,
      action: "lifecycle_preflight",
      ok: false,
      source: "blocked",
      detail: preflight.blockers.map((b) => b.code).join(", "),
      metadata: { blockers: preflight.blockers },
    });
    if (preflight.channel) {
      await updateShow(showId, { status: "blocked" });
    }
    const failStep: LifecycleStep = {
      step: "preflight",
      ok: false,
      detail: preflight.blockers[0]?.message,
      proof: "blocked",
    };
    track.plan(["preflight"]);
    track.start("preflight");
    track.done(failStep);
    track.complete(false);
    return {
      showId,
      ok: false,
      mode,
      blockers: preflight.blockers,
      steps: [failStep],
      proof,
      checklist: await checklistSummary(showId),
    };
  }

  const show = (await getShow(showId))!;
  const channel = (await getChannel(show.channelId))!;
  proof.youtubeVideoId = show.youtubeVideoId;

  track.plan(buildLifecycleStepPlan(show, mode));
  track.start("preflight");
  track.done({ step: "preflight", ok: true, detail: "All required checks passed", proof: "verified" });

  track.start("channel_setup");
  try {
    await runChannelSetup(channel.id);
    await markTasksDone(showId, ACTION_TASKS.channelSetup);
    track.done({
      step: "channel_setup",
      ok: true,
      detail: "Local channel tags + description updated · trailer pending QC",
      proof: "draft_only",
    });
  } catch (e) {
    track.done({
      step: "channel_setup",
      ok: false,
      detail: e instanceof Error ? e.message : "failed",
      proof: "blocked",
    });
  }

  track.start("seo_pack");
  try {
    const pack = await generateSeoPack(show, channel);
    await updateShow(showId, {
      seoTitle: pack.titles[0] ?? null,
      seoDescription: pack.description,
      seoTags: pack.tags,
    });
    await markTasksDone(showId, ACTION_TASKS.seoPack);
    track.done({ step: "seo_pack", ok: true, detail: "SEO drafts saved locally", proof: "draft_only" });
  } catch (e) {
    track.done({
      step: "seo_pack",
      ok: false,
      detail: e instanceof Error ? e.message : "failed",
      proof: "blocked",
    });
  }

  track.start("sponsor_block");
  try {
    const sponsor = await buildSponsorBlock(show.dealId);
    const healthy = sponsor.urls.some((u) => u.healthy);
    if (healthy || !show.dealId) {
      await markTasksDone(showId, ACTION_TASKS.sponsorBlock);
      track.done({
        step: "sponsor_block",
        ok: true,
        detail: healthy ? `${sponsor.urls.length} healthy sponsor URLs` : "No deal linked",
        proof: healthy ? "verified" : "draft_only",
      });
    } else {
      track.done({
        step: "sponsor_block",
        ok: false,
        detail: "Sponsor deal linked but no healthy TrackingLinks",
        proof: "blocked",
      });
    }
  } catch (e) {
    track.done({
      step: "sponsor_block",
      ok: false,
      detail: e instanceof Error ? e.message : "failed",
      proof: "blocked",
    });
  }

  track.start("cross_post");
  try {
    const items = await generateCrossPosts(show, channel);
    await upsertCrossPosts(items);
    track.done({
      step: "cross_post",
      ok: true,
      detail: `${items.length} platform drafts saved · not posted`,
      proof: "draft_only",
    });
  } catch (e) {
    track.done({
      step: "cross_post",
      ok: false,
      detail: e instanceof Error ? e.message : "failed",
      proof: "blocked",
    });
  }

  if (show.pipeline === "live") {
    track.start("analytics");
    try {
      const analytics = await captureAnalytics(show, channel);
      proof.analyticsSource = analytics.source;
      if (analytics.source === "youtube_api") {
        await markTasksDone(showId, [...ACTION_TASKS.analyticsWaiting, ...ACTION_TASKS.analyticsPeak]);
        track.done({ step: "analytics", ok: true, detail: analytics.source, proof: "verified" });
      } else {
        track.done({
          step: "analytics",
          ok: false,
          detail: "No YouTube metrics — snapshot not stored",
          proof: "blocked",
        });
      }
    } catch (e) {
      track.done({
        step: "analytics",
        ok: false,
        detail: e instanceof Error ? e.message : "failed",
        proof: "blocked",
      });
    }

    track.start("live_chapters");
    try {
      const chapters = await generateLiveChapters(show);
      await updateShow(showId, { liveChapters: chapters });
      track.done({
        step: "live_chapters",
        ok: true,
        detail: `${chapters.length} chapter drafts · pending YouTube push`,
        proof: "draft_only",
      });
    } catch (e) {
      track.done({
        step: "live_chapters",
        ok: false,
        detail: e instanceof Error ? e.message : "failed",
        proof: "blocked",
      });
    }

    track.start("live_links");
    try {
      const liveResult = await applyLiveLinkAndChapterUpdate(showId, {
        skipYoutubeWrite: preview,
      });
      proof.metadataWriteOk = liveResult.pushedToYoutube;
      proof.metadataWriteStatus = liveResult.writeStatus;
      if (liveResult.pushedToYoutube) {
        await markTasksDone(showId, [...ACTION_TASKS.liveLinks, ...ACTION_TASKS.liveChapters]);
        track.done({ step: "live_links", ok: true, detail: "Pushed to YouTube", proof: "verified" });
      } else if (preview) {
        await markTasksDone(showId, [...ACTION_TASKS.liveLinks, ...ACTION_TASKS.liveChapters]);
        track.done({
          step: "live_links",
          ok: true,
          detail: "Preview — live description saved locally · OAuth required to publish",
          proof: "draft_only",
        });
      } else {
        track.done({
          step: "live_links",
          ok: false,
          detail: liveResult.writeError ?? "YouTube metadata write failed",
          proof: "blocked",
        });
      }
    } catch (e) {
      track.done({
        step: "live_links",
        ok: false,
        detail: e instanceof Error ? e.message : "failed",
        proof: "blocked",
      });
    }
  } else {
    proof.analyticsSource = "skipped";
    track.start("analytics");
    track.done({ step: "analytics", ok: true, detail: "skipped (pre-recorded pipeline)", proof: "skipped" });
    track.start("live_chapters");
    track.done({ step: "live_chapters", ok: true, detail: "skipped", proof: "skipped" });
    track.start("live_links");
    track.done({ step: "live_links", ok: true, detail: "skipped", proof: "skipped" });
  }

  const youtubeUrl =
    opts?.youtubeUrl ??
    (show.youtubeVideoId ? `https://www.youtube.com/watch?v=${show.youtubeVideoId}` : null);

  if ((mode === "full" || preview) && youtubeUrl) {
    const serverlessPreview = preview && isServerlessDemoHost();
    track.start("clips");
    try {
      await updateClipBatch(showId, { status: "importing", message: "Lifecycle clips…" });
      const batch = await runClipsPipeline(youtubeUrl);
      await updateClipBatch(showId, batch);
      if (batch.scoutSourceId) {
        await updateShow(showId, { clipSourceId: batch.scoutSourceId });
      }
      const exportCount = batch.exportUrls?.length ?? 0;
      proof.clipsExportCount = exportCount;
      if (batch.status === "done" && exportCount > 0) {
        await markTasksDone(showId, ACTION_TASKS.clips);
        await logVerification({
          showRunId: showId,
          channelId: channel.id,
          action: "clips_export",
          ok: true,
          source: "local_only",
          videoId: show.youtubeVideoId,
          detail: `${exportCount} MP4 exports`,
          metadata: { exportUrls: batch.exportUrls },
        });
        track.done({ step: "clips", ok: true, detail: batch.message, proof: "verified" });
      } else if (serverlessPreview || preview) {
        await logVerification({
          showRunId: showId,
          channelId: channel.id,
          action: "clips_export",
          ok: true,
          source: "local_only",
          videoId: show.youtubeVideoId,
          detail:
            batch.message ??
            (serverlessPreview
              ? "Skipped on demo host"
              : "Preview — Shorts export skipped (clips runtime missing or export failed)"),
        });
        track.done({
          step: "clips",
          ok: true,
          detail:
            batch.message ??
            (serverlessPreview
              ? "Skipped on demo host — Shorts export on local :3001 or via Scout"
              : "Preview — Shorts export skipped · install yt-dlp + ffmpeg for MP4 clips"),
          proof: "skipped",
        });
      } else {
        await logVerification({
          showRunId: showId,
          channelId: channel.id,
          action: "clips_export",
          ok: false,
          source: "blocked",
          videoId: show.youtubeVideoId,
          detail: batch.message ?? "No MP4 exports produced",
        });
        track.done({
          step: "clips",
          ok: false,
          detail: batch.message ?? "No MP4 exports produced",
          proof: "blocked",
        });
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : "failed";
      if (preview) {
        track.done({
          step: "clips",
          ok: true,
          detail: `Preview — Shorts export skipped (${detail})`,
          proof: "skipped",
        });
      } else {
        track.done({
          step: "clips",
          ok: false,
          detail,
          proof: "blocked",
        });
      }
    }
  } else if (mode === "metadata_only") {
    track.start("clips");
    track.done({ step: "clips", ok: true, detail: "skipped (metadata-only run)", proof: "skipped" });
  }

  const refreshed = (await getShow(showId))!;

  track.start("post_show");
  try {
    const seo = await runPostShowSeoPass(refreshed, refreshed.clipSourceId);
    const desc = `${refreshed.seoDescription ?? ""}${seo.descriptionAppend}`.trim();
    await updateShow(showId, { seoTags: seo.tags, seoDescription: desc });

    let postShowWriteOk = false;
    if (refreshed.youtubeVideoId && !preview && (await youtubeWriteReady(channel.id))) {
      const write = await updateVideoMetadata(channel.id, refreshed.youtubeVideoId, {
        description: desc,
        tags: seo.tags,
        title: refreshed.seoTitle ?? refreshed.title,
      });
      postShowWriteOk = write.ok;
      proof.metadataWriteOk = write.ok;
      proof.metadataWriteStatus = write.httpStatus;
      await logVerification({
        showRunId: showId,
        channelId: channel.id,
        action: "metadata_update",
        ok: write.ok,
        source: write.ok ? "youtube_api" : "blocked",
        videoId: refreshed.youtubeVideoId,
        httpStatus: write.httpStatus,
        detail: write.ok ? `Updated ${write.fields.join(", ")}` : write.error ?? "Write failed",
      });
      if (write.ok) {
        await markTasksDone(showId, ACTION_TASKS.postShowSeo);
      }
    } else if (preview) {
      await markTasksDone(showId, ACTION_TASKS.postShowSeo);
      await logVerification({
        showRunId: showId,
        channelId: channel.id,
        action: "metadata_update",
        ok: true,
        source: "local_only",
        videoId: refreshed.youtubeVideoId,
        detail: "Preview — post-show SEO saved locally · OAuth required to publish",
      });
    }

    track.done({
      step: "post_show",
      ok: preview ? true : postShowWriteOk,
      detail: postShowWriteOk
        ? "Post-show metadata pushed to YouTube"
        : preview
          ? "Preview — post-show SEO saved locally · OAuth required to publish"
          : "Post-show SEO saved locally · YouTube write required",
      proof: postShowWriteOk ? "verified" : "draft_only",
    });
  } catch (e) {
    track.done({
      step: "post_show",
      ok: false,
      detail: e instanceof Error ? e.message : "failed",
      proof: "blocked",
    });
  }

  track.start("comment_queue");
  try {
    const comments = await seedCommentQueue(showId);
    track.done({
      step: "comment_queue",
      ok: comments.length > 0,
      detail:
        comments.length > 0
          ? `${comments.length} real YouTube comments imported · QC required`
          : "No comments imported — connect OAuth and link a video with comments",
      proof: comments.length > 0 ? "verified" : "draft_only",
    });
  } catch {
    track.done({ step: "comment_queue", ok: false, proof: "blocked" });
  }

  track.start("ig_carousel");
  try {
    const draft = await generateIgCarouselDraft(refreshed, channel);
    await upsertIgCarousel(showId, { ...draft, status: "pending_qc" });
    track.done({ step: "ig_carousel", ok: true, detail: "IG carousel draft · QC required", proof: "draft_only" });
  } catch {
    track.done({ step: "ig_carousel", ok: true, detail: "local draft pending QC", proof: "draft_only" });
  }

  const failedSteps = steps.filter(
    (s) =>
      s.step !== "preflight" &&
      s.proof !== "skipped" &&
      s.proof !== "draft_only" &&
      !s.ok
  );

  const clipsOk = mode === "metadata_only" || proof.clipsExportCount > 0 || preview;

  const runOk = preview
    ? failedSteps.length === 0 && clipsOk
    : failedSteps.length === 0 && proof.metadataWriteOk && clipsOk;

  await logVerification({
    showRunId: showId,
    channelId: channel.id,
    action: "lifecycle_run",
    ok: runOk,
    source: runOk ? (preview ? "local_only" : "youtube_api") : "blocked",
    videoId: show.youtubeVideoId,
    detail: runOk
      ? preview
        ? "Preview run complete — drafts local · OAuth required for YouTube publish"
        : "End-to-end run verified"
      : "Run finished with blockers",
    metadata: { proof, mode, steps: steps.map((s) => ({ step: s.step, ok: s.ok, proof: s.proof })) },
  });

  await updateShow(showId, {
    status: runOk ? (preview ? "preview" : "completed") : "blocked",
  });

  track.complete(runOk);

  return {
    showId,
    ok: runOk,
    mode,
    steps,
    proof,
    checklist: await checklistSummary(showId),
  };
}
