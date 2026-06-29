/**
 * YTX HTTP API smoke tests - requires dev server on YTX_BASE_URL (default :3001).
 * Run: npm run test:api
 */
import assert from "node:assert/strict";

const BASE = process.env.YTX_BASE_URL ?? "http://localhost:3001/ytx";

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

async function json(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function main() {
  console.log(`\n=== YTX API smoke (${BASE}) ===\n`);

  const health = await json("/api/health");
  ok("GET /api/health 200", health.res.status === 200);
  ok("health product=ytx", health.body.product === "ytx");

  const channels = await json("/api/channels");
  ok("GET /api/channels 200", channels.res.status === 200);
  ok("10 channels", channels.body.channels?.length === 10);
  const banter = channels.body.channels?.find((c: { slug: string }) => c.slug === "banter");
  ok("banter in roster", banter?.isShowFormat === true);
  const chento = channels.body.channels?.find((c: { slug: string }) => c.slug === "chento");

  const dashboard = await json("/api/dashboard");
  ok("GET /api/dashboard 200", dashboard.res.status === 200);
  ok("dashboard has stats", typeof dashboard.body.stats?.auto === "number");

  const settings = await json("/api/settings");
  ok("GET /api/settings 200", settings.res.status === 200);

  const showsBefore = await json("/api/shows");
  ok("GET /api/shows 200", showsBefore.res.status === 200);

  const created = await json("/api/shows", {
    method: "POST",
    body: JSON.stringify({
      channelId: chento.id,
      title: `API smoke ${Date.now()}`,
      format: "stream",
      guestName: "Smoke Bot",
    }),
  });
  ok("POST /api/shows 201", created.res.status === 201);
  const showId = created.body.show?.id as string;
  ok("show id returned", Boolean(showId));

  const showGet = await json(`/api/shows/${showId}`);
  ok("GET /api/shows/[id] 200", showGet.res.status === 200);
  ok("checklist 38 on show", showGet.body.checklist?.length === 38);
  ok("clip batch exists", Boolean(showGet.body.clipBatch?.id));

  const checklistPatch = await json(`/api/shows/${showId}/checklist`, {
    method: "PATCH",
    body: JSON.stringify({ taskId: "1.1", status: "done" }),
  });
  ok("PATCH checklist 200", checklistPatch.res.status === 200);

  const seo = await json(`/api/shows/${showId}/seo-pack`, { method: "POST" });
  ok("POST seo-pack 200", seo.res.status === 200);
  ok("seo titles returned", Array.isArray(seo.body.pack?.titles));

  const sponsor = await json(`/api/shows/${showId}/sponsor-block`, { method: "POST" });
  ok("POST sponsor-block 200", sponsor.res.status === 200);

  const cross = await json(`/api/shows/${showId}/cross-post`, { method: "POST" });
  ok("POST cross-post 200", cross.res.status === 200);
  ok("6 cross-post items", cross.body.crossPosts?.length === 6);

  const analytics = await json(`/api/shows/${showId}/analytics`, { method: "POST" });
  ok("POST analytics 200", analytics.res.status === 200);
  ok("analytics snapshots", analytics.body.snapshots?.length >= 2);

  const lifecycle = await json(`/api/shows/${showId}/lifecycle`, {
    method: "POST",
    body: JSON.stringify({ skipClips: true }),
  });
  ok("POST lifecycle 200", lifecycle.res.status === 200);
  ok("lifecycle auto tasks", lifecycle.body.autoTasksDone >= 20);

  const oauth = await fetch(`${BASE}/api/youtube/connect?channelId=${chento.id}`, {
    redirect: "manual",
  });
  ok(
    "OAuth connect redirects (settings or Google)",
    oauth.status === 307 || oauth.status === 302 || oauth.status === 308
  );

  const pages = ["/", "/channels", "/shows", "/settings"];
  for (const page of pages) {
    const res = await fetch(`${BASE}${page}`);
    ok(`GET ${page} 200`, res.status === 200);
  }

  console.log("\n=== results ===");
  console.log(`passed: ${passed}`);
  if (failed > 0) {
    console.error(`failed: ${failed}`);
    process.exit(1);
  }
  console.log("all API smoke tests passed\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
