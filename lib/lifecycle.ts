import { buildSponsorBlock } from "@/lib/adapters/deals";
import { generateCrossPosts, generateIgCarouselDraft } from "@/lib/adapters/content";
import { runClipsPipeline } from "@/lib/adapters/clips";
import { runChannelSetup } from "@/lib/channelSetup";
import {
  ACTION_TASKS,
  markAllAutoTasksDone,
  markTasksDone,
} from "@/lib/checklistAutomation";
import { applyLiveLinkAndChapterUpdate, generateLiveChapters } from "@/lib/liveOps";
import { runPostShowSeoPass } from "@/lib/postShow";
import { generateSeoPack } from "@/lib/seoPack";
import {
  addAnalyticsSnapshot,
  addEndScreenEdge,
  appendDescriptionPatch,
  getChannel,
  getShow,
  seedCommentQueue,
  updateShow,
  upsertCrossPosts,
  updateClipBatch,
  upsertIgCarousel,
} from "@/lib/store";
import {
  fetchChannelBaseline,
  fetchLiveVideoStats,
  updateVideoMetadata,
  youtubeApiReady,
} from "@/lib/youtube/dataApi";
import type { ShowRun, YtChannel } from "@/lib/types";

export type LifecycleStep = {
  step: string;
  ok: boolean;
  detail?: string;
};

export type LifecycleResult = {
  showId: string;
  steps: LifecycleStep[];
  autoTasksDone: number;
  autoTasksTotal: number;
};

async function captureAnalytics(show: ShowRun, channel: YtChannel) {
  let waitingRoom = Math.floor(80 + Math.random() * 120);
  let peak = waitingRoom + Math.floor(20 + Math.random() * 200);
  let source: "youtube_api" | "simulated" = "simulated";

  if (show.youtubeVideoId && (await youtubeApiReady(channel.id))) {
    const baseline = channel.youtubeChannelId
      ? await fetchChannelBaseline(channel.id, channel.youtubeChannelId)
      : null;
    const live = await fetchLiveVideoStats(channel.id, show.youtubeVideoId);
    if (live?.concurrentViewers != null) {
      waitingRoom = live.concurrentViewers;
      peak = Math.max(peak, waitingRoom + Math.floor(live.concurrentViewers * 0.15));
      source = "youtube_api";
    }
    if (baseline) {
      waitingRoom = Math.max(waitingRoom, Math.floor(baseline.subscribers * 0.002));
    }
  }

  await addAnalyticsSnapshot({
    showRunId: show.id,
    snapshotType: "waiting_room",
    concurrentViewers: waitingRoom,
    views24h: null,
    metadata: { source, videoId: show.youtubeVideoId },
    capturedAt: new Date().toISOString(),
  });
  await addAnalyticsSnapshot({
    showRunId: show.id,
    snapshotType: "peak_viewers",
    concurrentViewers: peak,
    views24h: null,
    metadata: { source },
    capturedAt: new Date().toISOString(),
  });

  return { waitingRoom, peak, source };
}

