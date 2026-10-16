import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const baseUrl = process.env.BOT_API_URL?.replace(/\/$/, "");
  const token = process.env.BOT_API_TOKEN;
  const guildId = process.env.BOT_GUILD_ID;
  if (!baseUrl || !token || !guildId) {
    return NextResponse.json({ error: "Bot instance is not configured." }, { status: 503 });
  }

  try {
    const response = await fetch(`${baseUrl}/api/v1/actions/${guildId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(await request.json()),
      cache: "no-store",
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: "Bot instance is unreachable." }, { status: 502 });
  }
}
