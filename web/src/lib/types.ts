export type EventSchedule = {
  weekdays: string[];
  times: string[];
  reminders_minutes: number[];
};

export type BotEvent = {
  id: string;
  name: string;
  region: string;
  source: string;
  verification_status: string;
  timezone: string;
  enabled: boolean;
  placeholder: boolean;
  messages: {
    reminder: string;
    start: string;
  };
  schedule: EventSchedule;
  next_start: string | null;
};

export type DashboardState = {
  updatedAt: string;
  bot: {
    status: "online" | "starting";
    id: string | null;
    name: string;
    guildCount: number;
    schedulerRunning: boolean;
  };
  guild: {
    id: string;
    name: string;
    iconUrl: string | null;
  };
  voice: {
    configured: boolean;
    connected: boolean;
    channelId: string | null;
    channelName: string | null;
    channels: Array<{
      id: string;
      name: string;
      categoryName: string | null;
      type: "voice";
    }>;
    autojoin: boolean;
    volume: number;
    latencyMs: number | null;
    reconnect: "active" | "disabled" | "suspended" | "retrying";
  };
  schedule: {
    internalTimezone: string;
    displayTimezone: string;
    events: BotEvent[];
    nextJobs: Array<{
      id: string;
      event_id: string;
      event_name: string;
      region: string;
      reminder_minutes: number;
      next_run: string | null;
      next_run_display: string | null;
      display_timezone: string;
      timezone: string;
      weekday: number;
      time: string;
    }>;
  };
};

export type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

export type EligibleGuild = {
  id: string;
  name: string;
  iconUrl: string | null;
  reason: "owner" | "administrator" | "manage_guild" | "role_hierarchy";
};
