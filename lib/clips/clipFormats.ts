export const CLIP_EXPORT_FORMATS = ["tiktok", "reels", "shorts", "square", "original"] as const;
export type ClipExportFormat = (typeof CLIP_EXPORT_FORMATS)[number];

export type ClipExportQuality = "high" | "balanced";

/** How source video maps into the export frame. */
export type CropFocus = "fit" | "top" | "center";

export interface ClipFormatSpec {
  id: ClipExportFormat;
  label: string;
  width: number;
  height: number;
  aspect: string;
}

export const CLIP_FORMAT_SPECS: Record<ClipExportFormat, ClipFormatSpec> = {
  tiktok: { id: "tiktok", label: "TikTok (9:16)", width: 1080, height: 1920, aspect: "9:16" },
  reels: { id: "reels", label: "Instagram Reels (9:16)", width: 1080, height: 1920, aspect: "9:16" },
  shorts: { id: "shorts", label: "YouTube Shorts (9:16)", width: 1080, height: 1920, aspect: "9:16" },
  square: { id: "square", label: "Square (1:1)", width: 1080, height: 1080, aspect: "1:1" },
  original: { id: "original", label: "Original aspect", width: 0, height: 0, aspect: "source" },
};

export function defaultFormatForPlatform(platform?: string): ClipExportFormat {
  if (platform === "youtube") return "shorts";
  if (platform === "instagram") return "reels";
  if (platform === "tiktok") return "tiktok";
  return "tiktok";
}
