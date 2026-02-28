# Deployment Guide — Fly.io (Single Service)

One service, one URL, works on mobile + desktop. Free tier, $0 spending cap.

```
[Phone / Desktop Browser]
        │
        ▼
[Fly.io — FastAPI]
   ├── Serves UI at /
   ├── API at /api/*
   ├── Auth at /auth/*
   │
   ├── X API v2 (tweet data)
   └── External URLs (article scraping)
```

## Prerequisites

1. A free Fly.io account at [fly.io](https://fly.io)
2. `flyctl` CLI installed: `brew install flyctl` (or `curl -L https://fly.io/install.sh | sh`)
3. X Developer app credentials (client ID + secret from [developer.x.com](https://developer.x.com))
4. Your X API tokens (from running local auth)

## Step 1: Set spending limit to $0

**Do this first, before anything else.**

1. Log into [fly.io/dashboard](https://fly.io/dashboard)
2. Go to **Billing** → **Manage billing**
3. Under **Spending limit**, set it to **$0**
4. This hard-caps your bill at $0. The free tier includes:
   - 3 shared-cpu-1x VMs (256MB RAM)
   - 160GB outbound bandwidth
   - Enough for this tool running 24/7

## Step 2: Get your X API tokens

If you haven't already, run auth locally:

```bash
python3 scripts/x_api_auth.py --client-id "YOUR_CLIENT_ID"
```

Then grab the tokens:

```bash
cat ~/.config/x-bookmarks/tokens.json
```

You need `access_token` and `refresh_token` from that file.

## Step 3: Deploy

```bash
# Login to Fly.io
flyctl auth login

# Launch the app (first time only)
flyctl launch --no-deploy

# Set your secrets (tokens + credentials)
flyctl secrets set \
  X_API_BEARER_TOKEN="your_access_token_here" \
  X_API_REFRESH_TOKEN="your_refresh_token_here" \
  X_CLIENT_ID="your_client_id" \
  X_CLIENT_SECRET="your_client_secret"

# Deploy
flyctl deploy
```

That's it. Your app is live at `https://x-content-scraper.fly.dev`.

## Step 4: Update the APP_URL

After your first deploy, Fly.io gives you a URL. Update it:

```bash
flyctl secrets set APP_URL="https://your-app-name.fly.dev"
```

## Step 5 (Optional): Set up X OAuth callback

Only needed if you want browser-based X login (multi-user mode):

1. Go to [developer.x.com](https://developer.x.com) → your app
2. Under **Authentication settings**, add callback URL:
   ```
   https://your-app-name.fly.dev/auth/callback
   ```

For single-user mode (just you), the bearer token from Step 2 is all you need.

## Open on your phone

Navigate to `https://your-app-name.fly.dev` on any device. Bookmark it.

## Useful commands

```bash
flyctl status          # Check app status
flyctl logs            # View logs
flyctl ssh console     # SSH into the machine
flyctl secrets list    # List configured secrets
flyctl scale count 1   # Ensure only 1 machine (stay free)
flyctl destroy         # Delete app entirely
```

## Local development

```bash
cd web/api
pip install -r requirements.txt
APP_URL=http://localhost:8000 uvicorn main:app --reload --port 8000
```

Open http://localhost:8000.

## Cost breakdown

| Resource | Free allowance | This app uses |
|----------|---------------|---------------|
| VM | 3x shared-cpu-1x (256MB) | 1x shared-cpu-1x (256MB) |
| Bandwidth | 160GB/month | ~1-5GB/month |
| Storage | 3GB persistent | 0 (stateless) |

With `auto_stop_machines = "stop"` in fly.toml, the machine sleeps when idle
and wakes on the first request (~1-2s cold start). This keeps usage well
within free limits.
