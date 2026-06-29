import type { ShowRun } from "@/lib/types";
import { hasLinkedYoutubeVideo } from "@/lib/showMedia";
import type { PreflightMode } from "@/lib/readiness/preflight";

export type ShowNextStep = {
  step: number;
  headline: string;
  body: string;
  cta: "run_preview" | "run_full" | "review_qc" | "link_video" | "done" | "wait";
  ctaLabel: string;
  tone: "good" | "warn" | "neutral";
};

export function computeShowNextStep(input: {
  show: ShowRun;
  progressPct: number;
  qcPending: number;
  preflightReady: boolean;
  runMode: PreflightMode;
  lifecycleRunning: boolean;
}): ShowNextStep {
  const { show, progressPct, qcPending, preflightReady, runMode, lifecycleRunning } = input;
  const hasVideo = hasLinkedYoutubeVideo(show);
  const running = lifecycleRunning ? "Running…" : null;
  const draftsReady =
    show.thumbnailVariant === "brief_ready" || (Boolean(show.seoTitle) && progressPct >= 55);

  if (show.status === "completed") {
    return {
      step: 4,
      headline: "Show archived",
      body: "This run is done. Create a new ShowRun on Shows for your next stream.",
      cta: "done",
      ctaLabel: "Back to shows",
      tone: "neutral",
    };
  }

  if (runMode === "full" && !preflightReady) {
    return {
      step: hasVideo ? 3 : 2,
      headline: hasVideo ? "Connect YouTube on Roster" : "Add your YouTube video link",
      body: hasVideo
        ? "YouTube Studio needs your channel connected before we can push title, description, and tags."
        : "Go to Visibility and paste your watch URL — same as after you upload in YouTube Studio.",
      cta: hasVideo ? "wait" : "link_video",
      ctaLabel: hasVideo ? "Open Roster" : "Go to Visibility",
      tone: "warn",
    };
  }

  if (qcPending > 0 && progressPct >= 40 && hasVideo) {
    return {
      step: 3,
      headline: `Review ${qcPending} comment reply draft${qcPending === 1 ? "" : "s"}`,
      body: "Optional — replies are already drafted. Approve in Community before you post on YouTube.",
      cta: "review_qc",
      ctaLabel: "Open Community",
      tone: "neutral",
    };
  }

  if (draftsReady && !hasVideo) {
    return {
      step: 2,
      headline: "Draft complete — add to YouTube when ready",
      body: `Title, description, tags, and social posts are filled for “${show.title.slice(0, 50)}”. Upload or go live in YouTube Studio, then paste the link under Visibility.`,
      cta: "link_video",
      ctaLabel: "Go to Visibility",
      tone: "good",
    };
  }

  if (show.status === "preview" || progressPct >= 55) {
    if (!hasVideo) {
      return {
        step: 3,
        headline: "Add your YouTube video link",
        body: "After you upload or go live in YouTube Studio, paste the link under Visibility.",
        cta: "link_video",
        ctaLabel: "Go to Visibility",
        tone: "neutral",
      };
    }
    return {
      step: 4,
      headline: "Publish to YouTube",
      body: "Pushes title, description, tags, and clips — like saving Details in YouTube Studio.",
      cta: "run_full",
      ctaLabel: running ?? "Publish now",
      tone: "good",
    };
  }

  return {
    step: 1,
    headline: preflightReady ? "Everything is prepared" : "Preparing your show…",
    body: preflightReady
      ? "Title, description, tags, and social drafts are filled in. Add your YouTube link under Visibility when ready."
      : "We auto-fill Details, Video elements, and checklist the moment you create a show.",
    cta: preflightReady ? "link_video" : "run_preview",
    ctaLabel: preflightReady ? "Go to Visibility" : running ?? "Prepare everything",
    tone: "good",
  };
}
