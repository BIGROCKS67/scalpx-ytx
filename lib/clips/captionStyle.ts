export type CaptionStyle = {
  fontSize: number;
  textColor: string;
  highlightColor: string;
  /** Active word scale - CapCut pop (1.0–1.5). */
  popScale: number;
  /** Letter/word spacing in px at the 1080px reference width (0–20). */
  spacing: number;
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontSize: 62,
  textColor: "#FFFFFF",
  highlightColor: "#FFFF00",
  popScale: 1.28,
  spacing: 4,
};

export const CAPTION_FONT_SIZES = [48, 56, 62, 72, 80] as const;

export const CAPTION_SPACING_MAX = 20;

export const CAPTION_COLOR_PRESETS: Array<{ id: string; text: string; highlight: string }> = [
  { id: "classic", text: "#FFFFFF", highlight: "#FFFF00" },
  { id: "neon", text: "#FFFFFF", highlight: "#00FF88" },
  { id: "fire", text: "#FFFFFF", highlight: "#FF4444" },
  { id: "ice", text: "#FFFFFF", highlight: "#44CCFF" },
  { id: "pink", text: "#FFFFFF", highlight: "#FF66CC" },
];

/** CSS hex → ASS &HAABBGGRR */
export function hexToAssColor(hex: string): string {
  const h = hex.replace("#", "").padStart(6, "0");
  const r = h.slice(0, 2);
  const g = h.slice(2, 4);
  const b = h.slice(4, 6);
  return `&H00${b}${g}${r}&`.toUpperCase();
}

/** Preview font size scaled from export 1080-wide frame to ~280px preview. */
export function previewFontPx(exportSize: number): number {
  return Math.round(exportSize * (280 / 1080) * 1.05);
}

export function normalizeCaptionStyle(raw?: Partial<CaptionStyle>): CaptionStyle {
  return {
    fontSize: CAPTION_FONT_SIZES.includes(raw?.fontSize as typeof CAPTION_FONT_SIZES[number])
      ? raw!.fontSize!
      : DEFAULT_CAPTION_STYLE.fontSize,
    textColor: raw?.textColor?.match(/^#[0-9A-Fa-f]{6}$/) ? raw.textColor : DEFAULT_CAPTION_STYLE.textColor,
    highlightColor: raw?.highlightColor?.match(/^#[0-9A-Fa-f]{6}$/)
      ? raw.highlightColor
      : DEFAULT_CAPTION_STYLE.highlightColor,
    popScale: Math.min(1.5, Math.max(1, Number(raw?.popScale) || DEFAULT_CAPTION_STYLE.popScale)),
    spacing: Math.min(
      CAPTION_SPACING_MAX,
      Math.max(0, raw?.spacing == null ? DEFAULT_CAPTION_STYLE.spacing : Number(raw.spacing) || 0)
    ),
  };
}
