"""Persistent, rate-aware Discord dashboard for AION 2 schedules."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import discord
from discord import app_commands
from discord.ext import commands

from bot.services.event_sources import EventConfigError
from bot.services.scheduler import EventScheduler
from bot.services.tts import TTSService
from bot.services.voice import VoiceService

LOGGER = logging.getLogger(__name__)
CONFIG_VERSION = 1
DEFAULT_UPDATE_INTERVAL = 60.0
MIN_EDIT_INTERVAL = 5.0


class DashboardConfigError(ValueError):
    """Raised when persistent dashboard configuration is invalid."""


@dataclass(frozen=True, slots=True)
class DashboardTarget:
    """The channel and message that receive automatic dashboard updates."""

    channel_id: int
    message_id: int


class DashboardStore:
    """Load and atomically persist one dashboard target per guild."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._targets: dict[int, DashboardTarget] = {}
        self.load()

    def load(self) -> None:
        try:
            document = json.loads(self.path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            self._targets = {}
            LOGGER.info("Dashboard configuration %s does not exist; starting empty", self.path)
            return
        except json.JSONDecodeError as exc:
            raise DashboardConfigError(
                f"Invalid JSON in {self.path}: {exc.msg} at line {exc.lineno}"
            ) from exc
        except OSError as exc:
            raise DashboardConfigError(f"Could not read dashboard configuration {self.path}: {exc}") from exc

        if not isinstance(document, dict) or document.get("version", CONFIG_VERSION) != CONFIG_VERSION:
            raise DashboardConfigError(f"Unsupported dashboard configuration in {self.path}")
        raw_guilds = document.get("guilds", {})
        if not isinstance(raw_guilds, dict):
            raise DashboardConfigError("dashboard configuration guilds must be an object")

        targets: dict[int, DashboardTarget] = {}
        for raw_guild_id, raw_target in raw_guilds.items():
            try:
                guild_id = int(raw_guild_id)
            except (TypeError, ValueError) as exc:
                raise DashboardConfigError(f"Invalid guild ID: {raw_guild_id}") from exc
            if guild_id <= 0 or not isinstance(raw_target, dict):
                raise DashboardConfigError(f"Invalid dashboard target for guild {raw_guild_id}")
            channel_id = raw_target.get("channel_id")
            message_id = raw_target.get("message_id")
            if not self._valid_id(channel_id) or not self._valid_id(message_id):
                raise DashboardConfigError(f"Invalid dashboard channel or message ID for guild {guild_id}")
            targets[guild_id] = DashboardTarget(channel_id=channel_id, message_id=message_id)
        self._targets = targets
        LOGGER.info("Loaded dashboard targets for %d guild(s) from %s", len(targets), self.path)

    @staticmethod
    def _valid_id(value: Any) -> bool:
        return isinstance(value, int) and not isinstance(value, bool) and value > 0

    def get(self, guild_id: int) -> DashboardTarget | None:
        return self._targets.get(guild_id)

    @property
    def guild_ids(self) -> tuple[int, ...]:
        return tuple(self._targets)

    def set(self, guild_id: int, channel_id: int, message_id: int) -> DashboardTarget:
        if not all(self._valid_id(value) for value in (guild_id, channel_id, message_id)):
            raise DashboardConfigError("Guild, channel, and message IDs must be positive integers")
        target = DashboardTarget(channel_id=channel_id, message_id=message_id)
        self._targets[guild_id] = target
        self.save()
        return target

    def remove(self, guild_id: int) -> None:
        if guild_id in self._targets:
            self._targets.pop(guild_id)
            self.save()

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=self.path.parent,
                prefix=f".{self.path.name}.",
                suffix=".tmp",
                delete=False,
            ) as temporary:
                temporary_path = Path(temporary.name)
                json.dump(
                    {
                        "version": CONFIG_VERSION,
                        "guilds": {
                            str(guild_id): {
                                "channel_id": target.channel_id,
                                "message_id": target.message_id,
                            }
                            for guild_id, target in sorted(self._targets.items())
                        },
                    },
                    temporary,
                    indent=2,
                )
                temporary.write("\n")
                temporary.flush()
                os.fsync(temporary.fileno())
            temporary_path.replace(self.path)
            LOGGER.info("Persisted dashboard configuration atomically to %s", self.path)
        except OSError as exc:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)
            raise DashboardConfigError(f"Could not persist dashboard configuration {self.path}: {exc}") from exc


