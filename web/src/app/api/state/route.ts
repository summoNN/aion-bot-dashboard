import { NextResponse } from "next/server";
import { getBotContext } from "@/lib/bot-api";

export async function GET() {
  const context = await getBotContext();
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: 401 });

  try {
    const response = await fetch(`${context.baseUrl}/api/v1/state/${context.guildId}`, {
      headers: { Authorization: `Bearer ${context.token}` },
      cache: "no-store",
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Bot instance is unreachable." }, { status: 502 });
  }
}
