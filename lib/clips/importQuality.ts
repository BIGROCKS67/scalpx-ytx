export const YT_IMPORT_HEIGHTS = [480, 720, 1080, 1440] as const;
export type YtImportHeight = (typeof YT_IMPORT_HEIGHTS)[number];

export interface YtImportQualityOption {
  height: YtImportHeight;
  label: string;
  hint: string;
}

export const YT_IMPORT_QUALITY_OPTIONS: YtImportQualityOption[] = [
  { height: 480, label: "480p", hint: "Fast · smallest file · fine for quick clips" },
  { height: 720, label: "720p", hint: "Balanced · default for clipping" },
  { height: 1080, label: "1080p", hint: "High quality · bigger download" },
  { height: 1440, label: "1440p", hint: "Max quality · slowest · large files" },
];

export function normalizeYtImportHeight(raw: unknown): YtImportHeight {
  const n = Number(raw);
  if (n === 480 || n === 720 || n === 1080 || n === 1440) return n;
  const env = process.env.FLOWX_CLIP_YT_MAX_HEIGHT?.trim();
  const fromEnv = env ? Number(env) : 720;
  if (fromEnv === 480 || fromEnv === 720 || fromEnv === 1080 || fromEnv === 1440) return fromEnv;
  return 720;
}
