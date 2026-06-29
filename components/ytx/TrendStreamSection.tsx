"use client";

import Link from "next/link";
import { streamCreateHref, type TrendStreamInsights } from "@/lib/insights/trendStream";
import { formatCompactCount, formatRelativeDate } from "@/lib/formatNumbers";
import { ChannelAvatar } from "@/components/ytx/ChannelAvatar";
import { Badge } from "@/components/ui";

function topicStreamHref(trends: TrendStreamInsights, topic: string): string {
  const match = trends.streamReady.find((s) => s.trendTopics.includes(topic));
  if (match) {
    return streamCreateHref({
      channelId: match.channelId,
      title: match.title,
      format: match.format,
    });
  }
  return `/shows?title=${encodeURIComponent(`Live: ${topic}`)}&format=stream`;
}

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
            Trending uploads → stream ideas. When something spikes, queue a live follow-up before momentum
            fades.
          </p>
        </div>
        {trends.crossTrendTopics.length ? (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-dim self-center mr-1">Hot topics</span>
            {trends.crossTrendTopics.map((topic) => (
              <Link key={topic} href={topicStreamHref(trends, topic)} className="ytx-trend-chip">
                Stream {topic} →
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-dim mb-1">
            Trending — stream while it&apos;s hot
          </h3>
          <p className="text-xs text-dim mb-3 leading-relaxed">
            These uploads are outperforming. Each card is a signal to go live on the same topic before the
            algorithm moves on.
          </p>
          {trends.viralNow.length ? (
            <ul className="space-y-3">
              {trends.viralNow.map((pick) => {
                const uploadHref = pick.showId ? `/shows/${pick.showId}` : pick.watchUrl;
                const uploadExternal = !pick.showId;
                const streamHref = streamCreateHref({
                  channelId: pick.channelId,
                  title: pick.suggestedStream.title,
                  format: pick.suggestedStream.format,
                });

                return (
                  <li key={pick.videoId} className="ytx-trend-opportunity">
                    <div className="ytx-trend-opportunity-head">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pick.thumbnailUrl} alt="" className="ytx-trend-viral-thumb" loading="lazy" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink leading-snug">{pick.title}</p>
                        <p className="text-xs text-dim mt-0.5">
                          {pick.channelName} · {formatRelativeDate(pick.publishedAt)} ·{" "}
                          {formatCompactCount(pick.viewCount)} views
                        </p>
                        <p className="text-xs text-accent/90 mt-1">{pick.why}</p>
                      </div>
                      <Badge tone="good">Hot</Badge>
                    </div>

                    <div className="ytx-trend-opportunity-pitch">
                      <p className="ytx-trend-opportunity-label">Stream move</p>
                      <p className="text-xs text-ink leading-relaxed">{pick.streamPitch}</p>
                      <p className="text-xs font-medium text-accent mt-2 leading-snug">
                        Stream angle: {pick.suggestedStream.title}
                      </p>
                      {pick.suggestedStream.topics.length ? (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {pick.suggestedStream.topics.map((t) => (
                            <span key={t} className="ytx-trend-chip-sm">
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="ytx-trend-opportunity-actions">
                      <Link href={streamHref} className="ytx-trend-opportunity-cta">
                        Queue stream from this trend →
                      </Link>
                      <Link
                        href={uploadHref}
                        className="ytx-trend-opportunity-secondary"
                        {...(uploadExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      >
                        {uploadExternal ? "Watch upload ↗" : "View show →"}
                      </Link>
                    </div>
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
          <h3 className="text-xs font-semibold uppercase tracking-wider text-dim mb-1">Channel rhythm</h3>
          <p className="text-xs text-dim mb-3 leading-relaxed">
            What each channel usually posts — use this to pick format and topic when you hop on a trend.
          </p>
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
                  <span>
                    {rhythm.uploadsLast7Days} upload{rhythm.uploadsLast7Days === 1 ? "" : "s"} / 7d
                  </span>
                  <span>~{formatCompactCount(rhythm.avgViewsRecent)} avg views</span>
                  <span>Lead format: {rhythm.dominantFormat}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div id="stream-ideas">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-dim mb-1">More stream ideas</h3>
        <p className="text-xs text-dim mb-3 leading-relaxed">
          Cross-channel angles and alternate formats — for when you want a second stream or a different take
          on what&apos;s hot.
        </p>
        <div className="ytx-trend-suggest-grid">
          {trends.streamReady.map((s, i) => (
            <div key={`${s.channelId}-${i}`} className="ytx-trend-suggest-card">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs text-dim">{s.channelName}</p>
                <Badge tone={s.urgency === "high" ? "warn" : s.urgency === "medium" ? "neutral" : "good"}>
                  {s.urgency === "high" ? "Go live" : s.format}
                </Badge>
              </div>
              {s.inspiredBy ? (
                <p className="text-[10px] uppercase tracking-wider text-accent/80 mb-1">
                  From trend · {s.inspiredBy.slice(0, 52)}
                  {s.inspiredBy.length > 52 ? "…" : ""}
                </p>
              ) : null}
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
                href={streamCreateHref({
                  channelId: s.channelId,
                  title: s.title,
                  format: s.format,
                })}
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
