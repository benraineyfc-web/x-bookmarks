#!/usr/bin/env python3
"""
X Content Scraper — fetch and extract content from X/Twitter URLs.

Given a tweet URL or article URL shared on X, this tool:
1. Detects the URL type (tweet vs external article)
2. Fetches tweet content via free oEmbed API (no API key needed)
3. Crawls any linked URLs within the tweet
4. Converts HTML to clean markdown
5. Outputs structured JSON with all extracted content

Usage:
    python3 x_content_scraper.py "https://x.com/user/status/123456"
    python3 x_content_scraper.py "https://x.com/user/status/123456" --output markdown
    python3 x_content_scraper.py "https://example.com/article" --output json

Output formats: json (default), markdown

Environment:
    X_API_BEARER_TOKEN — optional: use X API v2 for richer data (metrics, media)
"""

import argparse
import json
import os
import re
import ssl
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

# Import auth helper (same directory, optional — only needed for CLI with local tokens)
sys.path.insert(0, str(Path(__file__).parent))
try:
    from x_api_auth import get_valid_token
except ImportError:
    get_valid_token = lambda: None

BASE_URL = "https://api.x.com/2"

# --- URL Parsing ---

TWEET_URL_PATTERN = re.compile(
    r"https?://(?:www\.)?(?:x\.com|twitter\.com)/(?P<username>[^/]+)/status/(?P<tweet_id>\d+)"
)


def parse_x_url(url: str) -> dict:
    """Parse a URL and classify it as tweet, x-article, or external."""
    url = url.strip()
    m = TWEET_URL_PATTERN.match(url)
    if m:
        return {
            "type": "tweet",
            "tweet_id": m.group("tweet_id"),
            "username": m.group("username"),
            "url": url,
        }
    # X article URLs (x.com/user/article/...)
    if re.match(r"https?://(?:www\.)?(?:x\.com|twitter\.com)/", url):
        return {"type": "x_page", "url": url}
    return {"type": "external", "url": url}


# --- HTML to Markdown Converter (stdlib only) ---

class HTMLToMarkdown(HTMLParser):
    """Lightweight HTML-to-Markdown converter using stdlib html.parser."""

    BLOCK_TAGS = {"p", "div", "article", "section", "main", "header", "footer",
                  "blockquote", "li", "tr", "br", "hr"}
    SKIP_TAGS = {"script", "style", "nav", "aside", "footer", "header", "form",
                 "iframe", "noscript", "svg", "button", "input", "select",
                 "textarea", "menu", "dialog"}
    HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}

    def __init__(self):
        super().__init__()
        self.output = []
        self.skip_depth = 0
        self.tag_stack = []
        self.list_stack = []  # track ol/ul nesting
        self.list_index = []  # track ordered list counters
        self.in_pre = False
        self.in_code = False
        self.link_href = None

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        tag = tag.lower()

        if tag in self.SKIP_TAGS:
            self.skip_depth += 1
            return

        if self.skip_depth > 0:
            return

        self.tag_stack.append(tag)

        if tag in self.HEADING_TAGS:
            level = int(tag[1])
            self.output.append(f"\n\n{'#' * level} ")
        elif tag == "p":
            self.output.append("\n\n")
        elif tag == "br":
            self.output.append("\n")
        elif tag == "hr":
            self.output.append("\n\n---\n\n")
        elif tag == "blockquote":
            self.output.append("\n\n> ")
        elif tag == "pre":
            self.in_pre = True
            self.output.append("\n\n```\n")
        elif tag == "code" and not self.in_pre:
            self.in_code = True
            self.output.append("`")
        elif tag == "strong" or tag == "b":
            self.output.append("**")
        elif tag == "em" or tag == "i":
            self.output.append("*")
        elif tag == "a":
            self.link_href = attrs_dict.get("href", "")
            self.output.append("[")
        elif tag == "img":
            alt = attrs_dict.get("alt", "image")
            src = attrs_dict.get("src", "")
            if src:
                self.output.append(f"![{alt}]({src})")
        elif tag == "ul":
            self.list_stack.append("ul")
            self.list_index.append(0)
            self.output.append("\n")
        elif tag == "ol":
            self.list_stack.append("ol")
            self.list_index.append(0)
            self.output.append("\n")
        elif tag == "li":
            indent = "  " * max(0, len(self.list_stack) - 1)
            if self.list_stack and self.list_stack[-1] == "ol":
                self.list_index[-1] += 1
                self.output.append(f"\n{indent}{self.list_index[-1]}. ")
            else:
                self.output.append(f"\n{indent}- ")

    def handle_endtag(self, tag):
        tag = tag.lower()

        if tag in self.SKIP_TAGS:
            self.skip_depth = max(0, self.skip_depth - 1)
            return

        if self.skip_depth > 0:
            return

        if self.tag_stack and self.tag_stack[-1] == tag:
            self.tag_stack.pop()

        if tag in self.HEADING_TAGS:
            self.output.append("\n")
        elif tag == "pre":
            self.in_pre = False
            self.output.append("\n```\n")
        elif tag == "code" and not self.in_pre:
            self.in_code = False
            self.output.append("`")
        elif tag == "strong" or tag == "b":
            self.output.append("**")
        elif tag == "em" or tag == "i":
            self.output.append("*")
        elif tag == "a":
            if self.link_href:
                self.output.append(f"]({self.link_href})")
            else:
                self.output.append("]")
            self.link_href = None
        elif tag in ("ul", "ol"):
            if self.list_stack:
                self.list_stack.pop()
            if self.list_index:
                self.list_index.pop()
            self.output.append("\n")
        elif tag == "p":
            self.output.append("\n")

    def handle_data(self, data):
        if self.skip_depth > 0:
            return
        if self.in_pre:
            self.output.append(data)
        else:
            # Collapse whitespace for non-pre content
            text = re.sub(r"\s+", " ", data)
            self.output.append(text)

    def get_markdown(self) -> str:
        raw = "".join(self.output)
        # Clean up excessive newlines
        raw = re.sub(r"\n{3,}", "\n\n", raw)
        return raw.strip()


