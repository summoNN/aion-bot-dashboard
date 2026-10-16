import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { DiscordUser } from "./types";

const SESSION_COOKIE = "aion_session";
const STATE_COOKIE = "aion_discord_oauth_state";

function cookieSecurity() {
  return process.env.NODE_ENV === "production";
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

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: cookieSecurity(),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function setSessionCookie(response: NextResponse, session: AuthSession) {
  response.cookies.set(SESSION_COOKIE, encrypt(session), cookieOptions(60 * 60 * 24 * 7));
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  response.cookies.set(STATE_COOKIE, "", cookieOptions(0));
  response.cookies.set("aion_selected_guild", "", cookieOptions(0));
}

export function setOAuthStateCookie(response: NextResponse, state: string) {
  response.cookies.set(STATE_COOKIE, state, cookieOptions(600));
}

export async function getOAuthState() {
  const store = await cookies();
  return store.get(STATE_COOKIE)?.value ?? null;
}

export function selectedGuildCookie(response: NextResponse, guildId: string) {
  response.cookies.set("aion_selected_guild", guildId, cookieOptions(60 * 60 * 24 * 30));
}
