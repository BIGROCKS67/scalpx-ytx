import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import type { ClipSource } from "@/lib/clips/types";
import { readLocalClipAsset } from "@/lib/clips/videoUpload";

export async function resolveSourceFilePath(
  source: ClipSource
): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
  const fileUrl = source.fileUrl;
  const localMatch = /\/api\/clips\/assets\/([^/?#]+)/.exec(fileUrl);
  if (localMatch?.[1]) {
    const asset = readLocalClipAsset(localMatch[1]);
    if (asset) {
      return { filePath: asset.filePath, cleanup: async () => {} };
    }
  }

  if (fileUrl.startsWith("http")) {
    const tmp = path.join(os.tmpdir(), `flowx-src-${source.id}-${randomUUID()}.mp4`);
    const res = await fetch(fileUrl);
    if (!res.ok || !res.body) throw new Error("Could not download source video for analysis");
    const nodeStream = Readable.fromWeb(res.body as import("stream/web").ReadableStream);
    await pipeline(nodeStream, createWriteStream(tmp));
    const stat = await fs.promises.stat(tmp);
    if (stat.size < 1000) {
      await fs.promises.unlink(tmp).catch(() => {});
      throw new Error("Downloaded source file is empty - re-import the video");
    }
    return {
      filePath: tmp,
      cleanup: async () => {
        await fs.promises.unlink(tmp).catch(() => {});
      },
    };
  }

  throw new Error("Source file not available on server - re-import the video");
}
