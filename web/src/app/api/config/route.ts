import { NextResponse } from "next/server";
import { getBotContext } from "@/lib/bot-api";

export async function PATCH(request: Request) {
  const context = await getBotContext();
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: 401 });

  try {
    const response = await fetch(`${context.baseUrl}/api/v1/config/${context.guildId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${context.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(await request.json()),
      cache: "no-store",
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: "Bot instance is unreachable." }, { status: 502 });
  }
}
