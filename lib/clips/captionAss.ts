import fs from "fs";
import type { CropFocus } from "@/lib/clips/clipFormats";
import type { CaptionStyle } from "@/lib/clips/captionStyle";
import { hexToAssColor, normalizeCaptionStyle } from "@/lib/clips/captionStyle";
import {
  CAPTION_CHUNK_SIZE,
  chunkWords,
  snapCapCutWords,
  type ClipRelativeWord,
} from "@/lib/clips/captionTiming";

export type CaptionWord = { startSec: number; endSec: number; word: string };

export type CaptionLayout = {
  playRes: { w: number; h: number };
  srcSize?: { width: number; height: number };
  cropFocus?: CropFocus;
  offsetSec?: number;
  speed?: number;
  style?: CaptionStyle;
};

function assTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/** Bottom margin for captions - sits in letterbox band when video is fit with black bars. */
export function computeCaptionMarginV(layout: CaptionLayout): number {
  const { playRes, srcSize, cropFocus } = layout;
  if (!srcSize || cropFocus !== "fit") return 200;

  const scale = Math.min(playRes.w / srcSize.width, playRes.h / srcSize.height);
  const scaledH = srcSize.height * scale;
  const letterbox = (playRes.h - scaledH) / 2;
  if (letterbox < 40) return 48;
  return Math.round(letterbox / 2 + 36);
}

function assHeader(playRes: { w: number; h: number }, styleLine: string): string {
  return [
    "[Script Info]",
    "Title: FlowX Captions",
    "ScriptType: v4.00+",
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "YCbCr Matrix: TV.601",
    "PlayResX: " + playRes.w,
    "PlayResY: " + playRes.h,
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    styleLine,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ].join("\n");
}

/** CapCut-style line - active word colored + scaled (pop). */
function capCutLineText(
  chunk: ClipRelativeWord[],
  activeIdx: number,
  style: CaptionStyle
): string {
  const textAss = hexToAssColor(style.textColor);
  const hiAss = hexToAssColor(style.highlightColor);
  const pop = Math.round(style.popScale * 100);

  return chunk
    .map((w, i) => {
      const clean = w.word.replace(/[{}\\]/g, "").trim();
      if (!clean) return "";
      if (i === activeIdx) {
        return `{\\1c${hiAss}\\fscx${pop}\\fscy${pop}}${clean}{\\1c${textAss}\\fscx100\\fscy100}`;
      }
      return clean;
    })
    .filter(Boolean)
    .join(" ");
}

/** Caption sizing is authored for a 1080px-wide frame; scale to the real output width. */
const CAPTION_REFERENCE_WIDTH = 1080;

function assStyleLine(style: CaptionStyle, marginV: number, frameWidth: number): string {
  const primary = hexToAssColor(style.textColor);
  const secondary = hexToAssColor(style.highlightColor);
  const scale = Math.max(0.4, Math.min(2, frameWidth / CAPTION_REFERENCE_WIDTH));
  const fontSize = Math.round(style.fontSize * scale);
  const outline = Math.max(2, Math.round(6 * scale));
  const margin = Math.round(56 * scale);
  const spacing = Math.round((style.spacing ?? 0) * scale);
  return `Style: Karaoke,Arial Bold,${fontSize},${primary},${secondary},&H00000000,&H96000000,1,0,0,0,100,100,${spacing},0,1,${outline},0,2,${margin},${margin},${marginV},1`;
}

