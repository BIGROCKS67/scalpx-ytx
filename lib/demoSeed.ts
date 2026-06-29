import { getDb, runWithDb } from "@/lib/db";
import { generateCrossPosts } from "@/lib/adapters/content";
import { DEMO_SHOWS, CHANNEL_PROFILES, profileBySlug } from "@/lib/demoProfiles";
import type { ShowRun } from "@/lib/types";

export function demoSeedEnabled(): boolean {
  return process.env.YTX_DEMO_SEED === "true";
}

function clearShowData(): void {
  runWithDb(() => {
    const db = getDb();
    db.exec("DELETE FROM comment_replies");
    db.exec("DELETE FROM ig_carousels");
    db.exec("DELETE FROM analytics_snapshots");
    db.exec("DELETE FROM cross_post_queue");
    db.exec("DELETE FROM clip_batches");
    db.exec("DELETE FROM checklist_items");
    db.exec("DELETE FROM show_runs");
  });
}

async function storeApi() {
  return import("@/lib/store");
}

/** Apply rich host/channel copy to roster rows (idempotent). */
export async function enrichChannelProfiles(): Promise<void> {
  if (!demoSeedEnabled()) return;

  const { listChannels, updateChannel } = await storeApi();
  const channels = await listChannels();
  for (const ch of channels) {
    const profile = profileBySlug(ch.slug);
    if (!profile) continue;

    const stale =
      !ch.descriptionTemplate ||
      ch.descriptionTemplate.endsWith("FlowX trader channel.") ||
      ch.descriptionTemplate.length < 80;

    if (!stale && ch.youtubeChannelId && ch.tags.length >= 4) continue;

    await updateChannel(ch.id, {
      youtubeChannelId: ch.youtubeChannelId ?? profile.youtubeChannelId,
      trackAccountId: ch.trackAccountId ?? profile.trackAccountId,
      descriptionTemplate: profile.descriptionTemplate,
      tags: profile.tags,
      socialLinks: profile.socialLinks,
      channelTrailerDraft: ch.channelTrailerDraft ?? profile.channelTrailerDraft,
    });
  }
}

async function seedShowExtras(
  showId: string,
  channelId: string,
  def: (typeof DEMO_SHOWS)[number]
): Promise<void> {
  const {
    listChannels,
    seedCommentQueue,
    upsertIgCarousel,
    upsertCrossPosts,
  } = await storeApi();
  const channels = await listChannels();
  const channel = channels.find((c) => c.id === channelId);
  const show = {
    id: showId,
    channelId,
    title: def.title,
    format: def.format,
    pipeline: def.pipeline,
    scheduledAt: def.scheduledAt,
    guestName: def.guestName,
    dealId: def.dealId,
    status: def.status,
  } as Parameters<typeof generateCrossPosts>[0];

  if (def.withComments) {
    await seedCommentQueue(showId, def.title);
  }

  if (def.withIgCarousel) {
    await upsertIgCarousel(showId, {
      slides: [
        "Slide 1 · Show title + hook",
        "Slide 2 · Key takeaway from stream",
        "Slide 3 · Guest quote or chart",
        "Slide 4 · CTA · Subscribe + next show",
      ],
      caption: `${def.title} · highlights on IG. Link in bio for full replay. #crypto #trading`,
      status: "pending_qc",
    });
  }

  if (def.withCrossPosts && channel) {
    const posts = await generateCrossPosts(show, channel);
    await upsertCrossPosts(posts);
  }

  if (def.withComments && def.status === "completed") {
    const { ensureReplayCommentQueue } = await import("@/lib/replayComments");
    const showRow = { ...show, status: def.status as ShowRun["status"] };
    await ensureReplayCommentQueue(showRow as ShowRun, channel ?? null);
  }
}

/** Seed demo show runs when DB is empty (first load / Vercel cold start). */
export async function seedDemoContent(force = false): Promise<{ seeded: boolean; count: number }> {
  if (!demoSeedEnabled() && !force) return { seeded: false, count: 0 };

  const { listShows, listChannels, createShow, updateShow, updateChecklistItem } = await storeApi();
  const existing = await listShows();
  if (existing.length > 0 && !force) return { seeded: false, count: existing.length };

  if (force && existing.length > 0) clearShowData();

  await enrichChannelProfiles();

  const channels = await listChannels();
  const bySlug = Object.fromEntries(channels.map((c) => [c.slug, c]));
  let count = 0;

  for (const def of DEMO_SHOWS) {
    const channel = bySlug[def.channelSlug];
    if (!channel) continue;

    const { show } = await createShow({
      channelId: channel.id,
      title: def.title,
      format: def.format,
      pipeline: def.pipeline,
      scheduledAt: def.scheduledAt,
      guestName: def.guestName,
      dealId: def.dealId,
    });

    await updateShow(show.id, {
      status: def.status,
      seoTitle: def.seoTitle,
      seoDescription: def.seoDescription,
      seoTags: def.seoTags,
      youtubeVideoId:
        def.status === "live" || def.status === "completed" ? `demo_${show.id.slice(0, 8)}` : null,
      liveChapters: (def.liveChapters ?? []).map((c) => ({ ...c, status: "draft" as const })),
      descriptionPatchLog:
        def.status === "live"
          ? [
              {
                at: new Date().toISOString(),
                note: "Sponsor block injected",
                snippet: "🔗 Partner links updated live · #ad",
              },
            ]
          : [],
    });

    for (const taskId of def.doneTaskIds) {
      await updateChecklistItem(show.id, taskId, { status: "done" });
    }

    await seedShowExtras(show.id, channel.id, def);
    count++;
  }

  return { seeded: true, count };
}

export function demoProfileSummary(): { channels: number; shows: number } {
  return { channels: CHANNEL_PROFILES.length, shows: DEMO_SHOWS.length };
}
