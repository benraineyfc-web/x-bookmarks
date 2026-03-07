"""
Bookmark Database — SQLite storage for imported X bookmarks.

Provides a simple interface to store, query, and manage bookmarks.
Uses Python's built-in sqlite3 — zero external dependencies.
"""

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

# Default DB path — overridden by DATA_DIR env var on Fly.io
DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).parent.parent / "data"))
DB_PATH = DATA_DIR / "bookmarks.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL DEFAULT '',
    author_username TEXT NOT NULL DEFAULT '',
    author_name TEXT NOT NULL DEFAULT '',
    created_at TEXT,
    url TEXT,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    bookmarks INTEGER DEFAULT 0,
    media_json TEXT DEFAULT '[]',
    scraped_json TEXT,
    imported_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_author ON bookmarks(author_username);
CREATE INDEX IF NOT EXISTS idx_bookmarks_imported ON bookmarks(imported_at);
"""


def _get_conn() -> sqlite3.Connection:
    """Get a database connection, creating the DB if needed."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(SCHEMA)
    return conn


def import_bookmarks(bookmarks: list[dict]) -> dict:
    """Import a list of normalized bookmark dicts. Returns import stats."""
    conn = _get_conn()
    now = datetime.now(timezone.utc).isoformat()
    added = 0
    skipped = 0

    for bm in bookmarks:
        try:
            conn.execute(
                """INSERT OR IGNORE INTO bookmarks
                   (id, text, author_username, author_name, created_at, url,
                    likes, retweets, views, replies, bookmarks, media_json, imported_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    bm["id"],
                    bm.get("text", ""),
                    bm.get("author_username", ""),
                    bm.get("author_name", ""),
                    bm.get("created_at", ""),
                    bm.get("url", ""),
                    bm.get("likes", 0),
                    bm.get("retweets", 0),
                    bm.get("views", 0),
                    bm.get("replies", 0),
                    bm.get("bookmarks", 0),
                    json.dumps(bm.get("media", [])),
                    now,
                ),
            )
            if conn.total_changes:
                added += 1
            else:
                skipped += 1
        except sqlite3.IntegrityError:
            skipped += 1

    conn.commit()
    conn.close()
    return {"added": added, "skipped": skipped, "total": len(bookmarks)}


def get_bookmarks(
    query: str = "",
    offset: int = 0,
    limit: int = 50,
    sort: str = "newest",
) -> dict:
    """Get bookmarks with optional search and pagination."""
    conn = _get_conn()

    where_clause = ""
    params: list = []

    if query:
        where_clause = "WHERE text LIKE ? OR author_username LIKE ? OR author_name LIKE ?"
        q = f"%{query}%"
        params = [q, q, q]

    order = "created_at DESC" if sort == "newest" else "created_at ASC"

    # Get total count
    count_sql = f"SELECT COUNT(*) FROM bookmarks {where_clause}"
    total = conn.execute(count_sql, params).fetchone()[0]

    # Get page
    sql = f"""SELECT id, text, author_username, author_name, created_at, url,
                     likes, retweets, views, replies, bookmarks, media_json,
                     scraped_json IS NOT NULL as is_scraped
              FROM bookmarks {where_clause}
              ORDER BY {order}
              LIMIT ? OFFSET ?"""
    rows = conn.execute(sql, params + [limit, offset]).fetchall()

    results = []
    for row in rows:
        results.append({
            "id": row["id"],
            "text": row["text"],
            "author_username": row["author_username"],
            "author_name": row["author_name"],
            "created_at": row["created_at"],
            "url": row["url"],
            "likes": row["likes"],
            "retweets": row["retweets"],
            "views": row["views"],
            "replies": row["replies"],
            "bookmarks": row["bookmarks"],
            "media": json.loads(row["media_json"] or "[]"),
            "is_scraped": bool(row["is_scraped"]),
        })

    conn.close()
    return {"bookmarks": results, "total": total, "offset": offset, "limit": limit}


def get_bookmark(tweet_id: str) -> dict | None:
    """Get a single bookmark by ID, including scraped data if available."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT * FROM bookmarks WHERE id = ?", (tweet_id,)
    ).fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row["id"],
        "text": row["text"],
        "author_username": row["author_username"],
        "author_name": row["author_name"],
        "created_at": row["created_at"],
        "url": row["url"],
        "likes": row["likes"],
        "retweets": row["retweets"],
        "views": row["views"],
        "replies": row["replies"],
        "bookmarks": row["bookmarks"],
        "media": json.loads(row["media_json"] or "[]"),
        "scraped_json": json.loads(row["scraped_json"]) if row["scraped_json"] else None,
    }


def save_scraped_data(tweet_id: str, scraped: dict):
    """Save scraped article/content data for a bookmark."""
    conn = _get_conn()
    conn.execute(
        "UPDATE bookmarks SET scraped_json = ? WHERE id = ?",
        (json.dumps(scraped, ensure_ascii=False), tweet_id),
    )
    conn.commit()
    conn.close()


def get_stats() -> dict:
    """Get dashboard stats."""
    conn = _get_conn()
    total = conn.execute("SELECT COUNT(*) FROM bookmarks").fetchone()[0]
    scraped = conn.execute(
        "SELECT COUNT(*) FROM bookmarks WHERE scraped_json IS NOT NULL"
    ).fetchone()[0]
    authors = conn.execute(
        "SELECT COUNT(DISTINCT author_username) FROM bookmarks"
    ).fetchone()[0]
    conn.close()
    return {"total": total, "scraped": scraped, "authors": authors}


def delete_all():
    """Delete all bookmarks. Use with caution."""
    conn = _get_conn()
    conn.execute("DELETE FROM bookmarks")
    conn.commit()
    conn.close()
