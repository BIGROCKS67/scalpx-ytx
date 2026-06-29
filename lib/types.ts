/** YTX - YouTube show lifecycle types */

export type ShowFormat = "banter" | "stream" | "education";
export type ShowPipeline = "live" | "prerecorded";
export type ShowPhase = "channel_setup" | "pre_show" | "live" | "post_show";
export type TaskMode = "auto" | "assist" | "manual";
export type TaskStatus = "pending" | "in_progress" | "done" | "skipped";
export type QcStatus = "pending_qc" | "approved" | "rejected" | "published";
export type ShowRunStatus = "draft" | "scheduled" | "live" | "completed" | "blocked" | "preview";

export type YtChannel = {
  id: string;
  slug: string;
  displayName: string;
  youtubeChannelId: string | null;
  trackAccountId: string | null;
  descriptionTemplate: string;
  tags: string[];
  socialLinks: Record<string, string>;
  showFormats: ShowFormat[];
  isShowFormat: boolean;
  oauthConnected: boolean;
  avatarUrl: string | null;
  channelTrailerDraft: ChannelTrailerDraft | null;
  createdAt: string;
  updatedAt: string;
};

export type ChannelTrailerDraft = {
  script: string;
  hook: string;
  cta: string;
  suggestedClips: string[];
  status: QcStatus;
};

export type ShowRun = {
  id: string;
  channelId: string;
  title: string;
  format: ShowFormat;
  pipeline: ShowPipeline;
  scheduledAt: string | null;
  guestName: string | null;
  dealId: string | null;
  youtubeVideoId: string | null;
  youtubeBroadcastId: string | null;
  status: ShowRunStatus;
  seoTitle: string | null;
  seoDescription: string | null;
  seoTags: string[];
  thumbnailVariant: string | null;
  clipSourceId: string | null;
  descriptionPatchLog: DescriptionPatch[];
  liveChapters: LiveChapter[];
  createdAt: string;
  updatedAt: string;
};

export type LiveChapter = {
  atSec: number;
  label: string;
  status: QcStatus | "draft";
};

export type DescriptionPatch = {
  at: string;
  note: string;
  snippet: string;
};

export type ChecklistTaskDef = {
  id: string;
  phase: ShowPhase;
  label: string;
  mode: TaskMode;
  needsQc?: boolean;
  specRef?: string;
};

export type ChecklistItem = {
  id: string;
  showRunId: string;
  taskId: string;
  phase: ShowPhase;
  status: TaskStatus;
  mode: TaskMode;
  completedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type CrossPostItem = {
  id: string;
  showRunId: string;
  platform: string;
  draftBody: string;
  scoutDraftId: string | null;
  status: "draft" | "scheduled" | "posted" | "skipped";
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClipBatch = {
  id: string;
  showRunId: string;
  scoutSourceId: string | null;
  momentIds: string[];
  exportUrls: string[];
  status: "idle" | "importing" | "analyzing" | "exporting" | "done" | "error";
  message: string;
  createdAt: string;
  updatedAt: string;
};

export type EndScreenEdge = {
  id: string;
  fromVideoId: string;
  toVideoId: string;
  weight: number;
  createdAt: string;
};

export type AnalyticsSnapshotType =
  | "waiting_room"
  | "peak_viewers"
  | "views_24h"
  | "spike_topic";

export type AnalyticsSnapshot = {
  id: string;
  showRunId: string;
  snapshotType: AnalyticsSnapshotType;
  concurrentViewers: number | null;
  views24h: number | null;
  metadata: Record<string, unknown>;
  capturedAt: string;
};

export type SponsorBlock = {
  dealId: string | null;
  sponsorName: string;
  urls: { label: string; url: string; slug: string; healthy: boolean }[];
  copy: string;
  requiresAd: boolean;
};

export type SeoPack = {
  titles: string[];
  description: string;
  tags: string[];
  thumbnailBrief: string;
};

export type CommentReply = {
  id: string;
  showRunId: string;
  authorHint: string;
  commentText: string;
  draftReply: string;
  status: "pending" | "approved" | "posted" | "skipped";
  createdAt: string;
  updatedAt: string;
};

export type IgCarouselDraft = {
  id: string;
  showRunId: string;
  slides: string[];
  caption: string;
  status: QcStatus;
  createdAt: string;
  updatedAt: string;
};

export type AppSettings = {
  googleClientId: string;
  googleClientSecret: string;
  youtubeApiKey: string;
  scoutUrl: string;
  scoutServiceKey: string;
  deepseekApiKey: string;
  scrapeCreatorsKey: string;
  openaiApiKey: string;
};

export const PHASE_LABELS: Record<ShowPhase, string> = {
  channel_setup: "Channel setup",
  pre_show: "Pre-show",
  live: "Live",
  post_show: "Post-show",
};

export const PHASE_ORDER: ShowPhase[] = [
  "channel_setup",
  "pre_show",
  "live",
  "post_show",
];
