"use client";

import Link from "next/link";
import type { AnalyticsSnapshot, ShowRun } from "@/lib/types";
import type { PreflightMode } from "@/lib/readiness/preflight";
import {
  runModeDescription,
  runModeLabel,
  showStatusToVisibility,
  visibilityDescription,
  visibilityLabel,
  visibilityToShowStatus,
  type StudioVisibility,
} from "@/lib/studioLabels";
import { hasLinkedYoutubeVideo, showYoutubeWatchUrl } from "@/lib/showMedia";
import { Button } from "@/components/ui";

export function ShowStudioVisibility({
  show,
  youtubeUrlInput,
  onYoutubeUrlChange,
  onSaveYoutubeUrl,
  onVisibilityChange,
  onPublish,
  bindBusy,
  publishBusy,
  publishDisabled,
  runMode,
  onRunModeChange,
  analytics = [],
  liveBusy,
  onMarkLive,
  onMarkCompleted,
  onCaptureAnalytics,
  onUpdateLiveLinks,
}: {
  show: ShowRun;
  youtubeUrlInput: string;
  onYoutubeUrlChange: (v: string) => void;
  onSaveYoutubeUrl: () => void;
  onVisibilityChange: (v: StudioVisibility) => void;
  onPublish: () => void;
  bindBusy: boolean;
  publishBusy: boolean;
  publishDisabled: boolean;
  runMode: PreflightMode;
  onRunModeChange: (mode: PreflightMode) => void;
  analytics?: AnalyticsSnapshot[];
  liveBusy?: string | null;
  onMarkLive?: () => void;
  onMarkCompleted?: () => void;
  onCaptureAnalytics?: () => void;
  onUpdateLiveLinks?: () => void;
}) {
  const linked = hasLinkedYoutubeVideo(show);
  const visibility = showStatusToVisibility(show.status);
  const options: StudioVisibility[] = ["private", "unlisted", "public"];

  return (
    <div className="ytx-studio-form space-y-5">
      <header className="ytx-studio-form-intro">
        <h2 className="text-base font-semibold text-ink">Visibility</h2>
        <p className="text-sm text-dim mt-1">
          Choose who can watch — same as YouTube Studio when you save or publish. Link your YouTube
          video here (watch URL or live link).
        </p>
      </header>

      <div className="ytx-studio-field">
        <p className="ytx-studio-label mb-3">Save or publish</p>
        <ul className="space-y-3">
          {options.map((opt) => (
            <li key={opt}>
              <label className="ytx-studio-radio">
                <input
                  type="radio"
                  name="visibility"
                  checked={visibility === opt}
                  onChange={() => onVisibilityChange(opt)}
                />
                <span>
                  <span className="font-medium text-ink">{visibilityLabel(opt)}</span>
                  <span className="block text-xs text-dim mt-0.5">{visibilityDescription(opt)}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {show.status === "live" ? (
          <p className="text-xs text-accent mt-2">This show is marked live — visibility stays public.</p>
        ) : null}
      </div>

      <div className="ytx-studio-field">
        <label className="ytx-studio-label">Video link on YouTube</label>
        <input
          className="ytx-input w-full"
          placeholder="https://www.youtube.com/watch?v=… or youtu.be/…"
          value={youtubeUrlInput}
          onChange={(e) => onYoutubeUrlChange(e.target.value)}
        />
        <p className="text-xs text-dim mt-1">
          Paste the URL after you upload in YouTube Studio, or when the live stream is created. Not
          required until you publish metadata.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button size="sm" variant="secondary" disabled={bindBusy} onClick={onSaveYoutubeUrl}>
            {bindBusy ? "Saving…" : "Save video link"}
          </Button>
          {linked ? (
            <a
              href={showYoutubeWatchUrl(show.youtubeVideoId!)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent hover:underline self-center"
            >
              Open on YouTube ↗
            </a>
          ) : null}
        </div>
      </div>

      <div className="ytx-studio-field border-t border-white/6 pt-5">
        <label className="ytx-studio-label" htmlFor="publish-mode">
          When you publish from YTX
        </label>
        <select
          id="publish-mode"
          className="ytx-select w-full max-w-md mt-2"
          value={runMode}
          onChange={(e) => onRunModeChange(e.target.value as PreflightMode)}
        >
          <option value="preview">{runModeLabel("preview")}</option>
          <option value="metadata_only">{runModeLabel("metadata_only")}</option>
          <option value="full">{runModeLabel("full")}</option>
        </select>
        <p className="text-xs text-dim mt-2">{runModeDescription(runMode)}</p>
        <Button
          className="mt-4"
          disabled={publishDisabled || publishBusy}
          onClick={onPublish}
        >
          {publishBusy ? "Running…" : runMode === "preview" ? "Prepare everything" : "Publish now"}
        </Button>
        {!linked && runMode !== "preview" ? (
          <p className="text-xs text-amber-200/90 mt-2">
            Link a YouTube video above first, or switch to Prepare everything.
          </p>
        ) : null}
        {runMode === "full" ? (
          <p className="text-xs text-dim mt-2">
            Needs YouTube connected on{" "}
            <Link href="/channels" className="text-accent hover:underline">
              Roster
            </Link>
            .
          </p>
        ) : null}
      </div>

      {show.pipeline === "live" ? (
        <div className="ytx-studio-field border-t border-white/6 pt-5 space-y-4">
          <div>
            <p className="ytx-studio-label">During the stream</p>
            <p className="text-xs text-dim mt-1">
              Mark live when you go on air, capture viewer stats, and push the stream link into the
              description.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {show.status !== "live" && show.status !== "completed" ? (
              <Button size="sm" disabled={liveBusy === "mark-live"} onClick={onMarkLive}>
                Mark live
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              disabled={liveBusy === "analytics"}
              onClick={onCaptureAnalytics}
            >
              {liveBusy === "analytics" ? "Capturing…" : "Capture viewer stats"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={liveBusy === "livelinks"}
              onClick={onUpdateLiveLinks}
            >
              Update stream link in description
            </Button>
            {show.status === "live" ? (
              <Button size="sm" variant="ghost" disabled={liveBusy === "completed"} onClick={onMarkCompleted}>
                Mark completed
              </Button>
            ) : null}
          </div>
          {analytics.length ? (
            <ul className="space-y-1.5 text-sm">
              {analytics.slice(0, 4).map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span className="text-dim capitalize">{a.snapshotType.replace(/_/g, " ")}</span>
                  <span className="font-mono text-accent shrink-0">
                    {a.concurrentViewers ?? "—"} viewers
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { visibilityToShowStatus, showStatusToVisibility };