def html_to_markdown(html: str) -> str:
    """Convert HTML to markdown."""
    converter = HTMLToMarkdown()
    converter.feed(html)
    return converter.get_markdown()


# --- Title Extraction ---

class TitleParser(HTMLParser):
    """Extract <title> and <meta> description from HTML."""

    def __init__(self):
        super().__init__()
        self.title = ""
        self.description = ""
        self.og_title = ""
        self.og_description = ""
        self.og_image = ""
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "title":
            self.in_title = True
        elif tag == "meta":
            name = attrs_dict.get("name", "").lower()
            prop = attrs_dict.get("property", "").lower()
            content = attrs_dict.get("content", "")
            if name == "description":
                self.description = content
            elif prop == "og:title":
                self.og_title = content
            elif prop == "og:description":
                self.og_description = content
            elif prop == "og:image":
                self.og_image = content

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


def extract_metadata(html: str) -> dict:
    """Extract page metadata from HTML."""
    parser = TitleParser()
    parser.feed(html)
    return {
        "title": parser.og_title or parser.title,
        "description": parser.og_description or parser.description,
        "image": parser.og_image,
    }


# --- Article Content Extraction ---

class ArticleExtractor(HTMLParser):
    """Extract the main article/content body from HTML, ignoring nav/sidebar."""

    CONTENT_TAGS = {"article", "main", "[role=main]"}
    SKIP_TAGS = {"script", "style", "nav", "aside", "footer", "header", "form",
                 "iframe", "noscript", "svg"}

    def __init__(self):
        super().__init__()
        self.segments = []
        self.current_segment = []
        self.skip_depth = 0
        self.in_article = False
        self.article_depth = 0
        self.tag_depth = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        attrs_dict = dict(attrs)
        self.tag_depth += 1

        if tag in self.SKIP_TAGS:
            self.skip_depth += 1
            return

        if self.skip_depth > 0:
            return

        # Detect article/main content regions
        if tag in ("article", "main") or attrs_dict.get("role") == "main":
            self.in_article = True
            self.article_depth = self.tag_depth

    def handle_endtag(self, tag):
        tag = tag.lower()

        if tag in self.SKIP_TAGS:
            self.skip_depth = max(0, self.skip_depth - 1)
            self.tag_depth -= 1
            return

        if self.tag_depth == self.article_depth and self.in_article:
            self.in_article = False

        self.tag_depth -= 1

    def handle_data(self, data):
        if self.skip_depth > 0:
            return
        text = data.strip()
        if text:
            self.segments.append(text)

    def get_text(self) -> str:
        return "\n".join(self.segments)


# --- oEmbed HTML Parser ---

