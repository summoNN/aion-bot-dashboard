"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, Mic2, Play, Power, SlidersHorizontal } from "lucide-react";
import type { BotEvent, DashboardState } from "@/lib/types";
import { AppShell } from "./app-shell";
import { LocalTime } from "./local-time";
import { StatusPill } from "./status-pill";

type MessageDraft = { start: string; reminder: string };

export function SettingsPanel() {
  const [data, setData] = useState<DashboardState | null>(null);
  const [drafts, setDrafts] = useState<Record<string, MessageDraft>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/state", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load the bot instance.");
        return payload as DashboardState;
      })
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setDrafts(Object.fromEntries(payload.schedule.events.map((event) => [event.id, event.messages])));
      })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, []);

  async function mutate(endpoint: "/api/config" | "/api/actions", body: Record<string, unknown>, key: string) {
    setBusy(key);
    setSaved(null);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: endpoint === "/api/config" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The bot rejected this change.");
      setData(payload as DashboardState);
      if (typeof body.eventId === "string" && body.messages) {
        const event = (payload as DashboardState).schedule.events.find((candidate) => candidate.id === body.eventId);
        if (event) setDrafts((current) => ({ ...current, [event.id]: event.messages }));
      }
      setSaved(key);
      window.setTimeout(() => setSaved(null), 2200);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this change.");
    } finally {
      setBusy(null);
    }
  }

  function draftFor(event: BotEvent) {
    return drafts[event.id] ?? event.messages;
  }

  function updateDraft(eventId: string, field: keyof MessageDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [eventId]: { ...(current[eventId] ?? { start: "", reminder: "" }), [field]: value },
    }));
  }

  if (!data) {
    return <AppShell><div className="card error-card"><div className="eyebrow">Bot configuration</div><h1>Waiting for your instance</h1><p className="topbar-copy">{error || "Loading the secure control API…"}</p></div></AppShell>;
  }

  const channels = Array.from(new Map((data.voice.channels ?? []).map((channel) => [channel.id, channel])).values());
  return <AppShell>
    <div className="topbar">
      <div><div className="eyebrow">Bot configuration</div><h1>Make it yours.</h1><p className="topbar-copy">Tune schedules, announcement text, and voice behavior for {data.guild.name}.</p></div>
      <StatusPill status="success" label="Changes apply live" />
    </div>
    {error && <div className="alert" style={{ marginBottom: 18 }}>{error}</div>}

    <div className="settings-grid">
      <section className="card">
        <div className="section-head"><div><h2>Event schedules</h2><p>Enable or pause announcements without touching Discord.</p></div><SlidersHorizontal size={18} color="#5f65e8" /></div>
        <div className="setting-list">
          {data.schedule.events.map((event) => <div className="setting-row" key={event.id}>
            <div>
              <div className="setting-label">{event.name}</div>
              <div className="setting-description">{event.schedule.weekdays.map((day) => day.slice(0, 3)).join(" · ")} · configured {event.schedule.times.join(", ")} · reminders {event.schedule.reminders_minutes.map((minutes) => minutes === 0 ? "start" : `${minutes}m`).join(", ")}</div>
              <div className="setting-description">Next in your timezone: <LocalTime value={event.next_start} showZone /></div>
              <div>{event.schedule.times.map((time) => <span className="schedule-chip" key={time}>{time}</span>)}</div>
            </div>
            <button className={`switch ${event.enabled ? "on" : ""}`} onClick={() => mutate("/api/config", { eventId: event.id, enabled: !event.enabled }, event.id)} aria-label={`${event.enabled ? "Disable" : "Enable"} ${event.name}`} disabled={busy !== null}><span /></button>
          </div>)}
        </div>
      </section>

      <section className="card">
        <div className="section-head"><div><h2>Voice behavior</h2><p>Choose where announcements are played.</p></div><Mic2 size={18} color="#5f65e8" /></div>
        <div className="setting-list">
          <div className="setting-row channel-row">
            <div><div className="setting-label">Announcement channel</div><div className="setting-description">Select a voice channel that the bot can access in {data.guild.name}.</div></div>
            <select className="channel-select" value={data.voice.channelId ?? ""} onChange={(event) => { if (event.target.value) mutate("/api/config", { channelId: event.target.value }, "channel"); }} disabled={busy !== null || channels.length === 0} aria-label="Announcement channel">
              <option value="">{channels.length ? "Choose voice channel" : "No voice channels found"}</option>
              {channels.map((channel) => <option value={channel.id} key={channel.id}>{channel.categoryName ? `${channel.categoryName} / ` : ""}{channel.name}</option>)}
            </select>
          </div>
          <div className="setting-row">
            <div><div className="setting-label">Autojoin voice</div><div className="setting-description">Reconnect to the selected channel whenever the bot starts.</div></div>
            <button className={`switch ${data.voice.autojoin ? "on" : ""}`} onClick={() => mutate("/api/config", { autojoin: !data.voice.autojoin }, "autojoin")} aria-label="Toggle autojoin" disabled={busy !== null}><span /></button>
          </div>
          <div className="setting-row">
            <div><div className="setting-label">Announcement volume</div><div className="setting-description">From mute to 200% for this running bot instance.</div></div>
            <div className="range-wrap"><input type="range" min="0" max="2" step="0.05" value={data.voice.volume} onChange={(event) => setData({ ...data, voice: { ...data.voice, volume: Number(event.target.value) } })} onMouseUp={(event) => mutate("/api/config", { volume: Number((event.target as HTMLInputElement).value) }, "volume")} aria-label="Announcement volume" /><span className="range-value">{Math.round(data.voice.volume * 100)}%</span></div>
          </div>
        </div>
        <div className="actions" style={{ marginTop: 24 }}><button className="button" onClick={() => mutate("/api/actions", { action: "connect" }, "connect")} disabled={busy !== null}><Power size={14} /> Connect</button><button className="button secondary" onClick={() => mutate("/api/actions", { action: "disconnect" }, "disconnect")} disabled={busy !== null}>Disconnect</button></div>
      </section>
    </div>

    <section className="card message-card">
      <div className="section-head"><div><h2>Announcement text</h2><p>Customize the speech generated by the announcer. Use <code>{"{name}"}</code> and <code>{"{minutes}"}</code> as dynamic placeholders.</p></div><StatusPill status="neutral" label="TTS templates" /></div>
      <div className="message-grid">
        {data.schedule.events.map((event) => {
          const draft = draftFor(event);
          return <div className="message-editor" key={event.id}>
            <div className="setting-label">{event.name}</div>
            <label className="field"><span>At start</span><textarea className="text-input" maxLength={500} value={draft.start} onChange={(input) => updateDraft(event.id, "start", input.target.value)} /></label>
            <label className="field"><span>Reminder</span><textarea className="text-input" maxLength={500} value={draft.reminder} onChange={(input) => updateDraft(event.id, "reminder", input.target.value)} /></label>
            <button className="button secondary" onClick={() => mutate("/api/config", { eventId: event.id, messages: draft }, `messages-${event.id}`)} disabled={busy !== null}>{busy === `messages-${event.id}` ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} Save text</button>
          </div>;
        })}
      </div>
    </section>

    <section className="card message-card">
      <div className="section-head"><div><h2>Test announcement</h2><p>Send a live voice test using each event&apos;s start message.</p></div><StatusPill status={data.voice.configured ? "success" : "warning"} label={data.voice.configured ? "Voice target ready" : "Set a voice channel first"} /></div>
      <div className="actions">{data.schedule.events.map((event) => <button className="button ghost" key={event.id} onClick={() => mutate("/api/actions", { action: "test", eventId: event.id }, `test-${event.id}`)} disabled={!data.voice.configured || busy !== null}>{busy === `test-${event.id}` ? <LoaderCircle size={14} className="spin" /> : <Play size={14} />}{event.name}</button>)}</div>
    </section>
    <p className="footer-note">{saved ? <><Check size={13} style={{ verticalAlign: "-2px" }} /> Saved {saved}</> : "Changes are validated and persisted by the bot instance."}</p>
  </AppShell>;
}
