/**
 * Opt-in clips E2E — requires YTX_CLIPS_E2E=1, OPENAI_API_KEY, YTX_CLIPS_TEST_URL.
 * Run: YTX_CLIPS_E2E=1 OPENAI_API_KEY=... YTX_CLIPS_TEST_URL=... npx tsx tests/smoke-clips-e2e.ts
 */
import assert from "node:assert/strict";

async function main() {
  if (process.env.YTX_CLIPS_E2E !== "1") {
    console.log("skip clips E2E (set YTX_CLIPS_E2E=1 to run)");
    return;
  }

  const url = process.env.YTX_CLIPS_TEST_URL;
  assert.ok(url, "YTX_CLIPS_TEST_URL required");

  const base = process.env.YTX_APP_URL ?? "http://localhost:3001";
  const prefix = process.env.NEXT_PUBLIC_YTX_BASE_PATH ?? "/ytx";

  const readiness = await fetch(`${base}${prefix}/api/clips/readiness`);
  const readinessBody = (await readiness.json()) as { ready: boolean; blockers: unknown[] };
  assert.equal(readiness.ok, true);
  assert.equal(readinessBody.ready, true, JSON.stringify(readinessBody.blockers));

  console.log("  ✓ clips readiness OK");
  console.log("\n✓ Clips E2E preflight passed (full pipeline run manually against a dev server)\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
