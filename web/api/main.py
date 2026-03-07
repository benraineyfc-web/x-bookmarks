"""
X Content Scraper — Single-service web app for Fly.io.

Serves both the frontend UI and API from one process.
Scrapes tweets for free via oEmbed — no API keys needed.

    GET  /               — Scraper UI (single URL)
    GET  /dashboard      — Bookmark dashboard (browse all)
    POST /api/scrape-and-process — One-shot: URL → document
    POST /api/scrape     — Scrape a URL → structured JSON
    POST /api/process    — Transform JSON → document format
    POST /api/bookmarks/import — Import bookmarks from JSON export
    GET  /api/bookmarks  — List/search bookmarks
    GET  /api/bookmarks/stats — Dashboard stats
    POST /api/bookmarks/{id}/scrape — Scrape a bookmark's linked content
    GET  /api/health     — Health check
"""

import json
import os
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

# Add scripts directory to path so we can import existing modules
SCRIPTS_DIR = Path(__file__).resolve().parent.parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

from x_content_scraper import scrape_url, format_as_markdown, parse_x_url
from content_processor import process as process_content, generate_prompt
from bookmark_normalizer import normalize as normalize_bookmarks
from bookmark_db import (
    import_bookmarks, get_bookmarks, get_bookmark, get_stats,
    save_scraped_data, delete_all as delete_all_bookmarks,
)

# --- Config ---

# Optional: set X_API_BEARER_TOKEN for richer data (metrics, media).
# Without it, tweets are scraped for free via oEmbed.
X_API_BEARER_TOKEN = os.environ.get("X_API_BEARER_TOKEN", "")

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


# --- API Endpoints ---

