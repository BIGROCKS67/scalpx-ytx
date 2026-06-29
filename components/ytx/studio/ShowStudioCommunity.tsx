"use client";

import type { CommentReply } from "@/lib/types";
import { Badge, Button } from "@/components/ui";

export function ShowStudioCommunity({
  items,
  busy,
  onGenerate,
  onUpdateReply,
  onApprove,
  onSkip,
}: {
  items: CommentReply[];
  busy: boolean;
  onGenerate: () => void;
  onUpdateReply: (id: string, reply: string) => void;
  onApprove: (id: string) => void;
  onSkip: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <header className="ytx-studio-form-intro">
        <h2 className="text-base font-semibold text-ink">Community</h2>
        <p className="text-sm text-dim mt-1">
          Same idea as YouTube Studio → Community — review comments and approve replies before you
          post them on YouTube.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={onGenerate}>
          {busy ? "Drafting…" : items.length ? "Refresh reply drafts" : "Draft replies"}
        </Button>
      </div>

      {items.length ? (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id} className="track-panel">
              <p className="text-xs text-accent font-medium">{c.authorHint}</p>
              <p className="text-sm text-dim mt-1">{c.commentText}</p>
              <label className="ytx-studio-label mt-3 block">Your reply</label>
              <textarea
                className="ytx-input w-full min-h-[72px] text-sm mt-1"
                value={c.draftReply}
                onChange={(e) => onUpdateReply(c.id, e.target.value)}
              />
              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm" variant="secondary" onClick={() => onApprove(c.id)}>
                  Approve reply
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onSkip(c.id)}>
                  Skip
                </Button>
                <Badge tone={c.status === "approved" ? "good" : "neutral"}>{c.status}</Badge>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-dim">
          No reply drafts yet. Run Prepare everything on Dashboard, or tap Draft replies above.
        </p>
      )}
    </div>
  );
}
