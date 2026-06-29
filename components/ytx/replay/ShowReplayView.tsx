"use client";

import Link from "next/link";
import type { AnalyticsSnapshot, CommentReply, ShowRun, YtChannel } from "@/lib/types";
import { hasLinkedYoutubeVideo, showYoutubeWatchUrl } from "@/lib/showMedia";
import { canPullYoutubeComments } from "@/lib/youtube/commentSync";
import { ShowVideoHero } from "@/components/ytx/ShowVideoHero";
import { ShowReplayAnalytics } from "@/components/ytx/replay/ShowReplayAnalytics";
import { ShowReplayComments } from "@/components/ytx/replay/ShowReplayComments";
import { Button } from "@/components/ui";

export function ShowReplayView({
  show,
  channel,
  analytics,
  analyticsFromYoutube,
  analyticsSyncError,
  analyticsBusy,
  onSyncAnalytics,
  commentItems,
  commentsFromYoutube,
  commentSyncError,
  commentsBusy,
  youtubeUrlInput,
  onYoutubeUrlChange,
  onSaveYoutubeUrl,
  bindVideoBusy,
  onPullFromYoutube,
  onRegenerateReplies,
  onUpdateReply,
  onApproveComment,
  onSkipComment,
}: {
  show: ShowRun;
  channel: YtChannel | null;
  analytics: AnalyticsSnapshot[];
  analyticsFromYoutube: boolean;
  analyticsSyncError?: string | null;
  analyticsBusy: boolean;
  onSyncAnalytics: () => void;
  commentItems: CommentReply[];
  commentsFromYoutube: boolean;
  commentSyncError?: string | null;
  commentsBusy: boolean;
  youtubeUrlInput: string;
  onYoutubeUrlChange: (url: string) => void;
  onSaveYoutubeUrl: () => void;
  bindVideoBusy: boolean;
  onPullFromYoutube: () => void;
  onRegenerateReplies: () => void;
  onUpdateReply: (id: string, reply: string) => void;
  onApproveComment: (id: string) => void;
  onSkipComment: (id: string) => void;
}) {
  const linked = hasLinkedYoutubeVideo(show);
  const canPull = canPullYoutubeComments(show, channel);
  const pendingReplies = commentItems.filter((c) => c.status === "pending" && c.draftReply.trim()).length;

  return (
    <div className="ytx-replay-layout">
      <ShowVideoHero show={show} channel={channel} compact />

      {!linked ? (
        <div className="ytx-show-status-banner ytx-show-status-banner-warn mb-4">
          <p className="text-sm font-medium text-ink mb-2">Link the real YouTube video first</p>
          <p className="text-xs text-dim mb-3">
            Paste the watch URL for this stream — then Pull from YouTube works with your API key (Settings) or OAuth
            (Roster).
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              className="ytx-input flex-1 min-w-[220px] text-sm"
              placeholder="https://www.youtube.com/watch?v=…"
              value={youtubeUrlInput}
              onChange={(e) => onYoutubeUrlChange(e.target.value)}
            />
            <Button size="sm" disabled={bindVideoBusy || !youtubeUrlInput.trim()} onClick={onSaveYoutubeUrl}>
              {bindVideoBusy ? "Saving…" : "Save video URL"}
            </Button>
          </div>
        </div>
      ) : null}

      {pendingReplies > 0 ? (
        <div className="ytx-show-status-banner ytx-show-status-banner-info mb-4">
          {pendingReplies} draft repl{pendingReplies === 1 ? "y" : "ies"} ready — review below and approve to
          post on YouTube.
        </div>
      ) : null}

      <ShowReplayAnalytics
        analytics={analytics}
        fromYoutube={analyticsFromYoutube}
        syncError={analyticsSyncError}
        canRefresh={linked}
        busy={analyticsBusy}
        onRefresh={onSyncAnalytics}
      />

      <ShowReplayComments
        items={commentItems}
        busy={commentsBusy}
        fromYoutube={commentsFromYoutube}
        canPullYoutube={canPull}
        syncError={commentSyncError}
        onPullFromYoutube={onPullFromYoutube}
        onRegenerateReplies={onRegenerateReplies}
        onUpdateReply={onUpdateReply}
        onApprove={onApproveComment}
        onSkip={onSkipComment}
      />

      <footer className="ytx-replay-footer">
        {linked ? (
          <a
            href={showYoutubeWatchUrl(show.youtubeVideoId!)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline"
          >
            Open on YouTube ↗
          </a>
        ) : (
          <span className="text-xs text-dim">Link the real YouTube URL to pull actual comments</span>
        )}
        <Link href="/shows" className="text-sm text-dim hover:text-accent">
          ← Back to shows
        </Link>
        {!linked ? (
          <Link href="/channels" className="text-sm text-accent hover:underline">
            Connect YouTube on Roster →
          </Link>
        ) : null}
      </footer>
    </div>
  );
}