@app.post("/api/scrape")
async def api_scrape(req: ScrapeRequest):
    try:
        return scrape_url(req.url, crawl_links=req.crawl_links, token=X_API_BEARER_TOKEN or None)
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
async def api_scrape_and_process(req: ScrapeAndProcessRequest):
    try:
        data = scrape_url(req.url, crawl_links=req.crawl_links, token=X_API_BEARER_TOKEN or None)
        fmt = req.format

        # For SOP/PID/Concept: generate a ready-to-paste AI prompt
        # For markdown: generate the document directly
        if fmt in ("sop", "pid", "concept"):
            prompt = generate_prompt(data, fmt, req.context)
            return {
                "document": prompt,
                "format": fmt,
                "type": "prompt",
                "source": data,
            }
        else:
            document = process_content(data, fmt, req.context)
            return {
                "document": document,
                "format": fmt,
                "type": "document",
                "source": data,
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
async def api_health():
    return {"status": "ok", "version": "1.0.0"}


# --- Bookmark Endpoints ---

@app.post("/api/bookmarks/import")
async def api_import_bookmarks(file: UploadFile = File(...)):
    """Import bookmarks from a JSON export file."""
    try:
        content = await file.read()
        raw_data = json.loads(content)
        normalized = normalize_bookmarks(raw_data)
        if not normalized:
            raise HTTPException(status_code=400, detail="No bookmarks found in file. Check the format.")
        result = import_bookmarks(normalized)
        return result
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/bookmarks")
async def api_list_bookmarks(
    q: str = Query("", description="Search query"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    sort: str = Query("newest"),
):
    """List bookmarks with optional search and pagination."""
    return get_bookmarks(query=q, offset=offset, limit=limit, sort=sort)


@app.get("/api/bookmarks/stats")
async def api_bookmark_stats():
    """Get bookmark dashboard stats."""
    return get_stats()


@app.post("/api/bookmarks/{tweet_id}/scrape")
async def api_scrape_bookmark(tweet_id: str):
    """Scrape linked content for a specific bookmark."""
    bm = get_bookmark(tweet_id)
    if not bm:
        raise HTTPException(status_code=404, detail="Bookmark not found")

    url = bm["url"]
    if not url:
        raise HTTPException(status_code=400, detail="No URL for this bookmark")

    try:
        scraped = scrape_url(url, crawl_links=True, token=X_API_BEARER_TOKEN or None)
        save_scraped_data(tweet_id, scraped)
        return {"status": "ok", "scraped": scraped}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/bookmarks")
async def api_delete_bookmarks():
    """Delete all bookmarks. Use with caution."""
    delete_all_bookmarks()
    return {"status": "ok"}


@app.post("/api/bookmarks/scrape-batch")
async def api_scrape_batch(limit: int = Query(10, ge=1, le=50)):
    """Scrape the next batch of un-scraped bookmarks."""
    from bookmark_db import _get_conn
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, url FROM bookmarks WHERE scraped_json IS NULL AND url != '' LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()

    results = {"scraped": 0, "failed": 0, "remaining": 0}
    for row in rows:
        try:
            scraped = scrape_url(row["url"], crawl_links=True, token=X_API_BEARER_TOKEN or None)
            save_scraped_data(row["id"], scraped)
            results["scraped"] += 1
        except Exception:
            results["failed"] += 1

    # Count remaining
    conn = _get_conn()
    results["remaining"] = conn.execute(
        "SELECT COUNT(*) FROM bookmarks WHERE scraped_json IS NULL AND url != ''"
    ).fetchone()[0]
    conn.close()
    return results


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
.prompt-banner{margin:.75rem 0;padding:.75rem 1rem;background:#1a2332;border:1px solid #1d4ed8;border-radius:8px;display:flex;align-items:flex-start;gap:.75rem}
.prompt-banner .icon{font-size:1.4rem;flex-shrink:0;line-height:1.2}
.prompt-banner .text{flex:1;font-size:.85rem;line-height:1.5;color:#93c5fd}
.prompt-banner .text strong{color:#bfdbfe}
.copy-prompt-btn{width:100%;padding:.75rem;font-size:1rem;font-weight:600;background:#7c3aed;color:#fff;border:none;border-radius:8px;cursor:pointer;margin:.5rem 0;transition:all .15s}
.copy-prompt-btn:hover{background:#6d28d9}
.copy-prompt-btn.copied{background:#059669}
.paste-links{display:flex;gap:1rem;justify-content:center;margin:.5rem 0}
.paste-links a{color:#888;font-size:.8rem;text-decoration:none;border-bottom:1px dashed #555}
.paste-links a:hover{color:#bbb}
@media(max-width:480px){.formats{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<div class="wrap">
  <h1>X Content Scraper</h1>
  <p class="sub">Paste a tweet or article URL. Get a structured document back.</p>

  <form id="form">
    <input type="url" id="url" placeholder="Paste an X/Twitter URL or article link..." required>
    <div class="formats" id="formats">
      <div class="fmt active" data-f="markdown">Markdown<small>Clean reference note</small></div>
      <div class="fmt" data-f="sop">SOP<small>AI prompt &rarr; Claude/GPT</small></div>
      <div class="fmt" data-f="pid">PID<small>AI prompt &rarr; Claude/GPT</small></div>
      <div class="fmt" data-f="concept">Concept<small>AI prompt &rarr; Claude/GPT</small></div>
    </div>
    <div id="ctx-wrap" style="display:none">
      <button type="button" class="ctx-toggle" id="ctx-toggle">+ Add context (optional)</button>
      <textarea id="ctx" rows="2" placeholder="Add context, e.g. 'Apply to our SaaS onboarding flow'..." style="display:none"></textarea>
    </div>
    <button type="submit" class="submit" id="submit">Scrape &amp; Generate</button>
  </form>

  <div class="error" id="error" style="display:none"></div>

  <div id="result-wrap" style="display:none">
    <!-- Prompt mode banner (SOP/PID/Concept) -->
    <div id="prompt-mode" style="display:none">
      <div class="prompt-banner">
        <span class="icon">&#9889;</span>
        <div class="text">
          <strong>Your AI prompt is ready.</strong> It includes all the scraped content plus formatting instructions.
          Copy it and paste into your AI assistant to generate the document.
        </div>
      </div>
      <button class="copy-prompt-btn" id="copy-prompt-btn">Copy Prompt to Clipboard</button>
      <div class="paste-links">
        <a href="https://claude.ai/new" target="_blank" rel="noopener">Open Claude</a>
        <a href="https://chatgpt.com" target="_blank" rel="noopener">Open ChatGPT</a>
        <a href="https://gemini.google.com" target="_blank" rel="noopener">Open Gemini</a>
      </div>
    </div>
    <!-- Standard header (always shown) -->
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

  <div class="footer"><p><a href="/dashboard" style="color:#1d9bf0;text-decoration:none">Bookmarks Dashboard</a> &middot; X Content Scraper v1.0</p></div>
</div>

<script>
(function(){
  const $ = s => document.querySelector(s);
  let fmt = 'markdown', rawData = null, resultType = 'document';

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

  // Copy helper
  function copyText(text, btn, originalLabel) {
    navigator.clipboard.writeText(text);
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(()=>{ btn.textContent = originalLabel; btn.classList.remove('copied'); }, 2000);
  }

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
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({url, format:fmt, context:ctx, crawl_links:true})
      });
      if(!res.ok){const e=await res.json().catch(()=>({detail:res.statusText}));throw new Error(e.detail||'HTTP '+res.status);}
      const data = await res.json();
      rawData = data.source;
      resultType = data.type || 'document';

      const labels = {markdown:'Markdown',sop:'SOP',pid:'PID',concept:'Concept'};

      // Show/hide prompt mode UI
      const isPrompt = resultType === 'prompt';
      $('#prompt-mode').style.display = isPrompt ? '' : 'none';
      $('#result-title').textContent = isPrompt
        ? 'AI Prompt (' + labels[fmt] + ')'
        : 'Result (' + labels[fmt] + ')';
      $('#copy-btn').textContent = isPrompt ? 'Copy' : 'Copy';
      $('#output').textContent = data.document;
      $('#result-wrap').style.display = '';

      // Auto-scroll to results
      $('#result-wrap').scrollIntoView({behavior:'smooth',block:'start'});

      if(rawData){ $('#raw-output').textContent = JSON.stringify(rawData,null,2); $('#raw-wrap').style.display=''; }
    } catch(err){
      $('#error').textContent = err.message || 'Something went wrong';
      $('#error').style.display = '';
    } finally {
      $('#submit').disabled=false; $('#submit').textContent='Scrape & Generate';
    }
  });

  // Check for URL params (from dashboard links)
  const params = new URLSearchParams(window.location.search);
  if (params.get('url')) {
    $('#url').value = params.get('url');
    if (params.get('format')) {
      const f = params.get('format');
      document.querySelectorAll('.fmt').forEach(el => {
        el.classList.toggle('active', el.dataset.f === f);
      });
      fmt = f;
      $('#ctx-wrap').style.display = (f==='markdown')?'none':'';
    }
  }

  // Copy prompt (big button)
  $('#copy-prompt-btn').addEventListener('click',()=>{
    copyText($('#output').textContent, $('#copy-prompt-btn'), 'Copy Prompt to Clipboard');
  });

  // Copy (small button)
  $('#copy-btn').addEventListener('click',()=>{
    copyText($('#output').textContent, $('#copy-btn'), 'Copy');
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


# --- Dashboard ---

DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#0a0a0a">
<title>Bookmarks Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0a;color:#ededed;min-height:100vh;-webkit-font-smoothing:antialiased}
.wrap{max-width:900px;margin:0 auto;padding:1.5rem 1rem}
nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem}
nav h1{font-size:1.4rem;font-weight:700}
nav a{color:#1d9bf0;text-decoration:none;font-size:.85rem}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1.5rem}
.stat{background:#141414;border:1px solid #222;border-radius:8px;padding:.75rem;text-align:center}
.stat .n{font-size:1.5rem;font-weight:700;color:#1d9bf0}
.stat .l{font-size:.75rem;color:#888;margin-top:.25rem}
.toolbar{display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap}
.toolbar input[type=text]{flex:1;min-width:200px;padding:.6rem .75rem;background:#141414;border:1px solid #333;border-radius:8px;color:#ededed;font-size:.9rem;outline:none}
.toolbar button,.toolbar label{padding:.6rem 1rem;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#aaa;cursor:pointer;font-size:.85rem;white-space:nowrap}
.toolbar label{background:#1d9bf0;color:#fff;font-weight:600;border-color:#1d9bf0}
.toolbar label input{display:none}
.toolbar button:hover{border-color:#555}
.import-status{padding:.5rem .75rem;background:#1a2332;border:1px solid #1d4ed8;border-radius:8px;color:#93c5fd;font-size:.85rem;margin-bottom:1rem;display:none}
.bm-list{display:flex;flex-direction:column;gap:.5rem}
.bm{background:#141414;border:1px solid #222;border-radius:8px;padding:.75rem 1rem;cursor:pointer;transition:border-color .15s}
.bm:hover{border-color:#444}
.bm .top{display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem}
.bm .author{font-weight:600;font-size:.85rem;color:#1d9bf0;white-space:nowrap}
.bm .date{font-size:.7rem;color:#666;white-space:nowrap}
.bm .text{font-size:.85rem;line-height:1.5;color:#ccc;margin:.4rem 0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.bm .metrics{display:flex;gap:.75rem;font-size:.7rem;color:#666}
.bm .metrics span{display:flex;align-items:center;gap:.2rem}
.bm .scraped-badge{font-size:.65rem;background:#1a3a1a;color:#4ade80;padding:.15rem .4rem;border-radius:4px}
.bm-detail{display:none;margin-top:.5rem;padding-top:.5rem;border-top:1px solid #222}
.bm-detail .actions{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.5rem}
.bm-detail .actions button{padding:.4rem .75rem;font-size:.8rem;background:#1a1a1a;border:1px solid #333;border-radius:6px;color:#aaa;cursor:pointer}
.bm-detail .actions button:hover{border-color:#555;color:#eee}
.bm-detail .actions button.primary{background:#1d9bf0;border-color:#1d9bf0;color:#fff}
.bm-detail .actions button.purple{background:#7c3aed;border-color:#7c3aed;color:#fff}
.bm-detail .scraped-content{margin-top:.75rem;background:#0d0d0d;border:1px solid #222;border-radius:6px;padding:.75rem;font-size:.8rem;max-height:300px;overflow:auto;white-space:pre-wrap;color:#999}
.pagination{display:flex;justify-content:center;gap:.5rem;margin-top:1.5rem}
.pagination button{padding:.5rem 1rem;background:#1a1a1a;border:1px solid #333;border-radius:6px;color:#aaa;cursor:pointer;font-size:.85rem}
.pagination button:disabled{opacity:.3;cursor:default}
.pagination .info{padding:.5rem;color:#666;font-size:.85rem}
.empty{text-align:center;padding:3rem 1rem;color:#666}
.empty p{margin-bottom:1rem}
@media(max-width:480px){.stats{grid-template-columns:1fr}.toolbar{flex-direction:column}}
</style>
</head>
<body>
<div class="wrap">
  <nav>
    <h1>Bookmarks</h1>
    <a href="/">Scraper</a>
  </nav>

  <div class="stats" id="stats">
    <div class="stat"><div class="n" id="stat-total">-</div><div class="l">Bookmarks</div></div>
    <div class="stat"><div class="n" id="stat-scraped">-</div><div class="l">Scraped</div></div>
    <div class="stat"><div class="n" id="stat-authors">-</div><div class="l">Authors</div></div>
  </div>

  <div class="toolbar">
    <input type="text" id="search" placeholder="Search bookmarks...">
    <label>Import JSON<input type="file" id="import-file" accept=".json"></label>
    <button id="scrape-all-btn">Scrape All</button>
    <button id="sort-btn" data-sort="newest">Newest first</button>
  </div>

  <div class="import-status" id="import-status"></div>

  <div class="bm-list" id="bm-list"></div>

  <div class="pagination" id="pagination" style="display:none">
    <button id="prev-btn">Prev</button>
    <span class="info" id="page-info"></span>
    <button id="next-btn">Next</button>
  </div>
</div>

<script>
(function(){
  const $ = s => document.querySelector(s);
  let currentOffset = 0, currentTotal = 0, pageSize = 50, currentQuery = '', currentSort = 'newest';

  async function loadStats() {
    try {
      const r = await fetch('/api/bookmarks/stats');
      const s = await r.json();
      $('#stat-total').textContent = s.total;
      $('#stat-scraped').textContent = s.scraped;
      $('#stat-authors').textContent = s.authors;
    } catch(e) {}
  }

  async function loadBookmarks() {
    const params = new URLSearchParams({q:currentQuery, offset:currentOffset, limit:pageSize, sort:currentSort});
    try {
      const r = await fetch('/api/bookmarks?'+params);
      const data = await r.json();
      currentTotal = data.total;
      renderBookmarks(data.bookmarks);
      renderPagination();
    } catch(e) {
      $('#bm-list').innerHTML = '<div class="empty"><p>Error loading bookmarks</p></div>';
    }
  }

  function renderBookmarks(bookmarks) {
    if (!bookmarks.length) {
      $('#bm-list').innerHTML = '<div class="empty"><p>No bookmarks found.</p><p>Import your X bookmarks using the "Import JSON" button above.</p><p style="font-size:.8rem;color:#555">Use <a href="https://github.com/prinsss/twitter-web-exporter" target="_blank" style="color:#1d9bf0">Twitter Web Exporter</a> to export your bookmarks as JSON.</p></div>';
      return;
    }
    $('#bm-list').innerHTML = bookmarks.map(bm => {
      const date = bm.created_at ? new Date(bm.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'2-digit'}) : '';
      const text = escHtml(bm.text||'');
      const scraped = bm.is_scraped ? '<span class="scraped-badge">scraped</span>' : '';
      return `<div class="bm" data-id="${bm.id}" data-url="${escAttr(bm.url||'')}">
        <div class="top">
          <span class="author">@${escHtml(bm.author_username)} ${scraped}</span>
          <span class="date">${date}</span>
        </div>
        <div class="text">${text}</div>
        <div class="metrics">
          ${bm.likes?`<span>${fmtN(bm.likes)} likes</span>`:''}
          ${bm.retweets?`<span>${fmtN(bm.retweets)} RTs</span>`:''}
          ${bm.views?`<span>${fmtN(bm.views)} views</span>`:''}
        </div>
        <div class="bm-detail">
          <div class="actions">
            <button class="primary" onclick="scrapeBookmark('${bm.id}',this)">Scrape linked content</button>
            <button class="purple" onclick="generatePrompt('${bm.id}','sop')">SOP Prompt</button>
            <button class="purple" onclick="generatePrompt('${bm.id}','pid')">PID Prompt</button>
            <button class="purple" onclick="generatePrompt('${bm.id}','concept')">Concept Prompt</button>
            <button onclick="window.open('${escAttr(bm.url||'')}','_blank')">View on X</button>
          </div>
          <div class="scraped-content" id="sc-${bm.id}" style="display:none"></div>
        </div>
      </div>`;
    }).join('');
  }

  function renderPagination() {
    const pg = $('#pagination');
    if (currentTotal <= pageSize) { pg.style.display='none'; return; }
    pg.style.display = '';
    const page = Math.floor(currentOffset/pageSize)+1;
    const totalPages = Math.ceil(currentTotal/pageSize);
    $('#page-info').textContent = `${page} / ${totalPages} (${currentTotal} total)`;
    $('#prev-btn').disabled = currentOffset <= 0;
    $('#next-btn').disabled = currentOffset + pageSize >= currentTotal;
  }

  // Expand/collapse bookmark
  $('#bm-list').addEventListener('click', e => {
    const bm = e.target.closest('.bm');
    if (!bm || e.target.closest('button') || e.target.closest('a')) return;
    const detail = bm.querySelector('.bm-detail');
    detail.style.display = detail.style.display === 'none' ? '' : 'none';
  });

  // Search
  let searchTimer;
  $('#search').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentQuery = e.target.value.trim();
      currentOffset = 0;
      loadBookmarks();
    }, 300);
  });

  // Sort toggle
  $('#sort-btn').addEventListener('click', () => {
    currentSort = currentSort === 'newest' ? 'oldest' : 'newest';
    $('#sort-btn').textContent = currentSort === 'newest' ? 'Newest first' : 'Oldest first';
    currentOffset = 0;
    loadBookmarks();
  });

  // Pagination
  $('#prev-btn').addEventListener('click', () => { currentOffset = Math.max(0, currentOffset-pageSize); loadBookmarks(); });
  $('#next-btn').addEventListener('click', () => { currentOffset += pageSize; loadBookmarks(); });

  // Import
  $('#import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const status = $('#import-status');
    status.style.display = '';
    status.textContent = 'Importing...';
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await fetch('/api/bookmarks/import', {method:'POST', body:form});
      if (!r.ok) { const err = await r.json().catch(()=>({})); throw new Error(err.detail||'Import failed'); }
      const result = await r.json();
      status.textContent = `Imported: ${result.added} new, ${result.skipped} already existed (${result.total} total in file)`;
      loadStats();
      loadBookmarks();
    } catch(err) {
      status.textContent = 'Error: ' + err.message;
      status.style.borderColor = '#5c2020';
      status.style.color = '#f87171';
    }
    e.target.value = '';
  });

  // Scrape All (batch)
  $('#scrape-all-btn').addEventListener('click', async () => {
    const btn = $('#scrape-all-btn');
    btn.disabled = true;
    const scrapeNext = async () => {
      btn.textContent = 'Scraping batch...';
      try {
        const r = await fetch('/api/bookmarks/scrape-batch?limit=10', {method:'POST'});
        if (!r.ok) throw new Error('Batch scrape failed');
        const data = await r.json();
        const msg = `Scraped ${data.scraped}, failed ${data.failed}, ${data.remaining} remaining`;
        $('#import-status').style.display = '';
        $('#import-status').textContent = msg;
        $('#import-status').style.borderColor = '#1d4ed8';
        $('#import-status').style.color = '#93c5fd';
        loadStats();
        loadBookmarks();
        if (data.remaining > 0 && data.scraped > 0) {
          btn.textContent = `Continue (${data.remaining} left)`;
          btn.disabled = false;
        } else {
          btn.textContent = 'Scrape All';
          btn.disabled = false;
        }
      } catch(err) {
        btn.textContent = 'Scrape All';
        btn.disabled = false;
        $('#import-status').style.display = '';
        $('#import-status').textContent = 'Error: ' + err.message;
      }
    };
    await scrapeNext();
  });

  // Scrape a bookmark
  window.scrapeBookmark = async (id, btn) => {
    btn.disabled = true; btn.textContent = 'Scraping...';
    try {
      const r = await fetch(`/api/bookmarks/${id}/scrape`, {method:'POST'});
      if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.detail||'Scrape failed'); }
      const data = await r.json();
      const sc = $(`#sc-${id}`);
      sc.style.display = '';
      sc.textContent = JSON.stringify(data.scraped, null, 2);
      btn.textContent = 'Scraped!';
      btn.style.background = '#059669';
      loadStats();
    } catch(err) {
      btn.textContent = 'Error: ' + err.message;
      btn.disabled = false;
    }
  };

  // Generate prompt for a bookmark
  window.generatePrompt = async (id, fmt) => {
    // First scrape if needed, then open scraper page with the URL
    const bm = document.querySelector(`.bm[data-id="${id}"]`);
    const url = bm?.dataset.url;
    if (url) {
      // Open scraper page with pre-filled URL and format
      window.open(`/?url=${encodeURIComponent(url)}&format=${fmt}`, '_blank');
    }
  };

  function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function escAttr(s) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function fmtN(n) { return n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : n; }

  // Init
  loadStats();
  loadBookmarks();
})();
</script>
</body>
</html>"""


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    return DASHBOARD_HTML
