import { NextResponse } from "next/server";
import { exchangeCode, getDiscordUser } from "@/lib/discord";
import { getOAuthState, setSessionCookie, clearAuthCookies } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = await getOAuthState();
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: "Invalid Discord OAuth state." }, { status: 400 });
  }
  try {
    const token = await exchangeCode(code);
    const user = await getDiscordUser(token.access_token);
    const response = NextResponse.redirect(new URL("/select", request.url));
    setSessionCookie(response, {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000,
      user,
    });
    return response;
  } catch (error) {
    const response = NextResponse.json({ error: error instanceof Error ? error.message : "Discord sign-in failed." }, { status: 502 });
    clearAuthCookies(response);
    return response;
  }
}
