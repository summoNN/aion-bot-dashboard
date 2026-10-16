import { Overview } from "@/components/overview";
import { GuildPicker, LoginView } from "@/components/auth-views";
import { getEligibleGuilds } from "@/lib/discord";
import { getBotState } from "@/lib/server-api";
import { getSelectedGuildId, getSession } from "@/lib/session";
import type { EligibleGuild } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (!session) return <LoginView />;
  let guilds: EligibleGuild[] = [];
  let guildError: string | null = null;
  try { guilds = await getEligibleGuilds(session); } catch (error) { guilds = []; guildError = error instanceof Error ? error.message : "Could not load your Discord servers."; }
  const selectedGuildId = await getSelectedGuildId();
  if (!selectedGuildId || !guilds.some((guild) => guild.id === selectedGuildId)) return <GuildPicker user={session.user} guilds={guilds} error={guildError} />;
  const result = await getBotState();
  return <Overview data={result.data} error={result.error} />;
}
