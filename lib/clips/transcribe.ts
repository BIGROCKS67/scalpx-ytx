import fs from "fs";
import os from "os";
import path from "path";
import { runFfmpeg, probeDurationSec } from "@/lib/clips/ffmpegUtil";
import type { TranscriptCue } from "@/lib/clips/transcript";

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const MAX_BYTES = 24 * 1024 * 1024;
/** 5-minute chunks - reliable under Whisper 25MB limit at 64kbps mono. */
const CHUNK_SEC = 300;

export type TranscriptWord = { startSec: number; endSec: number; word: string };

function whisperApiKey(): string | null {
  const k = process.env.OPENAI_API_KEY?.trim();
  return k || null;
}

async function extractAudioChunk(
  filePath: string,
  outPath: string,
  startSec: number,
  durationSec: number
): Promise<void> {
  if (durationSec <= 0) throw new Error("Invalid audio chunk duration");

  // -ss after -i for accurate seek on long files (critical for chunk 2+).
  await runFfmpeg(
    [
      "-hide_banner",
      "-i",
      filePath,
      "-ss",
      String(startSec),
      "-t",
      String(durationSec),
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "64k",
      "-f",
      "mp3",
      "-y",
      outPath,
    ],
    300_000
  );
}

interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

interface WhisperVerboseResponse {
  segments?: WhisperSegment[];
  words?: WhisperWord[];
}

async function transcribeAudioFile(
  apiKey: string,
  audioPath: string,
  offsetSec = 0,
  withWords = false
): Promise<{ cues: TranscriptCue[]; words: TranscriptWord[] }> {
  const stat = fs.statSync(audioPath);
  if (stat.size > MAX_BYTES) {
    throw new Error("Audio chunk too large for Whisper");
  }
  if (stat.size < 500) {
    return { cues: [], words: [] };
  }

  const form = new FormData();
  const blob = new Blob([fs.readFileSync(audioPath)], { type: "audio/mpeg" });
  form.append("file", blob, "audio.mp3");
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  if (withWords) {
    form.append("timestamp_granularities[]", "word");
  }

  const res = await fetch(WHISPER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as WhisperVerboseResponse;
  const cues = (data.segments ?? []).map((s) => ({
    startSec: s.start + offsetSec,
    endSec: s.end + offsetSec,
    text: s.text.trim(),
  }));
  const words = (data.words ?? []).map((w) => ({
    startSec: w.start + offsetSec,
    endSec: w.end + offsetSec,
    word: w.word.trim(),
  }));

  return { cues, words };
}

/** Full-video speech-to-text via OpenAI Whisper (chunked for long streams). */
export async function transcribeVideoFile(
  filePath: string,
  durationSec: number,
  onChunk?: (chunk: number, totalChunks: number) => void | Promise<void>
): Promise<TranscriptCue[]> {
  const { cues } = await transcribeVideoFileWithWords(filePath, durationSec, onChunk);
  return cues;
}

/** Full video with word timestamps for karaoke captions. */
export async function transcribeVideoFileWithWords(
  filePath: string,
  durationSec: number,
  onChunk?: (chunk: number, totalChunks: number) => void | Promise<void>
): Promise<{ cues: TranscriptCue[]; words: TranscriptWord[] }> {
  const apiKey = whisperApiKey();
  if (!apiKey) return { cues: [], words: [] };

  const probed = await probeDurationSec(filePath);
  const total = Math.max(probed, durationSec > 0 ? durationSec : 0, 1);

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "flowx-whisper-"));
  const cues: TranscriptCue[] = [];
  const words: TranscriptWord[] = [];

  try {
    const totalChunks = Math.max(1, Math.ceil(total / CHUNK_SEC));
    let start = 0;
    let chunkIdx = 0;

    while (start < total - 0.5) {
      const chunkDur = Math.min(CHUNK_SEC, total - start);
      if (chunkDur < 1) break;

      const audioPath = path.join(tmpDir, `chunk-${chunkIdx}.mp3`);
      await extractAudioChunk(filePath, audioPath, start, chunkDur);

      const size = fs.statSync(audioPath).size;
      if (size < 500) {
        console.warn(`[whisper] chunk ${chunkIdx} empty at ${start}s - skipping`);
        start += CHUNK_SEC;
        chunkIdx += 1;
        continue;
      }

      await onChunk?.(chunkIdx + 1, totalChunks);
      const part = await transcribeAudioFile(apiKey, audioPath, start, true);
      cues.push(...part.cues);
      words.push(...part.words);

      start += CHUNK_SEC;
      chunkIdx += 1;
      await fs.promises.unlink(audioPath).catch(() => {});
    }

    return {
      cues: cues.filter((c) => c.text.length > 0),
      words: words.filter((w) => w.word.length > 0),
    };
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Transcribe a single clip segment with word timestamps (for export captions). */
export async function transcribeSegmentWithWords(
  filePath: string,
  startSec: number,
  endSec: number
): Promise<{ cues: TranscriptCue[]; words: TranscriptWord[] }> {
  const apiKey = whisperApiKey();
  if (!apiKey) return { cues: [], words: [] };

  const dur = Math.max(1, endSec - startSec);
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "flowx-whisper-seg-"));
  const audioPath = path.join(tmpDir, "segment.mp3");

  try {
    await extractAudioChunk(filePath, audioPath, startSec, dur);
    if (fs.statSync(audioPath).size < 500) return { cues: [], words: [] };
    return await transcribeAudioFile(apiKey, audioPath, startSec, true);
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function whisperConfigured(): boolean {
  return Boolean(whisperApiKey());
}