class OEmbedParser(HTMLParser):
    """Parse oEmbed HTML blockquote to extract tweet text and links."""

    def __init__(self):
        super().__init__()
        self.text_parts = []
        self.links = []
        self.in_p = False
        self.in_a = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        tag = tag.lower()
        if tag == "p":
            self.in_p = True
        elif tag == "a" and self.in_p:
            self.in_a = True
            href = attrs_dict.get("href", "")
            if href:
                self.links.append(href)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "p":
            self.in_p = False
        elif tag == "a":
            self.in_a = False

    def handle_data(self, data):
        if self.in_p:
            self.text_parts.append(data)


# --- Web Fetching ---

def create_ssl_context():
    """Create a permissive SSL context for fetching URLs."""
    ctx = ssl.create_default_context()
    return ctx


def fetch_url(url: str, max_redirects: int = 5, timeout: int = 15) -> dict:
    """Fetch a URL and return status, final URL, headers, and body."""
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; x-content-scraper/1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    ctx = create_ssl_context()
    current_url = url

    for _ in range(max_redirects):
        req = urllib.request.Request(current_url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
                final_url = resp.geturl()
                content_type = resp.headers.get("Content-Type", "")
                body = resp.read()

                # Decode body
                charset = "utf-8"
                if "charset=" in content_type:
                    charset = content_type.split("charset=")[-1].split(";")[0].strip()
                try:
                    text = body.decode(charset, errors="replace")
                except (LookupError, UnicodeDecodeError):
                    text = body.decode("utf-8", errors="replace")

                return {
                    "url": final_url,
                    "content_type": content_type,
                    "body": text,
                    "status": 200,
                }
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307, 308):
                current_url = e.headers.get("Location", current_url)
                continue
            return {"url": current_url, "status": e.code, "body": "", "content_type": ""}
        except Exception as e:
            return {"url": current_url, "status": 0, "body": str(e), "content_type": ""}

    return {"url": current_url, "status": 0, "body": "Too many redirects", "content_type": ""}


# --- Free Tweet Fetching via oEmbed ---

def process_tweet_free(tweet_id: str, username: str, tweet_url: str) -> dict | None:
    """Fetch tweet data for free using Twitter's oEmbed endpoint. No API key needed."""
    oembed_api = (
        "https://publish.twitter.com/oembed?"
        + urllib.parse.urlencode({"url": tweet_url, "omit_script": "true"})
    )
    resp = fetch_url(oembed_api)
    if resp["status"] != 200:
        return None

    try:
        oembed = json.loads(resp["body"])
    except (json.JSONDecodeError, ValueError):
        return None

    # Parse tweet text and links from the oEmbed HTML blockquote
    parser = OEmbedParser()
    parser.feed(oembed.get("html", ""))
    text = "".join(parser.text_parts).strip()

    # Author info from oEmbed fields
    author_name = oembed.get("author_name", username)
    author_url = oembed.get("author_url", "")
    oembed_username = author_url.rstrip("/").rsplit("/", 1)[-1] if author_url else username

    # Resolve t.co links and filter out X/Twitter self-links
    linked_urls = []
    for link in parser.links:
        resolved = link
        if "t.co/" in link:
            resolved_resp = fetch_url(link)
            if resolved_resp.get("url"):
                resolved = resolved_resp["url"]
        # Skip X/Twitter self-links
        if re.match(r"https?://(?:www\.)?(?:x\.com|twitter\.com)/", resolved):
            continue
        linked_urls.append({
            "url": resolved,
            "display_url": resolved,
            "title": "",
            "description": "",
        })

    return {
        "tweet_id": tweet_id,
        "text": text,
        "created_at": "",
        "author": {
            "username": oembed_username,
            "name": author_name,
            "bio": "",
        },
        "metrics": {},
        "media": [],
        "linked_urls": linked_urls,
        "referenced_tweets": [],
    }


# --- Tweet Fetching via X API (optional, requires bearer token) ---

