import { NextRequest, NextResponse } from "next/server";
import { listChannels } from "@/lib/store";
import { preflightChannel } from "@/lib/readiness/preflight";
import { getYoutubeGlobalStatus } from "@/lib/youtube/dataApi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  const global = await getYoutubeGlobalStatus();

  if (channelId) {
    const status = await preflightChannel(channelId);
    return NextResponse.json({
      global,
      channel: status.channel
        ? {
            id: status.channel.id,
            slug: status.channel.slug,
            displayName: status.channel.displayName,
            oauthConnected: status.channel.oauthConnected,
          }
        : null,
      youtubeRead: status.youtubeRead,
      youtubeWrite: status.youtubeWrite,
      oauthConfigured: status.oauthConfigured,
      apiKeyConfigured: status.apiKeyConfigured,
    });
  }

  const channels = await listChannels();
  const perChannel = await Promise.all(
    channels.map(async (ch) => {
      const status = await preflightChannel(ch.id);
      return {
        id: ch.id,
        slug: ch.slug,
        displayName: ch.displayName,
        youtubeChannelId: ch.youtubeChannelId,
        oauthConnected: ch.oauthConnected,
        youtubeRead: status.youtubeRead,
        youtubeWrite: status.youtubeWrite,
      };
    })
  );

  return NextResponse.json({ global, channels: perChannel });
}
