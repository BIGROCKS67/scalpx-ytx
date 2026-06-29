import { hasLinkedYoutubeVideo } from "@/lib/showMedia";
import type { CommentReply, ShowRun, YtChannel } from "@/lib/types";

/** True when the show has a real YouTube video id to pull public comments from. */
export function canPullYoutubeComments(
  show: Pick<ShowRun, "youtubeVideoId">,
  _channel?: YtChannel | null
): boolean {
  return hasLinkedYoutubeVideo(show);
}

export function commentsAreFromYoutube(items: CommentReply[]): boolean {
  return items.length > 0 && items.every((c) => c.commentSource === "youtube");
}

export function commentsNeedYoutubeSync(items: CommentReply[]): boolean {
  if (!items.length) return true;
  return items.some((c) => c.commentSource !== "youtube");
}

export function commentsSyncBlocker(
  show: Pick<ShowRun, "youtubeVideoId">,
  youtubeReadReady: boolean
): string | undefined {
  if (!hasLinkedYoutubeVideo(show)) {
    return "Paste the real YouTube watch URL on this show";
  }
  if (!youtubeReadReady) {
    return "Add YouTube API key in Settings or connect OAuth on Roster";
  }
  return undefined;
}
