import type { ShowRun } from "@/lib/types";
import { youtubeThumbnailUrl } from "@/lib/youtube/video";

export function channelInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/** True when the ShowRun is bound to a real YouTube video id (not demo placeholders). */
export function hasLinkedYoutubeVideo(show: Pick<ShowRun, "youtubeVideoId">): boolean {
  const id = show.youtubeVideoId?.trim();
  if (!id) return false;
  if (id.startsWith("demo_")) return false;
  return true;
}

export function showThumbnailUrl(show: Pick<ShowRun, "youtubeVideoId">): string | null {
  const id = show.youtubeVideoId?.trim();
  if (!hasLinkedYoutubeVideo(show) || !id) return null;
  return youtubeThumbnailUrl(id);
}

export function showStatusTone(status: ShowRun["status"]): "good" | "warn" | "bad" | "neutral" {
  if (status === "live") return "warn";
  if (status === "preview") return "good";
  if (status === "blocked") return "bad";
  if (status === "completed") return "neutral";
  return "neutral";
}

export function showYoutubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
