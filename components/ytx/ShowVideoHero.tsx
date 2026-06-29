"use client";

import type { ReactNode } from "react";
import type { ShowRun, YtChannel } from "@/lib/types";
import { PIPELINE_LABELS } from "@/lib/pipelines";
import { statusLabel } from "@/lib/dashboardInsights";
import {
  hasLinkedYoutubeVideo,
  showStatusTone,
  showThumbnailUrl,
  showYoutubeWatchUrl,
} from "@/lib/showMedia";
import { ChannelAvatar } from "@/components/ytx/ChannelAvatar";
import { ShowThumbnailPlaceholder } from "@/components/ytx/ShowThumbnailPlaceholder";
import { Badge } from "@/components/ui";

export function ShowVideoHero({
  show,
  channel,
  progressPct,
  actions,
  statusOverride,
  compact = false,
}: {
  show: ShowRun;
  channel?: YtChannel | null;
  progressPct?: number;
  actions?: ReactNode;
  /** Softer badge when blocked status is stale (e.g. preview ready). */
  statusOverride?: ShowRun["status"];
  /** Slim header — no large thumb, no progress bar (use sidebar). */
  compact?: boolean;
}) {
  const linked = hasLinkedYoutubeVideo(show);
  const thumb = showThumbnailUrl(show);
  const channelName = channel?.displayName ?? "Channel";
  const badgeStatus = statusOverride ?? show.status;
  const when = show.scheduledAt
    ? new Date(show.scheduledAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <section className={`ytx-show-hero ${compact ? "ytx-show-hero-compact mb-4" : "mb-6"}`}>
      <div className={`ytx-show-hero-layout ${compact ? "ytx-show-hero-layout-compact" : ""}`}>
        {!compact ? (
          <div className="ytx-show-hero-player-wrap">
            <div className="ytx-show-hero-player">
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="ytx-show-hero-img" />
              ) : (
                <ShowThumbnailPlaceholder channel={channel} variant="hero" />
              )}
              <div className="ytx-show-card-badges">
                {badgeStatus === "live" ? (
                  <span className="ytx-show-card-live">LIVE</span>
                ) : (
                  <Badge tone={showStatusTone(badgeStatus)}>{statusLabel(badgeStatus)}</Badge>
                )}
              </div>
            </div>
            {linked ? (
              <a
                href={showYoutubeWatchUrl(show.youtubeVideoId!)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline mt-2 inline-block"
              >
                Open on YouTube ↗
              </a>
            ) : null}
          </div>
        ) : (
          <div className="ytx-show-hero-thumb-compact">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" className="ytx-show-hero-img" />
            ) : (
              <ShowThumbnailPlaceholder channel={channel} variant="card" />
            )}
          </div>
        )}

        <div className="ytx-show-hero-info">
          <div className="flex flex-wrap items-start gap-2 mb-1">
            {compact ? (
              badgeStatus === "live" ? (
                <span className="ytx-show-card-live">LIVE</span>
              ) : (
                <Badge tone={showStatusTone(badgeStatus)}>{statusLabel(badgeStatus)}</Badge>
              )
            ) : null}
          </div>
          <h1 className={compact ? "ytx-show-hero-title-compact" : "ytx-show-hero-title"}>{show.title}</h1>
          <div className="ytx-show-hero-channel">
            <ChannelAvatar channel={channel} size={compact ? "sm" : "lg"} />
            <div className="min-w-0">
              <p className={`font-medium text-ink ${compact ? "text-sm" : "text-sm"}`}>{channelName}</p>
              <p className="text-xs text-dim">
                {PIPELINE_LABELS[show.pipeline]}
                {show.guestName ? ` · ${show.guestName}` : ""}
                {when ? ` · ${when}` : ""}
              </p>
            </div>
          </div>
          {!compact && typeof progressPct === "number" ? (
            <div className="ytx-show-hero-progress">
              <div className="flex justify-between text-xs text-dim mb-1">
                <span>Lifecycle progress</span>
                <span className="font-mono text-ink">{progressPct}%</span>
              </div>
              <div className="ytx-progress-track">
                <div className="ytx-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          ) : null}
          {actions ? <div className="ytx-show-hero-actions">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}
