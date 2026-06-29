import { generateChannelTrailer } from "@/lib/channelTrailer";
import type { YtChannel } from "@/lib/types";
import { getChannel, updateChannel } from "@/lib/store";

function expandDescription(template: string, channel: YtChannel): string {
  const lines = [
    template.trim(),
    "",
    `Subscribe for live ${channel.showFormats.join(" · ")} content from ${channel.displayName}.`,
    "",
    Object.entries(channel.socialLinks)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n"),
    "",
    "Not financial advice.",
  ].filter(Boolean);
  return lines.join("\n");
}

function tagsFromDescription(description: string, seed: string[]): string[] {
  const words = description
    .toLowerCase()
    .replace(/[^\w\s#]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["this", "that", "with", "from", "your"].includes(w));

  const merged = [...new Set([...seed, ...words.slice(0, 8)])];
  return merged.slice(0, 15);
}

export async function runChannelSetup(channelId: string) {
  const channel = await getChannel(channelId);
  if (!channel) throw new Error("Channel not found");

  const description = expandDescription(channel.descriptionTemplate, channel);
  const tags = tagsFromDescription(description, channel.tags);

  const updated = await updateChannel(channelId, {
    descriptionTemplate: description,
    tags,
  });

  const trailerDraft = await generateChannelTrailer(channelId);

  return {
    channel: updated,
    description,
    tags,
    trailerDraft,
  };
}
