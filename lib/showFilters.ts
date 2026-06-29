import type { ShowRun, ShowRunStatus } from "@/lib/types";

/** Statuses that need ops attention — the reason Shows exists. */
export const ACTIVE_SHOW_STATUSES: ShowRunStatus[] = [
  "draft",
  "scheduled",
  "live",
  "preview",
  "blocked",
];

/** After the scheduled slot, a ShowRun is historical — belongs in archive / Home, not active ops. */
const PAST_SHOW_GRACE_MS = 6 * 60 * 60 * 1000;

export function isActiveShowStatus(status: ShowRunStatus): boolean {
  return ACTIVE_SHOW_STATUSES.includes(status);
}

export function isPastShowRun(show: Pick<ShowRun, "scheduledAt" | "status">): boolean {
  if (show.status === "live") return false;
  if (!show.scheduledAt) return false;
  return new Date(show.scheduledAt).getTime() < Date.now() - PAST_SHOW_GRACE_MS;
}

/** Completed or already-aired streams — post-show ops, not prep studio. */
export function isReplayShowView(show: Pick<ShowRun, "scheduledAt" | "status">): boolean {
  if (show.status === "completed") return true;
  if (show.status === "live") return false;
  return isPastShowRun(show);
}

/** Upcoming or in-progress ShowRuns only — not streams that already aired. */
export function filterActiveShows(shows: ShowRun[]): ShowRun[] {
  return shows.filter((s) => isActiveShowStatus(s.status) && !isPastShowRun(s));
}

/** Completed runs plus past dated ShowRuns (including old preview runs on existing YouTube videos). */
export function filterArchivedShows(shows: ShowRun[]): ShowRun[] {
  return shows.filter((s) => s.status === "completed" || isPastShowRun(s));
}

/** Best date for ordering / grouping archive entries (scheduled air date first). */
export function showArchiveTimestamp(show: Pick<ShowRun, "scheduledAt" | "updatedAt" | "createdAt">): number {
  const raw = show.scheduledAt ?? show.updatedAt ?? show.createdAt;
  return new Date(raw).getTime();
}

export function sortShowsByArchiveDate(shows: ShowRun[]): ShowRun[] {
  return [...shows].sort((a, b) => showArchiveTimestamp(b) - showArchiveTimestamp(a));
}

export type ArchiveDateGroup = {
  key: string;
  label: string;
  shows: ShowRun[];
};

/** Group archive runs by calendar day, newest days first. */
export function groupShowsByArchiveDate(shows: ShowRun[]): ArchiveDateGroup[] {
  const sorted = sortShowsByArchiveDate(shows);
  const groups: ArchiveDateGroup[] = [];
  const indexByKey = new Map<string, number>();

  for (const show of sorted) {
    const d = new Date(show.scheduledAt ?? show.updatedAt ?? show.createdAt);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const existing = indexByKey.get(key);
    if (existing !== undefined) {
      groups[existing].shows.push(show);
    } else {
      indexByKey.set(key, groups.length);
      groups.push({ key, label, shows: [show] });
    }
  }

  return groups;
}
