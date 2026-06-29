import { createHash, randomBytes } from "crypto";
import type { AppSettings } from "@/lib/types";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl",
].join(" ");

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function generatePkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = b64url(randomBytes(32));
  const codeChallenge = b64url(createHash("sha256").update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

export function generateState(): string {
  return b64url(randomBytes(16));
}

export function oauthConfigured(settings: AppSettings): boolean {
  return Boolean(settings.googleClientId?.trim() && settings.googleClientSecret?.trim());
}

export function buildAuthorizeUrl(
  settings: AppSettings,
  redirectUri: string,
  state: string,
  codeChallenge: string
): string {
  const params = new URLSearchParams({
    client_id: settings.googleClientId.trim(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export async function exchangeCode(
  settings: AppSettings,
  redirectUri: string,
  code: string,
  codeVerifier: string
) {
  const body = new URLSearchParams({
    client_id: settings.googleClientId.trim(),
    client_secret: settings.googleClientSecret.trim(),
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Token exchange failed");
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  }>;
}

export async function refreshAccessToken(settings: AppSettings, refreshToken: string) {
  const body = new URLSearchParams({
    client_id: settings.googleClientId.trim(),
    client_secret: settings.googleClientSecret.trim(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Refresh failed");
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

function appOrigin(): string {
  const configured = process.env.YTX_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return "http://localhost:3001";
}

export function appUrl(): string {
  return `${appOrigin()}/ytx`;
}

export function callbackUrl(): string {
  return `${appOrigin()}/ytx/api/youtube/callback`;
}
