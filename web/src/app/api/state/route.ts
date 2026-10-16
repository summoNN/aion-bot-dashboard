import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = process.env.BOT_API_URL?.replace(/\/$/, "");
  const token = process.env.BOT_API_TOKEN;
  const guildId = process.env.BOT_GUILD_ID;

  if (!baseUrl || !token || !guildId) {
    return NextResponse.json({ error: "Bot instance is not configured." }, { status: 503 });
  }

  try {
    const response = await fetch(`${baseUrl}/api/v1/state/${guildId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Bot instance is unreachable." }, { status: 502 });
  }
}
