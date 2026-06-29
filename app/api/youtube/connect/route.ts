import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  appUrl,
  buildAuthorizeUrl,
  callbackUrl,
  generatePkce,
  generateState,
  oauthConfigured,
} from "@/lib/youtubeOAuth";
import { getSettings } from "@/lib/store";

export const dynamic = "force-dynamic";

const OAUTH_COOKIE = "ytx_oauth_pending";

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }
  const settings = await getSettings();
  if (!oauthConfigured(settings)) {
    return NextResponse.redirect(`${appUrl()}/settings?oauth=not_configured`);
  }
  const { codeVerifier, codeChallenge } = generatePkce();
  const state = generateState();
  const jar = await cookies();
  jar.set(
    OAUTH_COOKIE,
    JSON.stringify({ channelId, codeVerifier, state }),
    { httpOnly: true, maxAge: 600, sameSite: "lax", path: "/" }
  );
  const url = buildAuthorizeUrl(settings, callbackUrl(), state, codeChallenge);
  return NextResponse.redirect(url);
}
