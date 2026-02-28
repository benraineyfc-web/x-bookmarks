"""
X Content Scraper — Single-service web app for Fly.io.

Serves both the frontend UI and API from one process.

    GET  /               — Web UI (mobile + desktop)
    POST /api/scrape-and-process — One-shot: URL → document
    POST /api/scrape     — Scrape a URL → structured JSON
    POST /api/process    — Transform JSON → document format
    GET  /api/health     — Health check

    GET  /auth/login     — Redirect to X OAuth 2.0 authorization
    GET  /auth/callback  — Handle OAuth callback from X
    GET  /auth/status    — Check if user is authenticated
    POST /auth/logout    — Clear session
"""

import json
import os
import secrets
import sys
import urllib.parse
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

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

APP_URL = os.environ.get("APP_URL", "http://localhost:8000")
X_CLIENT_ID = os.environ.get("X_CLIENT_ID", "")
X_CLIENT_SECRET = os.environ.get("X_CLIENT_SECRET", "")

# Single-user mode: set these and skip OAuth entirely
X_API_BEARER_TOKEN = os.environ.get("X_API_BEARER_TOKEN", "")
X_API_REFRESH_TOKEN = os.environ.get("X_API_REFRESH_TOKEN", "")

# OAuth
AUTHORIZE_URL = "https://x.com/i/oauth2/authorize"
REDIRECT_URI = f"{APP_URL}/auth/callback"
SCOPES = "tweet.read users.read bookmark.read offline.access"

# In-memory token store (single Fly.io machine)
_token_store: dict = {}

# --- App ---

app = FastAPI(title="X Content Scraper", version="1.0.0", docs_url="/api/docs")


# --- Models ---

class ScrapeRequest(BaseModel):
    url: str
    crawl_links: bool = True

class ProcessRequest(BaseModel):
    data: dict
    format: str = "markdown"
    context: str = ""

class ScrapeAndProcessRequest(BaseModel):
    url: str
    format: str = "markdown"
    context: str = ""
    crawl_links: bool = True


# --- Token Management ---

def _get_token(session_id: str = "default") -> str | None:
    if X_API_BEARER_TOKEN:
        return X_API_BEARER_TOKEN
    session = _token_store.get(session_id)
    if not session:
        return None
    refresh_token = session.get("refresh_token")
    if refresh_token and X_CLIENT_ID:
        try:
            new_tokens = refresh_access_token(refresh_token, X_CLIENT_ID, X_CLIENT_SECRET)
            new_tokens.setdefault("refresh_token", refresh_token)
            _token_store[session_id] = new_tokens
            return new_tokens["access_token"]
        except Exception:
            pass
    return session.get("access_token")


def _require_token(request: Request) -> str:
    session_id = request.cookies.get("session_id", "default")
    token = _get_token(session_id)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated. Connect your X account first.")
    return token


# --- API Endpoints ---

@app.post("/api/scrape")
async def api_scrape(req: ScrapeRequest, request: Request):
    token = _require_token(request)
    try:
        return scrape_url(req.url, crawl_links=req.crawl_links, token=token)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/process")
async def api_process(req: ProcessRequest):
    try:
        output = process_content(req.data, req.format, req.context)
        return {"document": output, "format": req.format}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scrape-and-process")
