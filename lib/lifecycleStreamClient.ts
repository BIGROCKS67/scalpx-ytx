import type { LifecycleProgressEvent } from "@/lib/lifecycleProgress";
import type { LifecycleResult } from "@/lib/lifecycle";
import type { LifecycleRunProgress } from "@/components/ytx/LifecycleProgressBar";

export type LifecycleStreamResult =
  | { ok: true; data: LifecycleResult }
  | { ok: false; error: string; data?: LifecycleResult; status?: number };

export async function runLifecycleStream(
  showId: string,
  mode: string,
  onProgress: (progress: LifecycleRunProgress) => void,
  initial: LifecycleRunProgress
): Promise<LifecycleStreamResult> {
  const base = process.env.NEXT_PUBLIC_YTX_BASE_PATH ?? "/ytx";
  const url = `${base}/api/shows/${showId}/lifecycle`;

  let progress: LifecycleRunProgress = { ...initial, running: true, completed: new Map(initial.completed) };

  const push = () => onProgress({ ...progress, completed: new Map(progress.completed) });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      body: JSON.stringify({ mode, stream: true }),
    });

    if (!res.ok || !res.body) {
      let body: LifecycleResult | { error?: string } = {};
      try {
        body = (await res.json()) as LifecycleResult;
      } catch {
        body = {};
      }
      return {
        ok: false,
        error:
          typeof body === "object" && body && "error" in body && typeof body.error === "string"
            ? body.error
            : `Request failed (${res.status})`,
        data: "steps" in body ? (body as LifecycleResult) : undefined,
        status: res.status,
      };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line) as {
          kind: string;
          result?: LifecycleResult;
          error?: string;
        } & LifecycleProgressEvent;

        if (msg.kind === "progress") {
          if (msg.type === "plan") {
            progress = { ...progress, plan: msg.steps, activeStep: null };
          } else if (msg.type === "step_start") {
            progress = { ...progress, activeStep: msg.step };
          } else if (msg.type === "step") {
            progress.completed.set(msg.step.step, msg.step);
            progress = { ...progress, activeStep: null };
          } else if (msg.type === "complete") {
            progress = { ...progress, running: false, runOk: msg.ok, activeStep: null };
          }
          push();
        } else if (msg.kind === "result" && msg.result) {
          progress = { ...progress, running: false, runOk: msg.result.ok, activeStep: null };
          push();
          return msg.result.ok
            ? { ok: true as const, data: msg.result }
            : { ok: false as const, error: "Run finished with blockers", data: msg.result };
        } else if (msg.kind === "error") {
          progress = { ...progress, running: false, runOk: false, activeStep: null };
          push();
          return { ok: false, error: msg.error ?? "Lifecycle failed" };
        }
      }
    }

    progress = { ...progress, running: false, runOk: false };
    push();
    return { ok: false, error: "Stream ended unexpectedly" };
  } catch (e) {
    progress = { ...progress, running: false, runOk: false };
    push();
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
