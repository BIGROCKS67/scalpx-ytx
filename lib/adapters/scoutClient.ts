import { getSettings } from "@/lib/store";

export async function scoutFetch<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; error: string; offline?: boolean }> {
  const settings = await getSettings();
  const base = settings.scoutUrl.replace(/\/$/, "");
  const headers = new Headers(init?.headers);
  if (settings.scoutServiceKey) {
    headers.set("Authorization", `Bearer ${settings.scoutServiceKey}`);
  }
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  try {
    const res = await fetch(`${base}${path}`, { ...init, headers });
    const body = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      return { ok: false, error: body.error ?? `Scout ${res.status}` };
    }
    return { ok: true, data: body };
  } catch {
    return { ok: false, error: "FlowX Scout unreachable", offline: true };
  }
}

export function scoutConfigured(): Promise<boolean> {
  return getSettings().then((s) => Boolean(s.scoutUrl));
}
