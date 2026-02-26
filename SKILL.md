---
name: x-bookmarks
version: 2.0.0
description: >
  Fetch, summarize, and manage X/Twitter bookmarks via bird CLI or X API v2.
  Scrape and transform content from any X/Twitter URL or linked article.
  Use when: (1) user says "check my bookmarks", "what did I bookmark", "bookmark digest",
  "summarize my bookmarks", "x bookmarks", "twitter bookmarks", (2) user wants a periodic
  digest of saved tweets, (3) user wants to categorize, search, or analyze their bookmarks,
  (4) scheduled bookmark digests via cron, (5) user shares a tweet/X URL and wants the
  content scraped, (6) user wants to turn X content into an SOP, PID, or concept doc,
  (7) user says "scrape this", "grab this tweet", "turn this into a doc".
  Auth: bird CLI with browser cookies, OR X API v2 with OAuth 2.0 tokens.
requires:
  env:
    - AUTH_TOKEN: "X/Twitter auth token (from browser cookies, for bird CLI auth)"
    - CT0: "X/Twitter CSRF token (from browser cookies, for bird CLI auth)"
    - X_API_BEARER_TOKEN: "Optional: X API v2 Bearer token (alternative to bird CLI)"
  bins:
    - bird: "bird-cli (npm i -g bird-cli) - preferred backend"
  files:
    - .env.bird: "Optional: stores AUTH_TOKEN and CT0 for bird CLI"
    - ~/.config/x-bookmarks/tokens.json: "OAuth 2.0 tokens for X API v2 backend"
security:
  credentials: >
    This skill accesses X/Twitter bookmarks and tweet content, which requires authentication.
    Two methods are supported: (1) bird CLI using browser cookies (AUTH_TOKEN/CT0 env vars
    sourced from .env.bird), or (2) X API v2 with OAuth 2.0 tokens stored locally.
    The content scraper also fetches external article URLs linked in tweets (read-only).
    All credentials are stored locally on the user's machine and never transmitted
    to third parties. The user must explicitly provide or authorize credentials.
  permissions:
    - read: "X/Twitter bookmarks and individual tweets (read-only access)"
    - read: "External article URLs linked in tweets (HTTP fetch, read-only)"
    - write: "Local files only (bookmark state, token storage, scraped content)"
---

# X Bookmarks v2

Turn X/Twitter bookmarks from a graveyard of good intentions into actionable work.

**Core philosophy:** Don't just summarize — propose actions the agent can execute.

## Data Source Selection

This skill supports **two backends**. Pick the first one that works:

### 1. bird CLI (preferred if available)
- Fast, no API key needed, uses browser cookies
- Install: `npm install -g bird-cli`
- Test: `bird whoami` — if this prints a username, you're good

### 2. X API v2 (fallback)
- Works without bird CLI
- Requires an X Developer account + OAuth 2.0 app
- Setup: see [references/auth-setup.md](references/auth-setup.md) → "X API Setup"

### Auto-detection logic

```
1. Check if `bird` command exists → try `bird whoami`
2. If bird works → use bird CLI path
3. If not → check for X API tokens (~/.config/x-bookmarks/tokens.json)
4. If tokens exist → use X API path (auto-refresh)
5. If neither → guide user through setup (offer both options)
```

## Fetching Bookmarks

### Via bird CLI

```bash
# Latest 20 bookmarks (default)
bird bookmarks --json

# Specific count
bird bookmarks -n 50 --json

# All bookmarks (paginated)
bird bookmarks --all --json

# With thread context
bird bookmarks --include-parent --thread-meta --json

# With Chrome cookie auth
bird --chrome-profile "Default" bookmarks --json

# With manual tokens
bird --auth-token "$AUTH_TOKEN" --ct0 "$CT0" bookmarks --json
```

If user has a `.env.bird` file or env vars `AUTH_TOKEN`/`CT0`, source them first: `source .env.bird`

### Via X API v2

```bash
# First-time setup (opens browser for OAuth)
python3 scripts/x_api_auth.py --client-id "YOUR_CLIENT_ID" --client-secret "YOUR_SECRET"

# Fetch bookmarks (auto-refreshes token)
python3 scripts/fetch_bookmarks_api.py -n 20

# All bookmarks
python3 scripts/fetch_bookmarks_api.py --all

# Since a specific tweet
python3 scripts/fetch_bookmarks_api.py --since-id "1234567890"

# Pretty print
python3 scripts/fetch_bookmarks_api.py -n 50 --pretty
```

The API script outputs the **same JSON format** as bird CLI, so all downstream workflows work identically.

**Token management is automatic:** tokens are stored in `~/.config/x-bookmarks/tokens.json` and refreshed via the saved refresh_token. If refresh fails, the agent should guide the user to re-run `x_api_auth.py`.

### Environment variable override

