"use client";

import Link from "next/link";
import type { ShowNextStep } from "@/lib/showNextStep";
import { Button } from "@/components/ui";

export function ShowNextStepCard({
  next,
  onRunPreview,
  onRunFull,
  onLinkVideo,
  onReviewQc,
  onClearBlocked,
  showBlocked,
}: {
  next: ShowNextStep;
  onRunPreview: () => void;
  onRunFull: () => void;
  onLinkVideo: () => void;
  onReviewQc: () => void;
  onClearBlocked?: () => void;
  showBlocked?: boolean;
}) {
  const toneBorder =
    next.tone === "good"
      ? "border-accent/35 bg-accent/5"
      : next.tone === "warn"
        ? "border-amber-500/30 bg-amber-500/5"
        : "border-white/10 bg-white/[0.02]";

  function handleCta() {
    switch (next.cta) {
      case "run_preview":
        onRunPreview();
        break;
      case "run_full":
        onRunFull();
        break;
      case "link_video":
        onLinkVideo();
        break;
      case "review_qc":
        onReviewQc();
        break;
      default:
        break;
    }
  }

  return (
    <section className={`track-panel ytx-next-step ${toneBorder}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dim mb-1">
        Next step
      </p>
      <h2 className="text-lg font-bold text-ink tracking-tight">{next.headline}</h2>
      <p className="text-sm text-dim mt-2 max-w-2xl leading-relaxed">{next.body}</p>

      {showBlocked ? (
        <p className="text-xs text-amber-200/90 mt-3">
          Last run was marked blocked — that&apos;s OK for a new stream. Run preview again or tap reset.
          {onClearBlocked ? (
            <button
              type="button"
              className="ml-2 text-accent hover:underline"
              onClick={onClearBlocked}
            >
              Reset status
            </button>
          ) : null}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 mt-4">
        {next.cta === "done" ? (
          <Link href="/shows">
            <Button size="sm">{next.ctaLabel}</Button>
          </Link>
        ) : next.cta === "wait" ? (
          <Link href="/channels">
            <Button size="sm" variant="secondary">
              {next.ctaLabel}
            </Button>
          </Link>
        ) : (
          <Button
            size="md"
            className="min-w-[160px]"
            disabled={next.ctaLabel.startsWith("Running")}
            onClick={handleCta}
          >
            {next.ctaLabel}
          </Button>
        )}
      </div>
    </section>
  );
}
