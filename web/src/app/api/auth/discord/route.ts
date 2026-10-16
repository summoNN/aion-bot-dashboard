import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { oauthStateCookie } from "@/lib/session";

export async function GET() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !redirectUri) return NextResponse.json({ error: "Discord OAuth is not configured." }, { status: 503 });
  const state = crypto.randomBytes(24).toString("base64url");
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", "identify guilds guilds.members.read");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", redirectUri);
  const response = NextResponse.redirect(url);
  response.headers.append("Set-Cookie", oauthStateCookie(state));
  return response;
}
