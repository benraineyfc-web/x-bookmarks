/**
 * Auto-categorization engine for bookmarks.
 * Analyzes tweet text + scraped content to assign specific, product-focused categories.
 */

export const CATEGORIES = {
  "X Articles": {
    color: "orange",
    keywords: [],
    _sourceMatch: "airtable_articles",
  },
  "Claude": {
    color: "purple",
    keywords: [
      "claude", "anthropic", "claude code", "claude opus", "claude sonnet",
      "claude haiku", "artifacts", "claude 3", "claude 4", "mcp",
      "model context protocol", "claude desktop", "claude api",
      "system prompt", "claude pro", "anthropic console",
    ],
  },
  "Prompts": {
    color: "blue",
    keywords: [
      "prompt", "prompt engineering", "prompting", "system prompt",
      "chain of thought", "few-shot", "zero-shot", "prompt template",
      "jailbreak", "prompt injection", "megaprompt", "metaprompt",
      "instructions", "persona prompt", "role prompt",
    ],
  },
  "Lovable": {
    color: "pink",
    keywords: [
      "lovable", "lovable.dev", "lovable ai", "lovableai",
    ],
  },
  "Cursor": {
    color: "cyan",
    keywords: [
      "cursor", "cursor ai", "cursor ide", "cursor editor",
      "cursor composer", "cursor tab", ".cursorrules",
    ],
  },
  "Vibe Coding": {
    color: "teal",
    keywords: [
      "vibe coding", "vibecoding", "vibe-coding", "vibe code",
      "ai coding", "ai-assisted coding", "code generation",
      "prompt to code", "nl2code", "windsurf", "bolt",
      "replit agent", "v0", "aider", "copilot", "codeium",
      "tabnine", "continue.dev", "sourcegraph cody",
    ],
  },
  "Dashboards": {
    color: "blue",
    keywords: [
      "dashboard", "admin panel", "admin dashboard", "analytics dashboard",
      "chart", "data viz", "visualization", "charts", "graphs",
      "horizon ui", "chakra ui", "shadcn", "tremor", "recharts",
    ],
  },
  "Landing Pages": {
    color: "orange",
    keywords: [
      "landing page", "hero section", "above the fold", "conversion rate",
      "cta", "call to action", "saas landing", "homepage design",
      "website design", "web design", "framer", "framer motion",
    ],
  },
  "AI Tools": {
    color: "purple",
    keywords: [
      "gpt", "openai", "chatgpt", "gemini", "llm", "large language model",
      "ai model", "ai tool", "ai app", "perplexity", "groq",
      "mistral", "llama", "hugging face", "replicate",
      "midjourney", "dall-e", "stable diffusion", "ai image",
      "eleven labs", "elevenlabs", "ai voice", "deepgram",
      "rag", "embeddings", "vector", "fine-tuning", "fine tuning",
      "langchain", "llamaindex", "ai agent", "agentic",
    ],
  },
  "NotebookLM": {
    color: "green",
    keywords: [
      "notebook lm", "notebooklm", "notebook ai", "google notebooklm",
    ],
  },
  "No-Code": {
    color: "teal",
    keywords: [
      "no-code", "nocode", "low-code", "lowcode", "bubble",
      "webflow", "retool", "softr", "glide", "adalo",
      "flutterflow", "outsystems", "power apps", "appsmith",
    ],
  },
  "Automation": {
    color: "yellow",
    keywords: [
      "automation", "automate", "workflow", "zapier", "make.com",
      "n8n", "pipedream", "api integration", "webhook", "cron",
      "scheduled", "trigger", "power automate", "ifttt",
    ],
  },
  "Dev Tools": {
    color: "gray",
    keywords: [
      "api", "sdk", "github", "vercel", "netlify", "railway",
      "fly.io", "docker", "supabase", "firebase", "nextjs",
      "next.js", "react", "typescript", "python", "node.js",
      "npm", "git", "ci/cd", "deploy", "postgresql", "redis",
      "graphql", "rest api", "serverless",
    ],
  },
  "Marketing": {
    color: "orange",
    keywords: [
      "marketing", "growth", "gtm", "go-to-market", "seo",
      "content marketing", "copywriting", "branding", "funnel",
      "email marketing", "newsletter", "audience", "distribution",
      "viral", "organic", "paid ads", "influencer", "affiliate",
      "icp", "ideal customer", "persona", "target market",
      "social media marketing", "twitter growth", "x growth",
    ],
  },
  "Startups": {
    color: "red",
    keywords: [
      "startup", "founder", "fundraising", "vc", "venture capital",
      "seed round", "pitch deck", "revenue", "mrr", "arr",
      "saas", "b2b", "product-market fit", "pmf", "mvp",
      "launch", "ship", "indie hacker", "bootstrapped",
      "solopreneur", "side project", "y combinator",
    ],
  },
  "Productivity": {
    color: "green",
    keywords: [
      "productivity", "notion", "obsidian", "second brain",
      "pkm", "knowledge management", "workflow", "efficiency",
      "time management", "project management", "linear",
      "todoist", "tana", "capacities", "logseq", "roam",
    ],
  },
  "Design": {
    color: "pink",
    keywords: [
      "design", "ux", "ui", "figma", "prototype", "wireframe",
      "design system", "component", "accessibility", "typography",
      "dark mode", "responsive", "mobile", "tailwind", "css",
    ],
  },
  "Twitter / X": {
    color: "blue",
    keywords: [
      "twitter", "tweet", "x.com", "bookmarks", "thread",
      "followers", "engagement", "impressions", "twitter blue",
      "x premium", "twitter api", "tweet viral",
    ],
  },
};

