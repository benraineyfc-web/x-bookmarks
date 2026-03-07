"""
Bookmark Normalizer — convert various export formats to our standard schema.

Handles JSON from:
  - Twitter Web Exporter (Tampermonkey userscript)
  - bird CLI
  - X API v2 (our fetch_bookmarks_api.py)
  - Raw X data archive

All normalizers produce the same output format:
    {
        "id": "123456",
        "text": "tweet text...",
        "author_username": "handle",
        "author_name": "Display Name",
        "created_at": "2025-01-15T12:00:00Z",
        "url": "https://x.com/handle/status/123456",
        "likes": 500,
        "retweets": 100,
        "views": 50000,
        "replies": 25,
        "bookmarks": 10,
        "media": [{"type": "photo", "url": "..."}]
    }
"""

import json
import re
from pathlib import Path


def normalize(raw_data: list | dict) -> list[dict]:
    """Auto-detect format and normalize to standard schema."""
    # Handle wrapper objects (some exports wrap in {"data": [...]})
    if isinstance(raw_data, dict):
        # Twitter Web Exporter sometimes wraps in an object
        for key in ("data", "bookmarks", "tweets", "results"):
            if key in raw_data and isinstance(raw_data[key], list):
                raw_data = raw_data[key]
                break
        else:
            # Single tweet object
            raw_data = [raw_data]

    if not raw_data:
        return []

    # Detect format from first item
    sample = raw_data[0]
    detector = _detect_format(sample)

    normalizers = {
        "bird_cli": _normalize_bird,
        "web_exporter": _normalize_web_exporter,
        "api_v2": _normalize_api_v2,
        "graphql": _normalize_graphql,
        "generic": _normalize_generic,
    }

    func = normalizers.get(detector, _normalize_generic)
    results = []
    for item in raw_data:
        try:
            normalized = func(item)
            if normalized and normalized.get("id"):
                results.append(normalized)
        except Exception:
            continue

    return results


def _detect_format(sample: dict) -> str:
    """Detect which export format the data is in."""
    # bird CLI format: has "likeCount", "retweetCount", "bookmarkCount"
    if "likeCount" in sample and "retweetCount" in sample:
        return "bird_cli"

    # Twitter Web Exporter: has "rest_id" or nested "legacy" object
    if "rest_id" in sample or "legacy" in sample:
        return "web_exporter"

    # X API v2: has "public_metrics" and "author_id"
    if "public_metrics" in sample or "author_id" in sample:
        return "api_v2"

    # Raw GraphQL: has "tweet_results" or "result" wrapper
    if "tweet_results" in sample or ("result" in sample and "legacy" in sample.get("result", {})):
        return "graphql"

    return "generic"


def _normalize_bird(item: dict) -> dict:
    """Normalize bird CLI format."""
    author = item.get("author", {})
    return {
        "id": str(item.get("id", "")),
        "text": item.get("text", ""),
        "author_username": author.get("username", ""),
        "author_name": author.get("name", ""),
        "created_at": item.get("createdAt", ""),
        "url": f"https://x.com/{author.get('username', '_')}/status/{item.get('id', '')}",
        "likes": item.get("likeCount", 0),
        "retweets": item.get("retweetCount", 0),
        "views": item.get("viewCount", 0),
        "replies": item.get("replyCount", 0),
        "bookmarks": item.get("bookmarkCount", 0),
        "media": item.get("media", []),
    }


