import type { ChildProcess } from "child_process";

type RunControl = {
  cancelled: boolean;
  kills: Array<() => void>;
};

const runs = new Map<string, RunControl>();

function getOrCreate(jobId: string): RunControl {
  let ctrl = runs.get(jobId);
  if (!ctrl) {
    ctrl = { cancelled: false, kills: [] };
    runs.set(jobId, ctrl);
  }
  return ctrl;
}

export function registerImportRun(jobId: string, child: ChildProcess): void {
  getOrCreate(jobId).kills.push(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      // already dead
    }
  });
}

export function registerImportUploadKill(jobId: string, kill: () => void): void {
  getOrCreate(jobId).kills.push(kill);
}

export function cancelImportRun(jobId: string): boolean {
  const ctrl = runs.get(jobId);
  if (!ctrl) return false;
  ctrl.cancelled = true;
  for (const kill of ctrl.kills) kill();
  return true;
}

export function isImportCancelled(jobId: string): boolean {
  return runs.get(jobId)?.cancelled ?? false;
}

export function clearImportRun(jobId: string): void {
  runs.delete(jobId);
}
