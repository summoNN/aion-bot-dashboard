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
BOT_API_URL=http://localhost:8765
BOT_API_TOKEN=your-control-api-token
BOT_GUILD_ID=your-discord-server-id
```

The dashboard uses server-side proxy routes, so `BOT_API_TOKEN` is never exposed to the browser.

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

Deploy the `web/` directory as the Vercel project root. Add `BOT_API_URL`, `BOT_API_TOKEN`, and `BOT_GUILD_ID` as server-side environment variables. See [DEPLOYMENT.md](DEPLOYMENT.md) for the Vercel setup.
