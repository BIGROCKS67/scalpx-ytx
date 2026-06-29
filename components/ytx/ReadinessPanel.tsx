"use client";

import { Badge } from "@/components/ui";

type ReadinessBlocker = {
  code: string;
  message: string;
  fix: string;
};

type VerificationRow = {
  id: string;
  action: string;
  ok: boolean;
  source: string;
  detail: string;
};

export function ReadinessPanel({
  blockers,
  warnings,
  ready,
  loading = false,
  mode = "full",
  host,
  proof,
  verification,
  compact = false,
}: {
  blockers: ReadinessBlocker[];
  warnings: string[];
  ready: boolean;
  loading?: boolean;
  mode?: "full" | "metadata_only" | "preview";
  host?: {
    serverless: boolean;
    previewClips: "local" | "scout_or_skip";
  };
  proof?: {
    youtubeVideoId: string | null;
    metadataWriteOk: boolean;
    metadataWriteStatus: number | null;
    analyticsSource: string;
    clipsExportCount: number;
    qcStillPending: string[];
  };
  verification?: VerificationRow[];
  /** Hide duplicate blocker list when parent already shows checks. */
  compact?: boolean;
}) {
  return (
    <section className={`track-panel mb-4 space-y-3 ${compact ? "!p-0 !bg-transparent !border-0 !shadow-none" : ""}`}>
      {!compact ? (
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Readiness</h2>
          <Badge tone={loading ? "neutral" : ready ? "good" : "bad"}>
            {loading ? "Checking…" : ready ? (mode === "preview" ? "Preview ready" : "Ready") : "Blocked"}
          </Badge>
        </div>
      ) : null}

      {!compact && loading ? (
        <p className="text-sm text-dim">Checking API key, linked video, and host…</p>
      ) : null}

      {!compact && !loading && blockers.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {blockers.map((b) => (
            <li key={b.code} className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
              <p className="font-medium text-amber-200">{b.message}</p>
              <p className="text-xs text-dim mt-1">{b.fix}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {!compact && !loading && blockers.length === 0 ? (
        <p className="text-sm text-dim">
          {mode === "preview"
            ? host?.serverless
              ? "Ready for preview on demo host — SEO and drafts without OAuth. Clips export skipped here."
              : "Ready for preview — run SEO, cross-post drafts, and checklist without OAuth. Link a YouTube URL when ready for Shorts and publish."
            : "All required checks passed for a full publish run."}
        </p>
      ) : null}

      {!compact && warnings.length > 0 ? (
        <ul className="text-xs text-dim space-y-1">
          {warnings.map((w) => (
            <li key={w}>· {w}</li>
          ))}
        </ul>
      ) : null}

      {proof ? (
        <div className="text-xs font-mono text-dim space-y-1 border-t border-white/5 pt-3">
          <p>videoId: {proof.youtubeVideoId ?? "—"}</p>
          <p>
            YouTube write:{" "}
            {proof.metadataWriteOk ? (
              <span className="text-accent">verified ({proof.metadataWriteStatus})</span>
            ) : mode === "preview" ? (
              <span className="text-sky-300">skipped (preview)</span>
            ) : (
              <span className="text-amber-300">not verified</span>
            )}
          </p>
          <p>analytics: {proof.analyticsSource}</p>
          <p>clips exported: {proof.clipsExportCount}</p>
          {proof.qcStillPending.length ? (
            <p>QC pending: {proof.qcStillPending.join(" · ")}</p>
          ) : null}
        </div>
      ) : null}

      {verification && verification.length > 0 ? (
        <div className="border-t border-white/5 pt-3">
          <p className="text-xs track-rail-label mb-2">Verification log</p>
          <ul className="space-y-1 max-h-40 overflow-y-auto text-xs font-mono">
            {verification.slice(0, 8).map((v) => (
              <li key={v.id} className={v.ok ? "text-accent" : "text-amber-300"}>
                {v.ok ? "✓" : "✗"} {v.action} · {v.source} · {v.detail.slice(0, 80)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
