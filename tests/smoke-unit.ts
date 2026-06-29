/**
 * YTX unit + store smoke tests (isolated temp DB).
 * Run: npm test
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDb } from "@/lib/db";
import {
  CHECKLIST_TASKS,
  TASK_COUNT,
  automationStats,
  tasksForPhase,
} from "@/lib/checklistTasks";
import { PHASE_ORDER } from "@/lib/types";
import { rosterSeedData, ROSTER_SLUG_ORDER } from "@/lib/rosterSeed";
import { canManuallyUpdateTask } from "@/lib/checklistAutomation";
import { generateSeoPack } from "@/lib/seoPack";
import { buildSponsorBlock } from "@/lib/adapters/deals";
import {
  createShow,
  getChannel,
  listAnalytics,
  listChannels,
  listChecklist,
  listCrossPosts,
  seedChannels,
  updateChannel,
  updateChecklistItem,
  upsertCrossPosts,
} from "@/lib/store";

let passed = 0;
let failed = 0;

function ok(label: string, cond: boolean) {
  if (!cond) {
    failed++;
    console.error(`  ✗ FAIL: ${label}`);
    return;
  }
  passed++;
  console.log(`  ✓ ${label}`);
}

function setupTempDb() {
  closeDb();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ytx-smoke-"));
  process.env.YTX_DATA_DIR = dir;
}

async function main() {
  console.log("\n=== YTX unit smoke ===\n");

  console.log("checklist spec:");
  ok("38 tasks defined", TASK_COUNT === 38);
  ok("unique task ids", new Set(CHECKLIST_TASKS.map((t) => t.id)).size === 38);
  const phaseTotal = PHASE_ORDER.reduce((n, p) => n + tasksForPhase(p).length, 0);
  ok("phases sum to 38", phaseTotal === 38);
  const stats = automationStats(CHECKLIST_TASKS.map((t) => ({ mode: t.mode, status: "pending" })));
  ok("auto tasks >= 23", stats.auto >= 23);
  ok("assist + manual + auto = 38", stats.auto + stats.assist + stats.manual === 38);
  ok("auto tasks cannot be manually marked done", !canManuallyUpdateTask("1.1", "done"));
  ok("manual tasks can be marked done", canManuallyUpdateTask("2.3", "done"));

  console.log("\nroster spec:");
  ok("2 active seed channels", rosterSeedData().length === 2);
  ok("chento in roster", rosterSeedData().some((c) => c.slug === "chento"));
  const banter = rosterSeedData().find((c) => c.slug === "banter");
  ok("banter is show-format entity", banter?.isShowFormat === true);
  ok("chento not show-format", rosterSeedData().find((c) => c.slug === "chento")?.isShowFormat === false);
  ok("roster order is chento then banter", ROSTER_SLUG_ORDER.join(",") === "chento,banter");

  setupTempDb();
  console.log("\nstore / lifecycle:");
  const channels = await seedChannels();
  ok("seed persists 2 active channels", channels.length === 2);
  ok("first channel is chento (roster order)", channels[0]?.slug === "chento");
  ok("last channel is banter", channels.at(-1)?.slug === "banter");

  const chento = channels.find((c) => c.slug === "chento")!;
  const { show, checklist } = await createShow({
    channelId: chento.id,
    title: "Banter dry-run smoke test",
    format: "banter",
    guestName: "Test Guest",
    dealId: null,
  });
  ok("show created", Boolean(show.id));
  ok("checklist seeded 38 items", checklist.length === 38);
  ok("show format banter", show.format === "banter");

  const item = await updateChecklistItem(show.id, "2.1", { status: "done" });
  ok("checklist item updates", item?.status === "done");

  const pack = await generateSeoPack(show, chento);
  ok("seo pack has 3 titles", pack.titles.length === 3);
  ok("seo pack description non-empty", pack.description.length > 20);
  ok("seo pack tags populated", pack.tags.length >= 5);

  const sponsor = await buildSponsorBlock(null);
  ok("sponsor block empty without deal", sponsor.urls.length === 0);

  const { generateCrossPosts } = await import("@/lib/adapters/content");
  const crossPosts = await generateCrossPosts(show, chento);
  ok("cross-post generates 6 platforms", crossPosts.length === 6);
  await upsertCrossPosts(crossPosts);
  const stored = await listCrossPosts(show.id);
  ok("cross-post stored once", stored.length === 6);
  await upsertCrossPosts(crossPosts);
  const storedAgain = await listCrossPosts(show.id);
  ok("cross-post replace avoids duplicates", storedAgain.length === 6);

  const { addAnalyticsSnapshot } = await import("@/lib/store");
  await addAnalyticsSnapshot({
    showRunId: show.id,
    snapshotType: "waiting_room",
    concurrentViewers: 100,
    views24h: null,
    metadata: {},
    capturedAt: new Date().toISOString(),
  });
  const analytics = await listAnalytics(show.id);
  ok("analytics snapshot stored", analytics.length >= 1);

  await updateChannel(chento.id, { youtubeChannelId: "UC_TEST_SMOKE" });
  const updated = await getChannel(chento.id);
  ok("channel patch persists", updated?.youtubeChannelId === "UC_TEST_SMOKE");

  const allChecklist = await listChecklist(show.id);
  ok("all checklist phases represented", PHASE_ORDER.every((p) => allChecklist.some((i) => i.phase === p)));

  const banterCh = channels.find((c) => c.slug === "banter")!;
  const { buildTrendFollowUpTitle, titlesTooSimilar } = await import("@/lib/insights/trendStream");
  const { channelContentDna } = await import("@/lib/insights/channelDna");
  console.log("\ntrend follow-up titles:");
  const propViral = "BITCOIN LIVE TRADING: $1K to $100K Prop Firm Challenge | EP 1";
  const propStream = buildTrendFollowUpTitle(
    chento,
    "stream",
    propViral,
    ["prop firm", "live trading", "bitcoin"],
    channelContentDna(chento)
  );
  ok("prop firm stream title is not a rerun", !titlesTooSimilar(propStream, propViral));
  ok(
    "prop firm stream title is a follow-up angle",
    /ep 2|check-in|continuation|update|not a replay/i.test(propStream)
  );
  const saylorViral = "Michael Saylor Did It & Bitcoin's about to Pump! (Here's Why)";
  const saylorStream = buildTrendFollowUpTitle(
    banterCh,
    "banter",
    saylorViral,
    ["bitcoin"],
    channelContentDna(banterCh)
  );
  ok("saylor stream title is not a rerun", !titlesTooSimilar(saylorStream, saylorViral));

  const { showNeedsDraftBootstrap, seedInitialShowMetadata } = await import("@/lib/bootstrapShowDrafts");
  const seeded = seedInitialShowMetadata("Bitcoin Live Test", chento);
  ok("create seeds seo title", Boolean(seeded.seoTitle?.includes("Bitcoin Live Test")));
  ok("draft show needs bootstrap", showNeedsDraftBootstrap({ ...show, status: "draft", seoTitle: seeded.seoTitle, seoDescription: seeded.seoDescription, thumbnailVariant: "pending" }));
  ok("scheduled without brief needs bootstrap", showNeedsDraftBootstrap({ ...show, status: "scheduled", seoTitle: "T", seoDescription: "D", thumbnailVariant: null }));
  ok("preview show skips bootstrap", !showNeedsDraftBootstrap({ ...show, status: "preview", seoTitle: "T", seoDescription: "D", thumbnailVariant: "brief_ready" }));

  const { buildShowDraftIntel, buildSeoTitles } = await import("@/lib/showDraftIntel");
  const intel = buildShowDraftIntel(
    { ...show, title: "Bitcoin Weekly · Alt Season Playbook", format: "stream" },
    chento,
    ["BITCOIN LIVE TRADING: Prop Firm Challenge | EP 1"]
  );
  ok("intel extracts bitcoin topic", intel.topics.includes("bitcoin"));
  ok("chento seo title uses live trading style", /BITCOIN LIVE TRADING/i.test(buildSeoTitles(
    { ...show, title: "Bitcoin Weekly · Alt Season Playbook" },
    chento,
    intel
  )[0]));

  const { draftReplyForComment, isStaleGenericDraft } = await import("@/lib/commentIntel");
  const saylorShow = {
    title: saylorViral,
    format: "banter" as const,
    guestName: null,
    liveChapters: [
      { atSec: 2052, label: "MSTR premium vs BTC spot", status: "draft" as const },
      { atSec: 3420, label: "Community Q&A", status: "draft" as const },
    ],
  };
  const tsReply = draftReplyForComment(
    saylorShow,
    { commentText: "Can you timestamp when you talked about MSTR premium vs BTC spot?" },
    banterCh
  );
  ok("banter timestamp reply cites chapters", /34:12|mstr premium|chapters/i.test(tsReply));
  ok("banter reply avoids ai filler", !/great question|solid point|touched on this during the live q&a/i.test(tsReply));
  const longReply = draftReplyForComment(
    saylorShow,
    { commentText: "Saylor buying again is literally the signal. Why isn't everyone long?" },
    banterCh
  );
  ok("banter long reply addresses comment", /long|saylor|size|mstr/i.test(longReply));
  ok("stale draft detected", isStaleGenericDraft("Great question — we broke down the Saylor angle live on this stream."));
  ok("fresh draft not stale", !isStaleGenericDraft("34:12 — MSTR premium vs BTC spot is in the chapters"));

  const { isLegitAnalyticsSnapshot, purgeFakeAnalytics } = await import("@/lib/store");
  ok("demo_seed analytics rejected", !isLegitAnalyticsSnapshot({
    id: "x",
    showRunId: show.id,
    snapshotType: "peak_viewers",
    concurrentViewers: 986,
    views24h: null,
    metadata: { source: "demo_seed" },
    capturedAt: new Date().toISOString(),
  }));
  ok("youtube_api analytics accepted", isLegitAnalyticsSnapshot({
    id: "y",
    showRunId: show.id,
    snapshotType: "views_24h",
    concurrentViewers: null,
    views24h: 42000,
    metadata: { source: "youtube_api", metric: "total_views" },
    capturedAt: new Date().toISOString(),
  }));
  await purgeFakeAnalytics(show.id);

  console.log("\n=== results ===");
  console.log(`passed: ${passed}`);
  if (failed > 0) {
    console.error(`failed: ${failed}`);
    process.exit(1);
  }
  console.log("all unit smoke tests passed\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
