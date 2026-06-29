import type { ShowRun, ShowRunStatus } from "@/lib/types";

/** Statuses that need ops attention — the reason Shows exists. */
export const ACTIVE_SHOW_STATUSES: ShowRunStatus[] = [
  "draft",
  "scheduled",
  "live",
  "preview",
  "blocked",
];

export function isActiveShowStatus(status: ShowRunStatus): boolean {
  return ACTIVE_SHOW_STATUSES.includes(status);
}

export function filterActiveShows(shows: ShowRun[]): ShowRun[] {
  return shows.filter((s) => isActiveShowStatus(s.status));
}

export function filterArchivedShows(shows: ShowRun[]): ShowRun[] {
  return shows.filter((s) => s.status === "completed");
}
