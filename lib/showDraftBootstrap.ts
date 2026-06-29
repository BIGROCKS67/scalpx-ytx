import { buildSeedMetadata } from "@/lib/showDraftIntel";
import type { ShowRun, YtChannel } from "@/lib/types";

/** True when the show still needs the full preview draft pass (SEO, social, checklist). */
export function showNeedsDraftBootstrap(
  show: Pick<ShowRun, "seoTitle" | "seoDescription" | "status" | "thumbnailVariant">
): boolean {
  if (show.status === "completed" || show.status === "live") return false;
  if (show.thumbnailVariant === "brief_ready") return false;
  if (!show.seoTitle?.trim() || !show.seoDescription?.trim()) return true;
  return show.status === "draft" || show.status === "scheduled" || show.status === "blocked";
}

export function seedInitialShowMetadata(
  title: string,
  channel: YtChannel | null
): Pick<ShowRun, "seoTitle" | "seoDescription" | "seoTags" | "thumbnailVariant"> {
  return buildSeedMetadata(title, channel);
}
