/**
 * Auto-categorization engine for bookmarks.
 * Analyzes tweet text + scraped content to assign categories.
 */

export const CATEGORIES = {
  "AI & LLMs": {
    color: "purple",
    icon: "brain",
    keywords: [
      "claude", "gpt", "openai", "anthropic", "llm", "large language model",
      "ai model", "chatgpt", "gemini", "copilot", "artificial intelligence",
      "machine learning", "deep learning", "neural network", "transformer",
      "fine-tuning", "fine tuning", "rag", "retrieval augmented", "embeddings",
      "tokens", "context window", "prompt engineering", "system prompt",
      "ai agent", "agentic", "multi-agent", "langchain", "llamaindex",
      "mistral", "llama", "groq", "perplexity", "cursor ai",
    ],
  },
  "Vibe Coding": {
    color: "cyan",
    icon: "code",
    keywords: [
      "vibe coding", "vibecoding", "vibe-coding", "cursor", "windsurf",
      "v0", "bolt", "replit agent", "ai coding", "ai-assisted coding",
      "copilot", "codeium", "tabnine", "ai pair", "code generation",
      "natural language to code", "nl2code", "prompt to code",
      "claude code", "aider", "continue.dev", "sourcegraph cody",
    ],
  },
  "No-Code / Low-Code": {
    color: "teal",
    icon: "layers",
    keywords: [
      "lovable", "no-code", "nocode", "low-code", "lowcode", "bubble",
      "webflow", "retool", "airtable", "zapier", "make.com", "n8n",
      "supabase", "firebase", "appsmith", "softr", "glide", "adalo",
      "flutterflow", "outsystems", "mendix", "power apps", "power automate",
    ],
  },
  "Dev Tools & APIs": {
    color: "blue",
    icon: "tool",
    keywords: [
      "api", "sdk", "developer tool", "devtool", "github", "gitlab",
      "vercel", "netlify", "railway", "fly.io", "docker", "kubernetes",
      "terraform", "ci/cd", "pipeline", "webhook", "rest api", "graphql",
      "postman", "swagger", "openapi", "npm", "yarn", "pnpm",
      "typescript", "javascript", "python", "rust", "golang",
      "nextjs", "next.js", "react", "vue", "svelte", "node.js", "deno", "bun",
    ],
  },
  "Productivity & Tools": {
    color: "green",
    icon: "zap",
    keywords: [
      "notebook lm", "notebooklm", "notion", "obsidian", "roam",
      "logseq", "tana", "capacities", "productivity", "workflow",
      "second brain", "pkm", "knowledge management", "zettelkasten",
      "automation", "automate", "efficiency", "time management",
      "project management", "task management", "todoist", "linear",
    ],
  },
  "Marketing & Growth": {
    color: "orange",
    icon: "trending-up",
    keywords: [
      "marketing", "growth", "gtm", "go-to-market", "seo", "sem",
      "content marketing", "social media", "copywriting", "branding",
      "conversion", "funnel", "cro", "email marketing", "newsletter",
      "audience", "distribution", "viral", "organic growth",
      "paid ads", "facebook ads", "google ads", "tiktok ads",
      "influencer", "affiliate", "referral", "retention", "churn",
      "icp", "ideal customer", "persona", "target market",
    ],
  },
  "Startups & Business": {
    color: "red",
    icon: "briefcase",
    keywords: [
      "startup", "founder", "entrepreneurship", "fundraising", "vc",
      "venture capital", "seed round", "series a", "pitch deck",
      "business model", "revenue", "mrr", "arr", "saas", "b2b", "b2c",
      "product-market fit", "pmf", "mvp", "launch", "ship",
      "indie hacker", "bootstrapped", "solopreneur", "side project",
      "yc", "y combinator", "techstars", "accelerator",
    ],
  },
  "Design & UX": {
    color: "pink",
    icon: "palette",
    keywords: [
      "design", "ux", "ui", "user experience", "user interface",
      "figma", "sketch", "framer", "prototype", "wireframe",
      "design system", "component library", "accessibility", "a11y",
      "responsive", "mobile-first", "dark mode", "typography",
      "color theory", "visual design", "interaction design",
    ],
  },
  "Data & Analytics": {
    color: "yellow",
    icon: "bar-chart",
    keywords: [
      "data", "analytics", "metrics", "dashboard", "visualization",
      "sql", "database", "postgresql", "mongodb", "redis",
      "data engineering", "data pipeline", "etl", "dbt",
      "bigquery", "snowflake", "databricks", "jupyter",
      "pandas", "numpy", "scipy", "matplotlib", "plotly",
    ],
  },
  "Career & Learning": {
    color: "gray",
    icon: "graduation-cap",
    keywords: [
      "career", "job", "hiring", "interview", "resume", "salary",
      "remote work", "freelance", "consulting", "mentorship",
      "learning", "tutorial", "course", "bootcamp", "certification",
      "skill", "upskill", "reskill", "portfolio", "personal brand",
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
    const score = config.keywords.reduce((acc, keyword) => {
      if (searchText.includes(keyword.toLowerCase())) {
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

  // Return top 2 categories max
  return matches.slice(0, 2).map((m) => m.category);
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
