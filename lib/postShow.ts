import { listMomentsForSource } from "@/lib/clips/momentsStore";
import type { ShowRun } from "@/lib/types";

export type PostShowSeoResult = {
  tags: string[];
  descriptionAppend: string;
  chapterBlock: string;
};

/** Post-show SEO pass from clip moments / show metadata (offline). */
export async function runPostShowSeoPass(
  show: ShowRun,
  sourceId: string | null
): Promise<PostShowSeoResult> {
  const baseTags = [...(show.seoTags ?? [])];
  let chapterBlock = "";
  const extraTags: string[] = [];

  if (sourceId) {
    const moments = await listMomentsForSource(sourceId);
    const top = [...moments].sort((a, b) => b.score - a.score).slice(0, 8);
    for (const m of top) {
      extraTags.push(
        ...m.title
          .toLowerCase()
          .split(/\W+/)
          .filter((w) => w.length > 3)
          .slice(0, 2)
      );
      chapterBlock += `${formatTs(m.startSec)} ${m.title}\n`;
    }
  }

  if (show.guestName) {
    extraTags.push(show.guestName.toLowerCase().replace(/\s+/g, ""));
  }

  const tags = [...new Set([...baseTags, ...extraTags])].slice(0, 15);
  const descriptionAppend = chapterBlock
    ? `\n\nChapters:\n${chapterBlock.trim()}`
    : "\n\nTimestamps updated post-show.";

  return { tags, descriptionAppend, chapterBlock: chapterBlock.trim() };
}

function formatTs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
