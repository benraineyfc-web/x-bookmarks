import Dexie from "dexie";

export const db = new Dexie("xBookmarks");

/**
 * Delete all bookmarks and start fresh.
 */
export async function deleteAllBookmarks() {
  await db.bookmarks.clear();
}

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

// v3: ensure media/quoteTweet/urls fields exist on all bookmarks
db.version(3).stores({
  bookmarks:
    "id, author_username, created_at, *tags, *categories, importedAt, favorite",
  tags: "++id, &name, color",
  collections: "++id, name, createdAt",
  collectionItems: "++id, collectionId, bookmarkId",
}).upgrade((tx) => {
  return tx.table("bookmarks").toCollection().modify((bm) => {
    if (!bm.media) bm.media = [];
    if (!bm.urls) bm.urls = [];
    if (bm.quoteTweet === undefined) bm.quoteTweet = null;
  });
});

/**
 * Import normalized bookmarks into IndexedDB.
 * If updateExisting is true, updates media/urls/quoteTweet on existing bookmarks.
 * Returns { added, skipped, updated }.
 */
export async function importBookmarks(normalizedBookmarks, autoTags = [], { updateExisting = false } = {}) {
  const { categorizeBookmark, extractActionItems } = await import("./categorize.js");

  let added = 0;
  let skipped = 0;
  let updated = 0;
  const now = new Date().toISOString();

  await db.transaction("rw", db.bookmarks, async () => {
    for (const bm of normalizedBookmarks) {
      const exists = await db.bookmarks.get(bm.id);
      if (exists) {
        if (updateExisting) {
          // Always overwrite with new data when it has values
          const updates = {};
          const hasValidNewMedia = bm.media && bm.media.some(m => m.url && m.url.startsWith('http'));
          if (hasValidNewMedia) {
            updates.media = bm.media;
          }
          if (bm.urls && bm.urls.length > 0) {
            updates.urls = bm.urls;
          }
          if (bm.quoteTweet) {
            updates.quoteTweet = bm.quoteTweet;
          }
          // Always update author info when new data has it
          if (bm.author_name) updates.author_name = bm.author_name;
          if (bm.author_username) updates.author_username = bm.author_username;
          // Update URL if new one is better (has actual username)
          if (bm.url && bm.author_username && (!exists.url || exists.url.includes("/_/"))) {
            updates.url = bm.url;
          }
          if (Object.keys(updates).length > 0) {
            await db.bookmarks.update(bm.id, updates);
            updated++;
          } else {
            skipped++;
          }
        } else {
          skipped++;
        }
        continue;
      }
      const categories = categorizeBookmark(bm);
      const actionItems = extractActionItems(bm);
      await db.bookmarks.put({
        ...bm,
        tags: autoTags.length > 0 ? autoTags : (bm.tags || []),
        categories,
        actionItems,
        favorite: false,
        importedAt: now,
        notes: "",
      });
      added++;
    }
  });

  // Auto-recategorize when updating existing bookmarks to apply latest category rules
  if (updateExisting && updated > 0) {
    await recategorizeAll();
  }

  return { added, skipped, updated };
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
    tampermonkey: normalizeTampermonkey,
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

/**
 * Extract media from Twitter entities, handling photos, videos, and animated GIFs.
 * For videos: extracts best quality video URL from video_info.variants
 * For photos: uses media_url_https
 */
function extractMedia(entities) {
  if (!entities) return [];
  const mediaList = entities.media || [];
  return mediaList.map((m) => {
    const type = m.type || "photo";
    // Prefer media_url_https over url (which is often a t.co shortlink)
    const mediaUrl = m.media_url_https || m.media_url || m.original || "";
    const result = {
      type,
      url: mediaUrl || m.url || "",
      preview_image_url: mediaUrl || m.preview_image_url || m.thumbnail || "",
      alt_text: m.ext_alt_text || m.alt_text || "",
    };

    // For videos and animated GIFs, extract the actual video URL
    if ((type === "video" || type === "animated_gif") && m.video_info) {
      const variants = m.video_info.variants || [];
      // Filter to mp4 variants and pick highest bitrate
      const mp4Variants = variants.filter((v) => v.content_type === "video/mp4");
      if (mp4Variants.length > 0) {
        mp4Variants.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        result.video_url = mp4Variants[0].url;
      } else if (variants.length > 0) {
        // Fallback to any variant
        result.video_url = variants[0].url;
      }
      // preview_image_url is the poster/thumbnail for videos
      result.preview_image_url = mediaUrl || "";
    }

    return result;
  });
}

function detectFormat(sample) {
  if (sample.likeCount !== undefined && sample.retweetCount !== undefined)
    return "bird_cli";
  // Tampermonkey / flattened format: top-level screen_name + favorite_count
  if (sample.screen_name !== undefined && sample.favorite_count !== undefined)
    return "tampermonkey";
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
  // bird CLI may have media as array of objects or urls
  let media = [];
  if (item.media && item.media.length > 0) {
    media = item.media.map((m) => {
      if (typeof m === "string") return { type: "photo", url: m, preview_image_url: m };
      const type = m.type || "photo";
      return {
        type,
        url: (type === "photo") ? (m.original || m.url || m.media_url_https || "") : (m.thumbnail || m.url || m.media_url_https || ""),
        preview_image_url: m.preview_image_url || m.media_url_https || m.thumbnail || m.url || "",
        video_url: m.video_url || ((type === "video" || type === "animated_gif") ? m.original : "") || "",
        alt_text: m.alt_text || "",
      };
    });
  }
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
    media,
    quoteTweet,
    urls,
  };
}

