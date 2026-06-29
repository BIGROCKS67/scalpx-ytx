import { CHECKLIST_TASKS, taskById } from "@/lib/checklistTasks";
import { isPastShowRun } from "@/lib/showFilters";
import {
  PHASE_ORDER,
  type ChecklistItem,
  type ShowPhase,
  type ShowRun,
  type ShowRunStatus,
  type YtChannel,
} from "@/lib/types";

export type ShowProgress = {
  showId: string;
  done: number;
  total: number;
  pct: number;
  nextAction: string | null;
  qcPending: number;
  phaseProgress: Record<ShowPhase, { done: number; total: number }>;
};

export type AttentionItem = {
  showId: string;
  title: string;
  channelName: string;
  reason: string;
  urgency: "high" | "medium" | "low";
  href: string;
};

const STATUS_RANK: Record<ShowRunStatus, number> = {
  live: 0,
  blocked: 1,
  preview: 2,
  scheduled: 3,
  draft: 4,
  completed: 5,
};

export function progressForShow(items: ChecklistItem[]): Omit<ShowProgress, "showId"> {
  const applicable = items.filter((i) => i.status !== "skipped");
  const done = applicable.filter((i) => i.status === "done").length;
  const qcPending = items.filter((i) => {
    const def = taskById(i.taskId);
    return def?.needsQc && i.status !== "done";
  }).length;

  const phaseProgress = {} as Record<ShowPhase, { done: number; total: number }>;
  for (const phase of PHASE_ORDER) {
    const phaseItems = applicable.filter((i) => i.phase === phase);
    phaseProgress[phase] = {
      done: phaseItems.filter((i) => i.status === "done").length,
      total: phaseItems.length,
    };
  }

  let nextAction: string | null = null;
  const qcTask = items.find((i) => taskById(i.taskId)?.needsQc && i.status !== "done");
  if (qcTask) {
    nextAction = `${taskById(qcTask.taskId)?.label ?? qcTask.taskId} · QC`;
  } else {
    const open = items.find((i) => i.status === "pending" || i.status === "in_progress");
    if (open) nextAction = taskById(open.taskId)?.label ?? open.taskId;
  }

  return {
    done,
    total: applicable.length,
    pct: applicable.length ? Math.round((done / applicable.length) * 100) : 0,
    nextAction,
    qcPending,
    phaseProgress,
  };
}

/** One actionable row per show — no OAuth noise until production go-live. */
export function buildAttentionQueue(
  shows: ShowRun[],
  channels: YtChannel[],
  checklistByShow: Record<string, ChecklistItem[]>
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const now = Date.now();

  for (const show of shows) {
    if (isPastShowRun(show)) continue;
    const ch = channels.find((c) => c.id === show.channelId);
    const checklist = checklistByShow[show.id] ?? [];
    const prog = progressForShow(checklist);
    const base = {
      showId: show.id,
      title: show.title,
      channelName: ch?.displayName ?? "Channel",
      href: `/shows/${show.id}`,
    };

    let item: AttentionItem | null = null;

    if (show.status === "live") {
      item = { ...base, reason: "Live now", urgency: "high" };
    } else if (show.status === "blocked") {
      item = { ...base, reason: "Run blocked — fix and retry", urgency: "high" };
    } else if (prog.qcPending > 0) {
      item = {
        ...base,
        reason: `${prog.qcPending} QC item${prog.qcPending > 1 ? "s" : ""} pending`,
        urgency: "medium",
      };
    } else if (show.status === "preview") {
      item = { ...base, reason: "Preview complete — review drafts", urgency: "medium" };
    } else if (show.youtubeVideoId && show.status === "draft" && prog.pct < 15) {
      item = { ...base, reason: "Ready for preview run", urgency: "medium" };
    } else if (show.scheduledAt) {
      const hours = (new Date(show.scheduledAt).getTime() - now) / 3600000;
      if (hours > 0 && hours < 48 && prog.pct < 70) {
        item = {
          ...base,
          reason: `Air in ${Math.round(hours)}h · ${prog.pct}% ready`,
          urgency: "medium",
        };
      }
    } else if (
      show.youtubeVideoId &&
      (show.status === "draft" || show.status === "completed") &&
      prog.pct > 0 &&
      prog.pct < 70
    ) {
      item = { ...base, reason: `${prog.pct}% lifecycle · continue setup`, urgency: "low" };
    }

    if (item) items.push(item);
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return items.sort((a, b) => rank[a.urgency] - rank[b.urgency] || a.title.localeCompare(b.title));
}

export function sortShowsForDashboard(shows: ShowRun[]): ShowRun[] {
  return [...shows].sort((a, b) => {
    const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (byStatus !== 0) return byStatus;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function dashboardCounts(
  shows: ShowRun[],
  attention: AttentionItem[],
  checklistByShow: Record<string, ChecklistItem[]>
) {
  const qcPending = attention.filter((a) => a.reason.includes("QC")).length;
  const previewRuns = shows.filter((s) => s.status === "preview").length;
  const actionable = attention.length;
  let totalQcTasks = 0;
  for (const show of shows) {
    totalQcTasks += progressForShow(checklistByShow[show.id] ?? []).qcPending;
  }
  return { qcPending, previewRuns, actionable, totalQcTasks };
}

export function rosterHealth(channels: YtChannel[]) {
  const oauth = channels.filter((c) => c.oauthConnected).length;
  const ids = channels.filter((c) => c.youtubeChannelId).length;
  return { oauth, ids, total: channels.length };
}

export function shipMetrics(allItems: { mode: string; status: string }[]) {
  const autoTotal = CHECKLIST_TASKS.filter((t) => t.mode === "auto").length;
  const autoDone = allItems.filter((i) => i.mode === "auto" && i.status === "done").length;
  const shipTarget = 27;
  return { autoTotal, autoDone, shipTarget };
}

export function statusLabel(status: ShowRunStatus): string {
  switch (status) {
    case "preview":
      return "Preview";
    case "completed":
      return "Done";
    case "blocked":
      return "Blocked";
    default:
      return status;
  }
}
