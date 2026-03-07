import Dexie from "dexie";

export const db = new Dexie("xBookmarks");

db.version(1).stores({
  bookmarks:
    "id, author_username, created_at, *tags, importedAt",
  tags: "++id, &name, color",
  collections: "++id, name, createdAt",
  collectionItems: "++id, collectionId, bookmarkId",
});

db.version(2).stores({
  bookmarks:
    "id, author_username, created_at, *tags, *categories, importedAt, favorite",
  tags: "++id, &name, color",
  collections: "++id, name, createdAt",
  collectionItems: "++id, collectionId, bookmarkId",
}).upgrade((tx) => {
  return tx.table("bookmarks").toCollection().modify((bm) => {
    if (!bm.categories) bm.categories = [];
    if (bm.favorite === undefined) bm.favorite = false;
    if (!bm.actionItems) bm.actionItems = [];
  });
});

/**
 * Import normalized bookmarks into IndexedDB.
 * Skips duplicates by ID. Returns { added, skipped }.
 */
export async function importBookmarks(normalizedBookmarks, autoTags = []) {
  // Lazy import to avoid circular dependency
  const { categorizeBookmark, extractActionItems } = await import("./categorize.js");

  let added = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  await db.transaction("rw", db.bookmarks, async () => {
    for (const bm of normalizedBookmarks) {
      const exists = await db.bookmarks.get(bm.id);
      if (exists) {
        skipped++;
        continue;
      }
      const categories = categorizeBookmark(bm);
      const actionItems = extractActionItems(bm);
      await db.bookmarks.put({
        ...bm,
        tags: autoTags,
        categories,
        actionItems,
        favorite: false,
        importedAt: now,
        notes: "",
      });
      added++;
    }
  });

  return { added, skipped };
}

/**
 * Re-categorize all existing bookmarks (useful after import or when categories are updated)
 */
export async function recategorizeAll() {
  const { categorizeBookmark, extractActionItems } = await import("./categorize.js");
  const all = await db.bookmarks.toArray();
  let updated = 0;

  await db.transaction("rw", db.bookmarks, async () => {
    for (const bm of all) {
      const categories = categorizeBookmark(bm);
      const actionItems = extractActionItems(bm);
      await db.bookmarks.update(bm.id, { categories, actionItems });
      updated++;
    }
  });

  return updated;
}

/**
 * Normalize raw JSON from various X export formats.
 * Mirrors the Python normalizer logic from scripts/bookmark_normalizer.py
 */
export function normalize(rawData) {
  // Handle wrapper objects
  if (rawData && !Array.isArray(rawData)) {
    for (const key of ["data", "bookmarks", "tweets", "results"]) {
      if (Array.isArray(rawData[key])) {
        rawData = rawData[key];
        break;
      }
    }
    if (!Array.isArray(rawData)) {
      rawData = [rawData];
    }
  }

  if (!rawData || rawData.length === 0) return [];

  const sample = rawData[0];
  const format = detectFormat(sample);

  const normalizers = {
    bird_cli: normalizeBird,
    web_exporter: normalizeWebExporter,
    api_v2: normalizeApiV2,
    graphql: normalizeGraphQL,
    generic: normalizeGeneric,
  };

  const fn = normalizers[format] || normalizeGeneric;
  const results = [];

  for (const item of rawData) {
    try {
      const normalized = fn(item);
      if (normalized && normalized.id) {
        results.push(normalized);
      }
    } catch {
      continue;
    }
  }

  return results;
}

/** Extract external URLs from entities (filtering out x.com/twitter.com links) */
function extractUrls(entities) {
  if (!entities) return [];
  const urlList = entities.urls || entities.url?.urls || [];
  return urlList
    .filter((u) => {
      const expanded = u.expanded_url || u.url || "";
      return expanded && !expanded.includes("twitter.com/") && !expanded.includes("x.com/");
    })
    .map((u) => ({
      url: u.expanded_url || u.url || "",
      display_url: u.display_url || "",
      title: u.title || "",
      description: u.description || "",
      thumbnail: u.images?.[0]?.url || u.thumbnail || "",
    }));
}

