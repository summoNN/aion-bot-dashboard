# Dashboard deployment

This repository is now dashboard-only. The Discord bot must run separately on an always-on host that exposes its token-protected control API.

## Vercel

1. Import the GitHub repository into Vercel.
2. Set **Root Directory** to `web`.
3. Add these server-side environment variables to Preview and Production:

```text
DISCORD_CLIENT_ID=your-discord-application-client-id
DISCORD_CLIENT_SECRET=your-discord-application-client-secret
DISCORD_REDIRECT_URI=https://your-dashboard.vercel.app/api/auth/discord/callback
DISCORD_SESSION_SECRET=a-long-random-secret-at-least-32-characters
BOT_API_URL=https://your-bot-host.example.com
BOT_API_TOKEN=the-bot-control-api-token
```

4. Deploy.

Add the exact production callback URL to the Discord Developer Portal OAuth2 redirect URLs. `DISCORD_CLIENT_SECRET` and `BOT_API_TOKEN` are only used by Next.js server routes; they are not `NEXT_PUBLIC_` variables and are never sent to browser code.

After sign-in, the dashboard uses Discord OAuth to read the user&apos;s servers and member roles. It filters to servers where the bot is installed and the user is the owner, has Administrator, has Manage Server, or has a role above the bot.

## Bot API requirements

The separately hosted bot must expose:

```text
GET   /api/v1/guilds
GET   /api/v1/state/{guild_id}
PATCH /api/v1/config/{guild_id}
POST  /api/v1/actions/{guild_id}
```

`GET /api/v1/guilds` must return the bot&apos;s installed servers and enough role data for hierarchy checks:

```json
{
  "guilds": [
    {
      "id": "123",
      "name": "AION Community",
      "iconUrl": null,
      "botHighestRolePosition": 4,
      "rolePositions": { "456": 8, "789": 2 }
    }
  ]
}
```

Each request requires:

```text
Authorization: Bearer <control-api-token>
```

Use HTTPS and restrict access with a firewall or reverse proxy. The dashboard proxy routes are under `web/src/app/api/`.

## GitHub Actions

The workflow at `.github/workflows/ci.yml` installs the dashboard dependencies, runs ESLint, and builds the Next.js application on pushes and pull requests.
