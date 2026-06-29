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
import { rosterSeedData, ROSTER_SLUG_ORDER, TRADER_ROSTER } from "@/lib/rosterSeed";
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

  console.log("\nroster spec:");
  ok("10 seed channels", rosterSeedData().length === 10);
  ok("9 traders in roster constant", TRADER_ROSTER.length === 9);
  const banter = rosterSeedData().find((c) => c.slug === "banter");
  ok("banter is show-format entity", banter?.isShowFormat === true);
  ok("chento not show-format", rosterSeedData().find((c) => c.slug === "chento")?.isShowFormat === false);
  ok("roster order ends with banter", ROSTER_SLUG_ORDER.at(-1) === "banter");

  setupTempDb();
  console.log("\nstore / lifecycle:");
  const channels = await seedChannels();
  ok("seed persists 10 channels", channels.length === 10);
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
