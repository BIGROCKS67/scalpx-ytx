import fs from "fs";
import path from "path";
import { spawn, type ChildProcess } from "child_process";

export function resolveYtDlpBin(): string {
  const env = process.env.YT_DLP_PATH?.trim();
  if (env && fs.existsSync(env)) return env;

  const projectBin = path.join(process.cwd(), "bin", "yt-dlp");
  if (fs.existsSync(projectBin)) return projectBin;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const staticPath = require("yt-dlp-static") as string;
    if (staticPath && fs.existsSync(staticPath)) return staticPath;
  } catch {
    // optional
  }

  return "yt-dlp";
}

export function runYtDlp(
  args: string[],
  timeoutMs = 120_000
): Promise<{ stdout: string; stderr: string }> {
  const bin = resolveYtDlpBin();
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("yt-dlp timed out"));
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.slice(-300) || `yt-dlp exit ${code}`));
    });
  });
}

export function registerYtDlpChild(jobId: string, child: ChildProcess): void {
  // optional hook for cancel - importCancel can extend later
  void jobId;
  void child;
}
