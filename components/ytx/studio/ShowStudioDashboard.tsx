"use client";

import type { CommentReply, CrossPostItem, IgCarouselDraft, ShowRun, YtChannel } from "@/lib/types";
import type { ShowNextStep } from "@/lib/showNextStep";
import { hasLinkedYoutubeVideo } from "@/lib/showMedia";
import { ShowNextStepCard } from "@/components/ytx/ShowNextStepCard";
import { ShowStudioAutofillPreview } from "@/components/ytx/studio/ShowStudioAutofillPreview";
import { ShowStudioPromote } from "@/components/ytx/studio/ShowStudioPromote";
import {
  LifecycleProgressBar,
  type LifecycleRunProgress,
} from "@/components/ytx/LifecycleProgressBar";

export function ShowStudioDashboard({
  show,
  channel,
  nextStep,
  lifecycleMsg,
  runProgress,
  runModeLabel,
  showBlocked,
  autoBootstrapping,
  crossPosts,
  commentItems,
  igCarousel,
  onRunPreview,
  onRunFull,
  onLinkVideo,
  onReviewQc,
  onClearBlocked,
  onOpenTab,
  onScrollToPromote,
  promoteBusy,
  onGenerateCrossPosts,
  onGenerateIgCarousel,
  onApproveIgCarousel,
  onRejectIgCarousel,
}: {
  show: ShowRun;
  channel: YtChannel | null;
  nextStep: ShowNextStep;
  lifecycleMsg: string | null;
  runProgress: LifecycleRunProgress;
  runModeLabel: string;
  showBlocked?: boolean;
  autoBootstrapping?: boolean;
  crossPosts: CrossPostItem[];
  commentItems: CommentReply[];
  igCarousel: IgCarouselDraft | null;
  onRunPreview: () => void;
  onRunFull: () => void;
  onLinkVideo: () => void;
  onReviewQc: () => void;
  onClearBlocked?: () => void;
  onOpenTab: (tab: "details" | "checks" | "visibility" | "community" | "video-elements") => void;
  onScrollToPromote?: () => void;
  promoteBusy: string | null;
  onGenerateCrossPosts: () => void;
  onGenerateIgCarousel: () => void;
  onApproveIgCarousel: () => void;
  onRejectIgCarousel: () => void;
}) {
  const draftsReady = show.thumbnailVariant === "brief_ready" || Boolean(show.seoTitle && show.seoDescription);

  return (
    <div className="ytx-studio-stack">
      <ShowNextStepCard
        next={nextStep}
        showBlocked={showBlocked}
        onClearBlocked={onClearBlocked}
        onRunPreview={onRunPreview}
        onRunFull={onRunFull}
        onLinkVideo={onLinkVideo}
        onReviewQc={onReviewQc}
      />

      {(runProgress.running || autoBootstrapping) ? (
        <LifecycleProgressBar progress={runProgress} modeLabel={runModeLabel} />
      ) : null}

      {lifecycleMsg ? <p className="text-sm text-accent px-1">{lifecycleMsg}</p> : null}

      <ShowStudioAutofillPreview
        show={show}
        channel={channel}
        crossPostCount={crossPosts.length}
        commentCount={commentItems.length}
        hasIgCarousel={Boolean(igCarousel)}
        preparing={autoBootstrapping || (!draftsReady && !show.seoTitle)}
        onOpenTab={onOpenTab}
        onScrollToPromote={onScrollToPromote}
      />

      <ShowStudioPromote
        crossPosts={crossPosts}
        igCarousel={igCarousel}
        busy={promoteBusy}
        onGenerateCrossPosts={onGenerateCrossPosts}
        onGenerateIgCarousel={onGenerateIgCarousel}
        onApproveIgCarousel={onApproveIgCarousel}
        onRejectIgCarousel={onRejectIgCarousel}
      />

      {!hasLinkedYoutubeVideo(show) ? (
        <p className="text-xs text-dim text-center px-2">
          Upload in YouTube Studio first, then paste the link under{" "}
          <button type="button" className="text-accent hover:underline" onClick={() => onOpenTab("visibility")}>
            Visibility
          </button>
          .
        </p>
      ) : null}
    </div>
  );
}
