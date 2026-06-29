/** Client-safe lifecycle progress types and labels (no server imports). */

export type LifecycleStepSnapshot = {
  step: string;
  ok: boolean;
  detail?: string;
  proof?: "verified" | "draft_only" | "simulated" | "blocked" | "skipped";
};

export type PreflightMode = "full" | "metadata_only" | "preview";

export const LIFECYCLE_STEP_LABELS: Record<string, string> = {
  preflight: "Preflight checks",
  channel_setup: "Channel setup",
  seo_pack: "SEO pack",
  sponsor_block: "Sponsor block",
  cross_post: "Cross-post drafts",
  analytics: "Live analytics",
  live_chapters: "Live chapters",
  live_links: "Live description & links",
  clips: "Clips & Shorts",
  post_show: "Post-show SEO",
  comment_queue: "Comment queue",
  ig_carousel: "IG carousel",
};

export type LifecycleProgressEvent =
  | { type: "plan"; steps: string[]; mode: PreflightMode }
  | { type: "step_start"; step: string; label: string }
  | { type: "step"; step: LifecycleStepSnapshot; index: number }
  | { type: "complete"; ok: boolean };

export function lifecycleStepLabel(stepId: string): string {
  return LIFECYCLE_STEP_LABELS[stepId] ?? stepId.replace(/_/g, " ");
}

export type StepUiState = "pending" | "running" | "done" | "failed" | "skipped";

export function stepUiState(
  stepId: string,
  completed: Map<string, LifecycleStepSnapshot>,
  activeStep: string | null
): StepUiState {
  if (activeStep === stepId) return "running";
  const done = completed.get(stepId);
  if (!done) return "pending";
  if (done.proof === "skipped") return "skipped";
  if (!done.ok && done.proof !== "draft_only") return "failed";
  return "done";
}

export function isPreviewMode(mode: PreflightMode): boolean {
  return mode === "preview";
}

export function buildLifecycleStepPlan(
  show: { pipeline: string },
  mode: PreflightMode
): string[] {
  const plan = ["preflight", "channel_setup", "seo_pack", "sponsor_block", "cross_post"];

  if (show.pipeline === "live") {
    plan.push("analytics", "live_chapters", "live_links");
  } else {
    plan.push("analytics", "live_chapters", "live_links");
  }

  if (mode === "full" || isPreviewMode(mode)) {
    plan.push("clips");
  } else if (mode === "metadata_only") {
    plan.push("clips");
  }

  plan.push("post_show", "comment_queue", "ig_carousel");
  return plan;
}
