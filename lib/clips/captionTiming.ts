import type { CaptionWord } from "@/lib/clips/captionAss";

/**
 * Small lead so the highlight lands ON the spoken word rather than ahead of it.
 * Whisper tends to mark word starts a touch late, so a tiny lead reads as "in sync"
 * without feeling early. (Was 0.1 - that fired the highlight noticeably early.)
 */
export const CAPTION_LEAD_SEC = 0.04;
/** Minimum visible duration per word. */
export const CAPTION_MIN_WORD_SEC = 0.08;
/** Tail padding so the last word doesn't cut off abruptly. */
export const CAPTION_TAIL_SEC = 0.15;
export const CAPTION_CHUNK_SIZE = 4;
/**
 * Words whose clip-relative start is earlier than this (i.e. spoken before the clip began)
 * are dropped instead of being clamped to t=0 - otherwise they'd flash on at clip open
 * before they're actually said. A small negative tolerance keeps words that straddle the cut.
 */
export const CAPTION_PRECLIP_TOLERANCE_SEC = -0.3;

export const CAPTION_SPEED_MIN = 0.6;
export const CAPTION_SPEED_MAX = 1.4;

export function clampCaptionSpeed(raw?: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(CAPTION_SPEED_MAX, Math.max(CAPTION_SPEED_MIN, n));
}

export type ClipRelativeWord = { start: number; end: number; word: string };

/**
 * Convert absolute word timestamps to clip-relative CapCut-snapped words.
 * `offsetSec` shifts timing; `speed` (<1) stretches the timeline so words reveal slower.
 */
export function snapCapCutWords(
  words: CaptionWord[],
  clipStartSec: number,
  clipDurationSec: number,
  offsetSec = 0,
  speed = 1
): ClipRelativeWord[] {
  const inv = speed > 0 ? 1 / speed : 1;
  const rel = words
    .map((w) => ({
      start: (w.startSec - clipStartSec) * inv,
      end: (w.endSec - clipStartSec) * inv,
      word: w.word.trim(),
    }))
    // Drop empty words, words that start at/after the clip end (would cram onto the final
    // frame), and words spoken before the clip began (would flash on early at t=0).
    .filter(
      (w) =>
        w.word &&
        w.end > w.start &&
        w.start < clipDurationSec - 0.02 &&
        w.start > CAPTION_PRECLIP_TOLERANCE_SEC
    )
    .sort((a, b) => a.start - b.start);

  if (rel.length === 0) return [];

  const out: ClipRelativeWord[] = [];

  for (let i = 0; i < rel.length; i++) {
    const w = rel[i];
    const next = rel[i + 1];
    let start = w.start - CAPTION_LEAD_SEC + offsetSec;
    let end = w.end + CAPTION_TAIL_SEC + offsetSec;

    if (next) {
      end = Math.min(end, next.start - CAPTION_LEAD_SEC + offsetSec);
    }

    start = Math.max(0, start);
    end = Math.min(clipDurationSec, end);
    end = Math.max(start + CAPTION_MIN_WORD_SEC, end);

    out.push({ start, end, word: w.word });
  }

  return out;
}

export function chunkWords(words: ClipRelativeWord[], size = CAPTION_CHUNK_SIZE): ClipRelativeWord[][] {
  const chunks: ClipRelativeWord[][] = [];
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size));
  }
  // Avoid an orphan final line with a single dangling word - merge it into the previous line.
  if (chunks.length > 1 && chunks[chunks.length - 1].length === 1) {
    const orphan = chunks.pop()!;
    chunks[chunks.length - 1].push(...orphan);
  }
  return chunks;
}

/** Rebuild word timings after user edits line text (keeps line window, splits time evenly). */
export function wordsFromEditedLines(
  lines: string[],
  original: ClipRelativeWord[]
): ClipRelativeWord[] {
  const chunks = chunkWords(original);
  const out: ClipRelativeWord[] = [];

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    const text = lines[ci]?.trim() ?? "";
    const newWords = text.split(/\s+/).filter(Boolean);
    if (newWords.length === 0) continue;

    const lineStart = chunk[0].start;
    const lineEnd = chunk[chunk.length - 1].end;
    const span = Math.max(CAPTION_MIN_WORD_SEC * newWords.length, lineEnd - lineStart);
    const step = span / newWords.length;

    for (let wi = 0; wi < newWords.length; wi++) {
      const start = lineStart + wi * step;
      const end = lineStart + (wi + 1) * step;
      out.push({ start, end, word: newWords[wi] });
    }
  }

  return out;
}

/** Evenly-spaced words when only phrase lines exist (no Whisper word timestamps). */
export function wordsFromLinesOnly(lines: string[], clipDurationSec: number): ClipRelativeWord[] {
  const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return [];

  const out: ClipRelativeWord[] = [];
  const chunkDur = clipDurationSec / nonEmpty.length;

  for (let li = 0; li < nonEmpty.length; li++) {
    const parts = nonEmpty[li].split(/\s+/).filter(Boolean);
    const lineStart = li * chunkDur;
    const lineEnd = (li + 1) * chunkDur;
    const step = Math.max(CAPTION_MIN_WORD_SEC, (lineEnd - lineStart) / parts.length);

    for (let wi = 0; wi < parts.length; wi++) {
      const start = lineStart + wi * step;
      const end = Math.min(clipDurationSec, start + step);
      out.push({ start, end, word: parts[wi] });
    }
  }

  return out;
}

export function clipRelativeToAbsolute(
  words: ClipRelativeWord[],
  clipStartSec: number
): CaptionWord[] {
  return words.map((w) => ({
    word: w.word,
    startSec: w.start + clipStartSec,
    endSec: w.end + clipStartSec,
  }));
}

/** Find active word index at playback time (clip-relative seconds). */
export function activeWordIndex(words: ClipRelativeWord[], t: number): number {
  for (let i = words.length - 1; i >= 0; i--) {
    if (t >= words[i].start) return i;
  }
  return -1;
}

export function activeChunkIndex(words: ClipRelativeWord[], t: number): number {
  const idx = activeWordIndex(words, t);
  if (idx < 0) return -1;
  return Math.floor(idx / CAPTION_CHUNK_SIZE);
}
