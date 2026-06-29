"use client";

import type { LifecycleStepSnapshot } from "@/lib/lifecycleProgress";
import {
  lifecycleStepLabel,
  stepUiState,
  type StepUiState,
} from "@/lib/lifecycleProgress";

export type LifecycleRunProgress = {
  plan: string[];
  activeStep: string | null;
  completed: Map<string, LifecycleStepSnapshot>;
  running: boolean;
  runOk: boolean | null;
};

export function createEmptyRunProgress(): LifecycleRunProgress {
  return {
    plan: [],
    activeStep: null,
    completed: new Map(),
    running: false,
    runOk: null,
  };
}

function stateIcon(state: StepUiState): string {
  switch (state) {
    case "running":
      return "●";
    case "done":
      return "✓";
    case "failed":
      return "✗";
    case "skipped":
      return "–";
    default:
      return "○";
  }
}

function stateClass(state: StepUiState): string {
  switch (state) {
    case "running":
      return "ytx-lifecycle-step-running";
    case "done":
      return "ytx-lifecycle-step-done";
    case "failed":
      return "ytx-lifecycle-step-failed";
    case "skipped":
      return "ytx-lifecycle-step-skipped";
    default:
      return "ytx-lifecycle-step-pending";
  }
}

export function LifecycleProgressBar({
  progress,
  modeLabel,
}: {
  progress: LifecycleRunProgress;
  modeLabel: string;
}) {
  if (!progress.running && progress.plan.length === 0) return null;

  const doneCount = progress.plan.filter((id) => {
    const s = progress.completed.get(id);
    return s && (s.ok || s.proof === "skipped" || s.proof === "draft_only");
  }).length;
  const pct =
    progress.plan.length > 0
      ? Math.round((doneCount / progress.plan.length) * 100)
      : 0;

  return (
    <section className="track-panel mb-4 ytx-lifecycle-progress" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">
            {progress.running ? `${modeLabel} in progress…` : progress.runOk ? "Run complete" : "Run finished"}
          </h2>
          <p className="text-xs text-dim mt-0.5">
            {doneCount}/{progress.plan.length} steps
            {progress.activeStep && progress.running
              ? ` · ${lifecycleStepLabel(progress.activeStep)}`
              : ""}
          </p>
        </div>
        <span className="text-sm font-mono text-accent tabular-nums">{pct}%</span>
      </div>

      <div className="ytx-lifecycle-track mb-4">
        <div className="ytx-lifecycle-track-fill" style={{ width: `${pct}%` }} />
      </div>

      <ol className="ytx-lifecycle-steps">
        {progress.plan.map((stepId) => {
          const state = stepUiState(stepId, progress.completed, progress.activeStep);
          const step = progress.completed.get(stepId);
          return (
            <li key={stepId} className={`ytx-lifecycle-step ${stateClass(state)}`}>
              <span className="ytx-lifecycle-step-icon" aria-hidden>
                {state === "running" ? (
                  <span className="ytx-lifecycle-spinner" />
                ) : (
                  stateIcon(state)
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{lifecycleStepLabel(stepId)}</p>
                {step?.detail ? (
                  <p className="text-xs text-dim mt-0.5 truncate">{step.detail}</p>
                ) : state === "running" ? (
                  <p className="text-xs text-dim mt-0.5">Working…</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
