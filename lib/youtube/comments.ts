import { randomUUID } from "crypto";
import { getDb, runWithDb } from "@/lib/db";
import type { CommentReply } from "@/lib/types";
import { fetchVideoCommentThreads } from "@/lib/youtube/dataApi";

function listCommentRepliesSync(showRunId: string): CommentReply[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM comment_replies WHERE showRunId = ? ORDER BY likeCount DESC, replyCount DESC, createdAt DESC"
    )
    .all(showRunId) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    showRunId: row.showRunId as string,
    authorHint: (row.authorHint as string) ?? "",
    commentText: row.commentText as string,
    draftReply: (row.draftReply as string) ?? "",
    likeCount: Number(row.likeCount ?? 0),
    replyCount: Number(row.replyCount ?? 0),
    commentSource: (row.commentSource as CommentReply["commentSource"]) ?? "unknown",
    status: row.status as CommentReply["status"],
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  }));
}

export type YoutubeCommentSyncResult = {
  ok: boolean;
  items: CommentReply[];
  error?: string;
  imported: number;
};

/** Import real YouTube comment threads (OAuth or API key + linked video id). */
export async function syncCommentsFromYoutube(
  showRunId: string,
  channelId: string,
  videoId: string,
  maxResults = 10
): Promise<YoutubeCommentSyncResult> {
  const fetched = await fetchVideoCommentThreads(channelId, videoId, maxResults);
  if (!fetched.ok) {
    const error =
      fetched.error === "No YouTube credentials"
        ? "Add YouTube API key in Settings or connect OAuth on Roster"
        : fetched.error;
    return {
      ok: false,
      imported: 0,
      items: listCommentRepliesSync(showRunId),
      error,
    };
  }

  return runWithDb(() => {
    getDb().prepare("DELETE FROM comment_replies WHERE showRunId = ?").run(showRunId);

    const now = new Date().toISOString();
    const stmt = getDb().prepare(
      `INSERT INTO comment_replies (id, showRunId, authorHint, commentText, draftReply, likeCount, replyCount, commentSource, status, createdAt, updatedAt)
       VALUES (@id, @showRunId, @authorHint, @commentText, @draftReply, @likeCount, @replyCount, @commentSource, @status, @createdAt, @updatedAt)`
    );

    let imported = 0;
    for (const thread of fetched.threads) {
      stmt.run({
        id: randomUUID(),
        showRunId,
        authorHint: thread.authorDisplayName,
        commentText: thread.textDisplay.slice(0, 2000),
        draftReply: "",
        likeCount: thread.likeCount,
        replyCount: thread.replyCount,
        commentSource: "youtube",
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
      imported++;
    }

    const items = listCommentRepliesSync(showRunId);
    return { ok: imported > 0, items, imported, error: imported ? undefined : "No comment text in API response" };
  });
}
