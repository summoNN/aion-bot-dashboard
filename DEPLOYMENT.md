# Dashboard deployment

This repository is now dashboard-only. The Discord bot must run separately on an always-on host that exposes its token-protected control API.

## Vercel

1. Import the GitHub repository into Vercel.
2. Set **Root Directory** to `web`.
3. Add these environment variables to Preview and Production:

```text
BOT_API_URL=https://your-bot-host.example.com
BOT_API_TOKEN=the-bot-control-api-token
BOT_GUILD_ID=your-discord-server-id
```

4. Deploy.

`BOT_API_TOKEN` is only used by Next.js server routes. It is not a `NEXT_PUBLIC_` variable and is never sent to browser code.

## Bot API requirements

The separately hosted bot must expose:

```text
GET   /api/v1/state/{guild_id}
PATCH /api/v1/config/{guild_id}
POST  /api/v1/actions/{guild_id}
```

Each request requires:

```text
Authorization: Bearer <control-api-token>
```

Use HTTPS and restrict access with a firewall or reverse proxy. The dashboard proxy routes are under `web/src/app/api/`.

## GitHub Actions

The workflow at `.github/workflows/ci.yml` installs the dashboard dependencies, runs ESLint, and builds the Next.js application on pushes and pull requests.