If the user already has a Bearer token (e.g., from another tool), they can skip the OAuth dance:
```bash
X_API_BEARER_TOKEN="your_token" python3 scripts/fetch_bookmarks_api.py -n 20
```

## JSON Output Format (both backends)

Each bookmark returns:
```json
{
  "id": "tweet_id",
  "text": "tweet content",
  "createdAt": "2026-02-11T01:00:06.000Z",
  "replyCount": 46,
  "retweetCount": 60,
  "likeCount": 801,
  "bookmarkCount": 12,
  "viewCount": 50000,
  "author": { "username": "handle", "name": "Display Name" },
  "media": [{ "type": "photo|video", "url": "..." }],
  "quotedTweet": { "id": "..." }
}
```

## Core Workflows

### 1. Action-First Digest (Primary Use Case)

The key differentiator: don't just summarize, **propose actions the agent can execute**.

1. Fetch bookmarks (bird or API, auto-detected)
2. Parse and categorize by topic (auto-detect: crypto, AI, marketing, tools, personal, etc.)
3. For EACH category, propose specific actions:
   - **Tool/repo bookmarks** → "I can test this, set it up, or analyze the code"
   - **Strategy/advice bookmarks** → "Here are the actionable steps extracted — want me to implement any?"
   - **News/trends** → "This connects to [user's work]. Here's the angle for content"
   - **Content ideas** → "This would make a great tweet/video in your voice. Here's a draft"
   - **Questions/discussions** → "I can research this deeper and give you a summary"
4. Flag stale bookmarks (>2 weeks old) — "Use it or lose it"
5. Deliver categorized digest with actions

Format output as:
```
📂 CATEGORY (count)
• Bookmark summary (@author)
→ 🤖 I CAN: [specific action the agent can take]
```

### 2. Scheduled Digest (Cron)

Set up a recurring bookmark check. Suggest this cron config to the user:

```
Schedule: daily or weekly
Payload: "Check my X bookmarks for new saves since last check.
  Fetch bookmarks, compare against last digest, summarize only NEW ones.
  Categorize and propose actions. Deliver to me."
```

Track state by saving the most recent bookmark ID processed. Store in workspace:
`memory/bookmark-state.json` → `{ "lastSeenId": "...", "lastDigestAt": "..." }`

### 3. Content Recycling

When user asks for content ideas from bookmarks:
1. Fetch recent bookmarks
2. Identify high-engagement tweets (>500 likes) with frameworks, tips, or insights
3. Rewrite key ideas in the user's voice (if voice data available)
4. Suggest posting times based on the bookmark's original engagement

### 4. Pattern Detection

When user has enough bookmark history:
1. Fetch all bookmarks (`--all`)
2. Cluster by topic/keywords
3. Report: "You've bookmarked N tweets about [topic]. Want me to go deeper?"
4. Suggest: research reports, content series, or tools based on patterns

### 5. Bookmark Cleanup

For stale bookmarks:
1. Identify bookmarks older than a threshold (default: 30 days)
2. For each: extract the TL;DR and one actionable takeaway
3. Present: "Apply it today or clear it"
4. User can unbookmark via: `bird unbookmark <tweet-id>` (bird only)

## Content Scraper

Scrape and transform content from any X/Twitter URL or linked article into actionable documents.

**Trigger phrases:** "scrape this tweet", "grab this content", "turn this into a doc/SOP/PID",
"what does this tweet say", or simply pasting an X URL.

### Scraping a URL

```bash
# Scrape a tweet (fetches tweet + crawls any linked articles)
python3 scripts/x_content_scraper.py "https://x.com/user/status/123456"

# Output as markdown instead of JSON
python3 scripts/x_content_scraper.py "https://x.com/user/status/123456" --output markdown

# Scrape an external article directly
python3 scripts/x_content_scraper.py "https://example.com/article" --output markdown

# Don't crawl linked URLs (tweet content only)
python3 scripts/x_content_scraper.py "https://x.com/user/status/123456" --no-crawl

# Save output to file
python3 scripts/x_content_scraper.py "https://x.com/user/status/123456" -o markdown --save output/note.md

# Pretty-print JSON
python3 scripts/x_content_scraper.py "https://x.com/user/status/123456" --pretty
```

### Transforming Content

Pipe scraped JSON into the content processor to generate structured documents:

```bash
# Store as markdown note
python3 scripts/x_content_scraper.py "URL" | python3 scripts/content_processor.py --format markdown

# Generate a Business SOP
python3 scripts/x_content_scraper.py "URL" | python3 scripts/content_processor.py --format sop

# Generate a Project Initiation Document (PID)
python3 scripts/x_content_scraper.py "URL" | python3 scripts/content_processor.py --format pid

# Generate a Concept Document
python3 scripts/x_content_scraper.py "URL" | python3 scripts/content_processor.py --format concept

# Add context for more targeted output
python3 scripts/x_content_scraper.py "URL" | python3 scripts/content_processor.py \
  --format sop --context "Apply to our SaaS onboarding flow"

# Save transformed output to file
python3 scripts/x_content_scraper.py "URL" | python3 scripts/content_processor.py \
  --format pid --save output/project.md

# From a previously saved JSON file
python3 scripts/content_processor.py --format concept --input scraped.json
```

