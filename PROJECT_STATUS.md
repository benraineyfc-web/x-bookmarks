# X Bookmarks Platform — Project Status

## What We Built

A full-stack bookmark management platform for X/Twitter that imports bookmarks from multiple export tools, auto-categorizes them, displays media (images/videos), and exports actionable prompts for Claude/AI workflows.

### Core Flow
```
Export tweets (Tampermonkey/bird CLI/X API) → Upload JSON → Auto-normalize → Auto-categorize → Browse/Search/Filter → Export as AI prompts
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7.3, Tailwind CSS v4, shadcn/ui (Radix primitives) |
| Data | Dexie 4.3 (IndexedDB ORM) — all data stored client-side |
| Tables | TanStack React Table 8.21 |
| Icons | Hugeicons, react-icons (Material Design) |
| Backend API | FastAPI 0.115 (Python), Trafilatura (article extraction) |
| Deployment | Fly.io (free tier, `x-bookmarks.fly.dev`) |
| Scripts | Python — OAuth PKCE auth, X API fetcher, content scraper, doc generator |

### Key Dependencies (package.json)
- `react` 19 + `react-router` 7
- `dexie` 4.3 (IndexedDB)
- `@tanstack/react-table` 8.21
- `sonner` (toasts)
- `next-themes` (dark mode)
- `clsx` + `tailwind-merge`

---

## Project Structure

```
x-bookmarks/
├── dashboard/                    # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx     # Stats, trending, engagement overview
│   │   │   ├── Bookmarks.jsx     # Main browse view (grid/list, search, filters)
│   │   │   ├── Categories.jsx    # Browse by auto-assigned category
│   │   │   ├── Import.jsx        # Upload/paste JSON, diagnostics panel
│   │   │   ├── Export.jsx        # Select bookmarks → generate AI prompts
│   │   │   ├── Tags.jsx          # Tag CRUD
│   │   │   └── Collections.jsx   # User-created groupings
│   │   ├── components/
│   │   │   ├── bookmarks/
│   │   │   │   ├── BookmarkCard.jsx          # Card with media, metrics, author
│   │   │   │   └── BookmarkDetailDialog.jsx  # Full detail modal
│   │   │   ├── sidebar/          # App navigation
│   │   │   └── ui/               # 20+ shadcn components
│   │   ├── lib/
│   │   │   ├── db.js             # Dexie schema, normalize(), importBookmarks()
│   │   │   ├── categorize.js     # 20 keyword-based categories + action extraction
│   │   │   ├── scraper.js        # Article extraction via backend API
│   │   │   └── prompts.js        # 15+ export templates (PRD, BRD, research, etc.)
│   │   └── App.jsx               # React Router (7 routes)
├── web/
│   └── api/
│       ├── main.py               # FastAPI endpoints (scrape, process, health)
│       ├── Dockerfile            # Python 3.12
│       └── requirements.txt
├── scripts/
│   ├── x_api_auth.py             # OAuth 2.0 PKCE flow
│   ├── fetch_bookmarks_api.py    # X API v2 bookmark fetcher
│   ├── x_content_scraper.py      # Tweet/article → structured JSON
│   ├── content_processor.py      # JSON → SOP/PID/Concept docs
│   └── bookmark_normalizer.py    # Python normalizer (reference)
└── fly.toml                      # Fly.io deployment config
```

---

## Database Schema (IndexedDB via Dexie)

**3 schema versions (auto-migrated):**

```
Bookmark {
  id: string                  // Tweet ID (primary key)
  text: string                // Tweet content
  author_username: string     // @handle
  author_name: string         // Display name
  created_at: string          // ISO timestamp
  url: string                 // https://x.com/.../status/...
  likes, retweets, views, replies, bookmarks: number
  media: [{                   // Images/videos attached to tweet
    type: "photo" | "video" | "animated_gif"
    url: string               // Full-size image or thumbnail
    preview_image_url: string // Poster/thumbnail
    video_url?: string        // Direct .mp4 link (videos only)
    alt_text: string
  }]
  quoteTweet: { text, author_username, author_name, media } | null
  urls: [{ url, display_url, title, description, thumbnail }]
  tags: string[]              // User-assigned
  categories: string[]        // Auto-assigned (up to 3)
  actionItems: string[]       // Extracted from text
  favorite: boolean
  notes: string               // User notes
  importedAt: string
  scraped_json?: object       // Cached article extractions
}
```

---

## Import Pipeline

### Supported Formats (auto-detected)
1. **Tampermonkey** — `screen_name` + `favorite_count` + `media[]` with `thumbnail`/`original` fields
2. **bird CLI** — `likeCount`/`retweetCount` + `author.username`
3. **X API v2** — `public_metrics` + `author_id` + `media_keys`
4. **Web Exporter** — `rest_id` + `legacy` wrapper (GraphQL intercept)
5. **Raw GraphQL** — `tweet_results` with `extended_entities`
6. **Generic** — best-effort fallback for any `id` + `text` JSON

### Normalization Flow
```
Raw JSON → detectFormat() → format-specific normalizer → standard schema
  → categorizeBookmark() (20 categories × keyword matching)
  → extractActionItems() (numbered lists, imperatives)
  → importBookmarks() → Dexie/IndexedDB