function detectFormat(sample) {
  if (sample.likeCount !== undefined && sample.retweetCount !== undefined)
    return "bird_cli";
  if (sample.rest_id !== undefined || sample.legacy !== undefined)
    return "web_exporter";
  if (sample.public_metrics !== undefined || sample.author_id !== undefined)
    return "api_v2";
  if (
    sample.tweet_results !== undefined ||
    (sample.result && sample.result.legacy)
  )
    return "graphql";
  return "generic";
}

function normalizeBird(item) {
  const author = item.author || {};
  // Extract quoted tweet if present
  let quoteTweet = null;
  if (item.quoted_tweet || item.quotedTweet) {
    const qt = item.quoted_tweet || item.quotedTweet;
    const qtAuthor = qt.author || {};
    quoteTweet = {
      text: qt.text || "",
      author_username: qtAuthor.username || "",
      author_name: qtAuthor.name || "",
      media: qt.media || [],
    };
  }
  // Extract URLs from entities
  const urls = extractUrls(item.entities || item);
  return {
    id: String(item.id || ""),
    text: item.text || "",
    author_username: author.username || "",
    author_name: author.name || "",
    created_at: item.createdAt || "",
    url: `https://x.com/${author.username || "_"}/status/${item.id || ""}`,
    likes: item.likeCount || 0,
    retweets: item.retweetCount || 0,
    views: item.viewCount || 0,
    replies: item.replyCount || 0,
    bookmarks: item.bookmarkCount || 0,
    media: item.media || [],
    quoteTweet,
    urls,
  };
}

function normalizeWebExporter(item) {
  const legacy = item.legacy || item;
  const tweetId = String(
    item.rest_id || item.id || item.id_str || ""
  );

  let authorUsername = "";
  let authorName = "";
  const core = item.core || {};
  const userResults = (core.user_results || {}).result || {};
  if (userResults.legacy) {
    authorUsername = userResults.legacy.screen_name || "";
    authorName = userResults.legacy.name || "";
  } else if (item.user) {
    authorUsername =
      item.user.screen_name || item.user.username || "";
    authorName = item.user.name || "";
  }

  let metrics = legacy.public_metrics || {};
  if (!Object.keys(metrics).length) {
    metrics = {
      favorite_count: legacy.favorite_count || 0,
      retweet_count: legacy.retweet_count || 0,
      reply_count: legacy.reply_count || 0,
      bookmark_count: legacy.bookmark_count || 0,
    };
  }

  const entities =
    legacy.extended_entities || legacy.entities || {};
  const media = (entities.media || []).map((m) => ({
    type: m.type || "photo",
    url: m.media_url_https || m.url || "",
    preview_image_url: m.preview_image_url || "",
  }));

  // Extract URLs (link cards)
  const legacyEntities = legacy.entities || {};
  const urls = (legacyEntities.urls || [])
    .filter((u) => u.expanded_url && !u.expanded_url.includes("twitter.com/") && !u.expanded_url.includes("x.com/"))
    .map((u) => ({
      url: u.expanded_url || u.url || "",
      display_url: u.display_url || "",
      title: u.title || "",
      description: u.description || "",
      thumbnail: u.images?.[0]?.url || "",
    }));

  // Extract quoted tweet
  let quoteTweet = null;
  const qtResult = item.quoted_status_result?.result || item.quotedRefResult?.result;
  if (qtResult) {
    const qtLegacy = qtResult.legacy || {};
    const qtCore = qtResult.core || {};
    const qtUser = (qtCore.user_results || {}).result?.legacy || {};
    const qtEntities = qtLegacy.extended_entities || qtLegacy.entities || {};
    const qtMedia = (qtEntities.media || []).map((m) => ({
      type: m.type || "photo",
      url: m.media_url_https || m.url || "",
    }));
    quoteTweet = {
      text: qtLegacy.full_text || qtLegacy.text || "",
      author_username: qtUser.screen_name || "",
      author_name: qtUser.name || "",
      media: qtMedia,
    };
  }

  return {
    id: tweetId,
    text: legacy.full_text || legacy.text || "",
    author_username: authorUsername,
    author_name: authorName,
    created_at: legacy.created_at || "",
    url: authorUsername
      ? `https://x.com/${authorUsername}/status/${tweetId}`
      : "",
    likes:
      metrics.favorite_count || metrics.like_count || 0,
    retweets: metrics.retweet_count || 0,
    views:
      typeof item.views === "object"
        ? item.views.count || 0
        : 0,
    replies: metrics.reply_count || 0,
    bookmarks: metrics.bookmark_count || 0,
    media,
    quoteTweet,
    urls,
  };
}