class DashboardView(discord.ui.View):
    """Persistent controls attached to every dashboard message."""

    def __init__(self, service: "DashboardService") -> None:
        super().__init__(timeout=None)
        self.service = service

    @discord.ui.button(
        label="Refresh",
        emoji="🔄",
        style=discord.ButtonStyle.secondary,
        custom_id="aion2:dashboard:refresh",
    )
    async def refresh(self, interaction: discord.Interaction, button: discord.ui.Button["DashboardView"]) -> None:
        if interaction.guild is None:
            await _safe_interaction_message(interaction, "This dashboard can only be used inside a server.")
            return
        try:
            changed = await self.service.refresh_guild(interaction.guild, force=True)
            message = "Dashboard refreshed." if changed else "Dashboard is already up to date."
            await _safe_interaction_message(interaction, message)
        except discord.NotFound:
            await _safe_interaction_message(interaction, "This dashboard message no longer exists.")
        except discord.HTTPException:
            LOGGER.exception("Dashboard refresh interaction failed in guild %s", interaction.guild.id)
            await _safe_interaction_message(interaction, "Discord could not refresh the dashboard right now.")

    @discord.ui.button(
        label="Test Announcement",
        emoji="📣",
        style=discord.ButtonStyle.primary,
        custom_id="aion2:dashboard:test",
    )
    async def test_announcement(
        self,
        interaction: discord.Interaction,
        button: discord.ui.Button["DashboardView"],
    ) -> None:
        if interaction.guild is None:
            await _safe_interaction_message(interaction, "This dashboard can only be used inside a server.")
            return
        member = interaction.user
        if not isinstance(member, discord.Member) or not member.guild_permissions.manage_guild:
            await _safe_interaction_message(
                interaction,
                "Only members with **Manage Server** can run a voice test.",
            )
            return
        try:
            await self.service.test_announcement(interaction.guild)
            await _safe_interaction_message(interaction, "Test announcement queued in the configured voice channel.")
        except (EventConfigError, RuntimeError, OSError, discord.DiscordException, ValueError) as exc:
            LOGGER.exception("Dashboard test announcement failed in guild %s", interaction.guild.id)
            await _safe_interaction_message(interaction, f"Voice test failed: {exc}")


async def _safe_interaction_message(interaction: discord.Interaction, content: str) -> None:
    """Reply to a live interaction without turning an expired click into a traceback."""
    try:
        if interaction.response.is_done():
            await interaction.followup.send(content, ephemeral=True)
        else:
            await interaction.response.send_message(content, ephemeral=True)
    except (discord.NotFound, discord.InteractionResponded, discord.HTTPException):
        LOGGER.info("Ignoring expired dashboard interaction")


