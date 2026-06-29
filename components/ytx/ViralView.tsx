"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/clientFetch";
import ErrorBanner from "@/components/ErrorBanner";
import { ContextHeader } from "@/components/shell/ContextHeader";
import { TrendStreamSection } from "@/components/ytx/TrendStreamSection";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import type { TrendStreamInsights } from "@/lib/insights/trendStream";

type TrendsPayload = {
  trends: TrendStreamInsights;
};

export function ViralView() {
  const [data, setData] = useState<TrendsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchJson<TrendsPayload>("/api/trends");
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <WorkspaceShell
      title="Viral"
      panel={
        <div className="track-rail-block space-y-3 text-sm text-dim">
          <p className="track-rail-label">Quick actions</p>
          <Link href="/shows" className="track-rail-pill text-left w-full">
            Create show
          </Link>
          <Link href="/" className="track-rail-pill text-left w-full">
            Ops dashboard
          </Link>
        </div>
      }
    >
      {error ? <ErrorBanner message={error} onDismiss={() => void load()} /> : null}

      <ContextHeader
        title="Viral & stream ready"
        subtitle="Trending uploads → stream ideas. Queue a live follow-up while momentum is still hot."
      />

      <TrendStreamSection trends={data?.trends} loading={loading} />
    </WorkspaceShell>
  );
}
