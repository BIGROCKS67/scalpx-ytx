import { randomUUID } from "crypto";
import { filterActiveChannels, isActiveChannelSlug } from "@/lib/activeChannels";
import { CHECKLIST_TASKS } from "@/lib/checklistTasks";
import { getDb, parseJsonArray, parseJsonObject, runWithDb } from "@/lib/db";
import { defaultPipelineForFormat, isLiveOnlyTask } from "@/lib/pipelines";
import { rosterSeedData, ROSTER_SLUG_ORDER } from "@/lib/rosterSeed";
import type {
  AnalyticsSnapshot,
  AnalyticsSnapshotType,
  AppSettings,
  ChannelTrailerDraft,
  ChecklistItem,
  ClipBatch,
  CommentReply,
  CrossPostItem,
  DescriptionPatch,
  EndScreenEdge,
  IgCarouselDraft,
  LiveChapter,
  ShowFormat,
  ShowPipeline,
  ShowRun,
  ShowRunStatus,
  TaskStatus,
  YtChannel,
} from "@/lib/types";

function rowToChannel(row: Record<string, unknown>): YtChannel {
  return {
    id: row.id as string,
    slug: row.slug as string,
    displayName: row.displayName as string,
    youtubeChannelId: (row.youtubeChannelId as string) ?? null,
    trackAccountId: (row.trackAccountId as string) ?? null,
    descriptionTemplate: (row.descriptionTemplate as string) ?? "",
    tags: parseJsonArray<string>(row.tagsJson),
    socialLinks: parseJsonObject(row.socialLinksJson) as Record<string, string>,
    showFormats: parseJsonArray<ShowFormat>(row.showFormatsJson),
    isShowFormat: Boolean(row.isShowFormat),
    oauthConnected: Boolean(row.oauthConnected),
    avatarUrl: (row.avatarUrl as string) ?? null,
    channelTrailerDraft: parseTrailerDraft(row.channelTrailerDraftJson),
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}

function parseTrailerDraft(raw: unknown): ChannelTrailerDraft | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as ChannelTrailerDraft;
  } catch {
    return null;
  }
}

