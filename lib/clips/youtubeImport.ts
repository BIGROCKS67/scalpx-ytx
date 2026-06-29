import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import {
  isYouTubeUrl,
  parseYouTubeVideoId,
  youtubeThumbnailUrl,
} from "@/lib/youtube/video";
import { getSettings } from "@/lib/store";
import { getYouTubeVideo } from "@/lib/social";
import { storeClipSourceFromPath } from "@/lib/clips/videoUpload";
import {
  clearImportRun,
  isImportCancelled,
  registerImportRun,
  registerImportUploadKill,
} from "@/lib/clips/importCancel";
import { normalizeYtImportHeight } from "@/lib/clips/importQuality";

export interface YouTubeImportResult {
  url: string;
  storage: "blob" | "local";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  title: string;
  videoId: string;
  durationSec: number | null;
  thumbnailUrl: string;
}

function resolveYtDlpBin(): string {
  const env = process.env.YT_DLP_PATH?.trim();
  if (env && fs.existsSync(env)) return env;

  const projectBin = path.join(process.cwd(), "bin", "yt-dlp");
  if (fs.existsSync(projectBin)) return projectBin;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const staticPath = require("yt-dlp-static") as string;
    if (staticPath && fs.existsSync(staticPath)) return staticPath;
  } catch {
    // optional dependency path
  }

  return "yt-dlp";
}

export interface YouTubeImportProgress {
  phase: "metadata" | "downloading" | "saving";
  progress: number;
  message: string;
}

export interface YouTubeImportOptions {
  title?: string;
  description?: string;
  jobId?: string;
  maxHeight?: number;
  onProgress?: (p: YouTubeImportProgress) => void | Promise<void>;
}

function parseDownloadProgress(line: string): { pct: number; detail: string } | null {
  const pctMatch = /\[download\]\s+(\d+(?:\.\d+)?)%/.exec(line);
  if (!pctMatch) return null;
  const sizeMatch = /of\s+([\d.]+[KMG]?i?B)/i.exec(line);
  const speedMatch = /at\s+([\d.]+[KMG]?i?B\/s)/i.exec(line);
  const detail = sizeMatch
    ? `${pctMatch[1]}% of ${sizeMatch[1]}${speedMatch ? ` · ${speedMatch[1]}` : ""}`
    : `${pctMatch[1]}%`;
  return { pct: Number(pctMatch[1]), detail };
}

function runYtDlp(
  bin: string,
  args: string[],
  timeoutMs = 280_000,
  onLine?: (line: string) => void | Promise<void>,
  jobId?: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    if (jobId) registerImportRun(jobId, child);

    let stdout = "";
    let stderr = "";
    let stderrBuf = "";
    const flushLines = (chunk: string, isErr: boolean) => {
      if (isErr) stderr += chunk;
      else stdout += chunk;
      if (!onLine) return;
      stderrBuf += chunk;
      const parts = stderrBuf.split(/\r?\n/);
      stderrBuf = parts.pop() ?? "";
      for (const line of parts) {
        if (line.trim()) void onLine(line);
      }
    };
    child.stdout.on("data", (d) => flushLines(d.toString(), false));
    child.stderr.on("data", (d) => flushLines(d.toString(), true));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("YouTube download timed out - try a shorter video or upload the file manually"));
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(
          new Error(
            "yt-dlp not found - install with brew install yt-dlp or set YT_DLP_PATH"
          )
        );
      } else {
        reject(err);
      }
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (jobId && isImportCancelled(jobId)) {
        reject(new Error("Import cancelled"));
        return;
      }
      if (code === 0) resolve({ stdout, stderr });
      else {
        if (signal === "SIGKILL" && jobId && isImportCancelled(jobId)) {
          reject(new Error("Import cancelled"));
          return;
        }
        const tail = stderr.trim().split("\n").slice(-3).join(" ") || `exit ${code}`;
        reject(new Error(tail || "YouTube download failed"));
      }
    });
  });
}

async function fetchMetadata(
  youtubeUrl: string,
  videoId: string
): Promise<{ title: string; durationSec: number | null }> {
  try {
    const settings = await getSettings();
    const key = settings.scrapeCreatorsKey?.trim();
    if (key) {
      const details = await getYouTubeVideo(youtubeUrl, key);
      if (details?.title) {
        return { title: details.title, durationSec: null };
      }
    }
  } catch {
    // fall through to yt-dlp metadata
  }

  const bin = resolveYtDlpBin();
  const { stdout } = await runYtDlp(bin, [
    "--no-download",
    "--print",
    "%(title)s",
    "--print",
    "%(duration)s",
    youtubeUrl,
  ]);
  const lines = stdout.trim().split("\n");
  const title = lines[0]?.trim() || "YouTube video";
  const durationRaw = lines[1]?.trim();
  const durationSec = durationRaw && Number.isFinite(Number(durationRaw))
    ? Number(durationRaw)
    : null;
  return { title, durationSec };
}

function clipYtMaxHeight(override?: number): number {
  return normalizeYtImportHeight(override);
}

function clipYtConcurrentFragments(): number {
  const raw = process.env.FLOWX_CLIP_YT_FRAGMENTS?.trim();
  const n = raw ? Number(raw) : 8;
  return Number.isFinite(n) && n >= 1 && n <= 16 ? Math.floor(n) : 8;
}

