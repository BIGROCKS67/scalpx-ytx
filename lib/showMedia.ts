import type { ShowRun } from "@/lib/types";
import { youtubeThumbnailUrl } from "@/lib/youtube/video";

export function channelInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function showThumbnailUrl(show: Pick<ShowRun, "youtubeVideoId">): string | null {
  return show.youtubeVideoId ? youtubeThumbnailUrl(show.youtubeVideoId) : null;
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
