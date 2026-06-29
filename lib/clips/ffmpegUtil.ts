import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { ClipExportFormat, ClipExportQuality, CropFocus } from "@/lib/clips/clipFormats";
import { CLIP_FORMAT_SPECS } from "@/lib/clips/clipFormats";

export type FfmpegRuntime = {
  bin: string;
  probe: string;
  subtitles: boolean;
  drawtext: boolean;
};

let cachedRuntime: FfmpegRuntime | null = null;

function staticBinaryPath(mod: string, pathKey = "path"): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const resolved = require(mod) as string | { path?: string };
    const p = typeof resolved === "string" ? resolved : resolved?.path;
    if (p && fs.existsSync(p)) return p;
  } catch {
    // optional dependency
  }
  return undefined;
}

function ffmpegCandidates(): string[] {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  const staticFfmpeg = staticBinaryPath("ffmpeg-static");
  return [
    fromEnv,
    staticFfmpeg,
    "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg",
    "/usr/local/opt/ffmpeg-full/bin/ffmpeg",
    "ffmpeg",
  ].filter((c): c is string => Boolean(c));
}

function ffprobeForFfmpeg(ffmpegBin: string): string {
  const staticFfmpeg = staticBinaryPath("ffmpeg-static");
  const staticProbe = staticBinaryPath("ffprobe-static");
  if (staticFfmpeg && ffmpegBin === staticFfmpeg && staticProbe) return staticProbe;
  if (ffmpegBin === "ffmpeg") return "ffprobe";
  const probe = path.join(path.dirname(ffmpegBin), "ffprobe");
  return fs.existsSync(probe) ? probe : "ffprobe";
}

const EXEC_PROBE_TIMEOUT_MS = 6_000;

function readFilterCaps(bin: string): Promise<{ subtitles: boolean; drawtext: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(bin, ["-hide_banner", "-filters"], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let settled = false;
    const finish = (caps: { subtitles: boolean; drawtext: boolean }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill("SIGKILL");
      } catch {
        /* already exited */
      }
      resolve(caps);
    };
    const timer = setTimeout(
      () => finish({ subtitles: false, drawtext: false }),
      EXEC_PROBE_TIMEOUT_MS
    );
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (out += d.toString()));
    child.on("close", () => {
      finish({
        subtitles: /\bsubtitles\b/.test(out),
        drawtext: /\bdrawtext\b/.test(out),
      });
    });
    child.on("error", () => finish({ subtitles: false, drawtext: false }));
  });
}

function binaryExists(bin: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(bin, ["-version"], { stdio: ["ignore", "pipe", "pipe"] });
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill("SIGKILL");
      } catch {
        /* already exited */
      }
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), EXEC_PROBE_TIMEOUT_MS);
    child.on("close", (code) => finish(code === 0));
    child.on("error", () => finish(false));
  });
}

/** Resolve ffmpeg binary - prefers a build with libass (subtitles) for caption burn-in. */
export async function getFfmpegRuntime(): Promise<FfmpegRuntime> {
  if (cachedRuntime) return cachedRuntime;

  let fallback: FfmpegRuntime | null = null;

  for (const bin of ffmpegCandidates()) {
    if (!(await binaryExists(bin))) continue;
    const caps = await readFilterCaps(bin);
    const runtime: FfmpegRuntime = {
      bin,
      probe: ffprobeForFfmpeg(bin),
      subtitles: caps.subtitles,
      drawtext: caps.drawtext,
    };
    if (caps.subtitles) {
      console.info("[clips/ffmpeg] using", bin, "(libass subtitles OK)");
      cachedRuntime = runtime;
      return runtime;
    }
    if (!fallback) fallback = runtime;
  }

  cachedRuntime = fallback ?? {
    bin: "ffmpeg",
    probe: "ffprobe",
    subtitles: false,
    drawtext: false,
  };
  if (!cachedRuntime.subtitles) {
    console.warn(
      "[clips/ffmpeg] no libass build found - captions/hooks need: brew install ffmpeg-full"
    );
  }
  return cachedRuntime;
}

export function runFfmpeg(args: string[], timeoutMs = 180_000): Promise<string> {
  return getFfmpegRuntime().then(({ bin }) => runFfmpegBin(bin, args, timeoutMs));
}