async def api_scrape_and_process(req: ScrapeAndProcessRequest, request: Request):
    token = _require_token(request)
    try:
        data = scrape_url(req.url, crawl_links=req.crawl_links, token=token)
        document = process_content(data, req.format, req.context)
        return {"document": document, "format": req.format, "source": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
async def api_health():
    return {"status": "ok", "version": "1.0.0"}


# --- Auth Endpoints ---

@app.get("/auth/login")
async def auth_login():
    if not X_CLIENT_ID:
        raise HTTPException(status_code=500, detail="X_CLIENT_ID not configured.")
    verifier, challenge = generate_pkce()
    state = secrets.token_urlsafe(32)
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
    return Response(status_code=302, headers={"Location": f"{AUTHORIZE_URL}?{params}"})


@app.get("/auth/callback")
async def auth_callback(code: str = "", state: str = "", error: str = ""):
    if error:
        return HTMLResponse(f'<html><body style="background:#0a0a0a;color:#fff;font-family:sans-serif;padding:2rem"><h2>Auth failed: {error}</h2><a href="/" style="color:#1d9bf0">Back</a></body></html>')
    pkce_data = _token_store.pop(f"pkce:{state}", None)
    if not pkce_data:
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    try:
        tokens = exchange_code(code, pkce_data["verifier"], X_CLIENT_ID, X_CLIENT_SECRET)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Token exchange failed: {e}")
    session_id = secrets.token_urlsafe(32)
    _token_store[session_id] = tokens
    response = Response(status_code=302, headers={"Location": "/?auth=success"})
    response.set_cookie(key="session_id", value=session_id, httponly=True, secure=True, samesite="lax", max_age=86400 * 30)
    return response


@app.get("/auth/status")
async def auth_status(request: Request):
    session_id = request.cookies.get("session_id", "default")
    has_env = bool(X_API_BEARER_TOKEN)
    has_session = session_id in _token_store
    return {"authenticated": has_env or has_session, "method": "env" if has_env else ("session" if has_session else "none")}


@app.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    session_id = request.cookies.get("session_id")
    if session_id and session_id in _token_store:
        del _token_store[session_id]
    response.delete_cookie("session_id")
    return {"status": "logged out"}


# --- Frontend (served inline, no separate build step) ---

FRONTEND_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#0a0a0a">
<title>X Content Scraper</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0a;color:#ededed;min-height:100vh;-webkit-font-smoothing:antialiased}
.wrap{max-width:800px;margin:0 auto;padding:2rem 1rem}
h1{font-size:1.75rem;font-weight:700;text-align:center;margin-bottom:.25rem}
.sub{color:#888;font-size:.9rem;text-align:center;margin-bottom:2rem}
.auth-box{background:#1a1a2e;border:1px solid #333;border-radius:8px;padding:1rem;margin-bottom:1.5rem;text-align:center}
.auth-box p{color:#ccc;margin-bottom:.75rem}
.btn-x{display:inline-block;background:#1d9bf0;color:#fff;padding:.5rem 1.5rem;border-radius:20px;text-decoration:none;font-weight:600;font-size:.9rem}
input[type=url],textarea{width:100%;padding:.75rem 1rem;font-size:1rem;background:#141414;border:1px solid #333;border-radius:8px;color:#ededed;outline:none}
textarea{font-size:.9rem;resize:vertical}
.formats{display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;margin:1rem 0}
.fmt{padding:.6rem .5rem;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#aaa;cursor:pointer;font-size:.8rem;text-align:center}
.fmt.active{background:#1d9bf0;border-color:#1d9bf0;color:#fff;font-weight:600}
.fmt small{display:block;font-size:.65rem;margin-top:2px;opacity:.7}
.ctx-toggle{background:none;border:none;color:#1d9bf0;cursor:pointer;font-size:.85rem;padding:0;margin-bottom:1rem}
.submit{width:100%;padding:.75rem;font-size:1rem;font-weight:600;background:#1d9bf0;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-top:.5rem}
.submit:disabled{background:#333;cursor:wait;opacity:.6}
.error{margin-top:1rem;padding:.75rem 1rem;background:#2d1515;border:1px solid #5c2020;border-radius:8px;color:#f87171;font-size:.9rem}
.result-header{display:flex;justify-content:space-between;align-items:center;margin:.5rem 0}
.result-header h2{font-size:1rem;font-weight:600}
.action-btns{display:flex;gap:.5rem}
.action-btn{padding:.4rem .75rem;font-size:.8rem;background:#1a1a1a;border:1px solid #333;border-radius:6px;color:#aaa;cursor:pointer}
.action-btn.copied{color:#4ade80}
pre.output{background:#111;border:1px solid #222;border-radius:8px;padding:1rem;overflow:auto;max-height:60vh;white-space:pre-wrap;word-break:break-word;font-size:.85rem;line-height:1.6;color:#d4d4d4}
details{margin-top:1rem}
summary{color:#888;cursor:pointer;font-size:.85rem}
pre.raw{background:#111;border:1px solid #222;border-radius:8px;padding:1rem;overflow:auto;max-height:40vh;font-size:.75rem;color:#888;margin-top:.5rem}
.footer{margin-top:3rem;text-align:center;color:#555;font-size:.75rem}
@media(max-width:480px){.formats{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<div class="wrap">
  <h1>X Content Scraper</h1>
  <p class="sub">Paste a tweet or article URL. Get a structured document back.</p>

  <div class="auth-box" id="auth-box" style="display:none">
    <p>Connect your X account to scrape tweets</p>
    <a href="/auth/login" class="btn-x">Connect X Account</a>
  </div>

  <form id="form">
    <input type="url" id="url" placeholder="Paste an X/Twitter URL or article link..." required>
    <div class="formats" id="formats">
      <div class="fmt active" data-f="markdown">Markdown<small>Clean reference note</small></div>
      <div class="fmt" data-f="sop">SOP<small>Standard Operating Procedure</small></div>
      <div class="fmt" data-f="pid">PID<small>Project Initiation Document</small></div>
      <div class="fmt" data-f="concept">Concept<small>Key insights &amp; action items</small></div>
    </div>
    <div id="ctx-wrap" style="display:none">
      <button type="button" class="ctx-toggle" id="ctx-toggle">+ Add context (optional)</button>
      <textarea id="ctx" rows="2" placeholder="Add context, e.g. 'Apply to our SaaS onboarding flow'..." style="display:none"></textarea>
    </div>
    <button type="submit" class="submit" id="submit">Scrape &amp; Generate</button>
  </form>

  <div class="error" id="error" style="display:none"></div>

  <div id="result-wrap" style="display:none">
    <div class="result-header">
      <h2 id="result-title">Result</h2>
      <div class="action-btns">
        <button class="action-btn" id="copy-btn">Copy</button>
        <button class="action-btn" id="dl-btn">Download</button>
      </div>
    </div>
    <pre class="output" id="output"></pre>
  </div>

  <details id="raw-wrap" style="display:none">
    <summary>View raw scraped data (JSON)</summary>
    <pre class="raw" id="raw-output"></pre>
  </details>

  <div class="footer"><p>X Content Scraper v1.0</p></div>
</div>

<script>
(function(){
  const $ = s => document.querySelector(s);
  let fmt = 'markdown', rawData = null;

  // Auth check
  fetch('/auth/status',{credentials:'include'}).then(r=>r.json()).then(d=>{
    if(!d.authenticated) $('#auth-box').style.display='';
  }).catch(()=>{ $('#auth-box').style.display=''; });

  // Format picker
  $('#formats').addEventListener('click',e=>{
    const t = e.target.closest('.fmt');
    if(!t) return;
    document.querySelectorAll('.fmt').forEach(f=>f.classList.remove('active'));
    t.classList.add('active');
    fmt = t.dataset.f;
    $('#ctx-wrap').style.display = (fmt==='markdown')?'none':'';
  });

  // Context toggle
  $('#ctx-toggle').addEventListener('click',()=>{
    $('#ctx-toggle').style.display='none';
    $('#ctx').style.display='';
    $('#ctx').focus();
  });

  // Submit
  $('#form').addEventListener('submit', async e=>{
    e.preventDefault();
    const url = $('#url').value.trim();
    if(!url) return;
    const ctx = $('#ctx').value?.trim() || '';
    $('#submit').disabled=true; $('#submit').textContent='Scraping...';
    $('#error').style.display='none'; $('#result-wrap').style.display='none'; $('#raw-wrap').style.display='none';
    try {
      const res = await fetch('/api/scrape-and-process',{
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({url, format:fmt, context:ctx, crawl_links:true})
      });
      if(!res.ok){const e=await res.json().catch(()=>({detail:res.statusText}));throw new Error(e.detail||'HTTP '+res.status);}
      const data = await res.json();
      rawData = data.source;
      const labels = {markdown:'Markdown',sop:'SOP',pid:'PID',concept:'Concept'};
      $('#result-title').textContent = 'Result ('+labels[fmt]+')';
      $('#output').textContent = data.document;
      $('#result-wrap').style.display = '';
      if(rawData){ $('#raw-output').textContent = JSON.stringify(rawData,null,2); $('#raw-wrap').style.display=''; }
    } catch(err){
      $('#error').textContent = err.message || 'Something went wrong';
      $('#error').style.display = '';
    } finally {
      $('#submit').disabled=false; $('#submit').textContent='Scrape & Generate';
    }
  });

  // Copy
  $('#copy-btn').addEventListener('click',()=>{
    navigator.clipboard.writeText($('#output').textContent);
    $('#copy-btn').textContent='Copied!'; $('#copy-btn').classList.add('copied');
    setTimeout(()=>{$('#copy-btn').textContent='Copy';$('#copy-btn').classList.remove('copied');},2000);
  });

  // Download
  $('#dl-btn').addEventListener('click',()=>{
    const blob = new Blob([$('#output').textContent],{type:'text/markdown'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'scraped-'+fmt+'-'+Date.now()+'.md';
    a.click(); URL.revokeObjectURL(a.href);
  });
})();
</script>
</body>
</html>"""


@app.get("/", response_class=HTMLResponse)
async def frontend():
    return FRONTEND_HTML
