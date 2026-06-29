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
  const className = `ytx-channel-avatar ${SIZE_CLASS[size]}`;

  if (channel?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={channel.avatarUrl} alt="" className={className} loading="lazy" />
    );
  }

  return (
    <div className={`ytx-show-card-avatar ${className}`} aria-hidden>
      {channelInitial(name)}
    </div>
  );
}
