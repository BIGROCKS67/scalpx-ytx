import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/store";
import { callbackUrl, oauthConfigured } from "@/lib/youtubeOAuth";

export const dynamic = "force-dynamic";

const mask = (v: string) => (v ? "••••" + v.slice(-4) : "");

export async function GET() {
  const s = await getSettings();
  return NextResponse.json({
    googleClientId: s.googleClientId,
    googleClientSecret: mask(s.googleClientSecret),
    youtubeApiKey: mask(s.youtubeApiKey),
    scoutUrl: s.scoutUrl,
    scoutServiceKey: mask(s.scoutServiceKey),
    deepseekApiKey: mask(s.deepseekApiKey),
    hasGoogleOAuth: oauthConfigured(s),
    hasYoutubeApiKey: Boolean(s.youtubeApiKey?.trim() || process.env.YTX_YOUTUBE_API_KEY?.trim()),
    hasScout: Boolean(s.scoutUrl),
    redirectUri: callbackUrl(),
  });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as Record<string, string>;
  const patch: Record<string, string> = {};
  if (typeof body.googleClientId === "string") patch.googleClientId = body.googleClientId.trim();
  if (typeof body.googleClientSecret === "string" && !body.googleClientSecret.startsWith("••••")) {
    patch.googleClientSecret = body.googleClientSecret.trim();
  }
  if (typeof body.youtubeApiKey === "string" && !body.youtubeApiKey.startsWith("••••")) {
    patch.youtubeApiKey = body.youtubeApiKey.trim();
  }
  if (typeof body.scoutUrl === "string") patch.scoutUrl = body.scoutUrl.trim();
  if (typeof body.scoutServiceKey === "string" && !body.scoutServiceKey.startsWith("••••")) {
    patch.scoutServiceKey = body.scoutServiceKey.trim();
  }
  if (typeof body.deepseekApiKey === "string" && !body.deepseekApiKey.startsWith("••••")) {
    patch.deepseekApiKey = body.deepseekApiKey.trim();
  }
  const saved = await saveSettings(patch);
  return NextResponse.json({
    ok: true,
    hasGoogleOAuth: oauthConfigured(saved),
    hasYoutubeApiKey: Boolean(saved.youtubeApiKey?.trim() || process.env.YTX_YOUTUBE_API_KEY?.trim()),
  });
}
