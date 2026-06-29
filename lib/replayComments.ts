import { generateCommentReplyDrafts } from "@/lib/adapters/commentReplies";
import {
  draftReplyForComment,
  isStaleGenericDraft,
  sortCommentsByEngagement,
} from "@/lib/commentIntel";
import { runWithDb, getDb } from "@/lib/db";
import { isReplayShowView } from "@/lib/showFilters";
import { hasLinkedYoutubeVideo } from "@/lib/showMedia";
import {
  listCommentReplies,
  purgeNonYoutubeComments,
} from "@/lib/store";
import type { CommentReply, ShowRun, YtChannel } from "@/lib/types";
import {
  commentsAreFromYoutube,
  commentsNeedYoutubeSync,
  commentsSyncBlocker,
} from "@/lib/youtube/commentSync";
import { syncCommentsFromYoutube } from "@/lib/youtube/comments";
import { youtubeApiReady } from "@/lib/youtube/dataApi";

function needsNewDraft(comment: CommentReply, force: boolean): boolean {
  if (comment.status !== "pending") return false;
  if (force) return true;
  if (!comment.draftReply.trim()) return true;
  return isStaleGenericDraft(comment.draftReply);
}

function persistDrafts(drafts: Map<string, string>): void {
  const now = new Date().toISOString();
  const update = getDb().prepare(
    "UPDATE comment_replies SET draftReply = @draftReply, updatedAt = @updatedAt WHERE id = @id"
  );
  for (const [id, draftReply] of drafts) {
    if (!draftReply.trim()) continue;
    update.run({ id, draftReply, updatedAt: now });
  }
}

async function tryYoutubeSync(
  show: ShowRun,
  channel: YtChannel
): Promise<{ items: CommentReply[]; error?: string }> {
  const result = await syncCommentsFromYoutube(show.id, show.channelId, show.youtubeVideoId!);
  if (result.ok && result.imported > 0) {
    return { items: result.items };
  }
  return { items: result.items, error: result.error };
}

async function ensureCommentsExist(
  show: ShowRun,
  channel: YtChannel | null,
  opts?: { syncYoutube?: boolean }
): Promise<{ items: CommentReply[]; syncError?: string }> {
  await purgeNonYoutubeComments(show.id);

  let items = await listCommentReplies(show.id);
  const readReady = Boolean(channel && (await youtubeApiReady(channel.id)));
  const blocker = commentsSyncBlocker(show, readReady);

  if (blocker) {
    return { items: [], syncError: blocker };
  }

  const shouldSync =
    channel &&
    (opts?.syncYoutube || items.length === 0 || commentsNeedYoutubeSync(items));

  if (shouldSync && channel) {
    const synced = await tryYoutubeSync(show, channel);
    if (synced.items.length > 0 && commentsAreFromYoutube(synced.items)) {
      return { items: synced.items };
    }
    return { items: [], syncError: synced.error ?? "Could not import comments from YouTube" };
  }

  return { items };
}

async function writeDrafts(
  show: ShowRun,
  channel: YtChannel | null,
  items: CommentReply[],
  force: boolean
): Promise<void> {
  if (!commentsAreFromYoutube(items)) return;

  const targets = items.filter((c) => needsNewDraft(c, force));
  if (!targets.length) return;

  const drafts = await generateCommentReplyDrafts(show, channel, targets);

  for (const comment of targets) {
    if (!drafts.get(comment.id)?.trim()) {
      drafts.set(comment.id, draftReplyForComment(show, comment, channel));
    }
  }

  await runWithDb(() => persistDrafts(drafts));
}

export type ReplayCommentQueueResult = {
  items: CommentReply[];
  syncError?: string;
  fromYoutube: boolean;
};

/** Real YouTube comments only — no sample threads. */
export async function ensureReplayCommentQueue(
  show: ShowRun,
  channel: YtChannel | null,
  opts?: { force?: boolean; syncYoutube?: boolean }
): Promise<ReplayCommentQueueResult> {
  if (!isReplayShowView(show)) {
    const items = await listCommentReplies(show.id);
    return { items, fromYoutube: commentsAreFromYoutube(items) };
  }

  const { items, syncError } = await ensureCommentsExist(show, channel, {
    syncYoutube: opts?.syncYoutube ?? true,
  });
  await writeDrafts(show, channel, items, opts?.force ?? false);
  const final = sortCommentsByEngagement(await listCommentReplies(show.id));
  return {
    items: final,
    syncError,
    fromYoutube: commentsAreFromYoutube(final),
  };
}
