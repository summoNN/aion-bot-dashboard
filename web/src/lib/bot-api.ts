import { getSelectedGuildId, getSession } from "./session";

type BotContext = { error: string } | { baseUrl: string; token: string; guildId: string };

export async function getBotContext(): Promise<BotContext> {
  const baseUrl = process.env.BOT_API_URL?.replace(/\/$/, "");
  const token = process.env.BOT_API_TOKEN;
  const session = await getSession();
  const guildId = await getSelectedGuildId();
  if (!baseUrl || !token) return { error: "The bot API is not configured." };
  if (!session) return { error: "Sign in with Discord to continue." };
  if (!guildId) return { error: "Select a Discord server to continue." };
  return { baseUrl, token, guildId };
}
