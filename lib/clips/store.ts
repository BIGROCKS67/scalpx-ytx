import { randomUUID } from "crypto";
import { getDb, runWithDb } from "@/lib/db";
import type { ClipAnalysisStatus, ClipSource } from "@/lib/clips/types";

function rowToSource(row: Record<string, unknown>): ClipSource {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? "",
    fileUrl: row.fileUrl as string,
    fileName: (row.fileName as string) ?? "",
    mimeType: (row.mimeType as string) ?? "video/mp4",
    sizeBytes: Number(row.sizeBytes ?? 0),
    durationSec: row.durationSec != null ? Number(row.durationSec) : null,
    tags: (row.tags as string) ?? "",
    youtubeVideoId: (row.youtubeVideoId as string) ?? null,
    analysisStatus: (row.analysisStatus as ClipAnalysisStatus) ?? "none",
    analysisAt: (row.analysisAt as string) ?? null,
    analysisMessage: (row.analysisMessage as string) ?? "",
    analysisProgress: Number(row.analysisProgress ?? 0),
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}

export async function getClipSource(id: string): Promise<ClipSource | null> {
  return runWithDb(() => {
    const row = getDb().prepare("SELECT * FROM clip_sources WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToSource(row) : null;
  });
}

export async function upsertClipSource(source: ClipSource): Promise<ClipSource> {
  return runWithDb(() => {
    getDb()
      .prepare(
        `INSERT INTO clip_sources (
          id, title, description, fileUrl, fileName, mimeType, sizeBytes, durationSec, tags, youtubeVideoId,
          analysisStatus, analysisAt, analysisMessage, analysisProgress, createdAt, updatedAt
        ) VALUES (
          @id, @title, @description, @fileUrl, @fileName, @mimeType, @sizeBytes, @durationSec, @tags, @youtubeVideoId,
          @analysisStatus, @analysisAt, @analysisMessage, @analysisProgress, @createdAt, @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          title=excluded.title, description=excluded.description, fileUrl=excluded.fileUrl,
          fileName=excluded.fileName, mimeType=excluded.mimeType, sizeBytes=excluded.sizeBytes,
          durationSec=excluded.durationSec, tags=excluded.tags, youtubeVideoId=excluded.youtubeVideoId,
          analysisStatus=excluded.analysisStatus, analysisAt=excluded.analysisAt,
          analysisMessage=excluded.analysisMessage, analysisProgress=excluded.analysisProgress,
          updatedAt=excluded.updatedAt`
      )
      .run(source);
    return source;
  });
}

export async function updateClipSourceAnalysisProgress(
  id: string,
  message: string,
  progress: number
): Promise<void> {
  return runWithDb(() => {
    getDb()
      .prepare(
        `UPDATE clip_sources SET analysisMessage = @message, analysisProgress = @progress, updatedAt = @updatedAt WHERE id = @id`
      )
      .run({
        id,
        message,
        progress: Math.min(100, Math.max(0, Math.round(progress))),
        updatedAt: new Date().toISOString(),
      });
  });
}

export function newClipSource(
  partial: Partial<ClipSource> & { title: string; fileUrl: string }
): ClipSource {
  const now = new Date().toISOString();
  return {
    id: partial.id ?? randomUUID(),
    title: partial.title,
    description: partial.description ?? "",
    fileUrl: partial.fileUrl,
    fileName: partial.fileName ?? "",
    mimeType: partial.mimeType ?? "video/mp4",
    sizeBytes: partial.sizeBytes ?? 0,
    durationSec: partial.durationSec ?? null,
    tags: partial.tags ?? "",
    youtubeVideoId: partial.youtubeVideoId ?? null,
    analysisStatus: partial.analysisStatus ?? "none",
    analysisAt: partial.analysisAt ?? null,
    analysisMessage: partial.analysisMessage ?? "",
    analysisProgress: partial.analysisProgress ?? 0,
    createdAt: partial.createdAt ?? now,
    updatedAt: now,
  };
}
