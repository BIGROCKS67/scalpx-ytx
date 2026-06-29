"use client";

import type { CommentReply, CrossPostItem, IgCarouselDraft, ShowRun, YtChannel } from "@/lib/types";
import { buildShowDraftIntel } from "@/lib/showDraftIntel";
import { extractTopicsFromTitle } from "@/lib/insights/channelDna";

export function ShowStudioAutofillPreview({
  show,
  channel,
  crossPostCount,
  commentCount,
  hasIgCarousel,
  preparing,
  onOpenTab,
  onScrollToPromote,
}: {
  show: ShowRun;
  channel: YtChannel | null;
  crossPostCount: number;
  commentCount: number;
  hasIgCarousel: boolean;
  preparing?: boolean;
  onOpenTab: (tab: "details" | "video-elements" | "community" | "visibility") => void;
  onScrollToPromote?: () => void;
}) {
  const title = show.seoTitle ?? show.title;
  const description = show.seoDescription ?? "";
  const tags = show.seoTags ?? extractTopicsFromTitle(show.title);
  const intel = channel ? buildShowDraftIntel(show, channel) : null;
  const descPreview = description.split("\n").filter(Boolean).slice(0, 4).join("\n");

  return (
    <section className="ytx-autofill-preview">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <p className="ytx-autofill-label">Your YouTube draft</p>
          <h3 className="text-sm font-semibold text-ink mt-1">
            {preparing ? "Filling in title, description, tags…" : "Copy these into YouTube Studio → Details"}
          </h3>
          {intel && !preparing ? (
            <p className="text-xs text-dim mt-1">{intel.styleNote}</p>
          ) : null}
        </div>
        {!preparing && show.thumbnailVariant === "brief_ready" ? (
          <span className="ytx-studio-autofill-badge">Ready</span>
        ) : null}
      </div>

      {intel?.topics.length ? (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {intel.topics.map((t) => (
            <span key={t} className="ytx-trend-chip-sm">
              {t}
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <button type="button" className="ytx-autofill-block text-left" onClick={() => onOpenTab("details")}>
          <p className="ytx-autofill-label">YouTube title</p>
          <p className="text-sm font-medium text-ink leading-snug mt-1">{title}</p>
        </button>

        <button
          type="button"
          className="ytx-autofill-block text-left"
          onClick={() => onOpenTab("visibility")}
        >
          <p className="ytx-autofill-label">Visibility</p>
          <p className="text-sm text-ink mt-1 capitalize">{show.status === "scheduled" ? "Unlisted until go-live" : show.status}</p>
          {show.scheduledAt ? (
            <p className="text-xs text-dim mt-1">
              Scheduled {new Date(show.scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </p>
          ) : null}
        </button>
      </div>

      <button type="button" className="ytx-autofill-block text-left w-full mt-3" onClick={() => onOpenTab("details")}>
        <p className="ytx-autofill-label">Description</p>
        <p className="text-sm text-dim mt-1 whitespace-pre-wrap leading-relaxed line-clamp-5">
          {descPreview || "Generating from your show title and channel style…"}
        </p>
      </button>

      {tags.length ? (
        <div className="mt-3">
          <p className="ytx-autofill-label mb-1.5">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 12).map((tag) => (
              <span key={tag} className="ytx-trend-chip-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3 mt-4 pt-4 border-t border-white/6">
        <button
          type="button"
          className="ytx-autofill-mini"
          onClick={() => onScrollToPromote?.()}
        >
          <span className="font-mono text-accent">{crossPostCount || "—"}</span>
          <span className="text-xs text-dim">social drafts</span>
        </button>
        <button type="button" className="ytx-autofill-mini" onClick={() => onOpenTab("community")}>
          <span className="font-mono text-accent">{commentCount || "—"}</span>
          <span className="text-xs text-dim">comment replies</span>
        </button>
        <button type="button" className="ytx-autofill-mini" onClick={() => onOpenTab("video-elements")}>
          <span className="font-mono text-accent">{show.liveChapters.length || "—"}</span>
          <span className="text-xs text-dim">video elements</span>
        </button>
      </div>

      {intel?.hookLine ? (
        <p className="text-xs text-dim mt-3 italic">{intel.hookLine}</p>
      ) : null}
    </section>
  );
}
