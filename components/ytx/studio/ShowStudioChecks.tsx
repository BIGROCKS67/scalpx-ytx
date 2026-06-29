"use client";

import Link from "next/link";
import type { PreflightMode } from "@/lib/readiness/preflight";
import { runModeDescription, runModeLabel } from "@/lib/studioLabels";
import { ReadinessPanel } from "@/components/ytx/ReadinessPanel";
import { Button } from "@/components/ui";

type PreflightPayload = {
  ready: boolean;
  blockers: { code: string; message: string; fix: string }[];
  warnings: string[];
  host?: {
    serverless: boolean;
    previewClips: "local" | "scout_or_skip";
  };
};

type VerificationRow = {
  id: string;
  action: string;
  ok: boolean;
  source: string;
  detail: string;
};

type Proof = {
  youtubeVideoId: string | null;
  metadataWriteOk: boolean;
  metadataWriteStatus: number | null;
  analyticsSource: string;
  clipsExportCount: number;
  qcStillPending: string[];
};

export function ShowStudioChecks({
  preflight,
  preflightLoading,
  runMode,
  onRunModeChange,
  onRunAgain,
  runBusy,
  lifecycleProof,
  verification,
  children,
}: {
  preflight: PreflightPayload | null;
  preflightLoading: boolean;
  runMode: PreflightMode;
  onRunModeChange: (mode: PreflightMode) => void;
  onRunAgain: () => void;
  runBusy: boolean;
  lifecycleProof?: Proof;
  verification?: VerificationRow[];
  children?: React.ReactNode;
}) {
  const ready = preflight?.ready ?? false;

  return (
    <div className="space-y-4">
      <header className="ytx-studio-form-intro">
        <h2 className="text-base font-semibold text-ink">Checks</h2>
        <p className="text-sm text-dim mt-1">
          Like YouTube Studio before you publish — we check for missing links, OAuth, and anything
          that would block your upload.
        </p>
      </header>

      <section className="track-panel">
        <ul className="space-y-2 text-sm">
          <li className="ytx-studio-check-row">
            <span className={ready ? "text-accent" : "text-dim"}>{ready ? "✓" : "…"}</span>
            <span>
              {preflightLoading
                ? "Running checks…"
                : ready
                  ? "Ready — no blockers for this mode"
                  : "Issues found — fix below before publishing"}
            </span>
          </li>
          {preflight?.blockers.map((b) => (
            <li key={b.code} className="ytx-studio-check-row ytx-studio-check-row-bad">
              <span>✗</span>
              <div>
                <p className="font-medium text-amber-200">{b.message}</p>
                <p className="text-xs text-dim mt-0.5">{b.fix}</p>
              </div>
            </li>
          ))}
          {preflight?.warnings.map((w) => (
            <li key={w} className="ytx-studio-check-row">
              <span className="text-dim">!</span>
              <span className="text-dim">{w}</span>
            </li>
          ))}
        </ul>
      </section>

      <ReadinessPanel
        blockers={preflight?.blockers ?? []}
        warnings={preflight?.warnings ?? []}
        ready={ready}
        loading={preflightLoading}
        mode={runMode}
        host={preflight?.host}
        proof={lifecycleProof}
        verification={verification}
        compact
      />

      <section className="track-panel">
        <label className="ytx-studio-label" htmlFor="checks-mode">
          Run type
        </label>
        <select
          id="checks-mode"
          className="ytx-select w-full max-w-md mt-2"
          value={runMode}
          onChange={(e) => onRunModeChange(e.target.value as PreflightMode)}
        >
          <option value="preview">{runModeLabel("preview")}</option>
          <option value="metadata_only">{runModeLabel("metadata_only")}</option>
          <option value="full">{runModeLabel("full")}</option>
        </select>
        <p className="text-xs text-dim mt-2">{runModeDescription(runMode)}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            size="sm"
            variant="secondary"
            disabled={runBusy || (runMode === "full" && !ready)}
            onClick={onRunAgain}
          >
            {runBusy ? "Running…" : "Run checks again"}
          </Button>
          <Link href="/channels" className="text-sm text-accent hover:underline self-center">
            Connect YouTube →
          </Link>
        </div>
      </section>

      {children}
    </div>
  );
}