function ytDlpDownloadArgs(youtubeUrl: string, outTemplate: string, maxH: number): string[] {
  return [
    "--newline",
    "--no-playlist",
    "--merge-output-format",
    "mp4",
    "--concurrent-fragments",
    String(clipYtConcurrentFragments()),
    "--extractor-args",
    "youtube:player_client=android",
    "-S",
    `res:${maxH},ext:mp4:m4a`,
    "-f",
    `bv*[height<=${maxH}]+ba/b[height<=${maxH}]/bv*+ba/b`,
    "--max-filesize",
    "500m",
    "-o",
    outTemplate,
    youtubeUrl,
  ];
}

/** Download a YouTube video and store it as a clip source file (Blob or local disk). */
export async function importYouTubeClipSource(
  youtubeUrl: string,
  opts?: YouTubeImportOptions
): Promise<YouTubeImportResult> {
  const raw = youtubeUrl.trim();
  if (!isYouTubeUrl(raw)) {
    throw new Error("Paste a valid YouTube link (watch, Shorts, or youtu.be)");
  }
  const videoId = parseYouTubeVideoId(raw);
  if (!videoId) throw new Error("Could not parse YouTube video id");

  const jobId = opts?.jobId;

  const assertNotCancelled = () => {
    if (jobId && isImportCancelled(jobId)) {
      throw new Error("Import cancelled");
    }
  };

  const report = async (phase: YouTubeImportProgress["phase"], progress: number, message: string) => {
    assertNotCancelled();
    await opts?.onProgress?.({ phase, progress, message });
  };

  await report("metadata", 2, "Reading video info…");
  assertNotCancelled();
  const meta = await fetchMetadata(raw, videoId);
  const title = opts?.title?.trim() || meta.title;
  const maxH = clipYtMaxHeight(opts?.maxHeight);
  await report(
    "metadata",
    8,
    `Found: ${title.slice(0, 50)}${title.length > 50 ? "…" : ""} · pulling ${maxH}p`
  );

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "flowx-yt-"));
  const outTemplate = path.join(tmpDir, `${videoId}.%(ext)s`);
  const bin = resolveYtDlpBin();

  try {
    await runYtDlp(
      bin,
      ytDlpDownloadArgs(raw, outTemplate, maxH),
      280_000,
      async (line) => {
        const dl = parseDownloadProgress(line);
        if (dl) {
          const mapped = 8 + (dl.pct / 100) * 82;
          await report("downloading", mapped, `Downloading… ${dl.detail}`);
        }
      },
      jobId
    );

    assertNotCancelled();
    const files = await fs.promises.readdir(tmpDir);
    const downloaded = files.find((f) => f.startsWith(videoId));
    if (!downloaded) throw new Error("Download finished but no file was saved");

    const filePath = path.join(tmpDir, downloaded);
    const fileSize = fs.statSync(filePath).size;
    const sizeMb = (fileSize / (1024 * 1024)).toFixed(1);
    const usesBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
    const saveStart = Date.now();

    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let lastUploadPct = 0;

    const startSaveHeartbeat = (msg: string) => {
      heartbeat = setInterval(() => {
        const elapsed = Math.floor((Date.now() - saveStart) / 1000);
        const uploadPct =
          lastUploadPct > 0 ? ` · ${lastUploadPct}% uploaded` : "";
        void report(
          "saving",
          lastUploadPct > 0 ? 92 + (lastUploadPct / 100) * 7 : 92,
          `${msg} (${elapsed}s${uploadPct}) - still working`
        );
      }, 4000);
    };

    await report(
      "saving",
      92,
      usesBlob
        ? `Uploading ${sizeMb} MB to cloud vault…`
        : `Saving ${sizeMb} MB locally…`
    );

    if (usesBlob) startSaveHeartbeat(`Uploading ${sizeMb} MB to cloud`);

    try {
      const fileRead = fs.createReadStream(filePath);
      if (jobId) {
        registerImportUploadKill(jobId, () => fileRead.destroy());
      }

      const stored = await storeClipSourceFromPath(filePath, {
        fileName: `${title.replace(/[^\w\s.-]/g, "").trim() || videoId}.mp4`,
        mimeType: "video/mp4",
        readStream: fileRead,
        isCancelled: () => (jobId ? isImportCancelled(jobId) : false),
        onUploadProgress: (sent, total) => {
          const pct = Math.round((sent / total) * 100);
          lastUploadPct = pct;
          const mapped = 92 + (pct / 100) * 7;
          const sentMb = (sent / (1024 * 1024)).toFixed(1);
          void report(
            "saving",
            mapped,
            `Uploading to cloud… ${sentMb}/${sizeMb} MB (${pct}%)`
          );
        },
      });

      await report("saving", 100, "Done");

      return {
        ...stored,
        title,
        videoId,
        durationSec: meta.durationSec,
        thumbnailUrl: youtubeThumbnailUrl(videoId),
      };
    } finally {
      if (heartbeat) clearInterval(heartbeat);
    }
  } finally {
    if (jobId) clearImportRun(jobId);
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
