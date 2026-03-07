/**
 * Vercel Serverless Function: Scrape article metadata from URLs.
 * POST /api/scrape { urls: ["https://..."] }
 * Returns: { articles: [{ url, title, description, text }] }
 */

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { urls } = req.body || {};
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: "Provide urls array" });
  }

  // Limit to 5 URLs per request to stay within serverless timeout
  const toScrape = urls.slice(0, 5);
  const articles = [];

  for (const url of toScrape) {
    try {
      const article = await scrapeUrl(url);
      if (article) articles.push(article);
    } catch {
      articles.push({ url, title: "", description: "", text: "", error: true });
    }
  }

  return res.status(200).json({ articles });
}

async function scrapeUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BookmarkBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      return { url, title: "", description: "", text: "" };
    }

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return { url, title: url, description: "Non-HTML content", text: "" };
    }

    const html = await resp.text();

    // Extract metadata from HTML
    const title = extractMeta(html, [
      /<title[^>]*>([^<]+)<\/title>/i,
      /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i,
      /<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i,
      /<meta[^>]+name="twitter:title"[^>]+content="([^"]+)"/i,
    ]);

    const description = extractMeta(html, [
      /<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i,
      /<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i,
      /<meta[^>]+name="description"[^>]+content="([^"]+)"/i,
      /<meta[^>]+content="([^"]+)"[^>]+name="description"/i,
      /<meta[^>]+name="twitter:description"[^>]+content="([^"]+)"/i,
    ]);

    // Extract readable text from HTML body
    const text = extractText(html).slice(0, 3000);

    return {
      url,
      title: decodeEntities(title || ""),
      description: decodeEntities(description || ""),
      text,
    };
  } catch {
    clearTimeout(timeout);
    return { url, title: "", description: "", text: "" };
  }
}

function extractMeta(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return "";
}

function extractText(html) {
  // Remove script, style, nav, header, footer tags
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ");

  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode entities and clean up
  text = decodeEntities(text);
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
