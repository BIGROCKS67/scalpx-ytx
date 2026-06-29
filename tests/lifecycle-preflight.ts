/**
 * Lifecycle preflight smoke — proves E2E run blocks without credentials.
 * Run: npx tsx tests/lifecycle-preflight.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDb } from "@/lib/db";
import { preflightShowRun } from "@/lib/readiness/preflight";
import { createShow, listChannels, seedChannels, updateShow } from "@/lib/store";

function setupTempDb() {
  closeDb();
  process.env.YTX_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "ytx-preflight-"));
}

async function main() {
  console.log("\n=== Lifecycle preflight smoke ===\n");
  setupTempDb();
  await seedChannels();
  const chento = (await listChannels()).find((c) => c.slug === "chento");
  assert.ok(chento);

  const { show } = await createShow({
    channelId: chento!.id,
    title: "Preflight test",
    format: "stream",
  });

  const blocked = await preflightShowRun(show.id, "full");
  assert.equal(blocked.ready, false);
  assert.ok(blocked.blockers.some((b) => b.code === "missing_video_id"));
  assert.ok(blocked.blockers.some((b) => b.code === "youtube_write_missing"));
  console.log("  ✓ blocks without video + OAuth");

  await updateShow(show.id, { youtubeVideoId: "testVideo123" });
  const stillBlocked = await preflightShowRun(show.id, "full");
  assert.equal(stillBlocked.ready, false);
  assert.ok(stillBlocked.blockers.some((b) => b.code === "youtube_write_missing"));
  console.log("  ✓ blocks without OAuth even with video ID");

  process.env.YTX_YOUTUBE_API_KEY = process.env.YTX_YOUTUBE_API_KEY ?? "test-api-key";
  const previewPreflight = await preflightShowRun(show.id, "preview");
  assert.ok(!previewPreflight.blockers.some((b) => b.code === "youtube_write_missing"));
  assert.ok(
    previewPreflight.warnings.some((w) => w.includes("Preview run")),
    "preview warning shown"
  );
  console.log(`  ✓ preview preflight ready=${previewPreflight.ready} (no OAuth blocker)`);

  const prevVercel = process.env.VERCEL;
  process.env.VERCEL = "1";
  const vercelPreview = await preflightShowRun(show.id, "preview");
  assert.ok(!vercelPreview.blockers.some((b) => b.code === "youtube_write_missing"));
  assert.ok(!vercelPreview.blockers.some((b) => b.code === "yt_dlp_missing"));
  assert.equal(vercelPreview.host.serverless, true);
  if (vercelPreview.ready) {
    console.log("  ✓ Vercel preview preflight ready (clips gate skipped on demo host)");
  } else {
    console.log(`  ✓ Vercel preview blockers: ${vercelPreview.blockers.map((b) => b.code).join(", ")}`);
  }
  process.env.VERCEL = prevVercel;

  console.log("\n✓ Lifecycle preflight smoke passed\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
