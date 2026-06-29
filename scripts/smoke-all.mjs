#!/usr/bin/env node
/**
 * Full YTX smoke runner: unit tests + production build + API tests against dev server.
 * Run: npm run smoke
 */
import { spawn } from "node:child_process";

const BASE = process.env.YTX_BASE_URL ?? "http://localhost:3001/ytx";

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, ...env },
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function waitForServer(maxMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║  YTX full smoke audit                ║");
  console.log("╚══════════════════════════════════════╝\n");

  console.log("→ TypeScript build…");
  if ((await run("npm", ["run", "build"])) !== 0) {
    console.error("\n✗ build failed");
    process.exit(1);
  }
  console.log("✓ build passed\n");

  console.log("→ Unit / store smoke…");
  if ((await run("npx", ["tsx", "tests/smoke-unit.ts"])) !== 0) {
    console.error("\n✗ unit smoke failed");
    process.exit(1);
  }

  console.log("→ Banter dry-run…");
  if ((await run("npx", ["tsx", "tests/banter-dry-run.ts"])) !== 0) {
    console.error("\n✗ banter dry-run failed");
    process.exit(1);
  }

  console.log("\n→ Starting dev server for API smoke…");
  const server = spawn("npm", ["run", "dev"], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    env: process.env,
  });

  const ready = await waitForServer();
  if (!ready) {
    server.kill();
    console.error("\n✗ dev server did not become ready");
    process.exit(1);
  }
  console.log("✓ dev server ready\n");

  console.log("→ API smoke…");
  const apiCode = await run("npx", ["tsx", "tests/smoke-api.ts"], { YTX_BASE_URL: BASE });
  server.kill("SIGTERM");

  if (apiCode !== 0) {
    console.error("\n✗ API smoke failed");
    process.exit(1);
  }

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║  ALL SMOKE TESTS PASSED              ║");
  console.log("╚══════════════════════════════════════╝\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
