import fs from "fs";
import os from "os";
import path from "path";
import {
  getClipMoment,
  updateMomentClipUrl,
  updateMomentTranscriptJson,
} from "@/lib/clips/momentsStore";
import { getClipSource } from "@/lib/clips/store";
import { resolveSourceFilePath } from "@/lib/clips/sourceFile";
import { cutClipSegment, probeVideoSize } from "@/lib/clips/ffmpegUtil";
import { storeClipSourceFromPath } from "@/lib/clips/videoUpload";
import type { ClipExportFormat, ClipExportQuality, CropFocus } from "@/lib/clips/clipFormats";
import { CLIP_FORMAT_SPECS } from "@/lib/clips/clipFormats";
import type { MomentTranscriptData } from "@/lib/clips/types";
import { writeAssKaraokeFile, writeAssPhraseFile } from "@/lib/clips/captionAss";
import { normalizeCaptionStyle } from "@/lib/clips/captionStyle";
import { clampCaptionSpeed } from "@/lib/clips/captionTiming";
import { transcribeSegmentWithWords, whisperConfigured } from "@/lib/clips/transcribe";

export type ExportMomentOpts = {
  withCaptions?: boolean;
  autoCaptions?: boolean;
  withHook?: boolean;
  format?: ClipExportFormat;
  quality?: ClipExportQuality;
  cropFocus?: CropFocus;
  force?: boolean;
  transcriptJson?: string;
};

function parseTranscriptJson(raw: string): MomentTranscriptData {
  if (!raw) return { cues: [], words: [], captionOffsetSec: 0, captionStyle: normalizeCaptionStyle() };
  try {
    const p = JSON.parse(raw) as MomentTranscriptData;
    return {
      cues: Array.isArray(p.cues) ? p.cues : [],
      words: Array.isArray(p.words) ? p.words : [],
      captionOffsetSec: Number(p.captionOffsetSec) || 0,
      captionSpeed: clampCaptionSpeed(p.captionSpeed),
      captionStyle: normalizeCaptionStyle(p.captionStyle),
    };
  } catch {
    return { cues: [], words: [], captionOffsetSec: 0, captionSpeed: 1, captionStyle: normalizeCaptionStyle() };
  }
}

/** Cut a moment segment with platform format, HQ encode, and optional auto captions. */
export async function exportMomentClip(momentId: string, opts?: ExportMomentOpts): Promise<string> {
  const moment = await getClipMoment(momentId);
  if (!moment) throw new Error("Moment not found");

  const autoCaptions = opts?.autoCaptions ?? opts?.withCaptions ?? true;
  const withHook = opts?.withHook ?? true;
  const format = opts?.format ?? "tiktok";
  const quality = opts?.quality ?? "high";
  const force = opts?.force ?? false;
  const spec = CLIP_FORMAT_SPECS[format];

  if (moment.clipUrl && !force) return moment.clipUrl;

  const source = await getClipSource(moment.sourceId);
  if (!source) throw new Error("Source not found");

  const { filePath, cleanup } = await resolveSourceFilePath(source);
  const cropFocus: CropFocus = opts?.cropFocus ?? "fit";
  const srcSize = await probeVideoSize(filePath);
  // "original" keeps the source dimensions, so the caption canvas must match the
  // real output size - otherwise captions render against the wrong aspect and fall off-screen.
  const playRes =
    !spec.width || !spec.height
      ? { w: srcSize.width, h: srcSize.height }
      : { w: spec.width, h: spec.height };
  const transcriptRaw = opts?.transcriptJson ?? moment.transcriptJson;
  const parsedTranscript = parseTranscriptJson(transcriptRaw);
  const clientTranscript = Boolean(opts?.transcriptJson);
  const captionLayout = {
    playRes,
    srcSize,
    cropFocus,
    offsetSec: parsedTranscript.captionOffsetSec ?? 0,
    speed: parsedTranscript.captionSpeed ?? 1,
    style: parsedTranscript.captionStyle,
  };

  const tmpOut = path.join(os.tmpdir(), `flowx-moment-${moment.id}.mp4`);
  const assPath = path.join(os.tmpdir(), `flowx-caps-${moment.id}.ass`);

  try {
    let assFile: string | undefined;
    const clipDur = moment.endSec - moment.startSec;

    if (autoCaptions) {
      let transcript = parsedTranscript;
      let words = transcript.words ?? [];

      // Never fall back to stale phrase cues when the user just saved edited words.
      if (clientTranscript) {
        transcript = { ...transcript, cues: [] };
      }

      if (words.length === 0 && whisperConfigured()) {
        try {
          const seg = await transcribeSegmentWithWords(filePath, moment.startSec, moment.endSec);
          words = seg.words;
          if (transcript.cues.length === 0) transcript.cues = seg.cues;
          if (words.length > 0 || seg.cues.length > 0) {
            await updateMomentTranscriptJson(
              moment.id,
              JSON.stringify({
                cues: seg.cues.length > 0 ? seg.cues : transcript.cues,
                words,
              })
            );
          }
        } catch (e) {
          console.warn("[clips/export] segment whisper", e);
        }
      }

      if (words.length > 0) {
        if (writeAssKaraokeFile(words, moment.startSec, clipDur, assPath, captionLayout)) {
          assFile = assPath;
        }
      } else if (transcript.cues.length > 0) {
        if (writeAssPhraseFile(transcript.cues, moment.startSec, clipDur, assPath, captionLayout)) {
          assFile = assPath;
        }
      } else if (whisperConfigured()) {
        throw new Error("No speech detected in this clip - captions need audible dialogue.");
      } else {
        throw new Error(
          "Captions need OPENAI_API_KEY (Whisper) in .env.local - restart dev server after adding."
        );
      }
    }

    const cutOpts = {
      hook: withHook ? moment.hook : undefined,
      assPath: assFile,
      format,
      quality,
      cropFocus,
    };

    try {
      await cutClipSegment(filePath, tmpOut, moment.startSec, moment.endSec, cutOpts);
    } catch (captionErr) {
      console.warn("[clips/export] captioned export failed, retrying plain cut", captionErr);
      await cutClipSegment(filePath, tmpOut, moment.startSec, moment.endSec, {
        hook: withHook ? moment.hook : undefined,
        format,
        quality,
        cropFocus,
      });
    }

    const safeName = moment.title.replace(/[^\w\s.-]/g, "").trim() || "clip";
    const stored = await storeClipSourceFromPath(tmpOut, {
      fileName: `${safeName}.mp4`,
      mimeType: "video/mp4",
    });
    await updateMomentClipUrl(moment.id, stored.url);
    if (opts?.transcriptJson) {
      await updateMomentTranscriptJson(moment.id, opts.transcriptJson);
    }
    return stored.url;
  } finally {
    await cleanup();
    await fs.promises.unlink(tmpOut).catch(() => {});
    await fs.promises.unlink(assPath).catch(() => {});
  }
}
