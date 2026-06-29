"use client";

import Link from "next/link";
import type { YoutubeDashboardAnalytics } from "@/lib/youtube/dashboardAnalytics";
import { formatCompactCount, formatRelativeDate } from "@/lib/formatNumbers";
import { ChannelAvatar } from "@/components/ytx/ChannelAvatar";
import { Badge } from "@/components/ui";

export function YoutubeAnalyticsSection({
  analytics,
  loading,
}: {
  analytics?: YoutubeDashboardAnalytics | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <section className="track-panel mb-6">
        <h2 className="text-sm font-semibold text-ink mb-4">YouTube performance</h2>
        <div className="ytx-yt-channel-grid mb-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="ytx-yt-channel-card ytx-show-card-skeleton min-h-[88px]" />
          ))}
        </div>
        <div className="ytx-show-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="ytx-show-card-skeleton min-h-[180px]" />
          ))}
        </div>
      </section>
    );
  }

  if (!analytics?.ok) {
    return (
      <section className="track-panel mb-6">
        <h2 className="text-sm font-semibold text-ink mb-2">YouTube performance</h2>
        <p className="text-sm text-dim">
          {analytics?.error ?? "YouTube stats unavailable"} — add API key in Settings and sync roster.
        </p>
      </section>
    );
  }

  return (
    <section className="track-panel mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">YouTube performance</h2>
          <p className="text-xs text-dim mt-0.5">
            Live from YouTube Data API · Chento Trades + Crypto Banter
          </p>
        </div>
        <Badge tone="good">YouTube API</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mb-5">
        <div className="ytx-yt-stat-pill">
          <p className="text-xs text-dim">Combined subscribers</p>
          <p className="text-xl font-bold font-mono text-ink tabular-nums">
            {formatCompactCount(analytics.totals.subscribers)}
          </p>
        </div>
        <div className="ytx-yt-stat-pill">
          <p className="text-xs text-dim">Lifetime channel views</p>
          <p className="text-xl font-bold font-mono text-ink tabular-nums">
            {formatCompactCount(analytics.totals.views)}
          </p>
        </div>
        <div className="ytx-yt-stat-pill">
          <p className="text-xs text-dim">Recent upload views</p>
          <p className="text-xl font-bold font-mono text-ink tabular-nums">
            {formatCompactCount(analytics.totals.recentVideoViews)}
          </p>
        </div>
      </div>

      <div className="ytx-yt-channel-grid mb-5">
        {analytics.channels.map((ch) => (
          <div key={ch.channelId} className="ytx-yt-channel-card">
            <div className="flex items-center gap-2">
              <ChannelAvatar
                channel={{ displayName: ch.displayName, avatarUrl: ch.avatarUrl }}
                size="md"
              />
              <p className="text-sm font-semibold text-ink">{ch.displayName}</p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-dim">
              <span>{formatCompactCount(ch.subscribers)} subs</span>
              <span>{formatCompactCount(ch.totalViews)} views</span>
              <span>{formatCompactCount(ch.videoCount)} videos</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-dim">Recent uploads</h3>
        <Link href="/shows" className="text-xs text-accent hover:underline">
          All shows
        </Link>
      </div>

      <div className="ytx-show-grid">
        {analytics.recentVideos.map((video) => {
          const href = video.showId ? `/shows/${video.showId}` : video.watchUrl;
          const external = !video.showId;
          return (
            <Link
              key={video.videoId}
              href={href}
              className="ytx-show-card group"
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              <div className="ytx-show-card-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={video.thumbnailUrl} alt="" className="ytx-show-card-img" loading="lazy" />
                <span className="ytx-yt-view-badge">{formatCompactCount(video.viewCount)} views</span>
              </div>
              <div className="ytx-show-card-body">
                <div className="min-w-0 flex-1">
                  <p className="ytx-show-card-title">{video.title}</p>
                  <p className="ytx-show-card-meta">{video.channelName}</p>
                  <p className="ytx-show-card-meta">
                    {formatRelativeDate(video.publishedAt)}
                    {video.likeCount != null ? ` · ${formatCompactCount(video.likeCount)} likes` : ""}
                    {video.showId ? " · In YTX" : ""}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