```

### Import Options
- **Update existing** — re-import same JSON to update media/links/quotes on existing bookmarks
- **Fresh import** — delete all bookmarks first, import from scratch (bypasses update logic)
- **Auto-tag** — apply tags to the entire import batch
- **Diagnostics panel** — shows parsed count, media count, author count, raw/normalized samples

---

## Features Implemented

### Working
- [x] Multi-format JSON import with auto-detection
- [x] Auto-categorization (20 categories: AI Tools, Startups, Marketing, Prompts, etc.)
- [x] Search + filters (author, category, date range, tags, favorites)
- [x] Sort (newest, oldest, most liked/retweeted/viewed, recently added)
- [x] Grid and list view toggle
- [x] Bookmark detail dialog (full text, media gallery, linked articles, quote tweets)
- [x] Favorites system
- [x] Tag management (create, rename, delete, assign)
- [x] Collections (user-created groupings)
- [x] Batch operations (select, tag, delete, move to collection)
- [x] Export with 15+ AI prompt templates (PRD, BRD, Research, Content Ideas, etc.)
- [x] Dashboard with stats cards
- [x] Dark mode support
- [x] Responsive design (mobile/tablet/desktop)
- [x] Article scraping via backend API (URL → markdown)
- [x] Fresh import option (delete + re-import)

---

## Current Issues & What Needs Fixing

### 1. Media Display — RECENTLY FIXED, NEEDS VERIFICATION
**Problem:** Images/videos not rendering on bookmark cards.
**Root cause found:** The Tampermonkey export uses `thumbnail` and `original` fields for media URLs, but the normalizer only checked `media_url_https` / `media_url`. Every media item got empty `preview_image_url` and the `url` was a useless `t.co` shortlink.
**Fix applied:** All normalizers now extract `thumbnail` → `preview_image_url` and `original` → `url` (photos) / `video_url` (videos).
**Status:** Code fixed and pushed. Needs fresh import to verify images display correctly.

### 2. t.co URLs as Media URLs
**Problem:** Some media items have `https://t.co/...` as the `url`, which is a redirect shortlink, not an image.
**Fix:** The normalizer now prefers `original` and `thumbnail` over `url` for actual media content.

### 3. SafeImg Hiding Broken Images Silently
**Behavior:** `BookmarkCard.jsx` uses a `SafeImg` component and `onError` handler that hides images when they fail to load. If media URLs are wrong, images silently disappear rather than showing an error.
**Impact:** Made debugging harder — cards appeared to have no images when they actually had images with wrong URLs.

---

## Potential Improvements

### High Priority
- [ ] **Verify media rendering end-to-end** — Do a fresh import and confirm images/videos show on cards
- [ ] **Image proxy/fallback** — Twitter CDN images may require auth or expire; consider caching or proxying
- [ ] **Remove diagnostics panel** — Clean up the import page once media is confirmed working (or keep behind a toggle)

### Medium Priority
- [ ] **Infinite scroll / virtualization** — 1446 bookmarks rendering all at once may be slow; add windowing
- [ ] **Full-text search index** — Currently filters in-memory; Dexie has full-text search plugins
- [ ] **Bulk export** — Export all bookmarks as JSON backup
- [ ] **Bookmark deduplication** — Detect and merge duplicate imports
- [ ] **Content scraper integration in UI** — Button to scrape linked articles directly from bookmark cards
- [ ] **Better video playback** — Inline video player in card detail view using `video_url`

### Nice to Have
- [ ] **Chrome extension** — One-click bookmark from Twitter feed (currently relies on Tampermonkey)
- [ ] **Sync across devices** — Currently IndexedDB is browser-local only
- [ ] **AI-powered categorization** — Use Claude API instead of keyword matching for smarter categories
- [ ] **Thread unrolling** — Detect and combine tweet threads into single entries
- [ ] **Scheduled re-imports** — Auto-fetch new bookmarks via X API on a schedule
- [ ] **Analytics dashboard** — Engagement trends over time, most-bookmarked authors

---

## Tools & Extensions Used

| Tool | Purpose |
|------|---------|
| **Tampermonkey** (browser extension) | Exports X bookmarks as JSON via GraphQL intercept |
| **bird CLI** (`npm i -g bird-cli`) | CLI tool to fetch X bookmarks using browser cookies |
| **X API v2** (via `scripts/x_api_auth.py`) | Official API access with OAuth 2.0 PKCE |
| **Trafilatura** (Python) | Extracts article content from URLs |
| **Fly.io** | Hosts the FastAPI backend |
| **Vite** | Dev server + production build |
| **shadcn/ui** | Pre-built accessible React components |

---

## How to Run Locally

```bash
# Frontend
cd dashboard
npm install
npm run dev          # → http://localhost:5173

# Backend API (optional, for article scraping)
cd web/api
pip install -r requirements.txt
uvicorn main:app --reload   # → http://localhost:8000
```

## How to Deploy

```bash
# Fly.io (configured in fly.toml)
fly deploy
# → https://x-bookmarks.fly.dev
```

---

## Key Files for Context

| File | What it does |
|------|-------------|
| `dashboard/src/lib/db.js` | Database schema, normalize(), importBookmarks(), deleteAllBookmarks() |
| `dashboard/src/lib/categorize.js` | 20 auto-categories with keyword matching |
| `dashboard/src/pages/Import.jsx` | Import UI with diagnostics, fresh import option |
| `dashboard/src/pages/Bookmarks.jsx` | Main browse page (search, filter, sort, grid/list) |
| `dashboard/src/components/bookmarks/BookmarkCard.jsx` | Card rendering (media, metrics, author) |
| `dashboard/src/components/bookmarks/BookmarkDetailDialog.jsx` | Full detail modal |
| `scripts/x_content_scraper.py` | Tweet/article scraper (30KB) |
| `scripts/content_processor.py` | Document generator (SOP/PID/Concept) |

---

*Last updated: March 2026*