function runFfmpegBin(bin: string, args: string[], timeoutMs = 180_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("ffmpeg timed out"));
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(
          new Error(
            "ffmpeg not found - install with brew install ffmpeg-full (needed for captions)"
          )
        );
      } else {
        reject(err);
      }
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stderr);
      else reject(new Error(stderr.slice(-500) || `ffmpeg exit ${code}`));
    });
  });
}

export async function probeDurationSec(filePath: string): Promise<number> {
  const { probe } = await getFfmpegRuntime();
  return new Promise((resolve) => {
    const child = spawn(probe, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.on("close", (code) => {
      if (code !== 0) resolve(0);
      else resolve(Number(out.trim()) || 0);
    });
    child.on("error", () => resolve(0));
  });
}

export async function probeVideoSize(filePath: string): Promise<{ width: number; height: number }> {
  const { probe } = await getFfmpegRuntime();
  return new Promise((resolve) => {
    const child = spawn(probe, [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height:stream_tags=rotate",
      "-of",
      "json",
      filePath,
    ]);
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.on("close", () => {
      try {
        const json = JSON.parse(out) as {
          streams?: Array<{ width?: number; height?: number; tags?: { rotate?: string } }>;
        };
        const stream = json.streams?.[0];
        let width = stream?.width ?? 1920;
        let height = stream?.height ?? 1080;
        const rotate = Number(stream?.tags?.rotate ?? 0);
        if (rotate === 90 || rotate === -90 || rotate === 270) {
          [width, height] = [height, width];
        }
        resolve({ width, height });
      } catch {
        resolve({ width: 1920, height: 1080 });
      }
    });
    child.on("error", () => resolve({ width: 1920, height: 1080 }));
  });
}

/** Scene-change timestamps (action / cut points). */
export async function detectSceneTimes(filePath: string, max = 24): Promise<number[]> {
  const stderr = await runFfmpeg([
    "-hide_banner",
    "-i",
    filePath,
    "-vf",
    "select='gt(scene,0.38)',metadata=print",
    "-an",
    "-f",
    "null",
    "-",
  ]);
  const times: number[] = [];
  for (const line of stderr.split("\n")) {
    const m = /pts_time:([0-9.]+)/.exec(line);
    if (m) times.push(Number(m[1]));
  }
  return [...new Set(times.map((t) => Math.round(t * 10) / 10))]
    .sort((a, b) => a - b)
    .slice(0, max);
}

/** Loud audio bursts - yelling, reactions, hype moments. */
export async function detectAudioPeakTimes(
  filePath: string,
  durationSec: number,
  max = 16
): Promise<number[]> {
  if (durationSec < 30) return [];

  const windowSec = 4;
  const stderr = await runFfmpeg(
    [
      "-hide_banner",
      "-i",
      filePath,
      "-af",
      `asetnsamples=n=${16000 * windowSec},astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level`,
      "-f",
      "null",
      "-",
    ],
    300_000
  );

  const samples: { t: number; rms: number }[] = [];
  let idx = 0;
  for (const line of stderr.split("\n")) {
    const m = /RMS_level=(-?[0-9.]+)/.exec(line);
    if (m) {
      const rms = Number(m[1]);
      if (Number.isFinite(rms)) {
        samples.push({ t: idx * windowSec + windowSec / 2, rms });
        idx += 1;
      }
    }
  }

  if (samples.length === 0) return [];

  const sorted = [...samples].sort((a, b) => b.rms - a.rms);
  const threshold = sorted[Math.min(5, sorted.length - 1)]?.rms ?? -20;
  const peaks = samples
    .filter((s) => s.rms >= threshold && s.rms > -35)
    .map((s) => Math.round(s.t * 10) / 10)
    .filter((t) => t > 5 && t < durationSec - 10);

  return [...new Set(peaks)].sort((a, b) => a - b).slice(0, max);
}

function escapeDrawtext(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "'\\''")
    .slice(0, 80);
}

function escapeFontPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:");
}

function escapeSubPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/,/g, "\\,");
}

