import { getRecentVideoPerformance } from "@/lib/adapters/track";
import type { SeoPack, ShowRun, YtChannel } from "@/lib/types";

export async function generateSeoPack(
  show: ShowRun,
  channel: YtChannel
): Promise<SeoPack> {
  const ctx = await getRecentVideoPerformance(channel.trackAccountId);
  const topViews = ctx[0]?.views ?? 0;
  const guest = show.guestName ? ` ft. ${show.guestName}` : "";
  const formatLabel =
    show.format === "banter" ? "Banter Live" : show.format === "education" ? "Market Education" : "Live Trading";

  const titles = [
    `${show.title}${guest} | ${channel.displayName}`,
    `${formatLabel}: ${show.title} (${new Date().toLocaleDateString("en-GB", { month: "short", day: "numeric" })})`,
    topViews > 0
      ? `${show.title} - ${channel.displayName} Live Stream`
      : `LIVE NOW: ${show.title} | Crypto Trading`,
  ];

  const keywords = [
    ...channel.tags,
    show.format,
    "live",
    "crypto",
    "trading",
    "bitcoin",
  ].slice(0, 12);

  const description = [
    `${show.title}${guest} - ${channel.displayName} ${formatLabel} session.`,
    channel.descriptionTemplate || "Join us for live market analysis and community Q&A.",
    show.guestName ? `Guest: ${show.guestName}.` : "",
    "",
    "🔔 Subscribe for live alerts",
    "",
    keywords.slice(0, 8).map((k) => `#${k.replace(/\s+/g, "")}`).join(" "),
    "",
    "Not financial advice.",
  ]
    .filter(Boolean)
    .join("\n");

  const thumbnailBrief = [
    `# Thumbnail brief - ${show.title}`,
    `Channel: ${channel.displayName}`,
    `Format: ${show.format}`,
    show.guestName ? `Guest: ${show.guestName}` : "",
    `Variant A: Bold title "${show.title.slice(0, 40)}" + face cam + green accent`,
    `Variant B: Chart screenshot + LIVE badge + ${channel.slug} branding`,
    `Colors: #3dff8b accent on near-black (#050705)`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    titles,
    description,
    tags: keywords,
    thumbnailBrief,
  };
}