### Content Scraper Output Format

The scraper returns JSON with this structure:
```json
{
  "source_url": "https://x.com/user/status/123",
  "source_type": "tweet",
  "tweet": {
    "tweet_id": "123",
    "text": "Full tweet text (including long-form note tweets)",
    "created_at": "2026-02-11T01:00:06.000Z",
    "author": {
      "username": "handle",
      "name": "Display Name",
      "bio": "Author bio"
    },
    "metrics": {
      "replies": 46, "retweets": 60, "likes": 801,
      "bookmarks": 12, "views": 50000
    },
    "media": [{ "type": "photo", "url": "...", "alt_text": "..." }],
    "linked_urls": [
      { "url": "https://example.com/article", "title": "...", "description": "..." }
    ],
    "referenced_tweets": [
      { "type": "quoted", "id": "456", "text": "Quoted tweet content" }
    ]
  },
  "articles": [
    {
      "url": "https://example.com/article",
      "title": "Article Title",
      "description": "Meta description",
      "markdown": "Full article content as markdown..."
    }
  ]
}
```

### Document Formats

| Format | Use Case | What You Get |
|--------|----------|--------------|
| `markdown` | Quick save, reference notes | Clean markdown with attribution, content, and linked articles |
| `sop` | Process documentation | Structured SOP with purpose, scope, procedure steps, outcomes |
| `pid` | Project planning | Full PID with objectives, deliverables, timeline, risks |
| `concept` | Idea exploration | Core idea, key insights, applications, action items |

### Content Scraper Workflows

#### 6. Scrape & Store

When user shares a tweet/URL and wants to save it:
1. Run the scraper on the URL
2. Convert to markdown
3. Save to `output/` directory with a descriptive filename
4. Confirm what was saved and offer next steps

#### 7. Scrape & Transform

When user wants to turn content into a specific document:
1. Run the scraper on the URL
2. Ask user which format (SOP, PID, concept) — or use what they specified
3. Ask for additional context if not provided
4. Generate the document
5. Present it and offer to refine sections

#### 8. Scrape & Execute

When user shares content and gives specific instructions:
1. Run the scraper to extract the content
2. Read the user's instructions (e.g., "build this", "implement this strategy")
3. Use the scraped content as context to execute the task
4. This is the most powerful mode — the scraper feeds content directly into agent actions

Format output for scrape workflows as:
```
🔗 SCRAPED: [tweet summary or article title]
   Author: @username
   Content: [brief summary]
   Links: [N linked articles crawled]

→ 🤖 READY TO: [what the agent can do next based on user intent]
   • Save as markdown note
   • Generate SOP / PID / concept doc
   • Execute specific instructions with this content as context
```

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `bird: command not found` | bird CLI not installed | Use X API path instead, or `npm i -g bird-cli` |
| "No Twitter cookies found" | Not logged into X in browser | Log into x.com in Chrome/Firefox, or use X API |
| EPERM on Safari cookies | macOS permissions | Use Chrome/Firefox or X API instead |
| Empty results | Cookies/token expired | Re-login or re-run `x_api_auth.py` |
| Rate limit (429) | Too many API requests | Wait and retry, use `--count` to limit |
| "No X API token found" | Haven't run auth setup | Run `x_api_auth.py --client-id YOUR_ID` |
| Token refresh failed | Refresh token expired | Re-run `x_api_auth.py` to re-authorize |
| "Failed to fetch: HTTP 403" | Article blocks scraping | Content may be paywalled; use tweet text only |
| "Failed to fetch: HTTP 404" | URL is dead or moved | Check if the URL is still valid |
| "Too many redirects" | Redirect loop on article | Try the final URL directly |
| Scraper returns empty markdown | Page is JS-rendered SPA | Content may require browser; tweet text is still available |

## Tips

- Start with `-n 20` for quick digests, `--all` for deep analysis
- bird: Use `--include-parent` for thread context on replies
- API: includes `bookmarkCount` and `viewCount` (bird may not)
- Bookmark folders supported via bird `--folder-id <id>`
- Both backends output identical JSON — workflows are backend-agnostic
- Content scraper: use `--no-crawl` for fast tweet-only extraction
- Content scraper: pipe output through `content_processor.py` for structured docs
- Content scraper: use `--context` flag to guide document generation toward a specific use case
- Content scraper: supports long-form note tweets (>280 chars) automatically
- SOP/PID/Concept templates provide scaffolding — the agent should fill in the `[ ]` placeholders using the scraped content and user context
