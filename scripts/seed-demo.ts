import { seedChannels } from "@/lib/store";
import { enrichChannelProfiles, seedDemoContent } from "@/lib/demoSeed";
import { closeDb } from "@/lib/db";

/**
 * Force demo roster + show seed into the local DB.
 * Run: npm run seed:demo
 */
async function main() {
  console.log("\n=== YTX demo seed ===\n");
  await seedChannels();
  await enrichChannelProfiles();
  const result = await seedDemoContent(true);
  console.log(`  seeded: ${result.seeded} · shows: ${result.count}`);
  closeDb();
  console.log("\n✓ Demo data loaded — open http://localhost:3001/ytx\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