def fetch_tweet(tweet_id: str, token: str) -> dict:
    """Fetch a single tweet by ID via X API v2."""
    params = urllib.parse.urlencode({
        "tweet.fields": "created_at,public_metrics,entities,conversation_id,referenced_tweets,text,note_tweet",
        "user.fields": "username,name,profile_image_url,description",
        "media.fields": "type,url,preview_image_url,alt_text",
        "expansions": "author_id,attachments.media_keys,referenced_tweets.id,referenced_tweets.id.author_id",
    })
    url = f"{BASE_URL}/tweets/{tweet_id}?{params}"

    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {token}")

    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def extract_urls_from_tweet(tweet_data: dict) -> list:
    """Extract all URLs from a tweet's entities."""
    urls = []
    entities = tweet_data.get("entities", {})
    for u in entities.get("urls", []):
        expanded = u.get("expanded_url") or u.get("url", "")
        # Skip X/Twitter self-links (quoted tweets, etc.)
        if expanded and not re.match(r"https?://(?:www\.)?(?:x\.com|twitter\.com)/\w+/status/", expanded):
            urls.append({
                "url": expanded,
                "display_url": u.get("display_url", expanded),
                "title": u.get("title", ""),
                "description": u.get("description", ""),
            })
    return urls


def process_tweet(tweet_id: str, token: str) -> dict:
    """Fetch a tweet and return structured content."""
    response = fetch_tweet(tweet_id, token)

    tweet = response.get("data", {})
    includes = response.get("includes", {})

    # Resolve author
    users = {u["id"]: u for u in includes.get("users", [])}
    author_id = tweet.get("author_id", "")
    author = users.get(author_id, {})

    # Resolve media
    media_map = {m["media_key"]: m for m in includes.get("media", [])}
    media_keys = tweet.get("attachments", {}).get("media_keys", [])
    media = []
    for mk in media_keys:
        m = media_map.get(mk, {})
        if m:
            media.append({
                "type": m.get("type", "photo"),
                "url": m.get("url") or m.get("preview_image_url", ""),
                "alt_text": m.get("alt_text", ""),
            })

    # Extract linked URLs
    linked_urls = extract_urls_from_tweet(tweet)

    # Check for quoted/replied tweets
    referenced = []
    for ref in tweet.get("referenced_tweets", []):
        ref_tweet = None
        for inc_tweet in includes.get("tweets", []):
            if inc_tweet["id"] == ref["id"]:
                ref_tweet = inc_tweet
                break
        referenced.append({
            "type": ref.get("type", ""),
            "id": ref["id"],
            "text": ref_tweet.get("text", "") if ref_tweet else "",
        })

    metrics = tweet.get("public_metrics", {})

    # Use note_tweet text if available (long-form tweets)
    text = tweet.get("text", "")
    note = tweet.get("note_tweet", {})
    if note and note.get("text"):
        text = note["text"]

    return {
        "tweet_id": tweet.get("id", tweet_id),
        "text": text,
        "created_at": tweet.get("created_at", ""),
        "author": {
            "username": author.get("username", ""),
            "name": author.get("name", ""),
            "bio": author.get("description", ""),
        },
        "metrics": {
            "replies": metrics.get("reply_count", 0),
            "retweets": metrics.get("retweet_count", 0),
            "likes": metrics.get("like_count", 0),
            "bookmarks": metrics.get("bookmark_count", 0),
            "views": metrics.get("impression_count", 0),
        },
        "media": media,
        "linked_urls": linked_urls,
        "referenced_tweets": referenced,
    }


# --- Main Scraping Logic ---

def scrape_url(url: str, crawl_links: bool = True, token: str = None) -> dict:
    """
    Scrape content from a URL. Handles both tweet URLs and external articles.

    For tweets: uses free oEmbed by default. If a bearer token is provided,
    uses X API v2 for richer data (metrics, media, referenced tweets).

    Returns a structured dict with all extracted content.
    """
    parsed = parse_x_url(url)
    result = {
        "source_url": url,
        "source_type": parsed["type"],
        "tweet": None,
        "articles": [],
    }

    if parsed["type"] == "tweet":
        # Check for optional API token (env or explicit)
        if not token:
            token = os.environ.get("X_API_BEARER_TOKEN", "")

        tweet_data = None
        if token:
            # Premium path: X API v2 (richer data)
            try:
                tweet_data = process_tweet(parsed["tweet_id"], token)
            except Exception as e:
                print(f"X API failed, falling back to free method: {e}", file=sys.stderr)

        if not tweet_data:
            # Free path: oEmbed (no API key needed)
            tweet_data = process_tweet_free(parsed["tweet_id"], parsed["username"], url)

        if not tweet_data:
            raise ValueError(f"Could not fetch tweet. It may be deleted or from a private account.")

        result["tweet"] = tweet_data

        # Crawl linked URLs within the tweet
        if crawl_links and tweet_data.get("linked_urls"):
            for link in tweet_data["linked_urls"]:
                article = scrape_article(link["url"])
                if article:
                    result["articles"].append(article)
    else:
        # External URL — just scrape it directly
        article = scrape_article(parsed["url"])
        if article:
            result["articles"].append(article)

    return result


