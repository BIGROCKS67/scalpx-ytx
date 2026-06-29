/** First-release active channels — master these before expanding roster. */
export const ACTIVE_CHANNEL_SLUGS = ["chento", "banter"] as const;

export type ActiveChannelSlug = (typeof ACTIVE_CHANNEL_SLUGS)[number];

export const ACTIVE_CHANNEL_COUNT = ACTIVE_CHANNEL_SLUGS.length;

export function isActiveChannelSlug(slug: string): slug is ActiveChannelSlug {
  return (ACTIVE_CHANNEL_SLUGS as readonly string[]).includes(slug);
}

export function filterActiveChannels<T extends { slug: string }>(channels: T[]): T[] {
  return channels.filter((c) => isActiveChannelSlug(c.slug));
}
