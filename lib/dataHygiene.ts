import { ACTIVE_CHANNEL_SLUGS } from "@/lib/activeChannels";
import { getDb, runWithDb } from "@/lib/db";

/** Remove seeded demo / simulated artifacts from the DB on startup. */
export async function purgeFakeData(): Promise<{ removed: Record<string, number> }> {
  return runWithDb(() => {
    const db = getDb();
    const removed: Record<string, number> = {};

    const fakeComments = db
      .prepare(
        `DELETE FROM comment_replies WHERE authorHint LIKE '@viewer%' OR authorHint LIKE '@demo%'`
      )
      .run();
    removed.commentReplies = fakeComments.changes;

    const demoShows = db
      .prepare(`DELETE FROM show_runs WHERE youtubeVideoId LIKE 'demo_%'`)
      .run();
    removed.demoShows = demoShows.changes;

    const rows = db
      .prepare(`SELECT id, metadataJson FROM analytics_snapshots`)
      .all() as { id: string; metadataJson: string }[];
    let analyticsRemoved = 0;
    for (const row of rows) {
      try {
        const meta = JSON.parse(row.metadataJson || "{}") as { source?: string };
        if (meta.source === "simulated" || meta.source === "demo_seed") {
          db.prepare(`DELETE FROM analytics_snapshots WHERE id = ?`).run(row.id);
          analyticsRemoved++;
        }
      } catch {
        /* keep */
      }
    }
    removed.analyticsSnapshots = analyticsRemoved;

    const fakeEdges = db
      .prepare(`DELETE FROM end_screen_edges WHERE toVideoId LIKE '%-related'`)
      .run();
    removed.endScreenEdges = fakeEdges.changes;

    const placeholders = ACTIVE_CHANNEL_SLUGS.map(() => "?").join(", ");
    const inactiveShows = db
      .prepare(
        `DELETE FROM show_runs WHERE channelId IN (
          SELECT id FROM channels WHERE slug NOT IN (${placeholders})
        )`
      )
      .run(...ACTIVE_CHANNEL_SLUGS);
    removed.inactiveChannelShows = inactiveShows.changes;

    return { removed };
  });
}
