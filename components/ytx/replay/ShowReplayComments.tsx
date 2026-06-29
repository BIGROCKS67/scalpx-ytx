"use client";

import Link from "next/link";
import type { CommentReply } from "@/lib/types";
import { formatCompactCount } from "@/lib/formatNumbers";
import { topComments } from "@/lib/commentIntel";
import { Badge, Button } from "@/components/ui";

function CommentRow({
  comment,
  rank,
  onUpdateReply,
  onApprove,
  onSkip,
}: {
  comment: CommentReply;
  rank: number;
  onUpdateReply: (id: string, reply: string) => void;
  onApprove: (id: string) => void;
  onSkip: (id: string) => void;
}) {
  return (
    <li className="ytx-replay-comment">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="ytx-replay-rank">#{rank}</span>
          <p className="text-xs font-semibold text-accent truncate">{comment.authorHint}</p>
          {comment.commentSource === "youtube" ? (
            <span className="text-[10px] uppercase tracking-wider text-dim">YouTube</span>
          ) : comment.commentSource === "demo" ? (
            <span className="text-[10px] uppercase tracking-wider text-amber-200/80">Sample</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-[11px] text-dim font-mono">
            {formatCompactCount(comment.likeCount)} likes · {formatCompactCount(comment.replyCount)} replies
          </span>
          <Badge tone={comment.status === "approved" ? "good" : comment.status === "posted" ? "good" : "neutral"}>
            {comment.status}
          </Badge>
        </div>
      </div>
      <p className="text-sm text-ink leading-relaxed">{comment.commentText}</p>
      <label className="ytx-studio-label mt-3 block">Your reply</label>
      <textarea
        className="ytx-input w-full min-h-[80px] text-sm mt-1"
        value={comment.draftReply}
        onChange={(e) => onUpdateReply(comment.id, e.target.value)}
        placeholder="Draft reply…"
      />
      <div className="flex flex-wrap gap-2 mt-3">
        <Button size="sm" variant="secondary" onClick={() => onApprove(comment.id)}>
          Approve reply
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onSkip(comment.id)}>
          Skip
        </Button>
      </div>
    </li>
  );
}

export function ShowReplayComments({
  items,
  busy,
  fromYoutube,
  canPullYoutube,
  syncError,
  onPullFromYoutube,
  onRegenerateReplies,
  onUpdateReply,
  onApprove,
  onSkip,
}: {
  items: CommentReply[];
  busy: boolean;
  fromYoutube: boolean;
  canPullYoutube: boolean;
  syncError?: string | null;
  onPullFromYoutube: () => void;
  onRegenerateReplies: () => void;
  onUpdateReply: (id: string, reply: string) => void;
  onApprove: (id: string) => void;
  onSkip: (id: string) => void;
}) {
  const top = topComments(items, 10);
  const pending = top.filter((c) => c.status === "pending").length;
  const rest = items.length > top.length ? items.length - top.length : 0;
  const hasSampleComments = items.some((c) => c.commentSource !== "youtube");

  const heading = fromYoutube
    ? "Real YouTube comments"
    : hasSampleComments
      ? "Sample comments (preview)"
      : "YouTube comments";

  const subheading = fromYoutube
    ? "Pulled from YouTube — top threads by relevance. Approve AI replies, then post in Studio."
    : hasSampleComments
      ? "These are placeholders — link the video and pull from YouTube for real threads."
      : "Link the watch URL, then pull top comments from YouTube (API key or OAuth).";

  return (
    <section className="ytx-replay-comments">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="ytx-autofill-label">Top comments</p>
          <h2 className="text-base font-semibold text-ink mt-1">{heading}</h2>
          <p className="text-xs text-dim mt-1">{subheading}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {canPullYoutube ? (
            <Button size="sm" disabled={busy} onClick={onPullFromYoutube}>
              {busy ? "Pulling…" : "Pull from YouTube"}
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" disabled={busy || !items.length} onClick={onRegenerateReplies}>
            {busy ? "Writing replies…" : "Regenerate replies (AI)"}
          </Button>
        </div>
      </header>

      {!fromYoutube && hasSampleComments ? (
        <div className="ytx-show-status-banner ytx-show-status-banner-warn mb-4 text-sm">
          Comments marked <strong className="font-semibold">Sample</strong> are not from YouTube. Paste the watch URL,
          add an API key in <Link href="/settings" className="text-accent hover:underline">Settings</Link> or connect
          OAuth on{" "}
          <Link href="/channels" className="text-accent hover:underline">
            Roster
          </Link>
          , then click <strong className="font-semibold">Pull from YouTube</strong>.
        </div>
      ) : !fromYoutube ? (
        <div className="ytx-show-status-banner ytx-show-status-banner-warn mb-4 text-sm">
          Paste the real YouTube watch URL on this show, then click{" "}
          <strong className="font-semibold">Pull from YouTube</strong>. Works with your API key in{" "}
          <Link href="/settings" className="text-accent hover:underline">Settings</Link> — OAuth on{" "}
          <Link href="/channels" className="text-accent hover:underline">Roster</Link> is optional for reading
          comments.
        </div>
      ) : (
        <div className="ytx-show-status-banner ytx-show-status-banner-info mb-4 text-sm">
          Comments synced from YouTube API — author names and text match the live video.
        </div>
      )}

      {syncError ? (
        <p className="text-xs text-amber-200/90 mb-3">YouTube sync: {syncError}</p>
      ) : null}

      {top.length ? (
        <>
          <p className="text-xs text-dim mb-3">
            {pending} pending · {top.length - pending} reviewed
            {rest ? ` · ${rest} more in full list below` : ""}
          </p>
          <ul className="space-y-3">
            {top.map((comment, i) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                rank={i + 1}
                onUpdateReply={onUpdateReply}
                onApprove={onApprove}
                onSkip={onSkip}
              />
            ))}
          </ul>
        </>
      ) : (
        <div className="ytx-replay-empty">
          <p className="text-sm text-dim">
            No comments loaded yet.
            {canPullYoutube ? " Link the video if needed, then pull from YouTube." : " Paste the watch URL on this show first."}
          </p>
          {canPullYoutube ? (
            <Button size="sm" className="mt-3" disabled={busy} onClick={onPullFromYoutube}>
              Pull from YouTube
            </Button>
          ) : null}
        </div>
      )}

      {rest > 0 ? (
        <details className="ytx-replay-more mt-4">
          <summary className="text-xs text-dim cursor-pointer hover:text-ink">
            Show {rest} more comment{rest === 1 ? "" : "s"}
          </summary>
          <ul className="space-y-3 mt-3">
            {items
              .filter((c) => !top.some((t) => t.id === c.id))
              .map((comment, i) => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  rank={top.length + i + 1}
                  onUpdateReply={onUpdateReply}
                  onApprove={onApprove}
                  onSkip={onSkip}
                />
              ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
