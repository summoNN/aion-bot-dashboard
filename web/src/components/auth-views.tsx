"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, Building2, LoaderCircle, LogIn, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import type { DiscordUser, EligibleGuild } from "@/lib/types";

export function LoginView({ error }: { error?: string | null }) {
  return <main className="public-shell"><div className="public-card"><div className="public-mark">A2</div><div className="eyebrow">AION 2 Announce</div><h1>Your bot, in focus.</h1><p className="topbar-copy">Sign in with Discord to choose a server you manage and open its private control center.</p>{error && <div className="alert" style={{ marginTop: 22 }}>{error}</div>}<a className="button login-button" href="/api/auth/discord"><LogIn size={16} /> Continue with Discord <ArrowRight size={15} /></a><div className="public-security"><ShieldCheck size={15} /> Your Discord token never enters the browser.</div></div></main>;
}

export function GuildPicker({ user, guilds, error }: { user: DiscordUser; guilds: EligibleGuild[]; error?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState(error ?? null);

  async function select(guildId: string) {
    setBusy(guildId); setMessage(null);
    try {
      const response = await fetch("/api/guilds/select", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guildId }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not select this server.");
      router.push("/"); router.refresh();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not select this server."); setBusy(null); }
  }

  return <main className="public-shell"><div className="picker-wrap"><div className="picker-heading"><div><div className="eyebrow">Server selection</div><h1>Choose your server.</h1><p className="topbar-copy">Welcome, {user.global_name || user.username}. These are the servers where your account can manage the bot.</p></div><a className="button ghost" href="/api/auth/logout">Sign out</a></div>{message && <div className="alert" style={{ marginBottom: 18 }}>{message}</div>}{guilds.length ? <div className="guild-grid">{guilds.map((guild) => <button className="guild-card" key={guild.id} onClick={() => select(guild.id)} disabled={busy !== null}><div className="guild-icon">{guild.iconUrl ? <Image src={guild.iconUrl} alt="" width={40} height={40} unoptimized /> : <Building2 size={20} />}</div><div className="guild-copy"><div className="guild-name">{guild.name}</div><div className="guild-reason">{reasonLabel(guild.reason)}</div></div>{busy === guild.id ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}</button>)}</div> : <div className="card empty-state"><Building2 size={22} /><h2>No eligible servers found</h2><p>The bot must be installed in a server where you are an administrator, have Manage Server, or hold a role above the bot.</p><a className="button secondary" href="/api/auth/logout">Use another Discord account</a></div>}<p className="footer-note"><ShieldCheck size={13} style={{ verticalAlign: "-2px" }} /> Eligibility is checked again every time you select a server.</p></div></main>;
}

function reasonLabel(reason: EligibleGuild["reason"]) {
  return reason === "owner" ? "Server owner" : reason === "administrator" ? "Administrator" : reason === "manage_guild" ? "Manage Server" : "Role above bot";
}
