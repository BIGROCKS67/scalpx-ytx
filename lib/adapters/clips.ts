import { runLocalClipsPipeline } from "@/lib/clips/localPipeline";
import { scoutFetch } from "@/lib/adapters/scoutClient";
import type { ClipBatch } from "@/lib/types";

type ClipSource = { id: string; title: string; youtubeVideoId?: string | null };
type Moment = { id: string; title: string; score: number };

async function runScoutClipsPipeline(
  youtubeUrl: string,
  onProgress?: (msg: string) => void
): Promise<Partial<ClipBatch>> {
  onProgress?.("Importing via FlowX Scout…");
  const imported = await importShowToClips(youtubeUrl);
  if (!imported.ok || !imported.sourceId) {
    return {
      status: imported.offline ? "idle" : "error",
      message: imported.error ?? "Scout import failed",
    };
  }

  onProgress?.("Detecting moments (Scout)…");
  await analyzeSource(imported.sourceId);
  const momentsRes = await listMoments(imported.sourceId);
  const moments =
    momentsRes.ok && momentsRes.data.moments
      ? [...momentsRes.data.moments].sort((a, b) => b.score - a.score)
      : [];

  const top = moments.slice(0, 5).map((m) => m.id);
  onProgress?.("Exporting Shorts (Scout)…");
  const { urls, errors } = await exportShorts(top, 5);

  return {
    scoutSourceId: imported.sourceId,
    momentIds: top,
    exportUrls: urls,
    status: urls.length ? "done" : errors.length ? "error" : "analyzing",
    message: urls.length
      ? `${urls.length} Shorts ready (Scout)`
      : errors[0] ?? `${moments.length} moments found`,
  };
}

export async function importShowToClips(youtubeUrl: string): Promise<{
  ok: boolean;
  sourceId?: string;
  error?: string;
  offline?: boolean;
}> {
  const res = await scoutFetch<{ source: ClipSource }>("/api/clips/sources", {
    method: "POST",
    body: JSON.stringify({ youtubeUrl }),
  });
  if (!res.ok) return { ok: false, error: res.error, offline: res.offline };
  return { ok: true, sourceId: res.data.source.id };
}

export async function analyzeSource(sourceId: string) {
  return scoutFetch(`/api/clips/sources/${sourceId}/analyze`, { method: "POST" });
}

export async function listMoments(sourceId: string) {
  return scoutFetch<{ moments: Moment[] }>(`/api/clips/sources/${sourceId}/moments`);
}

export async function exportShorts(
  momentIds: string[],
  limit = 5
): Promise<{ urls: string[]; errors: string[] }> {
  const urls: string[] = [];
  const errors: string[] = [];
  for (const momentId of momentIds.slice(0, limit)) {
    const res = await scoutFetch<{ clipUrl: string }>(`/api/clips/moments/${momentId}/export`, {
      method: "POST",
      body: JSON.stringify({ format: "shorts", withCaptions: true, withHook: true }),
    });
    if (res.ok && res.data.clipUrl) urls.push(res.data.clipUrl);
    else errors.push(res.ok ? "No URL" : res.error);
  }
  return { urls, errors };
}

/** Local Clips libs first (copied from Scout) · Scout HTTP fallback when local fails. */
export async function runClipsPipeline(
  youtubeUrl: string,
  onProgress?: (msg: string) => void
): Promise<Partial<ClipBatch>> {
  try {
    return await runLocalClipsPipeline(youtubeUrl, onProgress);
  } catch (localErr) {
    console.warn("[clips] local pipeline failed, trying Scout", localErr);
    const scout = await runScoutClipsPipeline(youtubeUrl, onProgress);
    if (scout.status !== "idle" && scout.status !== "error") return scout;
    const msg = localErr instanceof Error ? localErr.message : "Local clips failed";
    return {
      status: "error",
      message: scout.message ?? msg,
    };
  }
}
