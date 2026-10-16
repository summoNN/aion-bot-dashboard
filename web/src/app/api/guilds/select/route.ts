import { NextResponse } from "next/server";
import { getEligibleGuilds } from "@/lib/discord";
import { getSession, selectedGuildCookie } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in with Discord first." }, { status: 401 });
  const body = await request.json().catch(() => null) as { guildId?: string } | null;
  const guildId = body?.guildId;
  if (!guildId) return NextResponse.json({ error: "guildId is required." }, { status: 400 });
  try {
    const guilds = await getEligibleGuilds(session);
    if (!guilds.some((guild) => guild.id === guildId)) return NextResponse.json({ error: "You cannot manage this server." }, { status: 403 });
    const response = NextResponse.json({ ok: true, guildId });
    response.headers.append("Set-Cookie", selectedGuildCookie(guildId));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not validate this server." }, { status: 502 });
  }
}
