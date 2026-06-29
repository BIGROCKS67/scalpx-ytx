"use client";

import type { YtChannel } from "@/lib/types";
import { channelInitial } from "@/lib/showMedia";

type ChannelLike = Pick<YtChannel, "slug" | "displayName" | "avatarUrl"> | null | undefined;

export function ShowThumbnailPlaceholder({
  channel,
  variant = "card",
}: {
  channel?: ChannelLike;
  variant?: "card" | "hero";
}) {
  const slug = channel?.slug;
  const variantClass = variant === "hero" ? "ytx-thumb-placeholder--hero" : "ytx-thumb-placeholder--card";

  if (slug === "chento") {
    return (
      <div
        className={`ytx-show-card-placeholder ytx-thumb-placeholder ytx-thumb-placeholder--chento ${variantClass}`}
      >
        <span className="ytx-thumb-placeholder-symbol" aria-hidden>
          C
        </span>
        <div className="ytx-thumb-placeholder-portrait">
          {channel?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={channel.avatarUrl} alt="" className="ytx-thumb-placeholder-portrait-img" />
          ) : (
            <span className="ytx-thumb-placeholder-portrait-fallback">
              {channelInitial(channel?.displayName ?? "Chento")}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (slug === "banter") {
    return (
      <div
        className={`ytx-show-card-placeholder ytx-thumb-placeholder ytx-thumb-placeholder--banter ${variantClass}`}
      >
        <p className="ytx-thumb-placeholder-waiting">
          WAITING ON
          <br />
          THUMBNAIL
        </p>
      </div>
    );
  }

  return (
    <div className="ytx-show-card-placeholder ytx-show-card-empty">
      <span className="ytx-show-card-empty-label">No video linked</span>
    </div>
  );
}