function normalizeApiV2(item) {
  const metrics = item.public_metrics || {};
  const author = item.author || {};
  const urls = extractUrls(item.entities || {});
  let quoteTweet = null;
  if (item.referenced_tweets) {
    const qt = item.referenced_tweets.find((r) => r.type === "quoted");
    if (qt?.data) {
      const qtAuthor = qt.data.author || {};
      quoteTweet = { text: qt.data.text || "", author_username: qtAuthor.username || "", author_name: qtAuthor.name || "", media: qt.data.media || [] };
    }
  }
  return {
    id: String(item.id || ""),
    text: item.text || "",
    author_username: author.username || "",
    author_name: author.name || "",
    created_at: item.created_at || "",
    url: `https://x.com/${author.username || "_"}/status/${item.id || ""}`,
    likes: metrics.like_count || item.likeCount || 0,
    retweets: metrics.retweet_count || item.retweetCount || 0,
    views: metrics.impression_count || item.viewCount || 0,
    replies: metrics.reply_count || item.replyCount || 0,
    bookmarks: metrics.bookmark_count || item.bookmarkCount || 0,
    media: item.media || [],
    quoteTweet,
    urls,
  };
}

function normalizeGraphQL(item) {
  const tweet =
    (item.tweet_results || {}).result || item.result || item;
  return normalizeWebExporter(tweet);
}

function normalizeGeneric(item) {
  const tweetId = String(
    item.id || item.rest_id || item.id_str || item.tweet_id || ""
  );
  const text = item.text || item.full_text || item.content || "";

  let author = item.author || item.user || {};
  if (typeof author === "string") author = { username: author };

  const username = author.username || author.screen_name || "";
  const name = author.name || author.display_name || "";

  let url = item.url || item.tweet_url || "";
  if (!url && username && tweetId) {
    url = `https://x.com/${username}/status/${tweetId}`;
  }

  const getMetric = (...keys) => {
    for (const k of keys) {
      if (item[k] != null) return Number(item[k]) || 0;
    }
    const m = item.public_metrics || item.metrics || {};
    for (const k of keys) {
      if (m[k] != null) return Number(m[k]) || 0;
    }
    return 0;
  };

  const urls = extractUrls(item.entities || {});
  let quoteTweet = null;
  if (item.quoted_tweet || item.quotedTweet) {
    const qt = item.quoted_tweet || item.quotedTweet;
    const qtAuthor = qt.author || qt.user || {};
    quoteTweet = { text: qt.text || "", author_username: qtAuthor.username || qtAuthor.screen_name || "", author_name: qtAuthor.name || "", media: qt.media || [] };
  }

  return {
    id: tweetId,
    text,
    author_username: username,
    author_name: name,
    created_at:
      item.created_at || item.createdAt || item.date || "",
    url,
    likes: getMetric("likes", "like_count", "favorite_count", "likeCount"),
    retweets: getMetric("retweets", "retweet_count", "retweetCount"),
    views: getMetric("views", "view_count", "impression_count", "viewCount"),
    replies: getMetric("replies", "reply_count", "replyCount"),
    bookmarks: getMetric("bookmarks", "bookmark_count", "bookmarkCount"),
    media: item.media || [],
    quoteTweet,
    urls,
  };
}
