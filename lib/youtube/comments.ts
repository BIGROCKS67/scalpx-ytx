import { randomUUID } from "crypto";
import { getDb, runWithDb } from "@/lib/db";
import type { CommentReply } from "@/lib/types";

const YT_API = "https://www.googleapis.com/youtube/v3";

async function resolveAccessToken(channelId: string): Promise<string | null> {
  const { getOAuthTokens } = await import("@/lib/store");
  const tokens = await getOAuthTokens(channelId);
  return tokens?.accessToken ?? null;
}

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

/** Import real YouTube comment threads for a video (OAuth required). Replaces existing rows. */
export async function syncCommentsFromYoutube(
  showRunId: string,
  channelId: string,
  videoId: string,
  maxResults = 10
): Promise<YoutubeCommentSyncResult> {
  const token = await resolveAccessToken(channelId);
  if (!token) {
    return {
      ok: false,
      imported: 0,
      items: listCommentRepliesSync(showRunId),
      error: "YouTube OAuth not connected for this channel",
    };
  }

  const qs = new URLSearchParams({
    part: "snippet",
    videoId,
    maxResults: String(maxResults),
    order: "relevance",
    textFormat: "plainText",
  });

  const res = await fetch(`${YT_API}/commentThreads?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return {
      ok: false,
      imported: 0,
      items: listCommentRepliesSync(showRunId),
      error: `YouTube API ${res.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`,
    };
  }

  const data = (await res.json()) as {
    items?: Array<{
      snippet?: {
        totalReplyCount?: number;
        topLevelComment?: {
          snippet?: {
            authorDisplayName?: string;
            textDisplay?: string;
            likeCount?: number;
          };
        };
      };
    }>;
  };

  const threads = data.items ?? [];
  if (!threads.length) {
    return {
      ok: false,
      imported: 0,
      items: listCommentRepliesSync(showRunId),
      error: "No comments returned — video may have comments disabled or none yet",
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
    for (const thread of threads) {
      const top = thread.snippet?.topLevelComment?.snippet;
      if (!top?.textDisplay) continue;
      stmt.run({
        id: randomUUID(),
        showRunId,
        authorHint: top.authorDisplayName ?? "YouTube viewer",
        commentText: top.textDisplay.slice(0, 2000),
        draftReply: "",
        likeCount: top.likeCount ?? 0,
        replyCount: thread.snippet?.totalReplyCount ?? 0,
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
