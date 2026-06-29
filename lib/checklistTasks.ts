import type { ChecklistTaskDef, TaskMode, TaskStatus } from "@/lib/types";

/** 38 tasks · modes updated per Chento addendum (29 Jun 2026). */
export const CHECKLIST_TASKS: ChecklistTaskDef[] = [
  { id: "3.2", phase: "channel_setup", label: "Channel description", mode: "auto", specRef: "3.2" },
  { id: "3.1", phase: "channel_setup", label: "Channel tags", mode: "auto", specRef: "3.1" },
  { id: "3.3", phase: "channel_setup", label: "Link social accounts", mode: "assist", specRef: "3.3" },
  { id: "oauth", phase: "channel_setup", label: "Connect YouTube OAuth", mode: "assist" },
  {
    id: "1.5",
    phase: "channel_setup",
    label: "Channel trailer",
    mode: "auto",
    needsQc: true,
    specRef: "1.5",
  },
  { id: "1.1", phase: "pre_show", label: "SEO title options", mode: "auto", specRef: "1.1" },
  { id: "ab-thumb", phase: "pre_show", label: "A/B thumbnail variants", mode: "assist", needsQc: true },
  { id: "1.2", phase: "pre_show", label: "Video description", mode: "auto", specRef: "1.2" },
  { id: "2.1", phase: "pre_show", label: "Sponsor links", mode: "auto", specRef: "2.1" },
  { id: "1.3", phase: "pre_show", label: "Show tags (10-15)", mode: "auto", specRef: "1.3" },
  { id: "1.4", phase: "pre_show", label: "Playlists", mode: "assist", specRef: "1.4" },
  { id: "3.5", phase: "pre_show", label: "Collab / guest", mode: "assist", specRef: "3.5" },
  { id: "1.6", phase: "pre_show", label: "Upload settings pre-flight", mode: "assist", specRef: "1.6" },
  { id: "3.4", phase: "pre_show", label: "Thumbnail brief", mode: "assist", needsQc: true, specRef: "3.4" },
  { id: "social-yt", phase: "pre_show", label: "Pre-show · YouTube Community", mode: "auto" },
  { id: "social-x", phase: "pre_show", label: "Pre-show · X", mode: "auto" },
  { id: "social-ig", phase: "pre_show", label: "Pre-show · Instagram", mode: "auto" },
  { id: "social-fb", phase: "pre_show", label: "Pre-show · Facebook", mode: "auto" },
  { id: "social-reddit", phase: "pre_show", label: "Pre-show · Reddit", mode: "auto" },
  { id: "social-tg", phase: "pre_show", label: "Pre-show · Telegram", mode: "auto" },
  { id: "1.11", phase: "pre_show", label: "Waiting room baseline", mode: "auto", specRef: "1.11" },
  { id: "1.12", phase: "live", label: "Live SEO timestamps", mode: "auto", specRef: "1.12" },
  { id: "1.13", phase: "live", label: "Update links live", mode: "auto", specRef: "1.13" },
  { id: "2.3", phase: "live", label: "Post value live", mode: "manual", specRef: "2.3" },
  { id: "3.7", phase: "live", label: "Peak live viewers", mode: "auto", specRef: "3.7" },
  { id: "1.14", phase: "live", label: "Peak moments / topics", mode: "auto", specRef: "1.14" },
  { id: "1.15", phase: "post_show", label: "A/B title & thumbnail", mode: "assist", needsQc: true, specRef: "1.15" },
  { id: "1.16", phase: "post_show", label: "Tags cleanup", mode: "auto", specRef: "1.16" },
  { id: "1.17", phase: "post_show", label: "Timestamps cleanup", mode: "auto", specRef: "1.17" },
  { id: "1.18", phase: "post_show", label: "End screens & cards", mode: "auto", specRef: "1.18" },
  { id: "1.19", phase: "post_show", label: "Transcript translate", mode: "auto", specRef: "1.19" },
  { id: "1.20", phase: "post_show", label: "Transcript → description", mode: "auto", specRef: "1.20" },
  { id: "3.8", phase: "post_show", label: "Tag guests / partners", mode: "assist", specRef: "3.8" },
  { id: "1.21", phase: "post_show", label: "End-screen bucket", mode: "auto", specRef: "1.21" },
  {
    id: "1.22",
    phase: "post_show",
    label: "Comment replies",
    mode: "auto",
    needsQc: true,
    specRef: "1.22",
  },
  {
    id: "2.4",
    phase: "post_show",
    label: "IG carousels",
    mode: "auto",
    needsQc: true,
    specRef: "2.4",
  },
  { id: "1.23", phase: "post_show", label: "X clips", mode: "auto", specRef: "1.23" },
  { id: "1.24", phase: "post_show", label: "YT Shorts (3-5)", mode: "auto", specRef: "1.24" },
];

export const TASK_COUNT = CHECKLIST_TASKS.length;

export function taskById(id: string): ChecklistTaskDef | undefined {
  return CHECKLIST_TASKS.find((t) => t.id === id);
}

export function tasksForPhase(phase: ChecklistTaskDef["phase"]): ChecklistTaskDef[] {
  return CHECKLIST_TASKS.filter((t) => t.phase === phase);
}

export function automationStats(items: { mode: TaskMode; status: TaskStatus }[]) {
  const auto = CHECKLIST_TASKS.filter((t) => t.mode === "auto").length;
  const assist = CHECKLIST_TASKS.filter((t) => t.mode === "assist").length;
  const manual = CHECKLIST_TASKS.filter((t) => t.mode === "manual").length;
  const qc = CHECKLIST_TASKS.filter((t) => t.needsQc).length;
  const doneAuto = items.filter((i) => i.mode === "auto" && i.status === "done").length;
  return { auto, assist, manual, qc, doneAuto, total: TASK_COUNT };
}
