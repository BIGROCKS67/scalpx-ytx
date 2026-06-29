import type { YtChannel } from "@/lib/types";
import { channelInitial } from "@/lib/showMedia";

type ChannelLike = Pick<YtChannel, "displayName" | "avatarUrl"> | null | undefined;

const SIZE_CLASS = {
  sm: "ytx-channel-avatar-sm",
  md: "ytx-channel-avatar-md",
  lg: "ytx-channel-avatar-lg",
} as const;

export function ChannelAvatar({
  channel,
  size = "md",
}: {
  channel?: ChannelLike;
  size?: keyof typeof SIZE_CLASS;
}) {
  const name = channel?.displayName ?? "Channel";
  const wrapClass = `ytx-channel-avatar-wrap ${SIZE_CLASS[size]}`;

  if (channel?.avatarUrl) {
    return (
      <span className={wrapClass} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={channel.avatarUrl} alt="" className="ytx-channel-avatar-img" loading="lazy" />
      </span>
    );
  }

  return (
    <span className={`ytx-channel-avatar-wrap ytx-channel-avatar-fallback ${SIZE_CLASS[size]}`} aria-hidden>
      {channelInitial(name)}
    </span>
  );
}
