"use client";

import Link from "next/link";
import type { TrendStreamInsights } from "@/lib/insights/trendStream";
import { formatCompactCount, formatRelativeDate } from "@/lib/formatNumbers";
import { ChannelAvatar } from "@/components/ytx/ChannelAvatar";
import { Badge } from "@/components/ui";

export function TrendStreamSection({
  trends,
  loading,
}: {
  trends?: TrendStreamInsights | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <section className="track-panel mb-6">
        <h2 className="text-sm font-semibold text-ink mb-4">Viral & stream ready</h2>
        <div className="ytx-trend-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="ytx-show-card-skeleton min-h-[120px]" />
          ))}
        </div>
      </section>
    );
  }

  if (!trends?.ok) {
    return null;
  }

  return (
    <section className="track-panel mb-6 ytx-trend-section">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Viral & stream ready</h2>
          <p className="text-xs text-dim mt-0.5">
            What&apos;s hot on your uploads · what each channel usually posts · what to stream next
          </p>
        </div>
        {trends.crossTrendTopics.length ? (
          <div className="flex flex-wrap gap-1.5">
            {trends.crossTrendTopics.map((topic) => (
              <span key={topic} className="ytx-trend-chip">
                {topic}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-dim mb-3">
            Viral right now
          </h3>
          {trends.viralNow.length ? (
            <ul className="space-y-2">
              {trends.viralNow.map((pick) => {
                const href = pick.showId ? `/shows/${pick.showId}` : pick.watchUrl;
                const external = !pick.showId;
                return (
                  <li key={pick.videoId}>
                    <Link
                      href={href}
                      className="ytx-trend-viral-row group"
                      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pick.thumbnailUrl} alt="" className="ytx-trend-viral-thumb" loading="lazy" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink truncate group-hover:text-accent transition-colors">
                          {pick.title}
                        </p>
                        <p className="text-xs text-dim mt-0.5">
                          {pick.channelName} · {formatRelativeDate(pick.publishedAt)} ·{" "}
                          {formatCompactCount(pick.viewCount)} views
                        </p>
                        <p className="text-xs text-accent/90 mt-1">{pick.why}</p>
                      </div>
                      <Badge tone="good">Hot</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-dim">
              No outlier uploads in the last 14 days yet — sync roster for more history.
            </p>
          )}
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-dim mb-3">
            Channel rhythm
          </h3>
          <ul className="space-y-3">
            {trends.channelRhythm.map((rhythm) => (
              <li key={rhythm.channelId} className="ytx-trend-rhythm-card">
                <div className="flex items-center gap-2 mb-2">
                  <ChannelAvatar
                    channel={{ displayName: rhythm.displayName, avatarUrl: rhythm.avatarUrl }}
                    size="sm"
                  />
                  <p className="text-sm font-semibold text-ink">{rhythm.displayName}</p>
                </div>
                <p className="text-xs text-dim leading-relaxed">{rhythm.summary}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-dim">
                  <span>{rhythm.uploadsLast7Days} upload{rhythm.uploadsLast7Days === 1 ? "" : "s"} / 7d</span>
                  <span>~{formatCompactCount(rhythm.avgViewsRecent)} avg views</span>
                  <span>Lead format: {rhythm.dominantFormat}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-dim mb-3">
          Ready to stream
        </h3>
        <div className="ytx-trend-suggest-grid">
          {trends.streamReady.map((s, i) => (
            <div key={`${s.channelId}-${i}`} className="ytx-trend-suggest-card">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs text-dim">{s.channelName}</p>
                <Badge tone={s.urgency === "high" ? "warn" : s.urgency === "medium" ? "neutral" : "good"}>
                  {s.urgency === "high" ? "Go live" : s.format}
                </Badge>
              </div>
              <p className="text-sm font-semibold text-ink leading-snug">{s.title}</p>
              <p className="text-xs text-dim mt-2 leading-relaxed">{s.rationale}</p>
              {s.trendTopics.length ? (
                <div className="flex flex-wrap gap-1 mt-2">
                  {s.trendTopics.map((t) => (
                    <span key={t} className="ytx-trend-chip-sm">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
              <Link
                href={`/shows?channel=${s.channelId}&title=${encodeURIComponent(s.title)}&format=${s.format}`}
                className="inline-block mt-3 text-xs text-accent hover:underline"
              >
                Create show →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
