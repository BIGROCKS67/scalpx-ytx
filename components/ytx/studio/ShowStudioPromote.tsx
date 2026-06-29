"use client";

import type { CrossPostItem, IgCarouselDraft } from "@/lib/types";
import { Badge, Button } from "@/components/ui";

export function ShowStudioPromote({
  crossPosts,
  igCarousel,
  busy,
  onGenerateCrossPosts,
  onGenerateIgCarousel,
  onApproveIgCarousel,
  onRejectIgCarousel,
}: {
  crossPosts: CrossPostItem[];
  igCarousel: IgCarouselDraft | null;
  busy: string | null;
  onGenerateCrossPosts: () => void;
  onGenerateIgCarousel: () => void;
  onApproveIgCarousel: () => void;
  onRejectIgCarousel: () => void;
}) {
  return (
    <section id="studio-promote" className="ytx-autofill-preview">
      <header className="mb-4">
        <p className="ytx-autofill-label">Promote</p>
        <h3 className="text-sm font-semibold text-ink mt-1">Social drafts for this show</h3>
        <p className="text-xs text-dim mt-1">
          Not part of YouTube Video elements — copy these to X, Telegram, Instagram, etc. before
          go-live.
        </p>
      </header>

      <div className="space-y-4">
        <div className="ytx-video-element">
          <div className="ytx-video-element-head">
            <div>
              <h4 className="text-sm font-semibold text-ink">Cross-post queue</h4>
              <p className="text-xs text-dim mt-0.5">Pre-show posts for six platforms</p>
            </div>
            <Button size="sm" disabled={busy === "cross"} onClick={onGenerateCrossPosts}>
              {busy === "cross" ? "Generating…" : crossPosts.length ? "Refresh" : "Generate"}
            </Button>
          </div>
          {crossPosts.length ? (
            <div className="ytx-video-element-body grid gap-2 sm:grid-cols-2">
              {crossPosts.map((cp) => (
                <div key={cp.id} className="ytx-promote-card">
                  <p className="text-xs font-bold text-accent uppercase">{cp.platform}</p>
                  <p className="text-[11px] text-dim mt-1 line-clamp-4">{cp.draftBody}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-dim px-1 pb-1">Drafts generate when you prepare the show.</p>
          )}
        </div>

        <div className="ytx-video-element">
          <div className="ytx-video-element-head">
            <div>
              <h4 className="text-sm font-semibold text-ink">Instagram carousel</h4>
              <p className="text-xs text-dim mt-0.5">Slides + caption — approve before posting</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {igCarousel ? (
                <Badge tone={igCarousel.status === "approved" ? "good" : "warn"}>
                  {igCarousel.status}
                </Badge>
              ) : null}
              <Button size="sm" disabled={busy === "igcarousel"} onClick={onGenerateIgCarousel}>
                {busy === "igcarousel" ? "Generating…" : igCarousel ? "Refresh" : "Generate"}
              </Button>
            </div>
          </div>
          {igCarousel ? (
            <div className="ytx-video-element-body space-y-3">
              {igCarousel.slides.map((slide, i) => (
                <pre key={i} className="ytx-video-element-mono whitespace-pre-wrap">
                  {slide}
                </pre>
              ))}
              <p className="text-xs text-ink">{igCarousel.caption}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={onApproveIgCarousel}>
                  Approve
                </Button>
                <Button size="sm" variant="ghost" onClick={onRejectIgCarousel}>
                  Reject
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-dim px-1 pb-1">Hook slide, takeaway, and CTA for Instagram.</p>
          )}
        </div>
      </div>
    </section>
  );
}
