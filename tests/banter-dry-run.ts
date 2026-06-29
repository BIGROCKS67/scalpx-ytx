/**
 * Banter show lifecycle — proof-based (blocks without real YouTube OAuth + video).
 * Run: npx tsx tests/banter-dry-run.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDb } from "@/lib/db";
import { runShowLifecycle } from "@/lib/lifecycle";
import { preflightShowRun } from "@/lib/readiness/preflight";
import { createShow, listChannels, seedChannels, updateShow } from "@/lib/store";

function setupTempDb() {
  closeDb();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ytx-banter-"));
  process.env.YTX_DATA_DIR = dir;
}

async function main() {
  console.log("\n=== Banter lifecycle proof test ===\n");
  setupTempDb();

  await seedChannels();
  const channels = await listChannels();
  assert.equal(channels.length, 2, "active roster is chento + banter");
  const banter = channels.find((c) => c.slug === "banter");
  assert.ok(banter, "banter channel exists");

  const { show, checklist } = await createShow({
    channelId: banter.id,
    title: "Banter Proof Test",
    format: "banter",
    guestName: "Test Guest",
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
  });

  assert.equal(checklist.length, 38, "38 checklist tasks seeded");

  const blocked = await runShowLifecycle(show.id, { mode: "full" });
  assert.equal(blocked.ok, false, "full run blocked without OAuth/video/clips");
  assert.ok(blocked.blockers?.length, "returns blocker list");
  console.log(`  blocked: ${blocked.blockers?.map((b) => b.code).join(", ")}`);

  await updateShow(show.id, { youtubeVideoId: "dQw4w9WgXcQ" });
  const stillBlocked = await runShowLifecycle(show.id, { mode: "full" });
  assert.equal(stillBlocked.ok, false, "still blocked without OAuth");
  assert.ok(
    stillBlocked.blockers?.some((b) => b.code === "youtube_write_missing"),
    "reports missing OAuth"
  );
  console.log("  ✓ preflight blocks without real credentials");

  const metadataOnly = await runShowLifecycle(show.id, { mode: "metadata_only" });
  assert.equal(metadataOnly.ok, false, "metadata-only still needs OAuth for YouTube write");
  console.log(`  metadata-only ok=${metadataOnly.ok} (expected false without OAuth)`);

  process.env.YTX_YOUTUBE_API_KEY = process.env.YTX_YOUTUBE_API_KEY ?? "test-api-key";
  const previewPreflight = await preflightShowRun(show.id, "preview");
  assert.ok(!previewPreflight.blockers.some((b) => b.code === "youtube_write_missing"));
  console.log("  ✓ preview preflight skips OAuth write blocker");

  console.log("\n✓ Banter proof test passed\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
