import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { callbackUrl, exchangeCode, appUrl } from "@/lib/youtubeOAuth";
import { getSettings, listShows, saveOAuthTokens } from "@/lib/store";
import { ACTION_TASKS, markTasksDone } from "@/lib/checklistAutomation";

export const dynamic = "force-dynamic";

const OAUTH_COOKIE = "ytx_oauth_pending";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  const base = appUrl();

  if (error) {
    return NextResponse.redirect(`${base}/settings?oauth=error`);
  }

  const jar = await cookies();
  const raw = jar.get(OAUTH_COOKIE)?.value;
  jar.delete(OAUTH_COOKIE);

  if (!raw || !code || !state) {
    return NextResponse.redirect(`${base}/settings?oauth=invalid`);
  }

  try {
    const pending = JSON.parse(raw) as {
      channelId: string;
      codeVerifier: string;
      state: string;
    };
    if (pending.state !== state) {
      return NextResponse.redirect(`${base}/settings?oauth=state`);
    }
    const settings = await getSettings();
    const tokens = await exchangeCode(settings, callbackUrl(), code, pending.codeVerifier);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    await saveOAuthTokens(pending.channelId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      expiresAt,
      scopes: tokens.scope.split(" "),
    });
    const shows = await listShows();
    for (const show of shows.filter((s) => s.channelId === pending.channelId)) {
      await markTasksDone(show.id, ACTION_TASKS.oauth);
    }
    return NextResponse.redirect(`${base}/channels?oauth=connected`);
  } catch {
    return NextResponse.redirect(`${base}/settings?oauth=failed`);
  }
}
