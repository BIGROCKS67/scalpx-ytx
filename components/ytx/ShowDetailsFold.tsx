"use client";

import type { ReactNode } from "react";

export function ShowDetailsFold({
  id,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  id?: string;
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details id={id} className="ytx-details track-panel mb-3 group" open={defaultOpen}>
      <summary className="ytx-details-summary cursor-pointer list-none">
        <span className="text-sm font-semibold text-ink">{title}</span>
        {summary ? <span className="text-xs text-dim ml-2 hidden sm:inline">{summary}</span> : null}
        <span className="ytx-details-chevron text-dim ml-auto" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="ytx-details-body pt-4 mt-3 border-t border-white/6">{children}</div>
    </details>
  );
}