/** Cross-platform font for drawtext (macOS + Linux server). */
export function resolveDrawtextFont(): string | null {
  const candidates = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function drawtextFilter(text: string, opts: { y: string; fontsize: number; boxAlpha: string }): string {
  const esc = escapeDrawtext(text);
  const font = resolveDrawtextFont();
  const prefix = font ? `drawtext=fontfile='${escapeFontPath(font)}':` : "drawtext=";
  return `${prefix}text='${esc}':fontcolor=white:fontsize=${opts.fontsize}:x=(w-text_w)/2:y=${opts.y}:box=1:boxcolor=black@${opts.boxAlpha}:boxborderw=8`;
}

/** Scale + pad/crop for TikTok / Reels / Shorts / square. */
export function buildFormatFilter(
  format: ClipExportFormat,
  cropFocus: CropFocus = "fit",
  srcSize?: { width: number; height: number }
): string | null {
  const spec = CLIP_FORMAT_SPECS[format];
  if (format === "original" || !spec.width || !spec.height) return null;

  const w = spec.width;
  const h = spec.height;

  // Fit entire video in frame - black bars above/below (or sides) so nothing is cropped.
  if (cropFocus === "fit") {
    return [
      `scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos`,
      `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`,
      "setsar=1",
    ].join(",");
  }

  const srcW = srcSize?.width ?? 1920;
  const srcH = srcSize?.height ?? 1080;
  const portrait = srcH > srcW;

  if (format === "square") {
    return [
      `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos`,
      `crop=${w}:${h}:(iw-${w})/2:(ih-${h})/2`,
      "setsar=1",
    ].join(",");
  }

  if (portrait && cropFocus === "top") {
    return [
      `crop=iw:floor(ih*0.42):0:0`,
      `scale=${w}:${h}:flags=lanczos`,
      "setsar=1",
    ].join(",");
  }

  const cropY = cropFocus === "top" ? "0" : `(ih-${h})/2`;
  return [
    `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${w}:${h}:(iw-${w})/2:${cropY}`,
    "setsar=1",
  ].join(",");
}

function encodeArgs(quality: ClipExportQuality): string[] {
  if (quality === "high") {
    return [
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "18",
      "-profile:v",
      "high",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
    ];
  }
  return ["-c:v", "libx264", "-preset", "fast", "-crf", "20", "-c:a", "aac", "-b:a", "160k"];
}

export type CutClipOpts = {
  hook?: string;
  assPath?: string;
  format?: ClipExportFormat;
  quality?: ClipExportQuality;
  cropFocus?: CropFocus;
};

export async function cutClipSegment(
  inputPath: string,
  outputPath: string,
  startSec: number,
  endSec: number,
  opts?: CutClipOpts
): Promise<void> {
  const dur = Math.max(1, endSec - startSec);
  const hook = opts?.hook?.trim();
  const format = opts?.format ?? "tiktok";
  const quality = opts?.quality ?? "high";
  const cropFocus = opts?.cropFocus ?? "fit";
  const srcSize = await probeVideoSize(inputPath);
  const runtime = await getFfmpegRuntime();

  const vfParts: string[] = [];
  const formatFilter = buildFormatFilter(format, cropFocus, srcSize);
  if (formatFilter) vfParts.push(formatFilter);

  if (hook) {
    if (!runtime.drawtext) {
      console.warn("[clips/ffmpeg] drawtext unavailable - skipping hook burn-in");
    } else {
      vfParts.push(
        drawtextFilter(hook, { y: "h*0.05", fontsize: 28, boxAlpha: "0.5" })
      );
    }
  }

  if (opts?.assPath && fs.existsSync(opts.assPath)) {
    if (runtime.subtitles) {
      const subEsc = escapeSubPath(opts.assPath);
      vfParts.push(`subtitles=${subEsc}`);
    } else {
      console.warn(
        "[clips/ffmpeg] libass unavailable - exporting without burned captions (hook still applies if drawtext available)"
      );
    }
  }

  // Seek BEFORE -i (input seeking) so decoded frames restart at PTS 0. Captions are
  // generated clip-relative (0..dur); with output seeking the frames keep their original
  // timestamps (~startSec) and never match the subtitle times, so captions vanish.
  const args = [
    "-hide_banner",
    "-ss",
    String(startSec),
    "-i",
    inputPath,
    "-t",
    String(dur),
  ];

  if (vfParts.length > 0) args.push("-vf", vfParts.join(","));
  args.push(...encodeArgs(quality));
  args.push("-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y", outputPath);

  console.info("[clips/ffmpeg] export vf:", vfParts.join(","));
  await runFfmpeg(args, 600_000);
}

export async function cutClipSegmentPlain(
  inputPath: string,
  outputPath: string,
  startSec: number,
  endSec: number
): Promise<void> {
  await cutClipSegment(inputPath, outputPath, startSec, endSec);
}

export function formatClipTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
