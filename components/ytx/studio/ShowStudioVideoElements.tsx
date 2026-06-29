"use client";

import type { ClipBatch, ShowRun, SponsorBlock } from "@/lib/types";
import { Badge, Button } from "@/components/ui";

function formatChapterLines(chapters: ShowRun["liveChapters"]): string {
  if (!chapters.length) return "";
  return chapters
    .map((c) => {
      const m = Math.floor(c.atSec / 60);
      const s = String(Math.floor(c.atSec % 60)).padStart(2, "0");
      return `${m}:${s} ${c.label}`;
    })
    .join("\n");
}

function StudioElementSection({
  title,
  subtitle,
  status,
  busy,
  runLabel = "Update",
  onRun,
  children,
}: {
  title: string;
  subtitle: string;
  status?: { label: string; tone: "good" | "warn" | "neutral" };
  busy?: boolean;
  runLabel?: string;
  onRun?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="ytx-video-element">
      <div className="ytx-video-element-head">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <p className="text-xs text-dim mt-0.5">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
          {onRun ? (
            <Button size="sm" disabled={busy} onClick={onRun}>
              {busy ? "Running…" : runLabel}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="ytx-video-element-body">{children}</div>
    </section>
  );
}

export function ShowStudioVideoElements({
  show,
  sponsorBlock,
  clipBatch,
  endScreenMsg,
  busy,
  onGenerateChapters,
  onGenerateSponsor,
  onRunClips,
  onRunEndScreen,
}: {
  show: ShowRun;
  sponsorBlock: SponsorBlock | null;
  clipBatch: ClipBatch | null;
  endScreenMsg: string | null;
  busy: string | null;
  onGenerateChapters: () => void;
  onGenerateSponsor: () => void;
  onRunClips: () => void;
  onRunEndScreen: () => void;
}) {
  const chapterText = formatChapterLines(show.liveChapters);
  const isLivePipeline = show.pipeline === "live";
  const hasChapters = show.liveChapters.length > 0;

  return (
    <div className="ytx-studio-form space-y-5">
      <header className="ytx-studio-form-intro">
        <h2 className="text-base font-semibold text-ink">Video elements</h2>
        <p className="text-sm text-dim mt-1">
          Same four areas as YouTube Studio after Details — chapters, sponsor segment, end screen,
          and Shorts cut from this video.
        </p>
      </header>

      <StudioElementSection
        title="Chapters"
        subtitle="Timestamps viewers can jump to in the player and description."
        status={
          hasChapters
            ? { label: `${show.liveChapters.length} chapter${show.liveChapters.length === 1 ? "" : "s"}`, tone: "good" }
            : { label: "Not set", tone: "neutral" }
        }
        busy={busy === "chapters"}
        runLabel={hasChapters ? "Refresh" : "Generate"}
        onRun={isLivePipeline ? onGenerateChapters : undefined}
      >
        {chapterText ? (
          <pre className="ytx-video-element-mono">{chapterText}</pre>
        ) : (
          <p className="text-sm text-dim">
            {isLivePipeline
              ? "Generate intro + milestone chapters before or during the stream."
              : "Chapters apply to live streams. Pre-recorded shows skip this step."}
          </p>
        )}
        {!isLivePipeline ? (
          <p className="text-xs text-dim mt-2">Live pipeline only — this show uses pre-recorded.</p>
        ) : null}
      </StudioElementSection>

      <StudioElementSection
        title="Sponsor segment"
        subtitle="In-video sponsor copy and tracking links from FlowX Scout."
        status={
          sponsorBlock
            ? { label: "Draft ready", tone: "good" }
            : { label: "Not set", tone: "neutral" }
        }
        busy={busy === "sponsor"}
        runLabel={sponsorBlock ? "Refresh" : "Pull from Scout"}
        onRun={onGenerateSponsor}
      >
        {sponsorBlock ? (
          <pre className="ytx-video-element-mono whitespace-pre-wrap">{sponsorBlock.copy}</pre>
        ) : (
          <p className="text-sm text-dim">
            Pulls sponsor URLs and disclosure copy when this show has a deal linked.
          </p>
        )}
      </StudioElementSection>

      <StudioElementSection
        title="End screen"
        subtitle="Watch-next card and end-screen graph — set after the stream or upload."
        status={
          endScreenMsg
            ? { label: "Configured", tone: "good" }
            : { label: "Not set", tone: "neutral" }
        }
        busy={busy === "postshow"}
        runLabel={endScreenMsg ? "Refresh" : "Build end screen"}
        onRun={onRunEndScreen}
      >
        {endScreenMsg ? (
          <p className="text-sm text-dim">{endScreenMsg}</p>
        ) : (
          <p className="text-sm text-dim">
            Finalizes tags, chapter list in the description, and the end-screen edge to your next
            video.
          </p>
        )}
      </StudioElementSection>

      <StudioElementSection
        title="Shorts"
        subtitle="Vertical clips exported from this stream for YouTube Shorts."
        status={
          clipBatch?.status === "done"
            ? { label: "Exported", tone: "good" }
            : clipBatch
              ? { label: clipBatch.status, tone: "warn" }
              : { label: "Not started", tone: "neutral" }
        }
        busy={busy === "clips"}
        runLabel={clipBatch ? "Run again" : "Export Shorts"}
        onRun={onRunClips}
      >
        {clipBatch ? (
          <div className="space-y-2">
            <p className="text-sm text-dim">{clipBatch.message}</p>
            {clipBatch.exportUrls.length > 0 ? (
              <ul className="ytx-video-element-mono space-y-1">
                {clipBatch.exportUrls.map((u) => (
                  <li key={u} className="truncate text-accent">
                    {u}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-dim">
            Needs a linked YouTube replay. Runs locally (yt-dlp · Whisper · ffmpeg) or Scout if
            configured.
          </p>
        )}
      </StudioElementSection>
    </div>
  );
}
