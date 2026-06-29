import type { ShowRun } from "@/lib/types";
import type { PreflightMode } from "@/lib/readiness/preflight";

export type StudioTab =
  | "dashboard"
  | "details"
  | "video-elements"
  | "checks"
  | "visibility"
  | "community";

export const STUDIO_TABS: { id: StudioTab; label: string; hint: string }[] = [
  { id: "dashboard", label: "Dashboard", hint: "What to do next" },
  { id: "details", label: "Details", hint: "Title, description, tags" },
  { id: "video-elements", label: "Video elements", hint: "Chapters, sponsor, end screen, Shorts" },
  { id: "checks", label: "Checks", hint: "Issues before publish" },
  { id: "visibility", label: "Visibility", hint: "Who can watch" },
  { id: "community", label: "Community", hint: "Comments to reply to" },
];

export type StudioVisibility = "private" | "unlisted" | "public";

export function showStatusToVisibility(status: ShowRun["status"]): StudioVisibility {
  if (status === "live" || status === "completed") return "public";
  if (status === "scheduled" || status === "preview") return "unlisted";
  return "private";
}

export function visibilityLabel(v: StudioVisibility): string {
  if (v === "public") return "Public";
  if (v === "unlisted") return "Unlisted";
  return "Private";
}

export function visibilityDescription(v: StudioVisibility): string {
  if (v === "public") return "Everyone can watch your video on YouTube.";
  if (v === "unlisted") return "Anyone with the link can watch — good while you prep or test.";
  return "Only you can see this until you publish.";
}

export function visibilityToShowStatus(
  v: StudioVisibility,
  current: ShowRun["status"]
): ShowRun["status"] {
  if (v === "public") {
    if (current === "live") return "live";
    if (current === "completed") return "completed";
    return "scheduled";
  }
  if (v === "unlisted") {
    if (current === "live") return "live";
    return "scheduled";
  }
  if (current === "live") return "live";
  return "draft";
}

export function runModeLabel(mode: PreflightMode): string {
  if (mode === "preview") return "Prepare everything (no upload)";
  if (mode === "metadata_only") return "Update title & description only";
  return "Publish to YouTube";
}

export function runModeDescription(mode: PreflightMode): string {
  if (mode === "preview") {
    return "Generates title, description, tags, social drafts, and checklist — nothing goes to YouTube yet.";
  }
  if (mode === "metadata_only") {
    return "Pushes title, description, and tags to the linked YouTube video when OAuth is connected.";
  }
  return "Full publish pass — metadata, clips, analytics hooks, and verified YouTube writes.";
}
