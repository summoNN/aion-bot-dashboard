# Deployment guide

This repository contains a continuously running Discord bot. GitHub is the source-code host; it is not the runtime. The bot needs a process that stays connected to Discord, has FFmpeg available, and can write persistent configuration and TTS cache files.

The repository also contains a Next.js control dashboard under `web/`. The dashboard is a separate deployment from the bot process and talks to the bot through its token-protected control API.

## 1. Push the project to GitHub

From the project directory:

```powershell
git init
git add .
git commit -m "Prepare AION 2 Riftwatch bot for deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Create the empty repository on GitHub first. Do not commit `.env`, a Discord token, `.venv`, `cache/`, or generated Python files. The repository's GitHub Actions workflow runs the test suite on every push and pull request.

## 2. Runtime deployment

Use a continuously running Python/Docker host for the bot. The included Docker setup is the recommended portable option:

```bash
cp .env.example .env
# edit .env and set DISCORD_TOKEN
docker compose up -d --build
docker compose logs -f
```

Set `DISCORD_TOKEN` as a secret in the host's environment settings. Configure `GUILD_ID` for fast development command sync, and make sure the host persists both `config/` and `cache/`.

For the web dashboard connection, also set a long random `CONTROL_API_TOKEN` in `.env`. The Docker compose file exposes the control API on port `8765`; put it behind HTTPS and a firewall/reverse proxy before exposing it to the public internet.

The host must provide:

- Python 3.12 or newer, or Docker
- FFmpeg when running outside the included Docker image
- persistent storage for `config/` and `cache/`
- an always-on process; serverless invocations are not sufficient

## 3. Vercel limitation

Deploy the `web/` directory to Vercel. In the Vercel project settings, set **Root Directory** to `web`, then add these server-side environment variables:

```text
BOT_API_URL=https://your-bot-host.example.com
BOT_API_TOKEN=the-same-value-as-CONTROL_API_TOKEN
BOT_GUILD_ID=your-discord-server-id
```

The dashboard proxy keeps `BOT_API_TOKEN` on the server and never exposes it to browser JavaScript. `web/.env.example` is available for local development.

Do not deploy the repository root as if it were the bot. Vercel Functions are request-driven HTTP functions with a maximum request duration; they cannot run `python main.py` as a permanent Discord gateway/voice process. Deploying the bot itself to Vercel would therefore not keep it online, play voice announcements, or reliably retain its local files.

Keep the Discord bot itself on an always-on Docker/VPS/Python host. A Vercel frontend calls the separately hosted control API; it should never contain `DISCORD_TOKEN`.

## Required environment variables

At minimum:

```text
DISCORD_TOKEN=secret
GUILD_ID=optional-development-guild-id
EVENTS_CONFIG_PATH=config/events.json
VOICE_CONFIG_PATH=config/voice_channels.json
DASHBOARD_CONFIG_PATH=config/dashboards.json
TTS_CACHE_DIR=cache/tts
FFMPEG_EXECUTABLE=ffmpeg
HEALTHCHECK_PATH=cache/health/ready
```

See `.env.example` for the complete list and `README.md` for Discord permissions and voice setup.
