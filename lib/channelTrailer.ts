import { getChannel, updateChannel } from "@/lib/store";

export type ChannelTrailerDraft = {
  script: string;
  hook: string;
  cta: string;
  suggestedClips: string[];
};

/** AI-style channel trailer brief (auto + human QC before upload to YT Studio). */
export async function generateChannelTrailer(channelId: string): Promise<ChannelTrailerDraft> {
  const channel = await getChannel(channelId);
  if (!channel) throw new Error("Channel not found");

  const hook = `Why ${channel.displayName}? Real markets. Real streams. No fluff.`;
  const script = [
    `[0:00] ${hook}`,
    `[0:08] ${channel.descriptionTemplate.slice(0, 160)}`,
    `[0:20] Best moments from recent live ${channel.showFormats.join(" / ")} sessions`,
    `[0:35] Subscribe + bell - we go live every week`,
  ].join("\n");
  const cta = "Subscribe for live alerts";
  const suggestedClips = [
    "Top viral moment (15s hook)",
    "Guest highlight reel",
    "Education clip montage",
  ];

  await updateChannel(channelId, {
    channelTrailerDraft: { script, hook, cta, suggestedClips, status: "pending_qc" },
  });

  return { script, hook, cta, suggestedClips };
}
