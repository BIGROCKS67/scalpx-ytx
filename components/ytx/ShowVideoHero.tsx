"use client";

import type { ReactNode } from "react";
import type { ShowRun, YtChannel } from "@/lib/types";
import { PIPELINE_LABELS } from "@/lib/pipelines";
import { statusLabel } from "@/lib/dashboardInsights";
import {
  showStatusTone,
  showThumbnailUrl,
  showYoutubeWatchUrl,
} from "@/lib/showMedia";
import { ChannelAvatar } from "@/components/ytx/ChannelAvatar";
import { Badge } from "@/components/ui";

export function ShowVideoHero({
  show,
  channel,
  progressPct,
  actions,
}: {
  show: ShowRun;
  channel?: YtChannel | null;
  progressPct?: number;
  actions?: ReactNode;
}) {
  const thumb = showThumbnailUrl(show);
  const channelName = channel?.displayName ?? "Channel";
  const when = show.scheduledAt
    ? new Date(show.scheduledAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <section className="ytx-show-hero mb-6">
      <div className="ytx-show-hero-layout">
        <div className="ytx-show-hero-player-wrap">
          <div className="ytx-show-hero-player">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" className="ytx-show-hero-img" />
            ) : (
              <div className="ytx-show-card-placeholder">
                <ChannelAvatar channel={channel} size="lg" />
                <p className="text-xs text-dim mt-2">Link a YouTube video below</p>
              </div>
            )}
            <div className="ytx-show-card-badges">
              {show.status === "live" ? (
                <span className="ytx-show-card-live">LIVE</span>
              ) : (
                <Badge tone={showStatusTone(show.status)}>{statusLabel(show.status)}</Badge>
              )}
            </div>
          </div>
          {show.youtubeVideoId ? (
            <a
              href={showYoutubeWatchUrl(show.youtubeVideoId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline mt-2 inline-block"
            >
              Open on YouTube ↗
            </a>
          ) : null}
        </div>

        <div className="ytx-show-hero-info">
          <h1 className="ytx-show-hero-title">{show.title}</h1>
          <div className="ytx-show-hero-channel">
            <ChannelAvatar channel={channel} size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{channelName}</p>
              <p className="text-xs text-dim">
                {PIPELINE_LABELS[show.pipeline]}
                {show.guestName ? ` · ${show.guestName}` : ""}
                {when ? ` · ${when}` : ""}
              </p>
            </div>
          </div>
          {typeof progressPct === "number" ? (
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
