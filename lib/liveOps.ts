import { buildSponsorBlock } from "@/lib/adapters/deals";
import { listMomentsForSource } from "@/lib/clips/momentsStore";
import { appendDescriptionPatch, getChannel, getShow, updateShow } from "@/lib/store";
import { logVerification } from "@/lib/verificationLog";
import { updateVideoMetadata, youtubeWriteReady } from "@/lib/youtube/dataApi";
import type { LiveChapter, ShowRun } from "@/lib/types";

function formatTs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Auto-generate live chapter timestamps from clip moments only (no placeholder chapters). */
export async function generateLiveChapters(show: ShowRun): Promise<LiveChapter[]> {
  const chapters: LiveChapter[] = [{ atSec: 0, label: "Intro", status: "draft" }];

  if (show.clipSourceId) {
    const moments = await listMomentsForSource(show.clipSourceId);
    const top = [...moments].sort((a, b) => b.score - a.score).slice(0, 6);
    for (const m of top) {
      chapters.push({
        atSec: m.startSec,
        label: m.title.slice(0, 80),
        status: "draft",
      });
    }
  }

  if (show.guestName && chapters.length === 1) {
    chapters.push({
      atSec: 120,
      label: `Guest: ${show.guestName}`,
      status: "draft",
    });
  }

  return chapters.sort((a, b) => a.atSec - b.atSec);
}

export function chaptersToDescriptionBlock(chapters: LiveChapter[]): string {
  const lines = chapters.map((c) => `${formatTs(c.atSec)} ${c.label}`);
  return `\n\nChapters:\n${lines.join("\n")}`;
}

/** Auto-update live description with chapters + sponsor links (YT API when OAuth). */
export async function applyLiveLinkAndChapterUpdate(
  showId: string,
  opts?: { skipYoutubeWrite?: boolean }
): Promise<{
  show: ShowRun;
  chapters: LiveChapter[];
  description: string;
  pushedToYoutube: boolean;
  writeStatus: number | null;
  writeError?: string;
}> {
  const show = await getShow(showId);
  if (!show) throw new Error("Show not found");
  const channel = await getChannel(show.channelId);
  if (!channel) throw new Error("Channel missing");

  const chapters = show.liveChapters.length ? show.liveChapters : await generateLiveChapters(show);

  const sponsor = await buildSponsorBlock(show.dealId);
  const chapterBlock = chaptersToDescriptionBlock(chapters);
  const base = show.seoDescription ?? `${show.title}\n\nLive on ${channel.displayName}.`;
  const description = `${base}${sponsor.copy ? `\n\n${sponsor.copy}` : ""}${chapterBlock}`.trim();

  await appendDescriptionPatch(showId, {
    at: new Date().toISOString(),
    note: "Auto live link + chapter update",
    snippet: sponsor.urls[0]?.url ?? chapterBlock.slice(0, 120),
  });

  let pushedToYoutube = false;
  let writeStatus: number | null = null;
  let writeError: string | undefined;

  if (
    !opts?.skipYoutubeWrite &&
    show.youtubeVideoId &&
    (await youtubeWriteReady(channel.id))
  ) {
    const write = await updateVideoMetadata(channel.id, show.youtubeVideoId, {
      description,
      tags: show.seoTags,
    });
    pushedToYoutube = write.ok;
    writeStatus = write.httpStatus;
    writeError = write.error;
    await logVerification({
      showRunId: showId,
      channelId: channel.id,
      action: "live_description_update",
      ok: write.ok,
      source: write.ok ? "youtube_api" : "blocked",
      videoId: show.youtubeVideoId,
      httpStatus: write.httpStatus,
      detail: write.ok ? "Live description + chapters pushed" : write.error ?? "Write failed",
    });
  } else if (opts?.skipYoutubeWrite) {
    writeError = "Preview run — YouTube write skipped";
  } else {
    writeError = "OAuth not connected for this channel";
  }

  const updated = await updateShow(showId, {
    seoDescription: description,
    liveChapters: chapters.map((c) => ({ ...c, status: "published" as const })),
  });

  return {
    show: updated!,
    chapters,
    description,
    pushedToYoutube,
    writeStatus,
    writeError,
  };
}
