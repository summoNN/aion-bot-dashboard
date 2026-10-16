import { NextResponse } from "next/server";
import { getEligibleGuilds } from "@/lib/discord";
import { getSelectedGuildId, getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in with Discord first." }, { status: 401 });
  try {
    return NextResponse.json({ guilds: await getEligibleGuilds(session), selectedGuildId: await getSelectedGuildId() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load Discord servers." }, { status: 502 });
  }
}
