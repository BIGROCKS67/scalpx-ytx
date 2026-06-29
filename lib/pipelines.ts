import { CHECKLIST_TASKS } from "@/lib/checklistTasks";
import type { ChecklistTaskDef, ShowPipeline } from "@/lib/types";

export type { ShowPipeline };

export const PIPELINE_LABELS: Record<ShowPipeline, string> = {
  live: "Live stream",
  prerecorded: "Pre-recorded",
};

/** Tasks that only apply to live streams (skipped on pre-recorded shows). */
export const LIVE_ONLY_TASK_IDS = new Set([
  "1.11",
  "1.12",
  "1.13",
  "2.3",
  "3.7",
  "1.14",
]);

export function isLiveOnlyTask(taskId: string): boolean {
  return LIVE_ONLY_TASK_IDS.has(taskId);
}

export function tasksForPipeline(pipeline: ShowPipeline): ChecklistTaskDef[] {
  if (pipeline === "live") return CHECKLIST_TASKS;
  return CHECKLIST_TASKS.filter((t) => !LIVE_ONLY_TASK_IDS.has(t.id));
}

export function defaultPipelineForFormat(format: string): ShowPipeline {
  return format === "education" ? "prerecorded" : "live";
}
