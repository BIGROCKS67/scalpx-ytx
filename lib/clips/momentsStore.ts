import { randomUUID } from "crypto";
import { runWithDb, getDb } from "@/lib/db";
import type { ClipMoment } from "@/lib/clips/types";

function rowToMoment(row: Record<string, unknown>): ClipMoment {
  return {
    id: row.id as string,
    sourceId: row.sourceId as string,
    startSec: Number(row.startSec),
    endSec: Number(row.endSec),
    title: row.title as string,
    hook: (row.hook as string) ?? "",
    caption: (row.caption as string) ?? "",
    score: Number(row.score ?? 0),
    clipUrl: (row.clipUrl as string) ?? "",
    transcriptJson: (row.transcriptJson as string) ?? "",
    createdAt: row.createdAt as string,
  };
}

export async function listMomentsForSource(sourceId: string): Promise<ClipMoment[]> {
  return runWithDb(() => {
    const rows = getDb()
      .prepare(
        "SELECT * FROM clip_source_moments WHERE sourceId = ? ORDER BY score DESC, startSec ASC"
      )
      .all(sourceId) as Record<string, unknown>[];
    return rows.map(rowToMoment);
  });
}

export async function getClipMoment(id: string): Promise<ClipMoment | null> {
  return runWithDb(() => {
    const row = getDb().prepare("SELECT * FROM clip_source_moments WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToMoment(row) : null;
  });
}

export async function upsertClipMoments(moments: ClipMoment[]): Promise<void> {
  return runWithDb(() => {
    const stmt = getDb().prepare(
      `INSERT INTO clip_source_moments (
        id, sourceId, startSec, endSec, title, hook, caption, score, clipUrl, transcriptJson, createdAt
      ) VALUES (
        @id, @sourceId, @startSec, @endSec, @title, @hook, @caption, @score, @clipUrl, @transcriptJson, @createdAt
      )
      ON CONFLICT(id) DO UPDATE SET
        startSec=excluded.startSec, endSec=excluded.endSec, title=excluded.title,
        hook=excluded.hook, caption=excluded.caption, score=excluded.score,
        clipUrl=excluded.clipUrl, transcriptJson=excluded.transcriptJson`
    );
    for (const m of moments) stmt.run(m);
  });
}

export async function updateMomentClipUrl(id: string, clipUrl: string): Promise<void> {
  return runWithDb(() => {
    getDb().prepare("UPDATE clip_source_moments SET clipUrl = ? WHERE id = ?").run(clipUrl, id);
  });
}

export async function updateMomentTranscriptJson(id: string, transcriptJson: string): Promise<void> {
  return runWithDb(() => {
    getDb().prepare("UPDATE clip_source_moments SET transcriptJson = ? WHERE id = ?").run(
      transcriptJson,
      id
    );
  });
}

export async function deleteMomentsForSource(sourceId: string): Promise<void> {
  return runWithDb(() => {
    getDb().prepare("DELETE FROM clip_source_moments WHERE sourceId = ?").run(sourceId);
  });
}

export function newClipMoment(
  partial: Partial<ClipMoment> & {
    sourceId: string;
    startSec: number;
    endSec: number;
    title: string;
  }
): ClipMoment {
  return {
    id: partial.id ?? randomUUID(),
    sourceId: partial.sourceId,
    startSec: partial.startSec,
    endSec: partial.endSec,
    title: partial.title,
    hook: partial.hook ?? "",
    caption: partial.caption ?? "",
    score: partial.score ?? 0,
    clipUrl: partial.clipUrl ?? "",
    transcriptJson: partial.transcriptJson ?? "",
    createdAt: partial.createdAt ?? new Date().toISOString(),
  };
}
