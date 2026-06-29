"use client";

import type { StudioTab } from "@/lib/studioLabels";
import { STUDIO_TABS } from "@/lib/studioLabels";

export function ShowStudioNav({
  active,
  onChange,
  badges,
}: {
  active: StudioTab;
  onChange: (tab: StudioTab) => void;
  badges?: Partial<Record<StudioTab, number>>;
}) {
  const activeMeta = STUDIO_TABS.find((t) => t.id === active);

  return (
    <div className="ytx-studio-nav-wrap mb-4">
      <nav className="ytx-studio-nav" aria-label="Video editor">
        <ul className="ytx-studio-nav-list">
          {STUDIO_TABS.map((tab) => {
            const count = badges?.[tab.id];
            return (
              <li key={tab.id}>
                <button
                  type="button"
                  onClick={() => onChange(tab.id)}
                  className={`ytx-studio-nav-item ${active === tab.id ? "ytx-studio-nav-item-active" : ""}`}
                >
                  {tab.label}
                  {count && count > 0 ? (
                    <span className="ytx-studio-nav-badge">{count}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      {activeMeta ? (
        <p className="ytx-studio-nav-hint">{activeMeta.hint}</p>
      ) : null}
    </div>
  );
}

export function ShowStudioPanel({ children }: { children: React.ReactNode }) {
  return <div className="ytx-studio-panel">{children}</div>;
}
