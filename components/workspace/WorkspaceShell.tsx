"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type WorkspaceShellProps = {
  title?: string;
  panel: React.ReactNode;
  children: React.ReactNode;
};

export function WorkspaceShell({ title, panel, children }: WorkspaceShellProps) {
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    if (!panelOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [panelOpen]);

  useEffect(() => {
    const el = document.documentElement;
    el.dataset.shell = "1";
    return () => {
      delete el.dataset.shell;
    };
  }, []);

  return (
    <div className="track-layout">
      {panelOpen ? (
        <button
          type="button"
          className="track-rail-backdrop"
          aria-label="Close panel"
          onClick={() => setPanelOpen(false)}
        />
      ) : null}

      <div className="track-canvas">
        <div className="ytx-canvas-toolbar lg:hidden">
          <button type="button" className="track-rail-toggle" onClick={() => setPanelOpen(true)}>
            {title ? `${title} · panel` : "Panel"}
          </button>
        </div>
        <div className="workspace-canvas">{children}</div>
      </div>

      <aside className={`track-rail ytx-context-panel ${panelOpen ? "track-rail-open" : ""}`}>
        <div className="track-rail-brand lg:hidden">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{title ?? "Panel"}</p>
            <button
              type="button"
              className="track-rail-close"
              aria-label="Close panel"
              onClick={() => setPanelOpen(false)}
            >
              ×
            </button>
          </div>
        </div>
        <div className="track-rail-body flex-1 min-h-0 overflow-y-auto flex flex-col">{panel}</div>
      </aside>
    </div>
  );
}
