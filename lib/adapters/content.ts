import { randomUUID } from "crypto";
import { scoutFetch } from "@/lib/adapters/scoutClient";
import type { CrossPostItem, ShowRun, YtChannel } from "@/lib/types";

const PLATFORMS = [
  { id: "social-yt", platform: "youtube", label: "YouTube Community" },
  { id: "social-x", platform: "x", label: "X" },
  { id: "social-ig", platform: "instagram", label: "Instagram" },
  { id: "social-fb", platform: "facebook", label: "Facebook" },
  { id: "social-reddit", platform: "reddit", label: "Reddit" },
  { id: "social-tg", platform: "telegram", label: "Telegram" },
] as const;

function draftBody(show: ShowRun, channel: YtChannel, platform: string): string {
  const when = show.scheduledAt
    ? new Date(show.scheduledAt).toLocaleString("en-GB", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "soon";
  const guest = show.guestName ? ` w/ ${show.guestName}` : "";
  switch (platform) {
    case "x":
      return `🔴 LIVE ${when} - ${show.title}${guest}\n\n${channel.displayName} · ${show.format} show\n\n#crypto #trading`;
    case "youtube":
      return `Going live ${when}! ${show.title}${guest}. Set your reminder 🔔`;
    case "telegram":
      return `📣 Live stream ${when}\n${show.title}${guest}\n→ ${channel.displayName}`;
    default:
      return `Live ${when}: ${show.title}${guest} - ${channel.displayName}`;
  }
}

export async function generateCrossPosts(
  show: ShowRun,
  channel: YtChannel
): Promise<CrossPostItem[]> {
  const now = new Date().toISOString();
  const scheduledFor = show.scheduledAt
    ? new Date(new Date(show.scheduledAt).getTime() - 60 * 60 * 1000).toISOString()
    : null;

  const items: CrossPostItem[] = [];

  for (const p of PLATFORMS) {
    const body = draftBody(show, channel, p.platform);
    let scoutDraftId: string | null = null;

    if (channel.trackAccountId && p.platform !== "reddit" && p.platform !== "facebook") {
      const res = await scoutFetch<{ drafts: { id: string }[] }>("/api/content/generate-platform", {
        method: "POST",
        body: JSON.stringify({
          accountId: channel.trackAccountId,
          topic: show.title,
          platforms: [p.platform === "x" ? "x" : p.platform],
        }),
      });
      if (res.ok && res.data.drafts?.[0]) {
        scoutDraftId = res.data.drafts[0].id;
      }
    }

    items.push({
      id: randomUUID(),
      showRunId: show.id,
      platform: p.platform,
      draftBody: body,
      scoutDraftId,
      status: "draft",
      scheduledFor,
      createdAt: now,
      updatedAt: now,
    });
  }

  return items;
}

export { PLATFORMS as CROSS_POST_PLATFORMS };

export type IgCarouselDraft = {
  slides: string[];
  caption: string;
};

/** IG carousel draft from show transcript insights (local · Content adapter pattern). */
export async function generateIgCarouselDraft(
  show: ShowRun,
  channel: YtChannel
): Promise<IgCarouselDraft> {
  const guest = show.guestName ? `\nGuest: ${show.guestName}` : "";
  const slides = [
    `Slide 1 · Hook\n${show.title}`,
    `Slide 2 · Key takeaway\nLive ${show.format} session highlights`,
    `Slide 3 · CTA\nFollow ${channel.displayName} for the next stream`,
  ];
  const caption = `${show.title}${guest}\n\nFull replay on YouTube · link in bio\n\n#crypto #trading #${channel.slug}`;
  return { slides, caption };
}
