/**
 * Banter show dry-run - full lifecycle without Clips download.
 * Run: npx tsx tests/banter-dry-run.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDb } from "@/lib/db";
import { runShowLifecycle } from "@/lib/lifecycle";
import { CHECKLIST_TASKS } from "@/lib/checklistTasks";
import { createShow, listChannels, listChecklist, seedChannels } from "@/lib/store";

function setupTempDb() {
  closeDb();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ytx-banter-"));
  process.env.YTX_DATA_DIR = dir;
}

async function main() {
  console.log("\n=== Banter dry-run (full lifecycle) ===\n");
  setupTempDb();

  await seedChannels();
  const channels = await listChannels();
  const banter = channels.find((c) => c.slug === "banter");
  assert.ok(banter, "banter channel exists");

  const { show, checklist } = await createShow({
    channelId: banter.id,
    title: "Banter Dry Run - Ship Test",
    format: "banter",
    guestName: "Test Guest",
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
  });

  assert.equal(checklist.length, 38, "38 checklist tasks seeded");
  assert.equal(show.format, "banter");

  const result = await runShowLifecycle(show.id, { skipClips: true });
  console.log(`  steps OK: ${result.steps.filter((s) => s.ok).length}/${result.steps.length}`);
  console.log(`  auto tasks: ${result.autoTasksDone}/${result.autoTasksTotal}`);

  const items = await listChecklist(show.id);
  const autoTotal = CHECKLIST_TASKS.filter((t) => t.mode === "auto").length;
  const autoDone = items.filter(
    (i) => CHECKLIST_TASKS.find((t) => t.id === i.taskId)?.mode === "auto" && i.status === "done"
  ).length;

  const done = items.filter((i) => i.status === "done").length;
  const pctAll = Math.round((done / 38) * 100);

  assert.equal(autoTotal, 28, "28 auto tasks after Chento addendum");
  assert.ok(autoDone >= 25, `auto tasks done excluding QC (${autoDone}/${autoTotal})`);
  assert.ok(done >= 27, `70% ship bar: ${done}/38 tasks done (${pctAll}%)`);

  console.log(`  ship automation: ${pctAll}% of 38 tasks (${done} done · ${autoDone} auto)`);

  console.log("\n✓ Banter dry-run passed\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
