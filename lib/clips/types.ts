export const CLIP_PLATFORMS = ["tiktok", "instagram", "youtube", "x"] as const;
export type ClipPlatform = (typeof CLIP_PLATFORMS)[number];

import type { CaptionStyle } from "@/lib/clips/captionStyle";

export const CLIP_CAMPAIGN_STATUSES = ["draft", "active", "paused", "done"] as const;
export type ClipCampaignStatus = (typeof CLIP_CAMPAIGN_STATUSES)[number];

export const CLIP_SUBMISSION_STATUSES = ["pending", "approved", "rejected", "flagged"] as const;
export type ClipSubmissionStatus = (typeof CLIP_SUBMISSION_STATUSES)[number];

export const CLIP_ANALYSIS_STATUSES = ["none", "running", "done", "error"] as const;
export type ClipAnalysisStatus = (typeof CLIP_ANALYSIS_STATUSES)[number];

export interface ClipSource {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number | null;
  tags: string;
  youtubeVideoId: string | null;
  analysisStatus: ClipAnalysisStatus;
  analysisAt: string | null;
  analysisMessage: string;
  analysisProgress: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClipMoment {
  id: string;
  sourceId: string;
  startSec: number;
  endSec: number;
  title: string;
  hook: string;
  caption: string;
  score: number;
  clipUrl: string;
  transcriptJson: string;
  createdAt: string;
}

export type MomentTranscriptData = {
  cues: Array<{ startSec: number; endSec: number; text: string }>;
  words?: Array<{ startSec: number; endSec: number; word: string }>;
  captionOffsetSec?: number;
  /** Caption pace multiplier (<1 slows the word-by-word reveal). Applied at render only. */
  captionSpeed?: number;
  captionStyle?: CaptionStyle;
};

export interface ClipCampaign {
  id: string;
  title: string;
  status: ClipCampaignStatus;
  brief: string;
  hooks: string;
  bannedTopics: string;
  budgetUsdt: number;
  rewardPer1kViews: number;
  allowedPlatforms: ClipPlatform[];
  sourceIds: string[];
  dealId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClipSubmission {
  id: string;
  campaignId: string;
  clipperName: string;
  clipperEmail: string;
  clipFileUrl: string;
  clipFileName: string;
  postUrl: string;
  platform: ClipPlatform;
  status: ClipSubmissionStatus;
  viewCount: number;
  notes: string;
  rejectionReason: string;
  submittedAt: string;
  reviewedAt: string | null;
  momentId: string | null;
  sourceId: string | null;
}

export type ClipCampaignSummary = {
  campaignId: string;
  title: string;
  status: ClipCampaignStatus;
  submissionCount: number;
  pendingCount: number;
  approvedCount: number;
  totalViews: number;
  budgetUsdt: number;
  rewardPer1kViews: number;
};
