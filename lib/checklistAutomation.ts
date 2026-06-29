import { CHECKLIST_TASKS, taskById } from "@/lib/checklistTasks";
import { listChecklist, updateChecklistItem } from "@/lib/store";

/** Map YTX actions → checklist task IDs from the build spec. */
export const ACTION_TASKS = {
  channelSetup: ["3.1", "3.2"],
  channelTrailer: ["1.5"],
  seoPack: ["1.1", "1.2", "1.3"],
  thumbnailBrief: ["3.4"],
  sponsorBlock: ["2.1"],
  crossPost: ["social-yt", "social-x", "social-ig", "social-fb", "social-reddit", "social-tg"],
  analyticsWaiting: ["1.11"],
  analyticsPeak: ["3.7", "1.14"],
  clips: ["1.23", "1.24"],
  peakMoments: ["1.14"],
  postShowSeo: ["1.16", "1.17", "1.20"],
  endScreen: ["1.18", "1.21"],
  transcript: ["1.19"],
  comments: ["1.22"],
  abReminder: ["1.15"],
  liveChapters: ["1.12"],
  liveLinks: ["1.13"],
  guestTag: ["3.8", "3.5"],
  igCarousel: ["2.4"],
  oauth: ["oauth"],
} as const;

export async function markTasksDone(
  showRunId: string,
  taskIds: readonly string[]
): Promise<void> {
  for (const taskId of taskIds) {
    await updateChecklistItem(showRunId, taskId, { status: "done" });
  }
}

export function isAutoTask(taskId: string): boolean {
  return taskById(taskId)?.mode === "auto";
}

export function canManuallyUpdateTask(taskId: string, nextStatus: string): boolean {
  const def = taskById(taskId);
  if (!def) return false;
  if (def.mode === "auto" && nextStatus === "done") return false;
  return true;
}

export async function checklistSummary(showRunId: string): Promise<{
  done: number;
  pending: number;
  blockedOnProof: number;
  autoDone: number;
  autoTotal: number;
}> {
  const items = await listChecklist(showRunId);
  const applicable = items.filter((i) => i.status !== "skipped");
  const autoIds = new Set(CHECKLIST_TASKS.filter((t) => t.mode === "auto").map((t) => t.id));
  const autoDone = items.filter((i) => autoIds.has(i.taskId) && i.status === "done").length;
  return {
    done: applicable.filter((i) => i.status === "done").length,
    pending: applicable.filter((i) => i.status === "pending" || i.status === "in_progress").length,
    blockedOnProof: applicable.filter((i) => {
      const def = taskById(i.taskId);
      return def?.mode === "auto" && i.status !== "done" && !def.needsQc;
    }).length,
    autoDone,
    autoTotal: CHECKLIST_TASKS.filter((t) => t.mode === "auto").length,
  };
}

/** @deprecated Do not use — checklist must be proof-driven. */
export async function markAllAutoTasksDone(showRunId: string): Promise<{
  autoTasksDone: number;
  autoTasksTotal: number;
}> {
  const summary = await checklistSummary(showRunId);
  return { autoTasksDone: summary.autoDone, autoTasksTotal: summary.autoTotal };
}
