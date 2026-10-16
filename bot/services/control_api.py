"""Token-protected HTTP control plane for the Next.js dashboard."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from dataclasses import replace
from typing import Any

from aiohttp import web

from bot.services.event_sources import EventConfigError, event_to_dict
from bot.services.voice import VoiceService
from bot.services.tts import TTSService

LOGGER = logging.getLogger(__name__)


class ControlApi:
    """Expose one bot instance to its private Next.js control panel."""

    def __init__(
        self,
        bot: Any,
        events_cog: Any,
        voice_service: VoiceService,
        tts_service: TTSService,
        *,
        host: str,
        port: int,
        token: str,
    ) -> None:
        self.bot = bot
        self.events_cog = events_cog
        self.voice_service = voice_service
        self.tts_service = tts_service
        self.host = host
        self.port = port
        self.token = token
        self._runner: web.AppRunner | None = None

    async def start(self) -> None:
        app = web.Application(middlewares=[self._middleware])
        app.router.add_get("/api/health", self._health)
        app.router.add_get("/api/v1/state/{guild_id}", self._state)
        app.router.add_patch("/api/v1/config/{guild_id}", self._config)
        app.router.add_post("/api/v1/actions/{guild_id}", self._action)
        self._runner = web.AppRunner(app)
        await self._runner.setup()
        site = web.TCPSite(self._runner, self.host, self.port)
        await site.start()
        LOGGER.info("Control API listening on %s:%s", self.host, self.port)

    async def stop(self) -> None:
        if self._runner is not None:
            await self._runner.cleanup()
            self._runner = None

    @web.middleware
    async def _middleware(self, request: web.Request, handler: Any) -> web.StreamResponse:
        if request.method == "OPTIONS":
            return web.Response(status=204, headers=self._cors_headers())
        try:
            response = await handler(request)
        except web.HTTPException as exc:
            response = exc
        response.headers.update(self._cors_headers())
        return response

    @staticmethod
    def _cors_headers() -> dict[str, str]:
        return {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Authorization, Content-Type",
            "Access-Control-Allow-Methods": "GET, PATCH, POST, OPTIONS",
        }

    def _authorized(self, request: web.Request) -> bool:
        return request.headers.get("Authorization") == f"Bearer {self.token}"

    async def _health(self, request: web.Request) -> web.Response:
        user = getattr(self.bot, "user", None)
        return web.json_response(
            {
                "ok": True,
                "ready": bool(self.bot.is_ready()),
                "bot": {"id": str(user.id), "name": str(user)} if user else None,
            }
        )

    async def _state(self, request: web.Request) -> web.Response:
        self._require_auth(request)
        guild = self._guild(request)
        return web.json_response(self._state_payload(guild))

    async def _config(self, request: web.Request) -> web.Response:
        self._require_auth(request)
        guild = self._guild(request)
        try:
            payload = await request.json()
        except (ValueError, TypeError) as exc:
            raise web.HTTPBadRequest(text="Request body must be valid JSON") from exc
        if not isinstance(payload, dict):
            raise web.HTTPBadRequest(text="Request body must be an object")

        try:
            if "volume" in payload:
                self.voice_service.set_volume(guild, float(payload["volume"]))
            if "autojoin" in payload:
                if not isinstance(payload["autojoin"], bool):
                    raise ValueError("autojoin must be boolean")
                self.voice_service.set_autojoin(guild, payload["autojoin"])
            event_id = payload.get("eventId")
            if event_id is not None and "enabled" in payload:
                if not isinstance(payload["enabled"], bool):
                    raise ValueError("enabled must be boolean")
                configured = self.events_cog.scheduler.config.by_id(str(event_id))
                if configured is None:
                    raise EventConfigError(f"Unknown event id: {event_id}")
                await self.events_cog.scheduler.upsert_event(
                    replace(configured, enabled=payload["enabled"])
                )
        except (ValueError, TypeError, EventConfigError) as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc
        return web.json_response(self._state_payload(guild))

    async def _action(self, request: web.Request) -> web.Response:
        self._require_auth(request)
        guild = self._guild(request)
        try:
            payload = await request.json()
        except (ValueError, TypeError) as exc:
            raise web.HTTPBadRequest(text="Request body must be valid JSON") from exc
        action = payload.get("action") if isinstance(payload, dict) else None
        try:
            if action == "connect":
                await self.voice_service.connect_configured(guild, explicit=True)
            elif action == "disconnect":
                await self.voice_service.disconnect(guild, intentional=True)
            elif action == "test":
                event_id = str(payload.get("eventId", ""))
                configured = self.events_cog.scheduler.config.by_id(event_id)
                if configured is None:
                    raise EventConfigError(f"Unknown event id: {event_id}")
                text = configured.messages.start.format(name=configured.name, minutes=0)
                audio_path = await self.tts_service.synthesize(text)
                await self.voice_service.announce(guild, audio_path)
            else:
                raise ValueError("Unsupported action")
        except Exception as exc:
            LOGGER.exception("Control API action %s failed for guild %s", action, guild.id)
            raise web.HTTPBadRequest(text=str(exc)) from exc
        return web.json_response(self._state_payload(guild))

    def _require_auth(self, request: web.Request) -> None:
        if not self._authorized(request):
            raise web.HTTPUnauthorized(text="Invalid control API token")

    def _guild(self, request: web.Request) -> Any:
        try:
            guild_id = int(request.match_info["guild_id"])
        except (KeyError, TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(text="guild_id must be an integer") from exc
        guild = self.bot.get_guild(guild_id)
        if guild is None:
            raise web.HTTPNotFound(text="Guild is not available to this bot")
        return guild

    def _state_payload(self, guild: Any) -> dict[str, Any]:
        config = self.events_cog.scheduler.config
        all_jobs = self.events_cog.scheduler.job_descriptions()
        jobs = all_jobs[:12]
        events: list[dict[str, Any]] = []
        if config is not None:
            for event in config.events:
                item = event_to_dict(event)
                starts = [
                    job["next_run"]
                    for job in all_jobs
                    if job["event_id"] == event.id and job["reminder_minutes"] == 0 and job["next_run"]
                ]
                item["next_start"] = min(starts) if starts else None
                events.append(item)
        user = getattr(self.bot, "user", None)
        return {
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "bot": {
                "status": "online" if self.bot.is_ready() else "starting",
                "id": str(user.id) if user else None,
                "name": str(user) if user else "AION 2 Announce Bot",
                "guildCount": len(getattr(self.bot, "guilds", [])),
                "schedulerRunning": self.events_cog.scheduler.running,
            },
            "guild": {
                "id": str(guild.id),
                "name": guild.name,
                "iconUrl": str(guild.icon.url) if guild.icon else None,
            },
            "voice": self.voice_service.status_details(guild),
            "schedule": {
                "internalTimezone": config.internal_timezone_name if config else "UTC",
                "displayTimezone": config.display_timezone_name if config else "UTC",
                "events": events,
                "nextJobs": jobs,
            },
        }
