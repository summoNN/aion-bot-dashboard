import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { DiscordUser } from "./types";

const SESSION_COOKIE = "aion_session";
const STATE_COOKIE = "aion_discord_oauth_state";

function cookieSecurity() {
  return process.env.NODE_ENV === "production" ? " Secure;" : "";
}

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: DiscordUser;
};

function secretKey() {
  const secret = process.env.DISCORD_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("DISCORD_SESSION_SECRET must be at least 32 characters");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(value: AuthSession) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value: string): AuthSession | null {
  try {
    const [ivValue, tagValue, encryptedValue] = value.split(".");
    if (!ivValue || !tagValue || !encryptedValue) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const decoded = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const session = JSON.parse(decoded) as AuthSession;
    if (!session.accessToken || !session.user?.id) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getSession() {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  return value ? decrypt(value) : null;
}

export async function getSelectedGuildId() {
  const store = await cookies();
  return store.get("aion_selected_guild")?.value ?? null;
}

export function setSessionCookie(response: Response, session: AuthSession) {
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=${encrypt(session)}; Path=/; HttpOnly;${cookieSecurity()} SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`);
}

export function clearAuthCookies(response: Response) {
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly;${cookieSecurity()} SameSite=Lax; Max-Age=0`);
  response.headers.append("Set-Cookie", `${STATE_COOKIE}=; Path=/; HttpOnly;${cookieSecurity()} SameSite=Lax; Max-Age=0`);
  response.headers.append("Set-Cookie", `aion_selected_guild=; Path=/; HttpOnly;${cookieSecurity()} SameSite=Lax; Max-Age=0`);
}

export function oauthStateCookie(state: string) {
  return `${STATE_COOKIE}=${state}; Path=/; HttpOnly;${cookieSecurity()} SameSite=Lax; Max-Age=600`;
}

export async function getOAuthState() {
  const store = await cookies();
  return store.get(STATE_COOKIE)?.value ?? null;
}

export function selectedGuildCookie(guildId: string) {
  return `aion_selected_guild=${guildId}; Path=/; HttpOnly;${cookieSecurity()} SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;
}
