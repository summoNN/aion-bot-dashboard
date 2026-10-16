import type { DashboardState } from "./types";

export async function getBotState(): Promise<{
  data: DashboardState | null;
  error: string | null;
}> {
  const baseUrl = process.env.BOT_API_URL?.replace(/\/$/, "");
  const token = process.env.BOT_API_TOKEN;
  const guildId = process.env.BOT_GUILD_ID;

  if (!baseUrl || !token || !guildId) {
    return {
      data: null,
      error: "Connect this dashboard to a bot instance with BOT_API_URL, BOT_API_TOKEN, and BOT_GUILD_ID.",
    };
  }

  try {
    const response = await fetch(`${baseUrl}/api/v1/state/${guildId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return { data: null, error: `Bot API returned ${response.status}. Check the instance connection.` };
    }
    return { data: (await response.json()) as DashboardState, error: null };
  } catch {
    return { data: null, error: "The bot instance is unreachable. Check its host and control API port." };
  }
}
