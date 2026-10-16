from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import discord

from bot.services.dashboard import DashboardService, DashboardStore, DashboardView, _format_countdown
from bot.services.event_sources import load_event_config


def test_dashboard_store_round_trips_atomically(tmp_path: Path) -> None:
    path = tmp_path / "dashboards.json"
    store = DashboardStore(path)
    store.set(123, 456, 789)

    restored = DashboardStore(path)

    target = restored.get(123)
    assert target is not None
    assert target.channel_id == 456
    assert target.message_id == 789


def test_dashboard_embed_contains_relative_timestamp_and_schedule_metadata(tmp_path: Path) -> None:
    config = load_event_config(Path("config/events.json"))
    scheduler = SimpleNamespace(
        config=config,
        job_descriptions=lambda: [
            {
                "event_id": "rift-time",
                "reminder_minutes": 0,
                "next_run": "2099-01-01T12:00:00+00:00",
            },
            {
                "event_id": "shugo-time",
                "reminder_minutes": 0,
                "next_run": "2099-01-01T13:00:00+00:00",
            },
        ],
    )
    bot = SimpleNamespace()
    voice = SimpleNamespace(status=lambda guild: "Connected to `Lounge` (latency: 42 ms)")
    tts = SimpleNamespace()
    service = DashboardService(bot, scheduler, voice, tts, DashboardStore(tmp_path / "dashboards.json"))

    embed = service.build_embed(SimpleNamespace(id=123))
    values = "\n".join(field.value for field in embed.fields)

    assert "<t:" in values
    assert "European servers" in values
    assert "Europe/Rome" in values or "UTC" in values
    assert "unverified" in values
    assert "Reminders" in values
    assert "Connected to" in values


def test_dashboard_countdown_is_human_readable() -> None:
    assert _format_countdown(0) == "0s"
    assert _format_countdown(3661) == "1h 1m 1s"
    assert _format_countdown(90_061) == "1d 1h 1m 1s"


def test_dashboard_view_has_refresh_and_authorized_test_buttons() -> None:
    view = DashboardView(SimpleNamespace())
    labels = {child.label for child in view.children if isinstance(child, discord.ui.Button)}
    custom_ids = {child.custom_id for child in view.children if isinstance(child, discord.ui.Button)}

    assert labels == {"Refresh", "Test Announcement"}
    assert custom_ids == {"aion2:dashboard:refresh", "aion2:dashboard:test"}