/**
 * Categorize a single bookmark based on its text content.
 * Returns an array of matching category names (can be multiple).
 */
export function categorizeBookmark(bookmark) {
  const searchText = [
    bookmark.text || "",
    bookmark.author_username || "",
    bookmark.author_name || "",
    ...(bookmark.tags || []),
    // Include scraped content if available
    ...(bookmark.scraped_json?.articles?.map((a) =>
      `${a.title || ""} ${a.description || ""} ${(a.text || "").slice(0, 500)}`
    ) || []),
  ]
    .join(" ")
    .toLowerCase();

  const matches = [];

  for (const [category, config] of Object.entries(CATEGORIES)) {
    // Source-based match (e.g. X Articles from Airtable sync)
    if (config._sourceMatch && bookmark._source === config._sourceMatch) {
      matches.push({ category, score: 999, color: config.color });
      continue;
    }
    // Also match by _airtable_title presence as a fallback
    if (category === "X Articles" && bookmark._airtable_title) {
      matches.push({ category, score: 999, color: config.color });
      continue;
    }

    if (!config.keywords.length) continue;

    const score = config.keywords.reduce((acc, keyword) => {
      const pattern = new RegExp(`\\b${keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (pattern.test(searchText)) {
        return acc + 1;
      }
      return acc;
    }, 0);

    if (score >= 1) {
      matches.push({ category, score, color: config.color });
    }
  }

  // Sort by score descending, return top matches
  matches.sort((a, b) => b.score - a.score);

  // X Articles always keeps its slot; limit others to top 3
  const xArticles = matches.filter(m => m.category === "X Articles");
  const others = matches.filter(m => m.category !== "X Articles").slice(0, 3);
  return [...xArticles, ...others].map((m) => m.category);
}

/**
 * Categorize all bookmarks in bulk.
 * Returns a Map of bookmarkId -> categories[]
 */
export function categorizeAll(bookmarks) {
  const result = new Map();
  for (const bm of bookmarks) {
    result.set(bm.id, categorizeBookmark(bm));
  }
  return result;
}

/**
 * Get category color for display
 */
export function getCategoryColor(categoryName) {
  return CATEGORIES[categoryName]?.color || "gray";
}

/**
 * Extract actionable steps from a bookmark's text content.
 * Looks for numbered lists, bullet points, imperative sentences, etc.
 */
export function extractActionItems(bookmark) {
  const text = bookmark.text || "";
  const items = [];

  // Split into lines/sentences
  const lines = text.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Match numbered items: "1. Do something" or "1) Do something"
    if (/^\d+[\.\)]\s+/.test(line)) {
      items.push(line.replace(/^\d+[\.\)]\s+/, "").trim());
      continue;
    }
    // Match bullet items: "- Do something" or "• Do something"
    if (/^[-•*]\s+/.test(line)) {
      items.push(line.replace(/^[-•*]\s+/, "").trim());
      continue;
    }
    // Match imperative sentences starting with action verbs
    const actionVerbs = /^(try|use|build|create|start|stop|make|learn|read|watch|check|set up|install|deploy|launch|test|write|implement|add|remove|update|configure|enable|disable|run|open|sign up|subscribe|download|explore|consider|focus|prioritize|automate|integrate|connect|ship|optimize|track|measure|analyze|review|audit|migrate|refactor|upgrade|switch|adopt|avoid|never|always|remember|don't|do not)/i;
    if (actionVerbs.test(line) && line.length > 10 && line.length < 200) {
      items.push(line);
    }
  }

  // Also check scraped article content for action items
  if (bookmark.scraped_json?.articles) {
    for (const article of bookmark.scraped_json.articles) {
      const articleText = article.markdown || article.text || "";
      const articleLines = articleText.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);
      for (const line of articleLines.slice(0, 50)) {
        if (/^\d+[\.\)]\s+/.test(line)) {
          const item = line.replace(/^\d+[\.\)]\s+/, "").trim();
          if (item.length > 10 && item.length < 200) {
            items.push(item);
          }
        }
      }
    }
  }

  // Deduplicate and limit
  return [...new Set(items)].slice(0, 10);
}
