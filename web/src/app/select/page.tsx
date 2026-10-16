import { GuildPicker, LoginView } from "@/components/auth-views";
import { getEligibleGuilds } from "@/lib/discord";
import { getSession } from "@/lib/session";
import type { EligibleGuild } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SelectPage() {
  const session = await getSession();
  if (!session) return <LoginView />;
  let guilds: EligibleGuild[] = [];
  let errorMessage: string | undefined;
  try {
    guilds = await getEligibleGuilds(session);
  } catch (error) {
    guilds = [];
    errorMessage = error instanceof Error ? error.message : "Could not load your Discord servers.";
  }
  return <GuildPicker user={session.user} guilds={guilds} error={errorMessage} />;
}
