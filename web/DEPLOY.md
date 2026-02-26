# Deployment Guide

Two services: **Next.js frontend on Vercel** + **FastAPI backend on Railway**.

## Architecture

```
[Mobile/Desktop Browser]
        │
        ▼
[Vercel — Next.js Frontend]
        │ HTTPS
        ▼
[Railway — FastAPI Backend]
        │
        ├── X API v2 (tweet data)
        └── External URLs (article scraping)
```

## Step 1: Deploy the Backend (Railway)

### 1a. Create a Railway project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `x-bookmarks` repository
4. Railway will detect the Dockerfile at `web/api/Dockerfile`

### 1b. Set environment variables

In the Railway dashboard, go to **Variables** and add:

| Variable | Value |
|----------|-------|
| `FRONTEND_URL` | `https://your-app.vercel.app` (set after Vercel deploy) |
| `API_URL` | Your Railway public URL (shown in Settings → Domains) |
| `X_CLIENT_ID` | Your X Developer App client ID |
| `X_CLIENT_SECRET` | Your X Developer App client secret |
| `SESSION_SECRET` | Run: `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` |

**Shortcut for single-user mode** (skip OAuth):
```
X_API_BEARER_TOKEN=<your token from local auth>
X_API_REFRESH_TOKEN=<your refresh token>
```

### 1c. Set the root directory

In Railway **Settings**, set:
- **Root Directory**: `/` (project root, so Dockerfile can access `scripts/`)
- **Custom Start Command**: (leave empty, Dockerfile handles it)

### 1d. Get your Railway URL

Railway auto-generates a URL like `your-api-production.up.railway.app`.
Go to **Settings → Networking → Public Domain** to enable it.

## Step 2: Deploy the Frontend (Vercel)

### 2a. Import to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New → Project** → Import your `x-bookmarks` repo
3. Set **Root Directory** to `web/frontend`
4. Framework Preset: **Next.js** (auto-detected)

### 2b. Set environment variables

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | Your Railway URL (e.g. `https://your-api-production.up.railway.app`) |

### 2c. Deploy

Click **Deploy**. Vercel builds and ships the Next.js app.

### 2d. Update Railway FRONTEND_URL

Go back to Railway and update `FRONTEND_URL` to your Vercel URL.

## Step 3: Configure X OAuth (if using full auth)

1. Go to [developer.x.com](https://developer.x.com) → your app settings
2. Under **Authentication settings**, add a callback URL:
   ```
   https://your-api-production.up.railway.app/auth/callback
   ```
3. Ensure these scopes are enabled: `tweet.read`, `users.read`, `bookmark.read`, `offline.access`

## Quick-Start: Single-User Mode

If this is just for you, skip the OAuth setup entirely:

1. Run auth locally:
   ```bash
   python3 scripts/x_api_auth.py --client-id "YOUR_CLIENT_ID"
   ```
2. Copy the tokens:
   ```bash
   cat ~/.config/x-bookmarks/tokens.json
   ```
3. Set in Railway:
   - `X_API_BEARER_TOKEN` = the `access_token` value
   - `X_API_REFRESH_TOKEN` = the `refresh_token` value
   - `X_CLIENT_ID` = your client ID (needed for auto-refresh)
   - `X_CLIENT_SECRET` = your client secret (if applicable)

The backend will auto-refresh the token using the refresh token.

## Local Development

Run both services locally:

```bash
# Terminal 1: Backend
cd web/api
pip install -r requirements.txt
FRONTEND_URL=http://localhost:3000 API_URL=http://localhost:8000 \
  uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd web/frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

Open http://localhost:3000.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/scrape` | Scrape a URL → structured JSON |
| `POST` | `/process` | Transform JSON → document |
| `POST` | `/scrape-and-process` | One-shot: URL → document |
| `GET` | `/auth/login` | Start X OAuth flow |
| `GET` | `/auth/callback` | OAuth callback handler |
| `GET` | `/auth/status` | Check auth status |
| `POST` | `/auth/logout` | Clear session |
| `GET` | `/health` | Health check |
| `GET` | `/docs` | Interactive API docs (Swagger) |
