import { CHECKLIST_TASKS, taskById } from "@/lib/checklistTasks";
import { PHASE_ORDER, type ChecklistItem, type ShowPhase, type ShowRun, type YtChannel } from "@/lib/types";

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

export function buildAttentionQueue(
  shows: ShowRun[],
  channels: YtChannel[],
  checklistByShow: Record<string, ChecklistItem[]>
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const now = Date.now();

  for (const show of shows) {
    const ch = channels.find((c) => c.id === show.channelId);
    const checklist = checklistByShow[show.id] ?? [];
    const base = {
      showId: show.id,
      title: show.title,
      channelName: ch?.displayName ?? "Channel",
      href: `/shows/${show.id}`,
    };

    if (show.status === "live") {
      items.push({ ...base, reason: "Live now", urgency: "high" });
    }

    if (!ch?.oauthConnected && (show.status === "scheduled" || show.status === "live")) {
      items.push({ ...base, reason: "OAuth not connected", urgency: "high" });
    }

    const qc = progressForShow(checklist).qcPending;
    if (qc > 0) {
      items.push({ ...base, reason: `${qc} QC item${qc > 1 ? "s" : ""} pending`, urgency: "medium" });
    }

    if (show.scheduledAt) {
      const hours = (new Date(show.scheduledAt).getTime() - now) / 3600000;
      if (hours > 0 && hours < 48 && progressForShow(checklist).pct < 70) {
        items.push({
          ...base,
          reason: `Air in ${Math.round(hours)}h · ${progressForShow(checklist).pct}% ready`,
          urgency: "medium",
        });
      }
    }
  }

  const rank = { high: 0, medium: 1, low: 2 };
  const seen = new Set<string>();
  return items
    .filter((i) => {
      const key = `${i.showId}:${i.reason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => rank[a.urgency] - rank[b.urgency]);
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
