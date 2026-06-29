import { hasLinkedYoutubeVideo } from "@/lib/showMedia";
import type { CommentReply, ShowRun, YtChannel } from "@/lib/types";

/** True when we can pull real comment threads from YouTube Data API (OAuth + real video id). */
export function canPullYoutubeComments(
  show: Pick<ShowRun, "youtubeVideoId">,
  channel: YtChannel | null
): boolean {
  return hasLinkedYoutubeVideo(show) && Boolean(channel?.oauthConnected);
}

export function commentsAreFromYoutube(items: CommentReply[]): boolean {
  return items.length > 0 && items.every((c) => c.commentSource === "youtube");
}

export function commentsNeedYoutubeSync(items: CommentReply[]): boolean {
  if (!items.length) return true;
  return items.some((c) => c.commentSource !== "youtube");
}