/** Write karaoke ASS from clip-relative words (already snapped). */
export function writeAssFromClipWords(
  clipWords: ClipRelativeWord[],
  clipDurationSec: number,
  outPath: string,
  layout: CaptionLayout = { playRes: { w: 1080, h: 1920 } }
): boolean {
  if (clipWords.length === 0) return false;

  const playRes = layout.playRes;
  const marginV = computeCaptionMarginV(layout);
  const style = normalizeCaptionStyle(layout.style);
  const lines: string[] = [];
  const chunks = chunkWords(clipWords, CAPTION_CHUNK_SIZE);

  // Each active-word state is shown from its start until the NEXT word starts, so exactly one
  // caption line is ever on screen. The last word of a chunk holds until the next chunk begins.
  // This prevents stacked/duplicated lines when words are tightly spaced.
  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    const nextChunk = chunks[ci + 1];
    const chunkHoldEnd = Math.min(
      clipDurationSec,
      nextChunk ? nextChunk[0].start : chunk[chunk.length - 1].end + 0.4
    );

    for (let wi = 0; wi < chunk.length; wi++) {
      const w = chunk[wi];
      const nextW = chunk[wi + 1];
      const text = capCutLineText(chunk, wi, style);
      if (!text) continue;

      const start = Math.max(0, Math.min(w.start, clipDurationSec - 0.02));
      let end = Math.min(clipDurationSec, nextW ? nextW.start : chunkHoldEnd);

      if (end - start < 0.04) {
        // Collapsed/overlapping timing: skip intermediate words, but always keep the last
        // word of the chunk so the line stays visible.
        if (nextW) continue;
        end = Math.min(clipDurationSec, start + 0.04);
      }

      lines.push(
        `Dialogue: 0,${assTime(start)},${assTime(end)},Karaoke,,0,0,0,,${text}`
      );
    }
  }

  const styleLine = assStyleLine(style, marginV, playRes.w);
  fs.writeFileSync(outPath, `${assHeader(playRes, styleLine)}\n${lines.join("\n")}\n`, "utf8");
  return true;
}

/** CapCut-style bottom captions from absolute word timestamps. */
export function writeAssKaraokeFile(
  words: CaptionWord[],
  clipStartSec: number,
  clipDurationSec: number,
  outPath: string,
  layout: CaptionLayout = { playRes: { w: 1080, h: 1920 } }
): boolean {
  const clipWords = snapCapCutWords(
    words,
    clipStartSec,
    clipDurationSec,
    layout.offsetSec ?? 0,
    layout.speed ?? 1
  );
  return writeAssFromClipWords(clipWords, clipDurationSec, outPath, layout);
}

/** Phrase captions when word timestamps unavailable. */
export function writeAssPhraseFile(
  cues: Array<{ startSec: number; endSec: number; text: string }>,
  clipStartSec: number,
  clipDurationSec: number,
  outPath: string,
  layout: CaptionLayout = { playRes: { w: 1080, h: 1920 } }
): boolean {
  const playRes = layout.playRes;
  const offset = layout.offsetSec ?? 0;
  const rel = cues
    .map((c) => ({
      start: Math.max(0, c.startSec - clipStartSec + offset),
      end: Math.min(clipDurationSec, c.endSec - clipStartSec + offset),
      text: c.text.replace(/[{}\\]/g, "").trim(),
    }))
    .filter((c) => c.text && c.end > c.start);

  if (rel.length === 0) return false;

  const marginV = computeCaptionMarginV(layout);
  const lines = rel.map(
    (c) =>
      `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Phrase,,0,0,0,,${c.text.replace(/\n/g, " ")}`
  );

  // Scale to the real output width and honour the chosen colors, matching the karaoke path.
  const style = normalizeCaptionStyle(layout.style);
  const scale = Math.max(0.4, Math.min(2, playRes.w / CAPTION_REFERENCE_WIDTH));
  const fontSize = Math.round(style.fontSize * scale);
  const outline = Math.max(2, Math.round(6 * scale));
  const margin = Math.round(56 * scale);
  const spacing = Math.round((style.spacing ?? 0) * scale);
  const primary = hexToAssColor(style.textColor);
  const secondary = hexToAssColor(style.highlightColor);
  const styleLine = `Style: Phrase,Arial Bold,${fontSize},${primary},${secondary},&H00000000,&H96000000,1,0,0,0,100,100,${spacing},0,1,${outline},0,2,${margin},${margin},${marginV},1`;
  fs.writeFileSync(outPath, `${assHeader(playRes, styleLine)}\n${lines.join("\n")}\n`, "utf8");
  return true;
}
