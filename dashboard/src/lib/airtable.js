/**
 * airtable.js — Fetch bookmarks from the X Vault Airtable base
 * and return them in the normalized format expected by db.js importBookmarks().
 */

const BASE_ID = 'app2V0VDhr8zt4xul';

async function fetchAllRecords(apiKey, tableName, fields, onProgress) {
  const records = [];
  let offset = null;
  const encodedTable = encodeURIComponent(tableName);
  const fieldQS = fields.map(f => `fields[]=${encodeURIComponent(f)}`).join('&');

  do {
    let url = `https://api.airtable.com/v0/${BASE_ID}/${encodedTable}?pageSize=100&${fieldQS}`;
    if (offset) url += `&offset=${offset}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Airtable error ${res.status}`);
    }

    const data = await res.json();
    records.push(...(data.records || []));
    offset = data.offset || null;

    if (onProgress) onProgress(records.length);

    // Respect rate limits
    if (offset) await new Promise(r => setTimeout(r, 200));
  } while (offset);

  return records;
}

/**
 * Map a Bookmarks table record to normalized dashboard format.
 */
function mapBookmark(rec) {
  const f = rec.fields || {};
  const handle = (f['Author Handle'] || '').replace(/^@/, '');
  const id = f['Tweet ID'] || rec.id;
  return {
    id: String(id),
    text: f['Full Text'] || f['Tweet Text'] || '',
    author_username: handle,
    author_name: f['Author Name'] || handle,
    created_at: f['Created At'] || '',
    url: f['Tweet URL'] || (handle ? `https://x.com/${handle}/status/${id}` : ''),
    likes: f['Likes'] || 0,
    retweets: f['Retweets'] || 0,
    replies: f['Replies'] || 0,
    views: f['Views'] || 0,
    bookmarks: 0,
    media: [],
    quoteTweet: null,
    urls: f['External URLs']
      ? f['External URLs'].split('\n').filter(Boolean).map(u => ({ url: u, display_url: u, title: '', description: '', thumbnail: '' }))
      : [],
    _source: 'airtable_bookmarks',
  };
}

/**
 * Map an X Articles table record to normalized dashboard format.
 */
function mapArticle(rec) {
  const f = rec.fields || {};
  const handle = (f['Author Handle'] || '').replace(/^@/, '');
  const id = f['Tweet ID'] || rec.id;
  return {
    id: String(id),
    text: f['Tweet Text'] || '',
    author_username: handle,
    author_name: f['Author Name'] || handle,
    created_at: f['Created At'] || '',
    url: f['Tweet URL'] || (handle ? `https://x.com/${handle}/status/${id}` : ''),
    likes: f['Likes'] || 0,
    retweets: f['Retweets'] || 0,
    replies: f['Replies'] || 0,
    views: f['Views'] || 0,
    bookmarks: 0,
    media: [],
    quoteTweet: null,
    urls: f['Article URL']
      ? [{ url: f['Article URL'], display_url: f['Article URL'], title: f['Article Title'] || '', description: f['Preview Text'] || '', thumbnail: '' }]
      : [],
    _airtable_title: f['Article Title'] || '',
    _airtable_preview: f['Preview Text'] || '',
    _source: 'airtable_articles',
  };
}

/**
 * Sync all X Vault records from Airtable.
 * Returns { bookmarks: [], articles: [], total: N }
 * onProgress(fetched, total) called as records load.
 */
export async function syncFromAirtable(apiKey, onProgress) {
  const BOOKMARK_FIELDS = ['Tweet ID', 'Author Handle', 'Author Name', 'Content Type', 'Tweet Text', 'Full Text', 'External URLs', 'Tweet URL', 'Likes', 'Retweets', 'Replies', 'Views', 'Created At'];
  const ARTICLE_FIELDS = ['Tweet ID', 'Author Handle', 'Author Name', 'Article Title', 'Preview Text', 'Tweet URL', 'Article URL', 'Likes', 'Retweets', 'Replies', 'Views', 'Created At', 'Tweet Text'];

  let bookmarkCount = 0;
  let articleCount = 0;

  const [bookmarkRecs, articleRecs] = await Promise.all([
    fetchAllRecords(apiKey, 'Bookmarks', BOOKMARK_FIELDS, (n) => {
      bookmarkCount = n;
      if (onProgress) onProgress(bookmarkCount + articleCount);
    }),
    fetchAllRecords(apiKey, 'X Articles', ARTICLE_FIELDS, (n) => {
      articleCount = n;
      if (onProgress) onProgress(bookmarkCount + articleCount);
    }),
  ]);

  const bookmarks = bookmarkRecs.map(mapBookmark);
  const articles = articleRecs.map(mapArticle);

  return { bookmarks, articles, total: bookmarks.length + articles.length };
}
