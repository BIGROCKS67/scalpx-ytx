export type FetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; data?: T };

export async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<FetchResult<T>> {
  try {
    const base = process.env.NEXT_PUBLIC_YTX_BASE_PATH ?? "/ytx";
    const full =
      url.startsWith("/api") || url.startsWith("/shows") || url.startsWith("/channels")
        ? `${base}${url}`
        : url;
    const headers = new Headers(init?.headers);
    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const res = await fetch(full, { ...init, headers });
    let body: unknown = {};
    try {
      body = await res.json();
    } catch {
      body = {};
    }
    if (!res.ok) {
      const msg =
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof (body as { error: unknown }).error === "string"
          ? (body as { error: string }).error
          : `Request failed (${res.status})`;
      return { ok: false, error: msg, status: res.status, data: body as T };
    }
    return { ok: true, data: body as T };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}
