"""
X Content Scraper — Single-service web app for Fly.io.

Serves both the frontend UI and API from one process.
Scrapes tweets for free via oEmbed — no API keys needed.

    GET  /               — Web UI (mobile + desktop)
    POST /api/scrape-and-process — One-shot: URL → document
    POST /api/scrape     — Scrape a URL → structured JSON
    POST /api/process    — Transform JSON → document format
    GET  /api/health     — Health check
"""

import os
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

# Add scripts directory to path so we can import existing modules
SCRIPTS_DIR = Path(__file__).resolve().parent.parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

from x_content_scraper import scrape_url, format_as_markdown, parse_x_url
from content_processor import process as process_content

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
        document = process_content(data, req.format, req.context)
        return {"document": document, "format": req.format, "source": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
async def api_health():
    return {"status": "ok", "version": "1.0.0"}


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
        method:'POST',
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
