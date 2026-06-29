import { randomUUID } from "crypto";
import { getDb, runWithDb } from "@/lib/db";

export type VerificationAction =
  | "metadata_update"
  | "live_description_update"
  | "analytics_capture"
  | "roster_sync"
  | "clips_export"
  | "channel_setup"
  | "lifecycle_preflight"
  | "lifecycle_run";

export type VerificationSource = "youtube_api" | "simulated" | "local_only" | "blocked";

export type VerificationEntry = {
  id: string;
  showRunId: string | null;
  channelId: string | null;
  action: VerificationAction;
  ok: boolean;
  source: VerificationSource;
  videoId: string | null;
  httpStatus: number | null;
  detail: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

function rowToEntry(row: Record<string, unknown>): VerificationEntry {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse((row.metadataJson as string) || "{}") as Record<string, unknown>;
  } catch {
    metadata = {};
  }
  return {
    id: row.id as string,
    showRunId: (row.showRunId as string) ?? null,
    channelId: (row.channelId as string) ?? null,
    action: row.action as VerificationAction,
    ok: Boolean(row.ok),
    source: row.source as VerificationSource,
    videoId: (row.videoId as string) ?? null,
    httpStatus: row.httpStatus != null ? Number(row.httpStatus) : null,
    detail: (row.detail as string) ?? "",
    metadata,
    createdAt: row.createdAt as string,
  };
}

export async function logVerification(input: {
  showRunId?: string | null;
  channelId?: string | null;
  action: VerificationAction;
  ok: boolean;
  source: VerificationSource;
  videoId?: string | null;
  httpStatus?: number | null;
  detail?: string;
  metadata?: Record<string, unknown>;
}): Promise<VerificationEntry> {
  return runWithDb(() => {
    const entry: VerificationEntry = {
      id: randomUUID(),
      showRunId: input.showRunId ?? null,
      channelId: input.channelId ?? null,
      action: input.action,
      ok: input.ok,
      source: input.source,
      videoId: input.videoId ?? null,
      httpStatus: input.httpStatus ?? null,
      detail: input.detail ?? "",
      metadata: input.metadata ?? {},
      createdAt: new Date().toISOString(),
    };
    getDb()
      .prepare(
        `INSERT INTO verification_log (
          id, showRunId, channelId, action, ok, source, videoId, httpStatus, detail, metadataJson, createdAt
        ) VALUES (
          @id, @showRunId, @channelId, @action, @ok, @source, @videoId, @httpStatus, @detail, @metadataJson, @createdAt
        )`
      )
      .run({
        ...entry,
        ok: entry.ok ? 1 : 0,
        metadataJson: JSON.stringify(entry.metadata),
      });
    return entry;
  });
}

export async function listVerificationLog(
  showRunId: string,
  limit = 50
): Promise<VerificationEntry[]> {
  return runWithDb(() => {
    const rows = getDb()
      .prepare(
        "SELECT * FROM verification_log WHERE showRunId = ? ORDER BY createdAt DESC LIMIT ?"
      )
      .all(showRunId, limit) as Record<string, unknown>[];
    return rows.map(rowToEntry);
  });
}
