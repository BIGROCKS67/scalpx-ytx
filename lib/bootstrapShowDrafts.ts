import { runShowLifecycle } from "@/lib/lifecycle";
import { showNeedsDraftBootstrap } from "@/lib/showDraftBootstrap";
import { getChannel, getShow } from "@/lib/store";

export { seedInitialShowMetadata, showNeedsDraftBootstrap } from "@/lib/showDraftBootstrap";

/** Runs preview lifecycle — fills Details, Video elements drafts, and checklist without YouTube upload. */
export async function bootstrapShowDrafts(showId: string) {
  const show = await getShow(showId);
  if (!show) return { ok: false, skipped: true, reason: "not_found" as const };

  if (!showNeedsDraftBootstrap(show)) {
    return { ok: true, skipped: true, reason: "already_bootstrapped" as const };
  }

  const channel = await getChannel(show.channelId);
  if (!channel) return { ok: false, skipped: true, reason: "no_channel" as const };

  const result = await runShowLifecycle(showId, { mode: "preview" });
  return { ok: result.ok, skipped: false, result };
}
