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
    .prepare("SELECT * FROM comment_replies WHERE showRunId = ? ORDER BY createdAt DESC")
    .all(showRunId) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    showRunId: row.showRunId as string,
    authorHint: (row.authorHint as string) ?? "",
    commentText: row.commentText as string,
    draftReply: (row.draftReply as string) ?? "",
    status: row.status as CommentReply["status"],
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  }));
}

/** Import real YouTube comment threads for a video (OAuth required). */
export async function syncCommentsFromYoutube(
  showRunId: string,
  channelId: string,
  videoId: string,
  maxResults = 10
): Promise<CommentReply[]> {
  const token = await resolveAccessToken(channelId);
  if (!token) return [];

  const qs = new URLSearchParams({
    part: "snippet",
    videoId,
    maxResults: String(maxResults),
    order: "time",
    textFormat: "plainText",
  });

  const res = await fetch(`${YT_API}/commentThreads?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    items?: Array<{
      snippet?: {
        topLevelComment?: {
          snippet?: {
            authorDisplayName?: string;
            textDisplay?: string;
          };
        };
      };
    }>;
  };

  const threads = data.items ?? [];
  if (!threads.length) return listCommentRepliesSync(showRunId);

  return runWithDb(() => {
    const existing = getDb()
      .prepare("SELECT COUNT(*) as n FROM comment_replies WHERE showRunId = ?")
      .get(showRunId) as { n: number };
    if (existing.n > 0) return listCommentRepliesSync(showRunId);

    const now = new Date().toISOString();
    const stmt = getDb().prepare(
      `INSERT INTO comment_replies (id, showRunId, authorHint, commentText, draftReply, status, createdAt, updatedAt)
       VALUES (@id, @showRunId, @authorHint, @commentText, @draftReply, @status, @createdAt, @updatedAt)`
    );

    for (const thread of threads) {
      const top = thread.snippet?.topLevelComment?.snippet;
      if (!top?.textDisplay) continue;
      const author = top.authorDisplayName ?? "YouTube viewer";
      stmt.run({
        id: randomUUID(),
        showRunId,
        authorHint: author,
        commentText: top.textDisplay.slice(0, 2000),
        draftReply: "",
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
    }

    return listCommentRepliesSync(showRunId);
  });
}
