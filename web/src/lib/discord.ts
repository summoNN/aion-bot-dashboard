import type { AuthSession } from "./session";
import type { DiscordUser, EligibleGuild } from "./types";

const DISCORD_API = "https://discord.com/api/v10";
const ADMINISTRATOR = BigInt(1) << BigInt(3);
const MANAGE_GUILD = BigInt(1) << BigInt(5);

type UserGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
};

type UserMember = { roles: string[] };
type BotGuild = {
  id: string;
  name: string;
  iconUrl?: string | null;
  botHighestRolePosition?: number;
  rolePositions?: Record<string, number>;
};

function iconUrl(guild: UserGuild) {
  return guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64` : null;
}

function permissions(value: string | number | undefined) {
  try { return BigInt(String(value ?? "0")); } catch { return BigInt(0); }
}

function retryAfterSeconds(response: Response) {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header >= 0) return header;
  return 1;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function discordFetch<T>(path: string, accessToken: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${DISCORD_API}${path}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
    } catch {
      throw new Error("Discord could not be reached from the dashboard server.");
    }
    if (response.status === 429) {
      const retryAfter = retryAfterSeconds(response);
      if (attempt === 0 && retryAfter <= 3) {
        await wait(retryAfter * 1000);
        continue;
      }
      throw new Error(`Discord is temporarily rate-limiting requests. Please wait ${Math.ceil(retryAfter)} seconds and try again.`);
    }
    if (!response.ok) throw new Error(`Discord API returned ${response.status}`);
    return (await response.json()) as T;
  }
  throw new Error("Discord is temporarily unavailable. Please try again.");
}

export async function exchangeCode(code: string) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error("Discord OAuth is not configured");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Discord authorization code exchange failed");
  return (await response.json()) as { access_token: string; refresh_token: string; expires_in: number };
}

export function getDiscordUser(accessToken: string) {
  return discordFetch<DiscordUser>("/users/@me", accessToken);
}

async function getUserGuilds(accessToken: string) {
  return discordFetch<UserGuild[]>("/users/@me/guilds", accessToken);
}

async function getUserMember(accessToken: string, guildId: string) {
  return discordFetch<UserMember>(`/users/@me/guilds/${guildId}/member`, accessToken);
}

async function getBotGuilds() {
  const baseUrl = process.env.BOT_API_URL?.replace(/\/$/, "");
  const token = process.env.BOT_API_TOKEN;
  if (!baseUrl || !token) throw new Error("BOT_API_URL and BOT_API_TOKEN must be configured.");
  let apiUrl: URL;
  try {
    apiUrl = new URL(baseUrl);
  } catch {
    throw new Error("BOT_API_URL must include http:// or https://, for example http://localhost:8765.");
  }
  if (!['http:', 'https:'].includes(apiUrl.protocol)) {
    throw new Error("BOT_API_URL must use http:// or https://.");
  }
  let response: Response;
  try {
    response = await fetch(`${apiUrl.toString().replace(/\/$/, "")}/api/v1/guilds`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    throw new Error(`The dashboard server cannot reach BOT_API_URL (${baseUrl}). If this dashboard is on Vercel, localhost will not work; use a public HTTPS bot API URL.`);
  }
  if (!response.ok) throw new Error(`Bot API returned ${response.status}. It must expose GET /api/v1/guilds with the configured token.`);
  const payload = (await response.json()) as { guilds?: BotGuild[] } | BotGuild[];
  return Array.isArray(payload) ? payload : payload.guilds ?? [];
}

export async function getEligibleGuilds(session: AuthSession): Promise<EligibleGuild[]> {
  const [userGuilds, botGuilds] = await Promise.all([getUserGuilds(session.accessToken), getBotGuilds()]);
  const botById = new Map(botGuilds.map((guild) => [guild.id, guild]));
  const commonGuilds = userGuilds.filter((guild) => botById.has(guild.id));
  const eligible = await Promise.all(commonGuilds.map(async (guild) => {
    const bot = botById.get(guild.id);
    const userPermissions = permissions(guild.permissions);
    if (guild.owner) return { id: guild.id, name: guild.name, iconUrl: iconUrl(guild), reason: "owner" as const };
    if ((userPermissions & ADMINISTRATOR) === ADMINISTRATOR) return { id: guild.id, name: guild.name, iconUrl: iconUrl(guild), reason: "administrator" as const };
    if ((userPermissions & MANAGE_GUILD) === MANAGE_GUILD) return { id: guild.id, name: guild.name, iconUrl: iconUrl(guild), reason: "manage_guild" as const };
    if (!bot?.rolePositions || typeof bot.botHighestRolePosition !== "number") return null;
    try {
      const member = await getUserMember(session.accessToken, guild.id);
      const highestUserRole = Math.max(0, ...member.roles.map((roleId) => bot.rolePositions?.[roleId] ?? 0));
      return highestUserRole > bot.botHighestRolePosition
        ? { id: guild.id, name: guild.name, iconUrl: iconUrl(guild), reason: "role_hierarchy" as const }
        : null;
    } catch {
      return null;
    }
  }));
  return eligible.filter((guild): guild is EligibleGuild => guild !== null).sort((a, b) => a.name.localeCompare(b.name));
}