def scrape_article(url: str) -> dict | None:
    """Fetch and extract content from an article URL."""
    resp = fetch_url(url)
    if resp["status"] != 200:
        return {
            "url": url,
            "status": resp["status"],
            "error": f"Failed to fetch: HTTP {resp['status']}",
            "title": "",
            "description": "",
            "markdown": "",
        }

    html = resp["body"]
    metadata = extract_metadata(html)
    markdown = html_to_markdown(html)

    # Truncate extremely long content (>50k chars)
    if len(markdown) > 50000:
        markdown = markdown[:50000] + "\n\n... [content truncated at 50,000 characters]"

    return {
        "url": resp["url"],
        "status": 200,
        "title": metadata["title"],
        "description": metadata["description"],
        "image": metadata["image"],
        "markdown": markdown,
    }


# --- Output Formatting ---

def format_as_markdown(data: dict) -> str:
    """Convert scraped data to a clean markdown document."""
    parts = []

    if data.get("tweet"):
        t = data["tweet"]
        parts.append(f"# Tweet by @{t['author']['username']}")
        parts.append(f"**{t['author']['name']}** (@{t['author']['username']})")
        if t["author"].get("bio"):
            parts.append(f"*{t['author']['bio']}*")
        parts.append("")
        parts.append(t["text"])
        parts.append("")

        # Metrics
        m = t["metrics"]
        metrics_line = " | ".join(filter(None, [
            f"{m['likes']} likes" if m['likes'] else None,
            f"{m['retweets']} retweets" if m['retweets'] else None,
            f"{m['replies']} replies" if m['replies'] else None,
            f"{m['views']} views" if m['views'] else None,
        ]))
        if metrics_line:
            parts.append(f"*{metrics_line}*")
            parts.append("")

        # Media
        for media in t.get("media", []):
            if media.get("url"):
                alt = media.get("alt_text", media["type"])
                parts.append(f"![{alt}]({media['url']})")
            parts.append("")

        # Referenced tweets
        for ref in t.get("referenced_tweets", []):
            if ref.get("text"):
                parts.append(f"> **{ref['type'].title()}:** {ref['text']}")
                parts.append("")

        parts.append(f"*Source: {data['source_url']}*")
        parts.append(f"*Scraped: {t['created_at']}*")
        parts.append("")

    # Articles
    for i, article in enumerate(data.get("articles", [])):
        if article.get("error"):
            parts.append(f"## Linked Article (failed to fetch)")
            parts.append(f"URL: {article['url']}")
            parts.append(f"Error: {article['error']}")
            parts.append("")
            continue

        if data.get("tweet"):
            parts.append(f"---")
            parts.append(f"## Linked Article: {article.get('title', 'Untitled')}")
        else:
            parts.append(f"# {article.get('title', 'Untitled')}")

        if article.get("description"):
            parts.append(f"*{article['description']}*")
        parts.append(f"Source: {article['url']}")
        parts.append("")
        parts.append(article.get("markdown", ""))
        parts.append("")

    return "\n".join(parts)


def main():
    parser = argparse.ArgumentParser(
        description="Scrape content from X/Twitter URLs or linked articles"
    )
    parser.add_argument("url", help="URL to scrape (tweet URL or article URL)")
    parser.add_argument(
        "--output", "-o",
        choices=["json", "markdown"],
        default="json",
        help="Output format (default: json)",
    )
    parser.add_argument(
        "--no-crawl",
        action="store_true",
        help="Don't crawl linked URLs within tweets",
    )
    parser.add_argument(
        "--save", "-s",
        help="Save output to file (path)",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print JSON output",
    )

    args = parser.parse_args()

    data = scrape_url(args.url, crawl_links=not args.no_crawl)

    if args.output == "markdown":
        output = format_as_markdown(data)
    else:
        indent = 2 if args.pretty else None
        output = json.dumps(data, indent=indent, ensure_ascii=False)

    if args.save:
        save_path = Path(args.save)
        save_path.parent.mkdir(parents=True, exist_ok=True)
        save_path.write_text(output, encoding="utf-8")
        print(f"Saved to {save_path}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()
