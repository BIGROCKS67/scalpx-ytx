import fs from "fs";
import os from "os";
import path from "path";
import { runYtDlp } from "@/lib/clips/ytDlp";

export interface TranscriptCue {
  startSec: number;
  endSec: number;
  text: string;
}

export function parseVtt(raw: string): TranscriptCue[] {
  const cues: TranscriptCue[] = [];
  const blocks = raw.replace(/\r\n/g, "\n").split("\n\n");
  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    const timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine) continue;
    const [startRaw, endRaw] = timeLine.split("-->").map((s) => s.trim());
    const startSec = vttTimeToSec(startRaw);
    const endSec = vttTimeToSec(endRaw);
    const text = lines
      .filter((l) => l !== timeLine && !/^\d+$/.test(l) && !l.startsWith("WEBVTT"))
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (text) cues.push({ startSec, endSec, text });
  }
  return cues;
}

function vttTimeToSec(t: string): number {
  const clean = t.split(" ")[0];
  const parts = clean.split(":");
  if (parts.length === 3) {
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  }
  if (parts.length === 2) {
    return Number(parts[0]) * 60 + Number(parts[1]);
  }
  return Number(clean) || 0;
}

/** Pull YouTube auto-captions (no video re-download). */
export async function fetchYouTubeTranscript(youtubeUrl: string): Promise<TranscriptCue[]> {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "flowx-vtt-"));
  const outBase = path.join(tmpDir, "subs");
  try {
    await runYtDlp([
      "--write-auto-sub",
      "--write-subs",
      "--sub-langs",
      "en.*,en",
      "--convert-subs",
      "vtt",
      "--skip-download",
      "-o",
      outBase,
      youtubeUrl,
    ]);
    const files = await fs.promises.readdir(tmpDir);
    const vtt = files.find((f) => f.endsWith(".vtt"));
    if (!vtt) return [];
    const raw = await fs.promises.readFile(path.join(tmpDir, vtt), "utf8");
    return parseVtt(raw);
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
