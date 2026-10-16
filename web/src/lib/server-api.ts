import type { DashboardState } from "./types";
import { getBotContext } from "./bot-api";

export async function getBotState(): Promise<{
  data: DashboardState | null;
  error: string | null;
}> {
  const context = await getBotContext();
  if ("error" in context) return { data: null, error: context.error };

  try {
    const response = await fetch(`${context.baseUrl}/api/v1/state/${context.guildId}`, {
      headers: { Authorization: `Bearer ${context.token}` },
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
