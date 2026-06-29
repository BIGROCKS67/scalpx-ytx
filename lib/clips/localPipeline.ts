import { importYouTubeClipSource } from "@/lib/clips/youtubeImport";
import { analyzeClipSource } from "@/lib/clips/analyze";
import { exportMomentClip } from "@/lib/clips/exportMoment";
import { listMomentsForSource } from "@/lib/clips/momentsStore";
import { newClipSource, upsertClipSource } from "@/lib/clips/store";
import type { ClipBatch } from "@/lib/types";

/** Local Scout Clips pipeline - yt-dlp · Whisper · ffmpeg · Shorts export. */
export async function runLocalClipsPipeline(
  youtubeUrl: string,
  onProgress?: (msg: string) => void
): Promise<Partial<ClipBatch>> {
  onProgress?.("Importing from YouTube (yt-dlp)…");
  const imported = await importYouTubeClipSource(youtubeUrl);

  const source = newClipSource({
    title: imported.title,
    fileUrl: imported.url,
    fileName: imported.fileName,
    mimeType: imported.mimeType,
    sizeBytes: imported.sizeBytes,
    durationSec: imported.durationSec,
    youtubeVideoId: imported.videoId,
  });
  await upsertClipSource(source);

  onProgress?.("Detecting moments (transcript + energy scan)…");
  await analyzeClipSource(source.id, async (p) => {
    onProgress?.(p.message);
  });

  const moments = await listMomentsForSource(source.id);
  const ranked = [...moments].sort((a, b) => b.score - a.score);
  const shortsCandidates = ranked.slice(0, 5);
  const xCandidates = ranked.slice(0, 3);

  onProgress?.("Exporting YouTube Shorts…");
  const exportUrls: string[] = [];
  const errors: string[] = [];

  for (const m of shortsCandidates) {
    try {
      const url = await exportMomentClip(m.id, {
        format: "shorts",
        withCaptions: true,
        withHook: true,
      });
      exportUrls.push(url);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Shorts export failed");
    }
  }

  for (const m of xCandidates) {
    try {
      const url = await exportMomentClip(m.id, {
        format: "square",
        withCaptions: true,
        withHook: true,
        force: true,
      });
      exportUrls.push(url);
    } catch {
      /* X clip optional */
    }
  }

  const momentIds = shortsCandidates.map((m) => m.id);

  return {
    scoutSourceId: source.id,
    momentIds,
    exportUrls,
    status: exportUrls.length ? "done" : errors.length ? "error" : "analyzing",
    message: exportUrls.length
      ? `${exportUrls.length} clips exported locally (${shortsCandidates.length} Shorts + X moments)`
      : errors[0] ?? `${moments.length} moments detected - export needs ffmpeg + OPENAI_API_KEY for captions`,
  };
}
