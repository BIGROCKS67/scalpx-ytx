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
  mode = "full",
  host,
  proof,
  verification,
}: {
  blockers: ReadinessBlocker[];
  warnings: string[];
  ready: boolean;
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
}) {
  return (
    <section className="track-panel mb-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Readiness</h2>
        <Badge tone={ready ? "good" : "bad"}>
          {ready ? (mode === "preview" ? "Preview ready" : "Ready") : "Blocked"}
        </Badge>
      </div>

      {blockers.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {blockers.map((b) => (
            <li key={b.code} className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
              <p className="font-medium text-amber-200">{b.message}</p>
              <p className="text-xs text-dim mt-1">{b.fix}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-dim">
          {mode === "preview"
            ? host?.serverless
              ? "Ready for preview on demo host — API key + linked video. Clips export skipped here."
              : "Ready for preview — API key + linked video. OAuth not required; Shorts export optional if yt-dlp/ffmpeg installed."
            : "All required checks passed for a full end-to-end run."}
        </p>
      )}

      {warnings.length > 0 ? (
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