/**
 * Normalize flattened Tampermonkey export format.
 * Has top-level: screen_name, name, full_text, media[], favorite_count, quoted_status, url, etc.
 */
function normalizeTampermonkey(item) {
  const tweetId = String(item.id || item.id_str || "");
  const authorUsername = item.screen_name || "";
  const authorName = item.name || authorUsername || "";

  // Media: array of objects with media_url_https, type, video_info, ext_alt_text
  let media = [];
  if (item.media && Array.isArray(item.media) && item.media.length > 0) {
    media = item.media.map((m) => {
      if (typeof m === "string") return { type: "photo", url: m, preview_image_url: m };
      const type = m.type || "photo";
      // Support multiple field naming conventions:
      // - media_url_https / media_url: Twitter API standard
      // - thumbnail: some export tools use this for poster images
      // - original: some export tools use this for full-size media / video URLs
      const result = {
        type,
        url: (type === "photo") ? (m.original || m.media_url_https || m.media_url || m.url || "") : (m.media_url_https || m.media_url || m.thumbnail || m.url || ""),
        preview_image_url: m.media_url_https || m.media_url || m.preview_image_url || m.thumbnail || "",
        alt_text: m.ext_alt_text || m.alt_text || "",
      };
      // Extract video URL from video_info or original field
      if (type === "video" || type === "animated_gif") {
        if (m.video_info) {
          const variants = m.video_info.variants || [];
          const mp4s = variants.filter((v) => v.content_type === "video/mp4");
          if (mp4s.length > 0) {
            mp4s.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
            result.video_url = mp4s[0].url;
          } else if (variants.length > 0) {
            result.video_url = variants[0].url;
          }
        }
        // "original" field often has the direct video URL
        if (!result.video_url && m.original) {
          result.video_url = m.original;
        }
        result.preview_image_url = m.media_url_https || m.media_url || m.thumbnail || "";
      }
      return result;
    });
  }

  // Quoted tweet from quoted_status
  let quoteTweet = null;
  if (item.quoted_status) {
    const qs = item.quoted_status;
    let qsMedia = [];
    if (qs.media && Array.isArray(qs.media)) {
      qsMedia = qs.media.map((m) => ({
        type: m.type || "photo",
        url: m.original || m.media_url_https || m.media_url || m.url || "",
        preview_image_url: m.media_url_https || m.media_url || m.thumbnail || "",
        alt_text: m.ext_alt_text || m.alt_text || "",
      }));
    }
    quoteTweet = {
      text: qs.full_text || qs.text || "",
      author_username: qs.screen_name || "",
      author_name: qs.name || qs.screen_name || "",
      media: qsMedia,
    };
  }

  // URLs from entities or metadata
  let urls = [];
  if (item.entities?.urls) {
    urls = extractUrls(item.entities);
  } else if (item.metadata?.urls) {
    urls = extractUrls(item.metadata);
  }

  const tweetUrl = item.url || (authorUsername ? `https://x.com/${authorUsername}/status/${tweetId}` : "");

  return {
    id: tweetId,
    text: item.full_text || item.text || "",
    author_username: authorUsername,
    author_name: authorName,
    created_at: item.created_at || "",
    url: tweetUrl,
    likes: item.favorite_count || 0,
    retweets: item.retweet_count || 0,
    views: item.views_count || 0,
    replies: item.reply_count || 0,
    bookmarks: item.bookmark_count || 0,
    media,
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

  // Use extractMedia for proper video handling
  const entities = legacy.extended_entities || legacy.entities || {};
  const media = extractMedia(entities);

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
    const qtMedia = extractMedia(qtEntities);
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
  // API v2 media comes from includes.media matched by media_keys
  let media = [];
  if (item.attachments?.media_keys && item._includes_media) {
    media = item.attachments.media_keys.map((key) => {
      const m = item._includes_media.find((inc) => inc.media_key === key);
      if (!m) return null;
      return {
        type: m.type || "photo",
        url: m.url || m.preview_image_url || "",
        preview_image_url: m.preview_image_url || m.url || "",
        video_url: m.variants?.find((v) => v.content_type === "video/mp4")?.url || "",
        alt_text: m.alt_text || "",
      };
    }).filter(Boolean);
  } else if (item.media && Array.isArray(item.media)) {
    media = item.media.map((m) => ({
      type: m.type || "photo",
      url: m.url || m.preview_image_url || "",
      preview_image_url: m.preview_image_url || m.url || "",
      video_url: m.video_url || "",
      alt_text: m.alt_text || "",
    }));
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
    media,
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

  const username = author.username || author.screen_name || item.screen_name || "";
  const name = author.name || author.display_name || item.name || "";

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

  // Generic media extraction
  let media = [];
  if (item.media && Array.isArray(item.media)) {
    media = item.media.map((m) => {
      if (typeof m === "string") return { type: "photo", url: m, preview_image_url: m };
      const type = m.type || "photo";
      return {
        type,
        url: m.original || m.url || m.media_url_https || "",
        preview_image_url: m.preview_image_url || m.media_url_https || m.thumbnail || m.url || "",
        video_url: m.video_url || ((type === "video" || type === "animated_gif") ? m.original : "") || "",
        alt_text: m.alt_text || "",
      };
    });
  } else if (item.entities || item.extended_entities) {
    media = extractMedia(item.extended_entities || item.entities || {});
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
    media,
    quoteTweet,
    urls,
  };
}
