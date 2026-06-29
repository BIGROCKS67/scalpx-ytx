import { isActiveChannelSlug } from "@/lib/activeChannels";
import { checkClipsReadiness } from "@/lib/clips/readiness";
import { hasLinkedYoutubeVideo } from "@/lib/showMedia";
import { getChannel, getSettings, getShow } from "@/lib/store";
import { hostCapabilities, isServerlessDemoHost } from "@/lib/runtimeHost";
import { oauthConfigured } from "@/lib/youtubeOAuth";
import { youtubeApiReady, youtubeWriteReady } from "@/lib/youtube/dataApi";
import type { YtChannel } from "@/lib/types";

export type ReadinessBlocker = {
  code: string;
  message: string;
  fix: string;
};

export type ShowPreflight = {
  ready: boolean;
  blockers: ReadinessBlocker[];
  warnings: string[];
  channel: YtChannel | null;
  host: ReturnType<typeof hostCapabilities>;
  checks: {
    activeChannel: boolean;
    youtubeVideoId: boolean;
    youtubeRead: boolean;
    youtubeWrite: boolean;
    clipsReady: boolean;
    oauthConfigured: boolean;
    apiKeyConfigured: boolean;
  };
};

export type PreflightMode = "full" | "metadata_only" | "preview";

export function isPreviewMode(mode: PreflightMode): boolean {
  return mode === "preview";
}

export async function preflightShowRun(
  showId: string,
  mode: PreflightMode = "full"
): Promise<ShowPreflight> {
  const blockers: ReadinessBlocker[] = [];
  const warnings: string[] = [];

  const show = await getShow(showId);
  if (!show) {
    return {
      ready: false,
      blockers: [{ code: "show_not_found", message: "Show not found", fix: "Pick a valid show" }],
      warnings: [],
      channel: null,
      host: hostCapabilities(),
      checks: {
        activeChannel: false,
        youtubeVideoId: false,
        youtubeRead: false,
        youtubeWrite: false,
        clipsReady: false,
        oauthConfigured: false,
        apiKeyConfigured: false,
      },
    };
  }

  const channel = await getChannel(show.channelId);
  const settings = await getSettings();
  const oauthOk = oauthConfigured(settings);
  const apiKeyOk = Boolean(
    settings.youtubeApiKey?.trim() || process.env.YTX_YOUTUBE_API_KEY?.trim()
  );

  const activeChannel = channel ? isActiveChannelSlug(channel.slug) : false;
  if (!activeChannel) {
    blockers.push({
      code: "inactive_channel",
      message: "Only Chento Trades and Crypto Banter are active in this release",
      fix: "Create the show on chento or banter",
    });
  }

  const youtubeVideoId = hasLinkedYoutubeVideo(show);
  if (!youtubeVideoId) {
    if (mode === "full") {
      blockers.push({
        code: "missing_video_id",
        message: "Show is not linked to a YouTube video",
        fix: "Paste a YouTube URL on the show board, then run Full E2E",
      });
    } else {
      warnings.push(
        "No YouTube video linked — preview runs SEO, cross-post drafts, and checklist now · bind a URL before Shorts, analytics, and Full E2E"
      );
    }
  }

  const youtubeRead = channel ? await youtubeApiReady(channel.id) : false;
  if (!youtubeRead) {
    if (mode === "full" || youtubeVideoId) {
      blockers.push({
        code: "youtube_read_missing",
        message: "YouTube read access is not configured",
        fix: "Add YTX_YOUTUBE_API_KEY in Settings or connect OAuth",
      });
    } else if (isPreviewMode(mode) || mode === "metadata_only") {
      warnings.push(
        "YouTube API key not set — preview drafts still run · add YTX_YOUTUBE_API_KEY for roster sync and analytics"
      );
    }
  }

  const youtubeWrite = channel ? await youtubeWriteReady(channel.id) : false;
  if (!youtubeWrite && !isPreviewMode(mode)) {
    blockers.push({
      code: "youtube_write_missing",
      message: "YouTube OAuth is not connected for this channel",
      fix: "Connect OAuth on the roster page before running end to end",
    });
  }

  const skipClipsGate = isPreviewMode(mode);
  let clips: Awaited<ReturnType<typeof checkClipsReadiness>> = {
    ready: true,
    blockers: [],
    warnings: [],
  };
  if (mode === "full") {
    clips = await checkClipsReadiness();
    if (!clips.ready) {
      for (const b of clips.blockers) {
        blockers.push({
          code: b.code,
          message: b.message,
          fix: b.fix,
        });
      }
    }
  }
  if (mode === "metadata_only") {
    warnings.push("Metadata-only run — clip tasks will not complete");
  }
  if (isPreviewMode(mode)) {
    warnings.push(
      "Preview run — SEO, drafts, and checklist run locally · nothing is published to YouTube until channel OAuth is connected"
    );
    if (!youtubeVideoId) {
      warnings.push("Clips and live analytics steps skip until you link a YouTube URL");
    }
    if (!youtubeWrite) {
      warnings.push("YouTube OAuth not connected — metadata and comments stay as local drafts");
    }
    if (skipClipsGate && clips.ready && isServerlessDemoHost()) {
      warnings.push(
        "Demo host (Vercel) — Shorts export skipped here · run Preview on local :3001 for MP4 clips, or wire Scout"
      );
    }
  }
  warnings.push(...clips.warnings);

  if (!oauthOk && !isPreviewMode(mode)) {
    warnings.push("Google OAuth credentials not saved in Settings — connect will fail until configured");
  }
  if (!apiKeyOk) {
    warnings.push("YouTube API key not set — roster sync and read-only stats may fail");
  }

  const host = hostCapabilities();

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    channel,
    host,
    checks: {
      activeChannel,
      youtubeVideoId,
      youtubeRead,
      youtubeWrite,
      clipsReady: clips.ready,
      oauthConfigured: oauthOk,
      apiKeyConfigured: apiKeyOk,
    },
  };
}

export async function preflightChannel(channelId: string): Promise<{
  channel: YtChannel | null;
  youtubeRead: boolean;
  youtubeWrite: boolean;
  oauthConfigured: boolean;
  apiKeyConfigured: boolean;
}> {
  const channel = await getChannel(channelId);
  const settings = await getSettings();
  return {
    channel,
    youtubeRead: channel ? await youtubeApiReady(channel.id) : false,
    youtubeWrite: channel ? await youtubeWriteReady(channel.id) : false,
    oauthConfigured: oauthConfigured(settings),
    apiKeyConfigured: Boolean(
      settings.youtubeApiKey?.trim() || process.env.YTX_YOUTUBE_API_KEY?.trim()
    ),
  };
}