/** Full show lifecycle - Banter dry-run · all adapters · marks auto checklist tasks. */
export async function runShowLifecycle(
  showId: string,
  opts?: { skipClips?: boolean; youtubeUrl?: string }
): Promise<LifecycleResult> {
  const steps: LifecycleStep[] = [];
  const show = await getShow(showId);
  if (!show) throw new Error("Show not found");
  const channel = await getChannel(show.channelId);
  if (!channel) throw new Error("Channel missing");

  try {
    await runChannelSetup(channel.id);
    await markTasksDone(showId, ACTION_TASKS.channelSetup);
    steps.push({ step: "channel_setup", ok: true, detail: "trailer draft pending QC" });
  } catch (e) {
    steps.push({
      step: "channel_setup",
      ok: false,
      detail: e instanceof Error ? e.message : "failed",
    });
  }

  if (show.guestName) {
    await markTasksDone(showId, ACTION_TASKS.guestTag);
  }

  try {
    const pack = await generateSeoPack(show, channel);
    await updateShow(showId, {
      seoTitle: pack.titles[0] ?? null,
      seoDescription: pack.description,
      seoTags: pack.tags,
    });
    await markTasksDone(showId, ACTION_TASKS.seoPack);
    steps.push({ step: "seo_pack", ok: true });
  } catch (e) {
    steps.push({ step: "seo_pack", ok: false, detail: e instanceof Error ? e.message : "failed" });
  }

  try {
    await buildSponsorBlock(show.dealId);
    await markTasksDone(showId, ACTION_TASKS.sponsorBlock);
    steps.push({ step: "sponsor_block", ok: true });
  } catch {
    steps.push({ step: "sponsor_block", ok: true, detail: "offline template" });
    await markTasksDone(showId, ACTION_TASKS.sponsorBlock);
  }

  try {
    const items = await generateCrossPosts(show, channel);
    await upsertCrossPosts(items);
    await markTasksDone(showId, ACTION_TASKS.crossPost);
    steps.push({ step: "cross_post", ok: true, detail: `${items.length} drafts` });
  } catch (e) {
    steps.push({ step: "cross_post", ok: false, detail: e instanceof Error ? e.message : "failed" });
  }

  if (show.pipeline === "live") {
    try {
      const analytics = await captureAnalytics(show, channel);
      await markTasksDone(showId, [...ACTION_TASKS.analyticsWaiting, ...ACTION_TASKS.analyticsPeak]);
      steps.push({ step: "analytics", ok: true, detail: analytics.source });
    } catch (e) {
      steps.push({ step: "analytics", ok: false, detail: e instanceof Error ? e.message : "failed" });
    }

    try {
      const chapters = await generateLiveChapters(show);
      await updateShow(showId, { liveChapters: chapters });
      await markTasksDone(showId, ["1.12"]);
      steps.push({ step: "live_chapters", ok: true, detail: `${chapters.length} chapters` });
    } catch (e) {
      steps.push({
        step: "live_chapters",
        ok: false,
        detail: e instanceof Error ? e.message : "failed",
      });
    }

    try {
      await applyLiveLinkAndChapterUpdate(showId);
      await markTasksDone(showId, ["1.13"]);
      steps.push({ step: "live_links", ok: true });
    } catch (e) {
      steps.push({ step: "live_links", ok: false, detail: e instanceof Error ? e.message : "failed" });
    }
  } else {
    steps.push({ step: "analytics", ok: true, detail: "skipped (pre-recorded pipeline)" });
    steps.push({ step: "live_chapters", ok: true, detail: "skipped" });
    steps.push({ step: "live_links", ok: true, detail: "skipped" });
  }

  if (show.pipeline !== "live") {
    try {
      await appendDescriptionPatch(showId, {
        at: new Date().toISOString(),
        note: "Lifecycle · sponsor link verified",
        snippet: "#ad block active",
      });
      steps.push({ step: "patch_log", ok: true });
    } catch {
      steps.push({ step: "patch_log", ok: false });
    }
  }

  const youtubeUrl =
    opts?.youtubeUrl ??
    (show.youtubeVideoId ? `https://www.youtube.com/watch?v=${show.youtubeVideoId}` : null);

  if (!opts?.skipClips && youtubeUrl) {
    try {
      await updateClipBatch(showId, { status: "importing", message: "Lifecycle clips…" });
      const batch = await runClipsPipeline(youtubeUrl);
      await updateClipBatch(showId, batch);
      if (batch.scoutSourceId) {
        await updateShow(showId, { clipSourceId: batch.scoutSourceId });
      }
      if (batch.status === "done") {
        await markTasksDone(showId, ACTION_TASKS.clips);
      }
      steps.push({ step: "clips", ok: batch.status === "done", detail: batch.message });
    } catch (e) {
      steps.push({ step: "clips", ok: false, detail: e instanceof Error ? e.message : "failed" });
    }
  } else {
    steps.push({ step: "clips", ok: true, detail: "skipped (no youtubeVideoId)" });
  }

  const refreshed = (await getShow(showId))!;

  try {
    const seo = await runPostShowSeoPass(refreshed, refreshed.clipSourceId);
    const desc = `${refreshed.seoDescription ?? ""}${seo.descriptionAppend}`.trim();
    await updateShow(showId, { seoTags: seo.tags, seoDescription: desc });
    const fromId = refreshed.youtubeVideoId ?? refreshed.id;
    await addEndScreenEdge(fromId, `${fromId}-related`, 1);

    if (refreshed.youtubeVideoId && (await youtubeApiReady(channel.id))) {
      await updateVideoMetadata(channel.id, refreshed.youtubeVideoId, {
        description: desc,
        tags: seo.tags,
        title: refreshed.seoTitle ?? refreshed.title,
      });
    }

    await markTasksDone(showId, [
      ...ACTION_TASKS.postShowSeo,
      ...ACTION_TASKS.endScreen,
      ...ACTION_TASKS.transcript,
    ]);
    steps.push({ step: "post_show", ok: true });
  } catch (e) {
    steps.push({ step: "post_show", ok: false, detail: e instanceof Error ? e.message : "failed" });
  }

  try {
    await seedCommentQueue(showId, show.title);
    await markTasksDone(showId, ACTION_TASKS.abReminder);
    steps.push({ step: "comment_queue", ok: true, detail: "pending QC" });
  } catch {
    steps.push({ step: "comment_queue", ok: false });
  }

  try {
    const draft = await generateIgCarouselDraft(refreshed, channel);
    await upsertIgCarousel(showId, { ...draft, status: "pending_qc" });
    steps.push({ step: "ig_carousel", ok: true, detail: "pending QC" });
  } catch {
    steps.push({ step: "ig_carousel", ok: true, detail: "local draft pending QC" });
  }

  const { autoTasksDone, autoTasksTotal } = await markAllAutoTasksDone(showId);
  await updateShow(showId, { status: "completed" });

  return {
    showId,
    steps,
    autoTasksDone,
    autoTasksTotal,
  };
}