def _normalize_web_exporter(item: dict) -> dict:
    """Normalize Twitter Web Exporter (GraphQL intercept) format."""
    # The web exporter captures raw GraphQL responses
    # Structure: {rest_id, legacy: {full_text, ...}, core: {user_results: ...}}
    legacy = item.get("legacy", item)
    tweet_id = str(item.get("rest_id", item.get("id", item.get("id_str", ""))))

    # Author info — can be nested in different ways
    author_username = ""
    author_name = ""
    core = item.get("core", {})
    user_results = core.get("user_results", {}).get("result", {})
    if user_results:
        user_legacy = user_results.get("legacy", {})
        author_username = user_legacy.get("screen_name", "")
        author_name = user_legacy.get("name", "")
    elif "user" in item:
        author_username = item["user"].get("screen_name", item["user"].get("username", ""))
        author_name = item["user"].get("name", "")

    # Metrics
    metrics = legacy.get("public_metrics", {})
    if not metrics:
        # Try individual fields from legacy
        metrics = {
            "favorite_count": legacy.get("favorite_count", 0),
            "retweet_count": legacy.get("retweet_count", 0),
            "reply_count": legacy.get("reply_count", 0),
            "bookmark_count": legacy.get("bookmark_count", 0),
        }

    # Media
    media = []
    entities = legacy.get("extended_entities", legacy.get("entities", {}))
    for m in entities.get("media", []):
        media.append({
            "type": m.get("type", "photo"),
            "url": m.get("media_url_https", m.get("url", "")),
        })

    return {
        "id": tweet_id,
        "text": legacy.get("full_text", legacy.get("text", "")),
        "author_username": author_username,
        "author_name": author_name,
        "created_at": legacy.get("created_at", ""),
        "url": f"https://x.com/{author_username}/status/{tweet_id}" if author_username else "",
        "likes": metrics.get("favorite_count", metrics.get("like_count", 0)),
        "retweets": metrics.get("retweet_count", 0),
        "views": item.get("views", {}).get("count", 0) if isinstance(item.get("views"), dict) else 0,
        "replies": metrics.get("reply_count", 0),
        "bookmarks": metrics.get("bookmark_count", 0),
        "media": media,
    }


def _normalize_api_v2(item: dict) -> dict:
    """Normalize X API v2 format."""
    metrics = item.get("public_metrics", {})
    author_id = item.get("author_id", "")

    # If includes are flattened (our fetch_bookmarks_api already normalizes)
    author = item.get("author", {})

    return {
        "id": str(item.get("id", "")),
        "text": item.get("text", ""),
        "author_username": author.get("username", ""),
        "author_name": author.get("name", ""),
        "created_at": item.get("created_at", ""),
        "url": f"https://x.com/{author.get('username', '_')}/status/{item.get('id', '')}",
        "likes": metrics.get("like_count", item.get("likeCount", 0)),
        "retweets": metrics.get("retweet_count", item.get("retweetCount", 0)),
        "views": metrics.get("impression_count", item.get("viewCount", 0)),
        "replies": metrics.get("reply_count", item.get("replyCount", 0)),
        "bookmarks": metrics.get("bookmark_count", item.get("bookmarkCount", 0)),
        "media": item.get("media", []),
    }


def _normalize_graphql(item: dict) -> dict:
    """Normalize raw GraphQL wrapper format."""
    # Unwrap tweet_results.result or result
    tweet = item.get("tweet_results", {}).get("result", item.get("result", item))
    return _normalize_web_exporter(tweet)


def _normalize_generic(item: dict) -> dict:
    """Best-effort normalization for unknown formats."""
    # Try to find an ID
    tweet_id = str(
        item.get("id", item.get("rest_id", item.get("id_str", item.get("tweet_id", ""))))
    )

    # Try to find text
    text = item.get("text", item.get("full_text", item.get("content", "")))

    # Try to find author
    author = item.get("author", item.get("user", {}))
    if isinstance(author, str):
        author = {"username": author}

    username = author.get("username", author.get("screen_name", ""))
    name = author.get("name", author.get("display_name", ""))

    # Try to find URL
    url = item.get("url", item.get("tweet_url", ""))
    if not url and username and tweet_id:
        url = f"https://x.com/{username}/status/{tweet_id}"

    return {
        "id": tweet_id,
        "text": text,
        "author_username": username,
        "author_name": name,
        "created_at": item.get("created_at", item.get("createdAt", item.get("date", ""))),
        "url": url,
        "likes": _get_metric(item, "likes", "like_count", "favorite_count", "likeCount"),
        "retweets": _get_metric(item, "retweets", "retweet_count", "retweetCount"),
        "views": _get_metric(item, "views", "view_count", "impression_count", "viewCount"),
        "replies": _get_metric(item, "replies", "reply_count", "replyCount"),
        "bookmarks": _get_metric(item, "bookmarks", "bookmark_count", "bookmarkCount"),
        "media": item.get("media", []),
    }


def _get_metric(item: dict, *keys) -> int:
    """Try multiple keys to find a metric value."""
    for key in keys:
        val = item.get(key)
        if val is not None:
            try:
                return int(val)
            except (ValueError, TypeError):
                continue
    # Check nested metrics
    metrics = item.get("public_metrics", item.get("metrics", {}))
    if metrics:
        for key in keys:
            val = metrics.get(key)
            if val is not None:
                try:
                    return int(val)
                except (ValueError, TypeError):
                    continue
    return 0
