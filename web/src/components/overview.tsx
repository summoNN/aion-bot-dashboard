import { Activity, CalendarClock, Mic2, Radio, Server } from "lucide-react";
import { AppShell } from "./app-shell";
import { StatusPill } from "./status-pill";
import type { DashboardState } from "@/lib/types";

function formatNext(value: string | null) {
  if (!value) return "No upcoming run";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function Overview({ data, error }: { data: DashboardState | null; error: string | null }) {
  if (!data) {
    return <AppShell><div className="card error-card"><div className="eyebrow">Instance connection</div><h1>Connect your bot</h1><p className="topbar-copy">The UI is ready. Add the control API values from your bot instance to the dashboard environment.</p><div className="alert" style={{ marginTop: 22 }}><CircleWarning />{error}</div><code>BOT_API_URL=http://your-bot-host:8765<br />BOT_API_TOKEN=your-control-api-token<br />BOT_GUILD_ID=your-discord-server-id</code></div></AppShell>;
  }

  const connected = data.bot.status === "online";
  return <AppShell>
    <div className="topbar">
      <div><div className="eyebrow">Overview</div><h1>Good to see you.</h1><p className="topbar-copy">A quiet view of what your AION 2 instance is doing right now.</p></div>
      <div className="instance"><div className="instance-avatar">{data.guild.name.slice(0, 2).toUpperCase()}</div><div><div className="instance-name">{data.guild.name}</div><div className="instance-id">Guild {data.guild.id}</div></div></div>
    </div>
    <div className="grid stats-grid">
      <Stat icon={<Activity size={16} />} label="Bot status" value={connected ? "Online" : "Starting"} detail={data.bot.name} />
      <Stat icon={<CalendarClock size={16} />} label="Active schedules" value={String(data.schedule.events.filter((event) => event.enabled).length)} detail={`${data.schedule.displayTimezone} display time`} />
      <Stat icon={<Mic2 size={16} />} label="Voice link" value={data.voice.connected ? "Connected" : "Offline"} detail={data.voice.channelName || "No channel configured"} />
      <Stat icon={<Server size={16} />} label="Scheduler" value={data.bot.schedulerRunning ? "Running" : "Paused"} detail={`${data.bot.guildCount} Discord server${data.bot.guildCount === 1 ? "" : "s"}`} />
    </div>
    <div className="grid two-col" style={{ marginTop: 18 }}>
      <section className="card"><div className="section-head"><div><h2>Event schedules</h2><p>Next announcement windows from the bot.</p></div><StatusPill status={data.bot.schedulerRunning ? "success" : "warning"} label={data.bot.schedulerRunning ? "Live" : "Paused"} /></div><div className="event-list">{data.schedule.events.length ? data.schedule.events.map((event) => <div className="event-row" key={event.id}><div className="event-main"><div className={`event-dot ${event.enabled ? "" : "off"}`} /><div><div className="event-name">{event.name}</div><div className="event-meta">{event.region} · {event.timezone} · {event.schedule.times.join(", ")}</div></div></div><div className="event-next"><div className="event-next-label">{event.enabled ? "Next start" : "Schedule disabled"}</div><div className="event-next-value">{event.enabled ? formatNext(event.next_start) : "—"}</div></div></div>) : <div className="empty">No schedules are configured yet.</div>}</div></section>
      <section className="card voice-card"><div className="section-head"><div><h2>Voice link</h2><p>Live connection for this server.</p></div><StatusPill status={data.voice.connected ? "success" : "neutral"} label={data.voice.connected ? "Connected" : "Offline"} /></div><div className="voice-status"><div className="voice-orb"><Radio size={21} /></div><div><div className="voice-title">{data.voice.channelName || "No voice channel"}</div><div className="voice-subtitle">{data.voice.connected ? `${data.voice.latencyMs ?? "—"} ms latency` : "Configure a target in Bot configuration"}</div></div></div><div className="detail-list"><div className="detail-item"><span>Autojoin</span><strong>{data.voice.autojoin ? "Enabled" : "Disabled"}</strong></div><div className="detail-item"><span>Reconnect</span><strong>{data.voice.reconnect}</strong></div><div className="detail-item"><span>Announcement volume</span><strong>{Math.round(data.voice.volume * 100)}%</strong></div></div></section>
    </div>
    <p className="footer-note">Last updated {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.updatedAt))} · API data stays server-side.</p>
  </AppShell>;
}

function Stat({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="card stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div></div>;
}

function CircleWarning() { return <span aria-hidden="true"><CircleAlertIcon /></span>; }
function CircleAlertIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>; }
