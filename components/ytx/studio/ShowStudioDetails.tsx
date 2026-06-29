"use client";

import type { SeoPack, ShowRun } from "@/lib/types";
import { Button } from "@/components/ui";

export function ShowStudioDetails({
  show,
  seoPack,
  busy,
  onGenerateSeo,
}: {
  show: ShowRun;
  seoPack: SeoPack | null;
  busy: boolean;
  onGenerateSeo: () => void;
}) {
  const title = show.seoTitle ?? seoPack?.titles[0] ?? show.title;
  const description = show.seoDescription ?? seoPack?.description ?? "";
  const tags = show.seoTags?.length ? show.seoTags : seoPack?.tags ?? [];

  return (
    <div className="ytx-studio-form space-y-5">
      <header className="ytx-studio-form-intro">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-ink">Details</h2>
          {show.seoTitle && show.seoDescription ? (
            <span className="ytx-studio-autofill-badge">Auto-filled</span>
          ) : null}
        </div>
        <p className="text-sm text-dim mt-1">
          Filled in automatically when you create a show — same fields as YouTube Studio. Edit in
          YouTube or run Publish to push updates.
        </p>
      </header>

      <div className="ytx-studio-field">
        <label className="ytx-studio-label">
          Title <span className="text-amber-300">(required)</span>
        </label>
        <div className="ytx-studio-readonly">{title}</div>
        {seoPack?.titles && seoPack.titles.length > 1 ? (
          <p className="text-xs text-dim mt-2">
            Alt titles: {seoPack.titles.slice(1, 3).join(" · ")}
          </p>
        ) : null}
      </div>

      <div className="ytx-studio-field">
        <label className="ytx-studio-label">Description</label>
        <div className="ytx-studio-readonly ytx-studio-readonly-tall whitespace-pre-wrap">
          {description || "Run Prepare everything to generate a description."}
        </div>
      </div>

      <div className="ytx-studio-field">
        <label className="ytx-studio-label">Tags</label>
        {tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="ytx-trend-chip-sm">
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-dim">No tags yet — generate details first.</p>
        )}
      </div>

      <div className="ytx-studio-field">
        <label className="ytx-studio-label">Thumbnail</label>
        <p className="text-sm text-dim">
          {show.thumbnailVariant
            ? `Brief ready (${show.thumbnailVariant}) — upload the final image in YouTube Studio.`
            : "Thumbnail brief generates with SEO pack. Upload the image in YouTube Studio → Thumbnail."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/6">
        <Button disabled={busy} onClick={onGenerateSeo}>
          {busy ? "Refreshing…" : "Refresh details"}
        </Button>
      </div>
    </div>
  );
}
