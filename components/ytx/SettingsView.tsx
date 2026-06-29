"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchJson } from "@/lib/clientFetch";
import ErrorBanner from "@/components/ErrorBanner";
import { ContextHeader } from "@/components/shell/ContextHeader";
import { CopyField } from "@/components/shell/CopyField";
import { Badge, Button } from "@/components/ui";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

type SettingsPayload = {
  googleClientId: string;
  googleClientSecret: string;
  youtubeApiKey: string;
  scoutUrl: string;
  scoutServiceKey: string;
  deepseekApiKey: string;
  hasGoogleOAuth: boolean;
  hasYoutubeApiKey: boolean;
  hasScout: boolean;
  redirectUri: string;
};

export function SettingsView() {
  const searchParams = useSearchParams();
  const oauthNotice = searchParams.get("oauth");
  const [form, setForm] = useState({
    googleClientId: "",
    googleClientSecret: "",
    youtubeApiKey: "",
    scoutUrl: "http://localhost:3000",
    scoutServiceKey: "",
    deepseekApiKey: "",
  });
  const [flags, setFlags] = useState({
    hasGoogleOAuth: false,
    hasYoutubeApiKey: false,
    hasScout: false,
    redirectUri: "",
  });
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetchJson<SettingsPayload>("/api/settings");
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setForm({
      googleClientId: res.data.googleClientId,
      googleClientSecret: res.data.googleClientSecret,
      youtubeApiKey: res.data.youtubeApiKey,
      scoutUrl: res.data.scoutUrl,
      scoutServiceKey: res.data.scoutServiceKey,
      deepseekApiKey: res.data.deepseekApiKey,
    });
    setFlags({
      hasGoogleOAuth: res.data.hasGoogleOAuth,
      hasYoutubeApiKey: res.data.hasYoutubeApiKey,
      hasScout: res.data.hasScout,
      redirectUri: res.data.redirectUri,
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(section: string) {
    setSaved(null);
    const res = await fetchJson("/api/settings", {
      method: "PUT",
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(section);
    void load();
  }

  return (
    <WorkspaceShell
      title="Settings"
      panel={
        <div className="track-rail-block space-y-3 text-sm text-dim">
          <p className="track-rail-label">Status</p>
          <p>YouTube OAuth: {flags.hasGoogleOAuth ? "Saved" : "Missing"}</p>
          <p>YouTube API key: {flags.hasYoutubeApiKey ? "Set" : "Not set"}</p>
          <p>Scout URL: {flags.hasScout ? "Set" : "Not set"}</p>
          <Link href="/channels" className="track-rail-pill text-left w-full">
            Connect channel OAuth
          </Link>
        </div>
      }
    >
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
      {oauthNotice === "not_configured" ? (
        <ErrorBanner message="Add Google OAuth credentials before connecting a channel." />
      ) : null}
      {oauthNotice === "connected" ? (
        <p className="text-sm text-accent mb-4">Channel OAuth connected.</p>
      ) : null}

      <ContextHeader
        title="Settings"
        subtitle="YouTube OAuth, API key, and Scout adapter credentials"
      />

      <div className="space-y-6 max-w-2xl">
        <section className="track-panel space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">YouTube Data API key</h2>
              <p className="text-xs text-dim mt-0.5">
                Read-only fallback for stats and channel lookups
              </p>
            </div>
            <Badge tone={flags.hasYoutubeApiKey ? "good" : "warn"}>
              {flags.hasYoutubeApiKey ? "Set" : "Optional"}
            </Badge>
          </div>
          <Field
            label="API key"
            value={form.youtubeApiKey}
            onChange={(v) => setForm((f) => ({ ...f, youtubeApiKey: v }))}
            secret
            hint={
              form.youtubeApiKey.startsWith("••••")
                ? "Leave as-is or paste to replace"
                : "From Google Cloud Console → Credentials → API key"
            }
          />
          <Button variant="secondary" onClick={() => void save("youtube-key")}>
            {saved === "youtube-key" ? "Saved" : "Save API key"}
          </Button>
        </section>

        <section className="track-panel space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">YouTube OAuth</h2>
              <p className="text-xs text-dim mt-0.5">
                {flags.hasGoogleOAuth ? "Credentials saved" : "Not configured"}
              </p>
            </div>
            <Badge tone={flags.hasGoogleOAuth ? "good" : "warn"}>
              {flags.hasGoogleOAuth ? "Ready" : "Setup required"}
            </Badge>
          </div>
          {flags.redirectUri ? (
            <CopyField
              label="Authorized redirect URI"
              value={flags.redirectUri}
              hint="Paste into Google Cloud Console → OAuth client → Authorized redirect URIs"
            />
          ) : null}
          <Field
            label="Google Client ID"
            value={form.googleClientId}
            onChange={(v) => setForm((f) => ({ ...f, googleClientId: v }))}
          />
          <Field
            label="Google Client Secret"
            value={form.googleClientSecret}
            onChange={(v) => setForm((f) => ({ ...f, googleClientSecret: v }))}
            secret
            hint={form.googleClientSecret.startsWith("••••") ? "Leave as-is or paste to replace" : undefined}
          />
          <Button onClick={() => void save("youtube")}>
            {saved === "youtube" ? "Saved" : "Save YouTube OAuth"}
          </Button>
        </section>

        <section className="track-panel space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">FlowX Scout</h2>
            <p className="text-xs text-dim mt-0.5">Clips · Content · Deals adapters</p>
          </div>
          <Field
            label="Scout URL"
            value={form.scoutUrl}
            onChange={(v) => setForm((f) => ({ ...f, scoutUrl: v }))}
          />
          <Field
            label="Service key"
            value={form.scoutServiceKey}
            onChange={(v) => setForm((f) => ({ ...f, scoutServiceKey: v }))}
            secret
          />
          <Button variant="secondary" onClick={() => void save("scout")}>
            {saved === "scout" ? "Saved" : "Save Scout"}
          </Button>
        </section>

        <section className="track-panel space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">DeepSeek</h2>
            <p className="text-xs text-dim mt-0.5">Optional · SEO and copy generation</p>
          </div>
          <Field
            label="API key"
            value={form.deepseekApiKey}
            onChange={(v) => setForm((f) => ({ ...f, deepseekApiKey: v }))}
            secret
          />
          <Button variant="secondary" onClick={() => void save("deepseek")}>
            {saved === "deepseek" ? "Saved" : "Save DeepSeek"}
          </Button>
        </section>
      </div>
    </WorkspaceShell>
  );
}

function Field({
  label,
  value,
  onChange,
  secret,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secret?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-dim">{label}</span>
      <input
        type={secret ? "password" : "text"}
        className="ytx-input w-full mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <p className="text-[11px] text-dim mt-1">{hint}</p> : null}
    </label>
  );
}
