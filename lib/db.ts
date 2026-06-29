import Database from "better-sqlite3";
import fs from "fs";
import { dbFilePath, dataDirectory } from "@/lib/storage";

let _db: Database.Database | null = null;
let dbChain: Promise<unknown> = Promise.resolve();

function initSchema(db: Database.Database) {
  db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  displayName TEXT NOT NULL,
  youtubeChannelId TEXT,
  trackAccountId TEXT,
  descriptionTemplate TEXT DEFAULT '',
  tagsJson TEXT DEFAULT '[]',
  socialLinksJson TEXT DEFAULT '{}',
  showFormatsJson TEXT DEFAULT '[]',
  isShowFormat INTEGER DEFAULT 0,
  oauthConnected INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS show_runs (
  id TEXT PRIMARY KEY,
  channelId TEXT NOT NULL,
  title TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'stream',
  scheduledAt TEXT,
  guestName TEXT,
  dealId TEXT,
  youtubeVideoId TEXT,
  youtubeBroadcastId TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  seoTitle TEXT,
  seoDescription TEXT,
  seoTagsJson TEXT DEFAULT '[]',
  thumbnailVariant TEXT,
  clipSourceId TEXT,
  descriptionPatchLogJson TEXT DEFAULT '[]',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id TEXT PRIMARY KEY,
  showRunId TEXT NOT NULL,
  taskId TEXT NOT NULL,
  phase TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  mode TEXT NOT NULL,
  completedAt TEXT,
  notes TEXT DEFAULT '',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(showRunId, taskId)
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  channelId TEXT PRIMARY KEY,
  accessToken TEXT NOT NULL,
  refreshToken TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  scopesJson TEXT DEFAULT '[]',
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cross_post_queue (
  id TEXT PRIMARY KEY,
  showRunId TEXT NOT NULL,
  platform TEXT NOT NULL,
  draftBody TEXT DEFAULT '',
  scoutDraftId TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduledFor TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clip_batches (
  id TEXT PRIMARY KEY,
  showRunId TEXT NOT NULL,
  scoutSourceId TEXT,
  momentIdsJson TEXT DEFAULT '[]',
  exportUrlsJson TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'idle',
  message TEXT DEFAULT '',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS end_screen_edges (
  id TEXT PRIMARY KEY,
  fromVideoId TEXT NOT NULL,
  toVideoId TEXT NOT NULL,
  weight REAL DEFAULT 1,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id TEXT PRIMARY KEY,
  showRunId TEXT NOT NULL,
  snapshotType TEXT NOT NULL,
  concurrentViewers INTEGER,
  views24h INTEGER,
  metadataJson TEXT DEFAULT '{}',
  capturedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_show_runs_channel ON show_runs(channelId, scheduledAt);
CREATE INDEX IF NOT EXISTS idx_checklist_show ON checklist_items(showRunId, phase);
CREATE INDEX IF NOT EXISTS idx_cross_post_show ON cross_post_queue(showRunId);

CREATE TABLE IF NOT EXISTS clip_sources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  fileUrl TEXT NOT NULL,
  fileName TEXT DEFAULT '',
  mimeType TEXT DEFAULT 'video/mp4',
  sizeBytes INTEGER DEFAULT 0,
  durationSec REAL,
  tags TEXT DEFAULT '',
  youtubeVideoId TEXT,
  analysisStatus TEXT DEFAULT 'none',
  analysisAt TEXT,
  analysisMessage TEXT DEFAULT '',
  analysisProgress INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clip_source_moments (
  id TEXT PRIMARY KEY,
  sourceId TEXT NOT NULL,
  startSec REAL NOT NULL,
  endSec REAL NOT NULL,
  title TEXT NOT NULL,
  hook TEXT DEFAULT '',
  caption TEXT DEFAULT '',
  score REAL DEFAULT 0,
  clipUrl TEXT DEFAULT '',
  transcriptJson TEXT DEFAULT '',
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clip_moments_source ON clip_source_moments(sourceId, score DESC);

CREATE TABLE IF NOT EXISTS comment_replies (
  id TEXT PRIMARY KEY,
  showRunId TEXT NOT NULL,
  authorHint TEXT DEFAULT '',
  commentText TEXT NOT NULL,
  draftReply TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comment_replies_show ON comment_replies(showRunId);

CREATE TABLE IF NOT EXISTS ig_carousels (
  id TEXT PRIMARY KEY,
  showRunId TEXT NOT NULL,
  slidesJson TEXT DEFAULT '[]',
  caption TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending_qc',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ig_carousels_show ON ig_carousels(showRunId);
`);
  migrateSchema(db);
}

function migrateSchema(db: Database.Database) {
  const addCol = (sql: string) => {
    try {
      db.exec(sql);
    } catch {
      /* column exists */
    }
  };
  addCol("ALTER TABLE show_runs ADD COLUMN pipeline TEXT DEFAULT 'live'");
  addCol("ALTER TABLE show_runs ADD COLUMN liveChaptersJson TEXT DEFAULT '[]'");
  addCol("ALTER TABLE channels ADD COLUMN channelTrailerDraftJson TEXT DEFAULT NULL");
}

export function getDb(): Database.Database {
  if (!_db) {
    dataDirectory();
    const file = dbFilePath();
    _db = new Database(file);
    _db.pragma("journal_mode = WAL");
    initSchema(_db);
  }
  return _db;
}

/** Test helper - reset singleton between isolated runs. */
export function closeDb(): void {
  if (_db) {
    try {
      _db.close();
    } catch {
      /* ignore */
    }
    _db = null;
  }
  dbChain = Promise.resolve();
}

export async function runWithDb<T>(fn: () => T): Promise<T> {
  const run = () => Promise.resolve(fn());
  const next = dbChain.then(run, run);
  dbChain = next.then(
    () => undefined,
    () => undefined
  );
  return next as Promise<T>;
}

export function parseJsonArray<T>(raw: unknown, fallback: T[] = []): T[] {
  if (!raw || typeof raw !== "string") return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
