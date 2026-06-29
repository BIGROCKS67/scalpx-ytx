"use client";

import Link from "next/link";
import type { ShowRun, YtChannel } from "@/lib/types";
import { PIPELINE_LABELS } from "@/lib/pipelines";
import { statusLabel } from "@/lib/dashboardInsights";
import { channelInitial, showStatusTone, showThumbnailUrl } from "@/lib/showMedia";
import { ChannelAvatar } from "@/components/ytx/ChannelAvatar";
import { Badge } from "@/components/ui";

export function ShowVideoCard({ show, channel }: { show: ShowRun; channel?: YtChannel }) {
  const thumb = showThumbnailUrl(show);
  const channelName = channel?.displayName ?? "Channel";
  const when = show.scheduledAt
    ? new Date(show.scheduledAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <Link href={`/shows/${show.id}`} className="ytx-show-card group">
      <div className="ytx-show-card-thumb">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="ytx-show-card-img" loading="lazy" />
        ) : (
          <div className="ytx-show-card-placeholder">
            <span className="text-2xl font-bold text-white/20">{channelInitial(channelName)}</span>
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
      <div className="ytx-show-card-body">
        <ChannelAvatar channel={channel} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="ytx-show-card-title">{show.title}</p>
          <p className="ytx-show-card-meta">{channelName}</p>
          <p className="ytx-show-card-meta">
            {PIPELINE_LABELS[show.pipeline]}
            {when ? ` · ${when}` : ""}
            {!show.youtubeVideoId ? " · No video linked" : ""}
          </p>
        </div>
      </div>
    </Link>
  );
}
