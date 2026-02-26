"""
X Content Scraper — FastAPI backend.

Endpoints:
    POST /scrape          — Scrape a URL and return structured content
    POST /process         — Transform scraped JSON into a document format
    POST /scrape-and-process — One-shot: scrape + transform in a single call
    GET  /health          — Health check

    GET  /auth/login      — Redirect to X OAuth 2.0 authorization
    GET  /auth/callback   — Handle OAuth callback from X
    GET  /auth/status     — Check if user is authenticated
    POST /auth/logout     — Clear session

Deployed on Railway. Frontend on Vercel talks to this API.
"""

import json
import os
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

# Add scripts directory to path so we can import existing modules
SCRIPTS_DIR = Path(__file__).resolve().parent.parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

from x_content_scraper import scrape_url, format_as_markdown, parse_x_url
from content_processor import process as process_content
from x_api_auth import (
    generate_pkce,
    exchange_code,
    refresh_access_token,
)

# --- Config ---

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
API_URL = os.environ.get("API_URL", "http://localhost:8000")
X_CLIENT_ID = os.environ.get("X_CLIENT_ID", "")
X_CLIENT_SECRET = os.environ.get("X_CLIENT_SECRET", "")
SESSION_SECRET = os.environ.get("SESSION_SECRET", "change-me-in-production")

# For single-user mode: set these env vars and skip OAuth entirely
X_API_BEARER_TOKEN = os.environ.get("X_API_BEARER_TOKEN", "")
X_API_REFRESH_TOKEN = os.environ.get("X_API_REFRESH_TOKEN", "")

# OAuth URLs
AUTHORIZE_URL = "https://x.com/i/oauth2/authorize"
TOKEN_URL = "https://api.x.com/2/oauth2/token"
REDIRECT_URI = f"{API_URL}/auth/callback"
SCOPES = "tweet.read users.read bookmark.read offline.access"

# In-memory token store (for single-instance Railway deploy)
# For multi-user, replace with Redis/Postgres
_token_store: dict = {}

# --- App ---

app = FastAPI(
    title="X Content Scraper API",
    version="1.0.0",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Models ---

class ScrapeRequest(BaseModel):
    url: str
    crawl_links: bool = True

class ProcessRequest(BaseModel):
    data: dict
    format: str = "markdown"  # markdown, sop, pid, concept
    context: str = ""

class ScrapeAndProcessRequest(BaseModel):
    url: str
    format: str = "markdown"
    context: str = ""
    crawl_links: bool = True


# --- Token Management ---

def _get_token(session_id: str = "default") -> str | None:
    """Get a valid API token. Tries env var first, then session store."""
    # Single-user mode: env var override
    if X_API_BEARER_TOKEN:
        return X_API_BEARER_TOKEN

    # Session-based token
    session = _token_store.get(session_id)
    if not session:
        return None

    # Try refresh if we have a refresh token
    refresh_token = session.get("refresh_token")
    if refresh_token and X_CLIENT_ID:
        try:
            new_tokens = refresh_access_token(
                refresh_token, X_CLIENT_ID, X_CLIENT_SECRET
            )
            new_tokens.setdefault("refresh_token", refresh_token)
            _token_store[session_id] = new_tokens
            return new_tokens["access_token"]
        except Exception:
            pass

    return session.get("access_token")


def _require_token(request: Request) -> str:
    """Get token or raise 401."""
    session_id = request.cookies.get("session_id", "default")
    token = _get_token(session_id)
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated. Visit /auth/login or set X_API_BEARER_TOKEN env var.",
        )
    return token


# --- Scrape Endpoints ---

@app.post("/scrape")
async def scrape(req: ScrapeRequest, request: Request):
    """Scrape a URL and return structured JSON content."""
    token = _require_token(request)
    try:
        data = scrape_url(req.url, crawl_links=req.crawl_links, token=token)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/process")
async def process_endpoint(req: ProcessRequest):
    """Transform scraped JSON into a document format."""
    try:
        output = process_content(req.data, req.format, req.context)
        return {"document": output, "format": req.format}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/scrape-and-process")
async def scrape_and_process(req: ScrapeAndProcessRequest, request: Request):
    """One-shot: scrape a URL and transform into a document."""
    token = _require_token(request)
    try:
        data = scrape_url(req.url, crawl_links=req.crawl_links, token=token)
        document = process_content(data, req.format, req.context)
        return {
            "document": document,
            "format": req.format,
            "source": data,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Auth Endpoints ---

@app.get("/auth/login")
async def auth_login(response: Response):
    """Start OAuth 2.0 PKCE flow — redirects to X authorization page."""
    if not X_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="X_CLIENT_ID not configured. Set it as an environment variable.",
        )

    import secrets
    import urllib.parse

    verifier, challenge = generate_pkce()
    state = secrets.token_urlsafe(32)

    # Store PKCE verifier + state for callback validation
    _token_store[f"pkce:{state}"] = {"verifier": verifier}

    params = urllib.parse.urlencode({
        "response_type": "code",
        "client_id": X_CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPES,
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })

    auth_url = f"{AUTHORIZE_URL}?{params}"
    response.status_code = 302
    response.headers["Location"] = auth_url
    return {"redirect": auth_url}


@app.get("/auth/callback")
async def auth_callback(code: str = "", state: str = "", error: str = ""):
    """Handle OAuth callback from X."""
    if error:
        return Response(
            content=f'<html><body><h2>Auth failed: {error}</h2><a href="{FRONTEND_URL}">Back</a></body></html>',
            media_type="text/html",
        )

    # Validate state + get PKCE verifier
    pkce_key = f"pkce:{state}"
    pkce_data = _token_store.pop(pkce_key, None)
    if not pkce_data:
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    # Exchange code for tokens
    try:
        tokens = exchange_code(
            code, pkce_data["verifier"], X_CLIENT_ID, X_CLIENT_SECRET
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Token exchange failed: {e}")

    # Store tokens with a session ID
    import secrets
    session_id = secrets.token_urlsafe(32)
    _token_store[session_id] = tokens

    # Redirect to frontend with session cookie
    response = Response(
        status_code=302,
        headers={"Location": f"{FRONTEND_URL}?auth=success"},
    )
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=86400 * 30,  # 30 days
    )
    return response


@app.get("/auth/status")
async def auth_status(request: Request):
    """Check if the current session has a valid token."""
    session_id = request.cookies.get("session_id", "default")
    has_env_token = bool(X_API_BEARER_TOKEN)
    has_session_token = session_id in _token_store
    return {
        "authenticated": has_env_token or has_session_token,
        "method": "env" if has_env_token else ("session" if has_session_token else "none"),
    }


@app.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    """Clear the session."""
    session_id = request.cookies.get("session_id")
    if session_id and session_id in _token_store:
        del _token_store[session_id]
    response.delete_cookie("session_id")
    return {"status": "logged out"}


# --- Health ---

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
