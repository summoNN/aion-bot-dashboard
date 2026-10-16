# AION 2 Announce Dashboard

Minimal React, Next.js, and TypeScript control panel for an AION 2 Announce bot instance.

The bot runtime has been removed from this repository. This project now contains only the web dashboard. It connects to a separately hosted bot through the bot's HTTP control API.

## Local development

```powershell
cd web
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

Configure `web/.env.local`:

```text
DISCORD_CLIENT_ID=your-discord-application-client-id
DISCORD_CLIENT_SECRET=your-discord-application-client-secret
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback
DISCORD_SESSION_SECRET=generate-a-long-random-secret-at-least-32-characters
BOT_API_URL=http://localhost:8765
BOT_API_TOKEN=the-bot-control-api-token
```

Register the redirect URL in the Discord Developer Portal. The dashboard signs users in with Discord, then shows only servers where the bot is installed and the user has sufficient permissions. The dashboard uses server-side proxy routes, so Discord and bot tokens are never exposed to the browser.

## Features

- Instance overview and live bot status
- Scheduler and event visibility
- Event enable/disable controls
- Voice autojoin and volume controls
- Voice connect/disconnect actions
- Test announcements
- Responsive minimal UI for desktop and mobile

## Checks

```powershell
cd web
npm run lint
npm run build
```

## Deployment

Deploy the `web/` directory as the Vercel project root. Add the OAuth, session, and bot API variables from `web/.env.example`. See [DEPLOYMENT.md](DEPLOYMENT.md) for the Vercel setup.
