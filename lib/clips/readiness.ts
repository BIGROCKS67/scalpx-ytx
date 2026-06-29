import fs from "fs";
import { spawnSync } from "child_process";
import { dataDirectory } from "@/lib/storage";
import { resolveYtDlpBin } from "@/lib/clips/ytDlp";
import { getFfmpegRuntime } from "@/lib/clips/ffmpegUtil";
import { whisperConfigured } from "@/lib/clips/transcribe";

export type ReadinessBlocker = {
  code: string;
  message: string;
  fix: string;
};

export type ClipsReadiness = {
  ready: boolean;
  blockers: ReadinessBlocker[];
  warnings: string[];
};

function checkExecutable(bin: string, args: string[]): boolean {
  try {
    const res = spawnSync(bin, args, { encoding: "utf8", timeout: 8000 });
    return res.status === 0 || Boolean(res.stdout || res.stderr);
  } catch {
    return false;
  }
}

export async function checkClipsReadiness(): Promise<ClipsReadiness> {
  const blockers: ReadinessBlocker[] = [];
  const warnings: string[] = [];

  try {
    const ytDlp = resolveYtDlpBin();
    if (!checkExecutable(ytDlp, ["--version"])) {
      blockers.push({
        code: "yt_dlp_missing",
        message: "yt-dlp is not available",
        fix: "Run npm install or brew install yt-dlp",
      });
    }
  } catch {
    blockers.push({
      code: "yt_dlp_missing",
      message: "yt-dlp is not available",
      fix: "Run npm install or brew install yt-dlp",
    });
  }

  try {
    const ffmpeg = await getFfmpegRuntime();
    if (!checkExecutable(ffmpeg.bin, ["-version"])) {
      blockers.push({
        code: "ffmpeg_missing",
        message: "ffmpeg is not available",
        fix: "Install ffmpeg-static via npm or brew install ffmpeg-full",
      });
    } else if (!ffmpeg.subtitles) {
      warnings.push("ffmpeg lacks libass — Shorts may export without burned captions");
    }
  } catch {
    blockers.push({
      code: "ffmpeg_missing",
      message: "ffmpeg is not available",
      fix: "Install ffmpeg-static via npm or brew install ffmpeg-full",
    });
  }

  const dataDir = dataDirectory();
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.accessSync(dataDir, fs.constants.W_OK);
  } catch {
    blockers.push({
      code: "storage_not_writable",
      message: `Cannot write to ${dataDir}`,
      fix: "Set YTX_DATA_DIR to a writable path",
    });
  }

  if (!whisperConfigured()) {
    warnings.push(
      "OPENAI_API_KEY not set — clips need YouTube auto-captions or Whisper for export"
    );
  }

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
  };
}
