import { db } from "./db";

/**
 * Extract URLs from tweet text.
 */
function extractUrls(text) {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s)\]"']+/g;
  const matches = text.match(urlRegex) || [];
  // Filter out t.co tracking links that just point back to twitter
  return matches.filter((url) => {
    const lower = url.toLowerCase();
    return (
      !lower.includes("twitter.com") &&
      !lower.includes("x.com") &&
      !lower.includes("/status/")
    );
  });
}

/**
 * Scrape articles for a batch of bookmarks using the Vercel API function.
 * Updates IndexedDB directly. Returns { scraped, failed, remaining }.
 */
export async function scrapeBookmarkBatch(limit = 10) {
  // Get bookmarks that haven't been scraped yet and have URLs in their text
  const all = await db.bookmarks.toArray();
  const unscraped = all.filter(
    (bm) =>
      (!bm.scraped_json || Object.keys(bm.scraped_json).length === 0) &&
      extractUrls(bm.text).length > 0
  );

  const batch = unscraped.slice(0, limit);
  let scraped = 0;
  let failed = 0;

  // Process in chunks of 5 (API limit per request)
  for (let i = 0; i < batch.length; i += 5) {
    const chunk = batch.slice(i, i + 5);
    const urlMap = {};

    // Collect all URLs for this chunk
    for (const bm of chunk) {
      const urls = extractUrls(bm.text);
      if (urls.length > 0) {
        urlMap[bm.id] = urls.slice(0, 2); // Max 2 URLs per bookmark
      }
    }

    // Flatten all unique URLs
    const allUrls = [...new Set(Object.values(urlMap).flat())];

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: allUrls }),
      });

      if (!res.ok) throw new Error("Scrape API failed");
      const data = await res.json();

      // Build URL -> article lookup
      const articlesByUrl = {};
      for (const article of data.articles || []) {
        if (article.url) {
          articlesByUrl[article.url] = article;
        }
      }

      // Update each bookmark with its scraped articles
      for (const bm of chunk) {
        const bmUrls = urlMap[bm.id] || [];
        const articles = bmUrls
          .map((url) => articlesByUrl[url])
          .filter((a) => a && (a.title || a.description || a.text));

        if (articles.length > 0) {
          await db.bookmarks.update(bm.id, {
            scraped_json: {
              articles: articles.map((a) => ({
                url: a.url,
                title: a.title,
                description: a.description,
                markdown: a.text || "",
              })),
            },
          });
          scraped++;
        } else {
          // Mark as attempted so we don't retry
          await db.bookmarks.update(bm.id, {
            scraped_json: { articles: [], attempted: true },
          });
          failed++;
        }
      }
    } catch {
      failed += chunk.length;
    }
  }

  const remaining = unscraped.length - batch.length;
  return { scraped, failed, remaining };
}
