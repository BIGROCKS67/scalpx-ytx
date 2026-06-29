import fs from "fs";
import path from "path";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import { dataDirectory } from "@/lib/storage";

const ALLOWED = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "audio/mp4",
  "audio/mpeg",
  "application/octet-stream",
]);

const MAX_BYTES = 500 * 1024 * 1024;

function extForMime(mime: string, fileName?: string): string {
  if (mime === "video/quicktime") return "mov";
  if (mime === "video/webm") return "webm";
  if (mime === "audio/mpeg") return "mp3";
  const fromName = fileName?.match(/\.(mp4|mov|webm|m4v)$/i)?.[1];
  if (fromName) return fromName.toLowerCase() === "m4v" ? "mp4" : fromName.toLowerCase();
  return "mp4";
}

function sniffMime(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const n = file.name.toLowerCase();
  if (n.endsWith(".mov")) return "video/quicktime";
  if (n.endsWith(".webm")) return "video/webm";
  if (n.endsWith(".mp4") || n.endsWith(".m4v")) return "video/mp4";
  return file.type || "video/mp4";
}

function localAssetsDir(): string {
  return path.join(dataDirectory(), "clip-sources");
}

async function writeFileStream(file: File, dest: string): Promise<void> {
  const webStream = file.stream();
  const nodeStream = Readable.fromWeb(webStream as import("stream/web").ReadableStream);
  await pipeline(nodeStream, createWriteStream(dest));
}

export function clipMaxBytes(): number {
  return MAX_BYTES;
}

export async function storeClipSourceFile(
  file: File
): Promise<{ url: string; storage: "local"; fileName: string; mimeType: string; sizeBytes: number }> {
  const mime = sniffMime(file);
  const isVideo =
    mime.startsWith("video/") ||
    ALLOWED.has(mime) ||
    /\.(mp4|mov|webm|m4v)$/i.test(file.name);
  if (!isVideo) {
    throw new Error("Use MP4, MOV, WebM, or M4V");
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`File must be under ${Math.floor(MAX_BYTES / (1024 * 1024))} MB`);
  }
  if (file.size === 0) {
    throw new Error("File is empty");
  }

  const ext = extForMime(mime, file.name);
  const name = `${randomUUID()}.${ext}`;
  const dir = localAssetsDir();
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, name);
  await writeFileStream(file, dest);

  const written = fs.statSync(dest).size;
  if (written !== file.size) {
    fs.unlinkSync(dest);
    throw new Error(`Upload incomplete (${written} of ${file.size} bytes)`);
  }

  return {
    url: `/api/clips/assets/${name}`,
    storage: "local",
    fileName: file.name || name,
    mimeType: mime,
    sizeBytes: file.size,
  };
}

export async function storeClipSourceFromPath(
  filePath: string,
  opts: {
    fileName: string;
    mimeType?: string;
    readStream?: fs.ReadStream;
    isCancelled?: () => boolean;
    onUploadProgress?: (sent: number, total: number) => void;
  }
): Promise<{ url: string; storage: "local"; fileName: string; mimeType: string; sizeBytes: number }> {
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_BYTES) {
    throw new Error(`File must be under ${Math.floor(MAX_BYTES / (1024 * 1024))} MB`);
  }
  if (stat.size === 0) {
    throw new Error("Downloaded file is empty");
  }

  const mime = opts.mimeType ?? "video/mp4";
  const ext = extForMime(mime, opts.fileName);
  const name = `${randomUUID()}.${ext}`;

  const dir = localAssetsDir();
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, name);
  const input = opts.readStream ?? fs.createReadStream(filePath);
  await pipeline(input, createWriteStream(dest));

  const written = fs.statSync(dest).size;
  if (written !== stat.size) {
    fs.unlinkSync(dest);
    throw new Error(`Save incomplete (${written} of ${stat.size} bytes)`);
  }

  opts.onUploadProgress?.(stat.size, stat.size);

  return {
    url: `/api/clips/assets/${name}`,
    storage: "local",
    fileName: opts.fileName,
    mimeType: mime,
    sizeBytes: stat.size,
  };
}

export async function deleteClipSourceAsset(fileUrl: string): Promise<void> {
  if (!fileUrl) return;
  const match = /\/api\/clips\/assets\/([^/?#]+)/.exec(fileUrl);
  if (match?.[1]) {
    const asset = readLocalClipAsset(match[1]);
    if (asset && fs.existsSync(asset.filePath)) {
      fs.unlinkSync(asset.filePath);
    }
  }
}

export function readLocalClipAsset(name: string): { filePath: string; mime: string } | null {
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return null;
  const filePath = path.join(localAssetsDir(), name);
  if (!fs.existsSync(filePath)) return null;
  const ext = path.extname(name).slice(1).toLowerCase();
  const mime =
    ext === "mov"
      ? "video/quicktime"
      : ext === "webm"
        ? "video/webm"
        : ext === "mp3"
          ? "audio/mpeg"
          : "video/mp4";
  return { filePath, mime };
}