function rowToShow(row: Record<string, unknown>): ShowRun {
  return {
    id: row.id as string,
    channelId: row.channelId as string,
    title: row.title as string,
    format: row.format as ShowFormat,
    pipeline: ((row.pipeline as ShowPipeline) ?? "live") as ShowPipeline,
    scheduledAt: (row.scheduledAt as string) ?? null,
    guestName: (row.guestName as string) ?? null,
    dealId: (row.dealId as string) ?? null,
    youtubeVideoId: (row.youtubeVideoId as string) ?? null,
    youtubeBroadcastId: (row.youtubeBroadcastId as string) ?? null,
    status: row.status as ShowRunStatus,
    seoTitle: (row.seoTitle as string) ?? null,
    seoDescription: (row.seoDescription as string) ?? null,
    seoTags: parseJsonArray<string>(row.seoTagsJson),
    thumbnailVariant: (row.thumbnailVariant as string) ?? null,
    clipSourceId: (row.clipSourceId as string) ?? null,
    descriptionPatchLog: parseJsonArray<DescriptionPatch>(row.descriptionPatchLogJson),
    liveChapters: parseJsonArray<LiveChapter>(row.liveChaptersJson),
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}

function rowToChecklist(row: Record<string, unknown>): ChecklistItem {
  return {
    id: row.id as string,
    showRunId: row.showRunId as string,
    taskId: row.taskId as string,
    phase: row.phase as ChecklistItem["phase"],
    status: row.status as TaskStatus,
    mode: row.mode as ChecklistItem["mode"],
    completedAt: (row.completedAt as string) ?? null,
    notes: (row.notes as string) ?? "",
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}

function rowToCrossPost(row: Record<string, unknown>): CrossPostItem {
  return {
    id: row.id as string,
    showRunId: row.showRunId as string,
    platform: row.platform as string,
    draftBody: (row.draftBody as string) ?? "",
    scoutDraftId: (row.scoutDraftId as string) ?? null,
    status: row.status as CrossPostItem["status"],
    scheduledFor: (row.scheduledFor as string) ?? null,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}

function rowToClipBatch(row: Record<string, unknown>): ClipBatch {
  return {
    id: row.id as string,
    showRunId: row.showRunId as string,
    scoutSourceId: (row.scoutSourceId as string) ?? null,
    momentIds: parseJsonArray<string>(row.momentIdsJson),
    exportUrls: parseJsonArray<string>(row.exportUrlsJson),
    status: row.status as ClipBatch["status"],
    message: (row.message as string) ?? "",
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}

function rowToSnapshot(row: Record<string, unknown>): AnalyticsSnapshot {
  return {
    id: row.id as string,
    showRunId: row.showRunId as string,
    snapshotType: row.snapshotType as AnalyticsSnapshotType,
    concurrentViewers: row.concurrentViewers != null ? Number(row.concurrentViewers) : null,
    views24h: row.views24h != null ? Number(row.views24h) : null,
    metadata: parseJsonObject(row.metadataJson) as Record<string, unknown>,
    capturedAt: row.capturedAt as string,
  };
}

export async function getSettings(): Promise<AppSettings> {
  return runWithDb(() => {
    const rows = getDb().prepare("SELECT key, value FROM settings").all() as {
      key: string;
      value: string;
    }[];
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      googleClientId: map.googleClientId ?? process.env.YTX_GOOGLE_CLIENT_ID ?? "",
      googleClientSecret: map.googleClientSecret ?? process.env.YTX_GOOGLE_CLIENT_SECRET ?? "",
      youtubeApiKey: map.youtubeApiKey ?? process.env.YTX_YOUTUBE_API_KEY ?? "",
      scoutUrl: map.scoutUrl ?? process.env.FLOWX_SCOUT_URL ?? "http://localhost:3000",
      scoutServiceKey: map.scoutServiceKey ?? process.env.FLOWX_SCOUT_SERVICE_KEY ?? "",
      deepseekApiKey: map.deepseekApiKey ?? process.env.DEEPSEEK_API_KEY ?? "",
      scrapeCreatorsKey: map.scrapeCreatorsKey ?? process.env.SCRAPECREATORS_KEY ?? "",
      openaiApiKey: map.openaiApiKey ?? process.env.OPENAI_API_KEY ?? "",
    };
  });
}

export async function saveSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  return runWithDb(() => {
    const upsert = getDb().prepare(
      "INSERT INTO settings (key, value) VALUES (@key, @value) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    );
    const entries: [string, string | undefined][] = [
      ["googleClientId", partial.googleClientId],
      ["googleClientSecret", partial.googleClientSecret],
      ["youtubeApiKey", partial.youtubeApiKey],
      ["scoutUrl", partial.scoutUrl],
      ["scoutServiceKey", partial.scoutServiceKey],
      ["deepseekApiKey", partial.deepseekApiKey],
      ["scrapeCreatorsKey", partial.scrapeCreatorsKey],
      ["openaiApiKey", partial.openaiApiKey],
    ];
    for (const [key, value] of entries) {
      if (value !== undefined) upsert.run({ key, value });
    }
    return getSettingsSync();
  });
}

function getSettingsSync(): AppSettings {
  const rows = getDb().prepare("SELECT key, value FROM settings").all() as {
    key: string;
    value: string;
  }[];
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    googleClientId: map.googleClientId ?? process.env.YTX_GOOGLE_CLIENT_ID ?? "",
    googleClientSecret: map.googleClientSecret ?? process.env.YTX_GOOGLE_CLIENT_SECRET ?? "",
    youtubeApiKey: map.youtubeApiKey ?? process.env.YTX_YOUTUBE_API_KEY ?? "",
    scoutUrl: map.scoutUrl ?? process.env.FLOWX_SCOUT_URL ?? "http://localhost:3000",
    scoutServiceKey: map.scoutServiceKey ?? process.env.FLOWX_SCOUT_SERVICE_KEY ?? "",
    deepseekApiKey: map.deepseekApiKey ?? process.env.DEEPSEEK_API_KEY ?? "",
    scrapeCreatorsKey: map.scrapeCreatorsKey ?? process.env.SCRAPECREATORS_KEY ?? "",
    openaiApiKey: map.openaiApiKey ?? process.env.OPENAI_API_KEY ?? "",
  };
}

export async function seedChannels(): Promise<YtChannel[]> {
  return runWithDb(() => {
    const count = getDb().prepare("SELECT COUNT(*) AS n FROM channels").get() as { n: number };
    if (count.n > 0) {
      return listChannelsSync();
    }
    const now = new Date().toISOString();
    const insert = getDb().prepare(`
      INSERT INTO channels (
        id, slug, displayName, youtubeChannelId, trackAccountId, descriptionTemplate,
        tagsJson, socialLinksJson, showFormatsJson, isShowFormat, oauthConnected, createdAt, updatedAt
      ) VALUES (
        @id, @slug, @displayName, @youtubeChannelId, @trackAccountId, @descriptionTemplate,
        @tagsJson, @socialLinksJson, @showFormatsJson, @isShowFormat, 0, @createdAt, @updatedAt
      )`);
    for (const row of rosterSeedData()) {
      insert.run({
        ...row,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        tagsJson: JSON.stringify(row.tags),
        socialLinksJson: JSON.stringify(row.socialLinks),
        showFormatsJson: JSON.stringify(row.showFormats),
        isShowFormat: row.isShowFormat ? 1 : 0,
      });
    }
    return listChannelsSync();
  });
}

function listChannelsSync(): YtChannel[] {
  const rows = getDb().prepare("SELECT * FROM channels").all() as Record<string, unknown>[];
  const order = new Map<string, number>(ROSTER_SLUG_ORDER.map((slug, i) => [slug, i]));
  return filterActiveChannels(
    rows
      .map(rowToChannel)
      .sort((a, b) => (order.get(a.slug) ?? 999) - (order.get(b.slug) ?? 999))
  );
}

export async function listChannels(): Promise<YtChannel[]> {
  return runWithDb(() => listChannelsSync());
}

export async function getChannel(id: string): Promise<YtChannel | null> {
  return runWithDb(() => {
    const row = getDb().prepare("SELECT * FROM channels WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToChannel(row) : null;
  });
}

export async function updateChannel(
  id: string,
  patch: Partial<
    Pick<
      YtChannel,
      | "displayName"
      | "youtubeChannelId"
      | "trackAccountId"
      | "descriptionTemplate"
      | "tags"
      | "socialLinks"
      | "oauthConnected"
      | "avatarUrl"
      | "channelTrailerDraft"
    >
  >
): Promise<YtChannel | null> {
  return runWithDb(() => {
    const existing = getChannelSync(id);
    if (!existing) return null;
    const updated: YtChannel = {
      ...existing,
      displayName: patch.displayName !== undefined ? patch.displayName : existing.displayName,
      youtubeChannelId:
        patch.youtubeChannelId !== undefined ? patch.youtubeChannelId : existing.youtubeChannelId,
      trackAccountId:
        patch.trackAccountId !== undefined ? patch.trackAccountId : existing.trackAccountId,
      descriptionTemplate:
        patch.descriptionTemplate !== undefined
          ? patch.descriptionTemplate
          : existing.descriptionTemplate,
      tags: patch.tags ?? existing.tags,
      socialLinks: patch.socialLinks ?? existing.socialLinks,
      oauthConnected: patch.oauthConnected ?? existing.oauthConnected,
      avatarUrl: patch.avatarUrl !== undefined ? patch.avatarUrl : existing.avatarUrl,
      channelTrailerDraft:
        patch.channelTrailerDraft !== undefined
          ? patch.channelTrailerDraft
          : existing.channelTrailerDraft,
      updatedAt: new Date().toISOString(),
    };
    getDb()
      .prepare(
        `UPDATE channels SET
          displayName=@displayName, youtubeChannelId=@youtubeChannelId, trackAccountId=@trackAccountId,
          descriptionTemplate=@descriptionTemplate, tagsJson=@tagsJson,
          socialLinksJson=@socialLinksJson, oauthConnected=@oauthConnected,
          avatarUrl=@avatarUrl, channelTrailerDraftJson=@channelTrailerDraftJson, updatedAt=@updatedAt
         WHERE id=@id`
      )
      .run({
        id,
        displayName: updated.displayName,
        youtubeChannelId: updated.youtubeChannelId,
        trackAccountId: updated.trackAccountId,
        descriptionTemplate: updated.descriptionTemplate,
        tagsJson: JSON.stringify(updated.tags),
        socialLinksJson: JSON.stringify(updated.socialLinks),
        oauthConnected: updated.oauthConnected ? 1 : 0,
        avatarUrl: updated.avatarUrl,
        channelTrailerDraftJson: updated.channelTrailerDraft
          ? JSON.stringify(updated.channelTrailerDraft)
          : null,
        updatedAt: updated.updatedAt,
      });
    return updated;
  });
}

function getChannelSync(id: string): YtChannel | null {
  const row = getDb().prepare("SELECT * FROM channels WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToChannel(row) : null;
}

export async function listShows(channelId?: string): Promise<ShowRun[]> {
  return runWithDb(() => {
    const activeIds = listChannelsSync().map((c) => c.id);
    if (!activeIds.length) return [];

    if (channelId) {
      if (!activeIds.includes(channelId)) return [];
      const rows = getDb()
        .prepare("SELECT * FROM show_runs WHERE channelId = ? ORDER BY scheduledAt DESC")
        .all(channelId) as Record<string, unknown>[];
      return rows.map(rowToShow);
    }

    const placeholders = activeIds.map(() => "?").join(", ");
    const rows = getDb()
      .prepare(`SELECT * FROM show_runs WHERE channelId IN (${placeholders}) ORDER BY createdAt DESC`)
      .all(...activeIds) as Record<string, unknown>[];
    return rows.map(rowToShow);
  });
}

export async function getShow(id: string): Promise<ShowRun | null> {
  return runWithDb(() => {
    const row = getDb().prepare("SELECT * FROM show_runs WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    const show = rowToShow(row);
    const channel = getChannelSync(show.channelId);
    if (channel && !isActiveChannelSlug(channel.slug)) return null;
    return show;
  });
}

export async function createShow(input: {
  channelId: string;
  title: string;
  format?: ShowFormat;
  pipeline?: ShowPipeline;
  scheduledAt?: string | null;
  guestName?: string | null;
  dealId?: string | null;
}): Promise<{ show: ShowRun; checklist: ChecklistItem[] }> {
  return runWithDb(() => {
    const now = new Date().toISOString();
    const format = input.format ?? "stream";
    const pipeline = input.pipeline ?? defaultPipelineForFormat(format);
    const show: ShowRun = {
      id: randomUUID(),
      channelId: input.channelId,
      title: input.title.trim(),
      format,
      pipeline,
      scheduledAt: input.scheduledAt ?? null,
      guestName: input.guestName ?? null,
      dealId: input.dealId ?? null,
      youtubeVideoId: null,
      youtubeBroadcastId: null,
      status: "draft",
      seoTitle: null,
      seoDescription: null,
      seoTags: [],
      thumbnailVariant: null,
      clipSourceId: null,
      descriptionPatchLog: [],
      liveChapters: [],
      createdAt: now,
      updatedAt: now,
    };
    insertShowSync(show);
    const checklist = seedChecklistSync(show.id, pipeline);
    getDb()
      .prepare(
        `INSERT INTO clip_batches (id, showRunId, status, message, momentIdsJson, exportUrlsJson, createdAt, updatedAt)
         VALUES (@id, @showRunId, 'idle', '', '[]', '[]', @createdAt, @updatedAt)`
      )
      .run({ id: randomUUID(), showRunId: show.id, createdAt: now, updatedAt: now });
    return { show, checklist };
  });
}

function insertShowSync(show: ShowRun) {
  getDb()
    .prepare(
      `INSERT INTO show_runs (
        id, channelId, title, format, pipeline, scheduledAt, guestName, dealId,
        youtubeVideoId, youtubeBroadcastId, status, seoTitle, seoDescription, seoTagsJson,
        thumbnailVariant, clipSourceId, descriptionPatchLogJson, liveChaptersJson, createdAt, updatedAt
      ) VALUES (
        @id, @channelId, @title, @format, @pipeline, @scheduledAt, @guestName, @dealId,
        @youtubeVideoId, @youtubeBroadcastId, @status, @seoTitle, @seoDescription, @seoTagsJson,
        @thumbnailVariant, @clipSourceId, @descriptionPatchLogJson, @liveChaptersJson, @createdAt, @updatedAt
      )`
    )
    .run({
      ...show,
      seoTagsJson: JSON.stringify(show.seoTags),
      descriptionPatchLogJson: JSON.stringify(show.descriptionPatchLog),
      liveChaptersJson: JSON.stringify(show.liveChapters),
    });
}

function seedChecklistSync(showRunId: string, pipeline: ShowPipeline): ChecklistItem[] {
  const now = new Date().toISOString();
  const insert = getDb().prepare(`
    INSERT INTO checklist_items (
      id, showRunId, taskId, phase, status, mode, completedAt, notes, createdAt, updatedAt
    ) VALUES (
      @id, @showRunId, @taskId, @phase, @status, @mode, @completedAt, @notes, @createdAt, @updatedAt
    )`);
  const items: ChecklistItem[] = CHECKLIST_TASKS.map((task) => {
    const skipLive = pipeline === "prerecorded" && isLiveOnlyTask(task.id);
    return {
      id: randomUUID(),
      showRunId,
      taskId: task.id,
      phase: task.phase,
      status: (skipLive ? "skipped" : "pending") as TaskStatus,
      mode: task.mode,
      completedAt: skipLive ? now : null,
      notes: skipLive ? "N/A for pre-recorded pipeline" : "",
      createdAt: now,
      updatedAt: now,
    };
  });
  for (const item of items) insert.run(item);
  return items;
}

export async function updateShow(
  id: string,
  patch: Partial<
    Pick<
      ShowRun,
      | "title"
      | "format"
      | "scheduledAt"
      | "guestName"
      | "dealId"
      | "youtubeVideoId"
      | "youtubeBroadcastId"
      | "status"
      | "seoTitle"
      | "seoDescription"
      | "seoTags"
      | "thumbnailVariant"
      | "clipSourceId"
      | "descriptionPatchLog"
      | "pipeline"
      | "liveChapters"
    >
  >
): Promise<ShowRun | null> {
  return runWithDb(() => {
    const existing = getShowSync(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    getDb()
      .prepare(
        `UPDATE show_runs SET
          title=@title, format=@format, pipeline=@pipeline, scheduledAt=@scheduledAt, guestName=@guestName,
          dealId=@dealId, youtubeVideoId=@youtubeVideoId, youtubeBroadcastId=@youtubeBroadcastId,
          status=@status, seoTitle=@seoTitle, seoDescription=@seoDescription, seoTagsJson=@seoTagsJson,
          thumbnailVariant=@thumbnailVariant, clipSourceId=@clipSourceId,
          descriptionPatchLogJson=@descriptionPatchLogJson, liveChaptersJson=@liveChaptersJson,
          updatedAt=@updatedAt
         WHERE id=@id`
      )
      .run({
        id,
        title: updated.title,
        format: updated.format,
        pipeline: updated.pipeline,
        scheduledAt: updated.scheduledAt,
        guestName: updated.guestName,
        dealId: updated.dealId,
        youtubeVideoId: updated.youtubeVideoId,
        youtubeBroadcastId: updated.youtubeBroadcastId,
        status: updated.status,
        seoTitle: updated.seoTitle,
        seoDescription: updated.seoDescription,
        seoTagsJson: JSON.stringify(updated.seoTags),
        thumbnailVariant: updated.thumbnailVariant,
        clipSourceId: updated.clipSourceId,
        descriptionPatchLogJson: JSON.stringify(updated.descriptionPatchLog),
        liveChaptersJson: JSON.stringify(updated.liveChapters),
        updatedAt: updated.updatedAt,
      });
    return updated;
  });
}

function getShowSync(id: string): ShowRun | null {
  const row = getDb().prepare("SELECT * FROM show_runs WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToShow(row) : null;
}

export async function listChecklist(showRunId: string): Promise<ChecklistItem[]> {
  return runWithDb(() => {
    const rows = getDb()
      .prepare("SELECT * FROM checklist_items WHERE showRunId = ? ORDER BY createdAt ASC")
      .all(showRunId) as Record<string, unknown>[];
    return rows.map(rowToChecklist);
  });
}

export async function updateChecklistItem(
  showRunId: string,
  taskId: string,
  patch: { status?: TaskStatus; notes?: string }
): Promise<ChecklistItem | null> {
  return runWithDb(() => {
    const row = getDb()
      .prepare("SELECT * FROM checklist_items WHERE showRunId = ? AND taskId = ?")
      .get(showRunId, taskId) as Record<string, unknown> | undefined;
    if (!row) return null;
    const now = new Date().toISOString();
    const status = (patch.status ?? row.status) as TaskStatus;
    const notes = patch.notes ?? (row.notes as string);
    const completedAt =
      status === "done" ? now : status === "pending" ? null : (row.completedAt as string | null);
    getDb()
      .prepare(
        `UPDATE checklist_items SET status=@status, notes=@notes, completedAt=@completedAt, updatedAt=@updatedAt
         WHERE showRunId=@showRunId AND taskId=@taskId`
      )
      .run({ showRunId, taskId, status, notes, completedAt, updatedAt: now });
    return {
      ...rowToChecklist(row),
      status,
      notes,
      completedAt,
      updatedAt: now,
    };
  });
}

export async function listCrossPosts(showRunId: string): Promise<CrossPostItem[]> {
  return runWithDb(() => {
    const rows = getDb()
      .prepare("SELECT * FROM cross_post_queue WHERE showRunId = ? ORDER BY platform ASC")
      .all(showRunId) as Record<string, unknown>[];
    return rows.map(rowToCrossPost);
  });
}

export async function upsertCrossPosts(items: CrossPostItem[]): Promise<void> {
  return runWithDb(() => {
    if (items.length === 0) return;
    getDb()
      .prepare("DELETE FROM cross_post_queue WHERE showRunId = ?")
      .run(items[0]!.showRunId);
    const stmt = getDb().prepare(`
      INSERT INTO cross_post_queue (
        id, showRunId, platform, draftBody, scoutDraftId, status, scheduledFor, createdAt, updatedAt
      ) VALUES (
        @id, @showRunId, @platform, @draftBody, @scoutDraftId, @status, @scheduledFor, @createdAt, @updatedAt
      )`);
    for (const item of items) stmt.run(item);
  });
}

export async function getClipBatch(showRunId: string): Promise<ClipBatch | null> {
  return runWithDb(() => {
    const row = getDb()
      .prepare("SELECT * FROM clip_batches WHERE showRunId = ? ORDER BY createdAt DESC LIMIT 1")
      .get(showRunId) as Record<string, unknown> | undefined;
    return row ? rowToClipBatch(row) : null;
  });
}

export async function updateClipBatch(
  showRunId: string,
  patch: Partial<ClipBatch>
): Promise<ClipBatch | null> {
  return runWithDb(() => {
    const existing = getClipBatchSync(showRunId);
    if (!existing) return null;
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    getDb()
      .prepare(
        `UPDATE clip_batches SET
          scoutSourceId=@scoutSourceId, momentIdsJson=@momentIdsJson, exportUrlsJson=@exportUrlsJson,
          status=@status, message=@message, updatedAt=@updatedAt WHERE id=@id`
      )
      .run({
        id: updated.id,
        scoutSourceId: updated.scoutSourceId,
        momentIdsJson: JSON.stringify(updated.momentIds),
        exportUrlsJson: JSON.stringify(updated.exportUrls),
        status: updated.status,
        message: updated.message,
        updatedAt: updated.updatedAt,
      });
    return updated;
  });
}

function getClipBatchSync(showRunId: string): ClipBatch | null {
  const row = getDb()
    .prepare("SELECT * FROM clip_batches WHERE showRunId = ? ORDER BY createdAt DESC LIMIT 1")
    .get(showRunId) as Record<string, unknown> | undefined;
  return row ? rowToClipBatch(row) : null;
}

export async function addAnalyticsSnapshot(
  input: Omit<AnalyticsSnapshot, "id">
): Promise<AnalyticsSnapshot> {
  return runWithDb(() => {
    const snap: AnalyticsSnapshot = { ...input, id: randomUUID() };
    getDb()
      .prepare(
        `INSERT INTO analytics_snapshots (
          id, showRunId, snapshotType, concurrentViewers, views24h, metadataJson, capturedAt
        ) VALUES (
          @id, @showRunId, @snapshotType, @concurrentViewers, @views24h, @metadataJson, @capturedAt
        )`
      )
      .run({
        ...snap,
        metadataJson: JSON.stringify(snap.metadata),
      });
    return snap;
  });
}

export async function listAnalytics(showRunId: string): Promise<AnalyticsSnapshot[]> {
  return runWithDb(() => {
    const rows = getDb()
      .prepare("SELECT * FROM analytics_snapshots WHERE showRunId = ? ORDER BY capturedAt DESC")
      .all(showRunId) as Record<string, unknown>[];
    return rows.map(rowToSnapshot);
  });
}

export async function listEndScreenEdges(fromVideoId?: string): Promise<EndScreenEdge[]> {
  return runWithDb(() => {
    const rows = fromVideoId
      ? (getDb()
          .prepare("SELECT * FROM end_screen_edges WHERE fromVideoId = ?")
          .all(fromVideoId) as Record<string, unknown>[])
      : (getDb().prepare("SELECT * FROM end_screen_edges").all() as Record<string, unknown>[]);
    return rows.map((row) => ({
      id: row.id as string,
      fromVideoId: row.fromVideoId as string,
      toVideoId: row.toVideoId as string,
      weight: Number(row.weight ?? 1),
      createdAt: row.createdAt as string,
    }));
  });
}

export async function addEndScreenEdge(
  fromVideoId: string,
  toVideoId: string,
  weight = 1
): Promise<EndScreenEdge> {
  return runWithDb(() => {
    const edge: EndScreenEdge = {
      id: randomUUID(),
      fromVideoId,
      toVideoId,
      weight,
      createdAt: new Date().toISOString(),
    };
    getDb()
      .prepare(
        "INSERT INTO end_screen_edges (id, fromVideoId, toVideoId, weight, createdAt) VALUES (@id, @fromVideoId, @toVideoId, @weight, @createdAt)"
      )
      .run(edge);
    return edge;
  });
}

export async function saveOAuthTokens(
  channelId: string,
  tokens: { accessToken: string; refreshToken: string; expiresAt: string; scopes: string[] }
): Promise<void> {
  return runWithDb(() => {
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO oauth_tokens (channelId, accessToken, refreshToken, expiresAt, scopesJson, updatedAt)
         VALUES (@channelId, @accessToken, @refreshToken, @expiresAt, @scopesJson, @updatedAt)
         ON CONFLICT(channelId) DO UPDATE SET
           accessToken=excluded.accessToken, refreshToken=excluded.refreshToken,
           expiresAt=excluded.expiresAt, scopesJson=excluded.scopesJson, updatedAt=excluded.updatedAt`
      )
      .run({
        channelId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scopesJson: JSON.stringify(tokens.scopes),
        updatedAt: now,
      });
    getDb()
      .prepare("UPDATE channels SET oauthConnected=1, updatedAt=? WHERE id=?")
      .run(now, channelId);
  });
}

export async function getOAuthTokens(channelId: string) {
  return runWithDb(() => {
    const row = getDb().prepare("SELECT * FROM oauth_tokens WHERE channelId = ?").get(channelId) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return {
      channelId: row.channelId as string,
      accessToken: row.accessToken as string,
      refreshToken: row.refreshToken as string,
      expiresAt: row.expiresAt as string,
      scopes: parseJsonArray<string>(row.scopesJson),
    };
  });
}

export async function appendDescriptionPatch(
  showRunId: string,
  patch: DescriptionPatch
): Promise<ShowRun | null> {
  return runWithDb(() => {
    const row = getDb().prepare("SELECT * FROM show_runs WHERE id = ?").get(showRunId) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    const log = parseJsonArray<DescriptionPatch>(row.descriptionPatchLogJson);
    log.push(patch);
    const now = new Date().toISOString();
    getDb()
      .prepare(
        "UPDATE show_runs SET descriptionPatchLogJson = @log, updatedAt = @updatedAt WHERE id = @id"
      )
      .run({ id: showRunId, log: JSON.stringify(log), updatedAt: now });
    return { ...rowToShow(row), descriptionPatchLog: log, updatedAt: now };
  });
}

function rowToComment(row: Record<string, unknown>): CommentReply {
  return {
    id: row.id as string,
    showRunId: row.showRunId as string,
    authorHint: (row.authorHint as string) ?? "",
    commentText: row.commentText as string,
    draftReply: (row.draftReply as string) ?? "",
    status: row.status as CommentReply["status"],
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}

export async function listCommentReplies(showRunId: string): Promise<CommentReply[]> {
  return runWithDb(() => {
    const rows = getDb()
      .prepare("SELECT * FROM comment_replies WHERE showRunId = ? ORDER BY createdAt DESC")
      .all(showRunId) as Record<string, unknown>[];
    return rows.map(rowToComment);
  });
}

export async function seedCommentQueue(showRunId: string, _showTitle?: string): Promise<CommentReply[]> {
  const show = await getShow(showRunId);
  if (!show?.youtubeVideoId) return listCommentRepliesSync(showRunId);
  const { syncCommentsFromYoutube } = await import("@/lib/youtube/comments");
  return syncCommentsFromYoutube(showRunId, show.channelId, show.youtubeVideoId);
}

function listCommentRepliesSync(showRunId: string): CommentReply[] {
  const rows = getDb()
    .prepare("SELECT * FROM comment_replies WHERE showRunId = ? ORDER BY createdAt DESC")
    .all(showRunId) as Record<string, unknown>[];
  return rows.map(rowToComment);
}

export async function updateCommentReply(
  id: string,
  patch: { draftReply?: string; status?: CommentReply["status"] }
): Promise<CommentReply | null> {
  return runWithDb(() => {
    const row = getDb().prepare("SELECT * FROM comment_replies WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    const now = new Date().toISOString();
    const draftReply = patch.draftReply ?? (row.draftReply as string);
    const status = patch.status ?? (row.status as CommentReply["status"]);
    getDb()
      .prepare(
        "UPDATE comment_replies SET draftReply=@draftReply, status=@status, updatedAt=@updatedAt WHERE id=@id"
      )
      .run({ id, draftReply, status, updatedAt: now });
    return { ...rowToComment(row), draftReply, status, updatedAt: now };
  });
}

function rowToIgCarousel(row: Record<string, unknown>): IgCarouselDraft {
  return {
    id: row.id as string,
    showRunId: row.showRunId as string,
    slides: parseJsonArray<string>(row.slidesJson),
    caption: (row.caption as string) ?? "",
    status: row.status as IgCarouselDraft["status"],
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}

export async function getIgCarousel(showRunId: string): Promise<IgCarouselDraft | null> {
  return runWithDb(() => {
    const row = getDb()
      .prepare("SELECT * FROM ig_carousels WHERE showRunId = ? ORDER BY updatedAt DESC LIMIT 1")
      .get(showRunId) as Record<string, unknown> | undefined;
    return row ? rowToIgCarousel(row) : null;
  });
}

export async function upsertIgCarousel(
  showRunId: string,
  data: { slides: string[]; caption: string; status?: IgCarouselDraft["status"] }
): Promise<IgCarouselDraft> {
  return runWithDb(() => {
    const existing = getDb()
      .prepare("SELECT * FROM ig_carousels WHERE showRunId = ? ORDER BY updatedAt DESC LIMIT 1")
      .get(showRunId) as Record<string, unknown> | undefined;
    const now = new Date().toISOString();
    if (existing) {
      getDb()
        .prepare(
          `UPDATE ig_carousels SET slidesJson=@slidesJson, caption=@caption, status=@status, updatedAt=@updatedAt WHERE id=@id`
        )
        .run({
          id: existing.id,
          slidesJson: JSON.stringify(data.slides),
          caption: data.caption,
          status: data.status ?? existing.status,
          updatedAt: now,
        });
      return rowToIgCarousel({
        ...existing,
        slidesJson: JSON.stringify(data.slides),
        caption: data.caption,
        status: data.status ?? existing.status,
        updatedAt: now,
      });
    }
    const draft: IgCarouselDraft = {
      id: randomUUID(),
      showRunId,
      slides: data.slides,
      caption: data.caption,
      status: data.status ?? "pending_qc",
      createdAt: now,
      updatedAt: now,
    };
    getDb()
      .prepare(
        `INSERT INTO ig_carousels (id, showRunId, slidesJson, caption, status, createdAt, updatedAt)
         VALUES (@id, @showRunId, @slidesJson, @caption, @status, @createdAt, @updatedAt)`
      )
      .run({
        ...draft,
        slidesJson: JSON.stringify(draft.slides),
      });
    return draft;
  });
}

export async function getDashboardBundle() {
  await ensureRosterData();
  const shows = await listShows();
  const checklistByShow: Record<string, ChecklistItem[]> = {};
  for (const show of shows.slice(0, 20)) {
    checklistByShow[show.id] = await listChecklist(show.id);
  }
  return { channels: await listChannels(), shows, checklistByShow };
}

export async function ensureRosterData(): Promise<void> {
  const { purgeFakeData } = await import("@/lib/dataHygiene");
  await purgeFakeData();
  await seedChannels();
  const { syncRosterFromYoutube } = await import("@/lib/youtube/rosterSync");
  await syncRosterFromYoutube();
}

/** @deprecated use ensureRosterData */
export const ensureDemoLoaded = ensureRosterData;
