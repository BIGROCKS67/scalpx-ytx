import { CHECKLIST_TASKS } from "@/lib/checklistTasks";
import { listChecklist, updateChecklistItem } from "@/lib/store";

/** Map YTX actions → checklist task IDs from the build spec. */
export const ACTION_TASKS = {
  channelSetup: ["3.1", "3.2"],
  channelTrailer: ["1.5"],
  seoPack: ["1.1", "1.2", "1.3", "3.4"],
  sponsorBlock: ["2.1"],
  crossPost: ["social-yt", "social-x", "social-ig", "social-fb", "social-reddit", "social-tg"],
  analyticsWaiting: ["1.11"],
  analyticsPeak: ["3.7", "1.14"],
  clips: ["1.23", "1.24", "1.14"],
  postShowSeo: ["1.16", "1.17", "1.20"],
  endScreen: ["1.18", "1.21"],
  transcript: ["1.19"],
  comments: ["1.22"],
  abReminder: ["1.15"],
  patchLog: ["1.13"],
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

/** Mark every Auto-mode task done - skips QC-gated tasks until human approves. */
export async function markAllAutoTasksDone(showRunId: string): Promise<{
  autoTasksDone: number;
  autoTasksTotal: number;
}> {
  const items = await listChecklist(showRunId);
  const autoIds = new Set(
    CHECKLIST_TASKS.filter((t) => t.mode === "auto" && !t.needsQc).map((t) => t.id)
  );
  for (const item of items) {
    if (autoIds.has(item.taskId) && item.status !== "done" && item.status !== "skipped") {
      await updateChecklistItem(showRunId, item.taskId, { status: "done" });
    }
  }
  const refreshed = await listChecklist(showRunId);
  const autoTasksTotal = CHECKLIST_TASKS.filter((t) => t.mode === "auto").length;
  const autoTasksDone = refreshed.filter(
    (i) => autoIds.has(i.taskId) && i.status === "done"
  ).length;
  return { autoTasksDone, autoTasksTotal };
}