class DashboardService(commands.Cog):
    """Render, publish, and periodically refresh persistent guild dashboards."""

    def __init__(
        self,
        bot: discord.Client,
        scheduler: EventScheduler,
        voice_service: VoiceService,
        tts_service: TTSService,
        store: DashboardStore,
        update_interval: float = DEFAULT_UPDATE_INTERVAL,
    ) -> None:
        self.bot = bot
        self.scheduler = scheduler
        self.voice_service = voice_service
        self.tts_service = tts_service
        self.store = store
        self.update_interval = max(30.0, update_interval)
        self._periodic_task: asyncio.Task[None] | None = None
        self._guild_locks: dict[int, asyncio.Lock] = {}
        self._fingerprints: dict[int, str] = {}
        self._last_edits: dict[int, float] = {}
        self._started = False

    @app_commands.command(
        name="aionevents",
        description="Display the AION 2 Riftwatch event dashboard.",
    )
    async def aionevents(self, interaction: discord.Interaction) -> None:
        if interaction.guild is None:
            await _safe_interaction_message(interaction, "This dashboard can only be used inside a server.")
            return
        try:
            await interaction.response.defer(ephemeral=True)
            message = await self.publish_or_refresh(interaction)
            if message is None:
                await _safe_interaction_message(interaction, "The dashboard could not be published.")
                return
            if self.store.get(interaction.guild.id) is None:
                await interaction.followup.send(
                    "Dashboard displayed. A member with **Manage Server** must run `/aionevents` to configure automatic updates.",
                    ephemeral=True,
                )
            else:
                await interaction.followup.send("AION 2 dashboard refreshed.", ephemeral=True)
        except (DashboardConfigError, EventConfigError, discord.Forbidden, discord.NotFound, discord.HTTPException) as exc:
            LOGGER.exception("/aionevents failed in guild %s", interaction.guild.id)
            await _safe_interaction_message(interaction, f"Could not display the dashboard: {exc}")

    def _lock_for(self, guild_id: int) -> asyncio.Lock:
        return self._guild_locks.setdefault(guild_id, asyncio.Lock())

    async def start(self) -> None:
        if self._started:
            return
        self._started = True
        if isinstance(self.bot, discord.Client):
            self.bot.add_view(DashboardView(self))
        self._periodic_task = asyncio.create_task(self._periodic_loop(), name="aion-dashboard-refresh")
        await self.update_all(reason="startup")
        LOGGER.info("AION dashboard service started with %.0fs refresh interval", self.update_interval)

    async def stop(self) -> None:
        self._started = False
        self.scheduler.remove_change_listener(self.on_schedule_changed)
        if self._periodic_task is not None:
            self._periodic_task.cancel()
            await asyncio.gather(self._periodic_task, return_exceptions=True)
            self._periodic_task = None
        self._guild_locks.clear()
        self._fingerprints.clear()
        self._last_edits.clear()

    async def _periodic_loop(self) -> None:
        while self._started:
            try:
                await asyncio.sleep(self.update_interval)
                await self.update_all(reason="periodic refresh")
            except asyncio.CancelledError:
                raise
            except Exception:
                LOGGER.exception("Periodic dashboard refresh failed")

    async def on_schedule_changed(self, _config: object) -> None:
        """Listener used by EventScheduler after reloads and admin edits."""
        await self.update_all(reason="schedule changed")

    async def update_all(self, *, reason: str) -> None:
        for guild_id in self.store.guild_ids:
            guild = self.bot.get_guild(guild_id)
            if guild is None:
                continue
            await self.refresh_guild(guild, reason=reason)

    async def refresh_guild(
        self,
        guild: discord.Guild,
        *,
        force: bool = False,
        reason: str = "manual refresh",
    ) -> bool:
        """Edit the configured message only when its rendered content changed."""
        target = self.store.get(guild.id)
        if target is None:
            return False
        async with self._lock_for(guild.id):
            try:
                message = await self._fetch_target_message(target)
            except discord.NotFound:
                LOGGER.warning("Dashboard message %s was deleted in guild %s; removing saved target", target.message_id, guild.id)
                self.store.remove(guild.id)
                self._fingerprints.pop(guild.id, None)
                return False
            except discord.Forbidden:
                LOGGER.warning("Cannot read dashboard message %s in guild %s", target.message_id, guild.id)
                return False
            except discord.HTTPException:
                LOGGER.exception("Could not fetch dashboard message in guild %s", guild.id)
                return False

            embed = self.build_embed(guild)
            fingerprint = self._fingerprint(embed)
            if not force and self._fingerprints.get(guild.id) == fingerprint:
                return False
            if time.monotonic() - self._last_edits.get(guild.id, 0.0) < MIN_EDIT_INTERVAL:
                LOGGER.debug("Skipping dashboard edit in guild %s due to local rate-limit guard", guild.id)
                return False
            try:
                await message.edit(embed=embed, view=DashboardView(self))
            except discord.NotFound:
                LOGGER.warning("Dashboard message disappeared during edit in guild %s", guild.id)
                self.store.remove(guild.id)
                return False
            except discord.Forbidden:
                LOGGER.warning("Cannot edit dashboard message in guild %s", guild.id)
                return False
            except discord.HTTPException:
                LOGGER.exception("Could not edit dashboard message in guild %s", guild.id)
                return False
            self._fingerprints[guild.id] = fingerprint
            self._last_edits[guild.id] = time.monotonic()
            LOGGER.info("Updated AION dashboard in guild %s (%s)", guild.id, reason)
            return True

    async def publish_or_refresh(self, interaction: discord.Interaction) -> discord.Message | None:
        """Publish a dashboard, or refresh its configured message if one exists."""
        if interaction.guild is None:
            raise EventConfigError("This command must be used in a server")
        guild = interaction.guild
        target = self.store.get(guild.id)
        if target is not None:
            try:
                changed = await self.refresh_guild(guild, force=True, reason="/aionevents")
            except discord.NotFound:
                changed = False
            if self.store.get(guild.id) is not None:
                return await self._fetch_target_message(self.store.get(guild.id))
            LOGGER.info("Creating a replacement dashboard in guild %s after a deleted target", guild.id)

        message = await interaction.followup.send(
            embed=self.build_embed(guild),
            view=DashboardView(self),
            wait=True,
        )
        if isinstance(interaction.user, discord.Member) and interaction.user.guild_permissions.manage_guild:
            self.store.set(guild.id, interaction.channel_id, message.id)
            self._fingerprints[guild.id] = self._fingerprint(message.embeds[0]) if message.embeds else ""
            self._last_edits[guild.id] = time.monotonic()
            LOGGER.info("Configured dashboard message %s in guild %s", message.id, guild.id)
        return message

    async def _fetch_target_message(self, target: DashboardTarget | None) -> discord.Message:
        if target is None:
            raise discord.NotFound(discord.Object(id=0), {})
        channel = self.bot.get_channel(target.channel_id)
        if channel is None:
            channel = await self.bot.fetch_channel(target.channel_id)
        fetch_message = getattr(channel, "fetch_message", None)
        if fetch_message is None:
            raise discord.Forbidden(discord.Object(id=target.channel_id), {})
        return await fetch_message(target.message_id)

    async def test_announcement(self, guild: discord.Guild) -> None:
        if not self.voice_service.has_target(guild):
            raise EventConfigError("No voice channel is configured. Use /setchannel first.")
        audio_path = await self.tts_service.synthesize(
            "Attention Daevas! This is a test announcement from the AION 2 event dashboard."
        )
        await self.voice_service.announce(guild, audio_path)

    def build_embed(self, guild: discord.Guild) -> discord.Embed:
        config = self.scheduler.config
        now = datetime.now(timezone.utc)
        embed = discord.Embed(
            title="✨ AION 2 • Riftwatch Dashboard",
            description=(
                "Track the next openings across the European realm.\n"
                "Times are shown in Discord's local format and update automatically."
            ),
            colour=discord.Colour(0x6E4CC3),
            timestamp=now,
        )
        if config is None:
            embed.description = "⚠️ The event schedule is not loaded yet."
            embed.set_footer(text="AION 2 • Scheduler starting")
            return embed

        for event_id, emoji, fallback_name in (
            ("rift-time", "🌌", "Spacetime Rift"),
            ("shugo-time", "🛍️", "Shugo Festival"),
        ):
            event = config.by_id(event_id)
            if event is None:
                continue
            embed.add_field(
                name=f"{emoji} {event.name or fallback_name}",
                value=self._event_text(event, config),
                inline=False,
            )

        embed.add_field(
            name="🎙️ Voice Link",
            value=self._voice_text(guild),
            inline=False,
        )
        embed.set_footer(
            text=(
                f"Display timezone: {config.display_timezone_name} • Internal: {config.internal_timezone_name} UTC • "
                "Manage Server required for tests"
            )
        )
        return embed

    def _event_text(self, event: Any, config: Any) -> str:
        reminders = ", ".join(
            "at start" if minutes == 0 else f"{minutes}m before"
            for minutes in event.schedule.reminders_minutes
        )
        lines = [
            f"**Status:** {'🟢 Enabled' if event.enabled else '🔴 Disabled'}",
        ]
        if event.enabled:
            next_start = self._next_start(event.id)
            if next_start is None:
                lines.append("**Next:** _No upcoming occurrence found._")
            else:
                unix = int(next_start.timestamp())
                seconds = max(0, int(next_start.timestamp() - datetime.now(timezone.utc).timestamp()))
                display_time = next_start.astimezone(config.display_timezone).strftime("%d %b %Y %H:%M")
                lines.append(
                    f"**Next:** <t:{unix}:R> • `{display_time} {config.display_timezone_name}`\n"
                    f"**Discord time:** <t:{unix}:F>\n**Countdown:** `{_format_countdown(seconds)}`"
                )
        else:
            lines.append("**Next:** _Announcements are disabled by an administrator._")
        lines.extend(
            (
                f"**Region:** {event.region}",
                f"**Timezone:** `{event.timezone_name}`",
                f"**Reminders:** {reminders}",
                f"**Source:** {event.source} · **Verification:** `{event.verification_status}`",
            )
        )
        return "\n".join(lines)

    def _next_start(self, event_id: str) -> datetime | None:
        candidates: list[datetime] = []
        for job in self.scheduler.job_descriptions():
            if job.get("event_id") != event_id or job.get("reminder_minutes") != 0:
                continue
            raw_value = job.get("next_run")
            if not raw_value:
                continue
            try:
                candidates.append(datetime.fromisoformat(raw_value).astimezone(timezone.utc))
            except (TypeError, ValueError):
                LOGGER.warning("Ignoring invalid next-run value for dashboard: %r", raw_value)
        return min(candidates) if candidates else None

    def _voice_text(self, guild: discord.Guild) -> str:
        status = self.voice_service.status(guild)
        if "Connected to" in status:
            return f"🟢 {status}"
        return f"🟠 {status}"

    @staticmethod
    def _fingerprint(embed: discord.Embed) -> str:
        payload = embed.to_dict()
        payload.pop("timestamp", None)
        return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def _format_countdown(seconds: int) -> str:
    days, seconds = divmod(seconds, 86_400)
    hours, seconds = divmod(seconds, 3_600)
    minutes, seconds = divmod(seconds, 60)
    parts: list[str] = []
    if days:
        parts.append(f"{days}d")
    if hours or days:
        parts.append(f"{hours}h")
    if minutes or hours or days:
        parts.append(f"{minutes}m")
    parts.append(f"{seconds}s")
    return " ".join(parts)
