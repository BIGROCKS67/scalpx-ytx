/** Where YTX is running — local dev vs Vercel demo host. */
export function isVercelDeploy(): boolean {
  return process.env.VERCEL === "1";
}

export function isServerlessDemoHost(): boolean {
  return isVercelDeploy();
}

/** Public origin for OAuth callbacks (no trailing slash, no /ytx path). */
export function publicAppOrigin(): string {
  const configured = process.env.YTX_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return "http://localhost:3001";
}

export type HostCapabilities = {
  serverless: boolean;
  previewClips: "local" | "scout_or_skip";
  persistData: boolean;
  appOrigin: string;
};

export function hostCapabilities(): HostCapabilities {
  const serverless = isServerlessDemoHost();
  return {
    serverless,
    previewClips: serverless ? "scout_or_skip" : "local",
    persistData: !serverless,
    appOrigin: publicAppOrigin(),
  };
}
