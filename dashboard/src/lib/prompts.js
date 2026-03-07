/**
 * Pre-built prompt templates for exporting bookmarks to Claude.
 * Each template wraps the selected bookmarks JSON with context.
 */

export const promptTemplates = {
  prd: {
    name: "Create PRD",
    icon: "📋",
    description: "Generate a Product Requirements Document from these threads",
    template: (bookmarksJson) => `You are a senior product manager. I'm sharing X/Twitter threads I've bookmarked that relate to a product idea or feature area. Analyze these threads and create a comprehensive Product Requirements Document (PRD).

Include:
- Problem Statement (derived from the discussions)
- Target Users
- Key Features & User Stories
- Success Metrics
- Technical Considerations
- Risks & Mitigations
- MVP Scope vs Future Iterations

Here are the bookmarked threads:

\`\`\`json
${bookmarksJson}
\`\`\`

Create the PRD based on the themes, insights, and ideas found in these threads.`,
  },

  research: {
    name: "Deep Research",
    icon: "🔬",
    description: "Research the topics in these threads deeply",
    template: (bookmarksJson) => `You are a research analyst. I'm sharing X/Twitter threads I've bookmarked on topics I want to understand deeply. Analyze these threads and provide:

1. **Key Themes** — What are the main topics and recurring ideas?
2. **Expert Opinions** — What do the authors argue or claim?
3. **Evidence & Data** — What facts, stats, or evidence is cited?
4. **Contrarian Views** — Any disagreements or alternative perspectives?
5. **Knowledge Gaps** — What questions remain unanswered?
6. **Further Reading** — What related topics should I explore?
7. **Synthesis** — Your overall analysis connecting these threads

Here are the bookmarked threads:

\`\`\`json
${bookmarksJson}
\`\`\`

Provide a thorough research brief.`,
  },

  validate: {
    name: "Validate Idea",
    icon: "✅",
    description: "Validate a business or product idea using these threads",
    template: (bookmarksJson) => `You are a startup advisor and critical thinker. I'm sharing X/Twitter threads I've bookmarked that relate to a business or product idea I'm exploring. Act as a devil's advocate and validation partner.

Analyze and provide:

1. **Idea Extraction** — What idea/opportunity do these threads point to?
2. **Market Signal Strength** — How strong is the signal based on engagement, authors' credibility?
3. **Competitive Landscape** — What existing solutions are mentioned or implied?
4. **Bull Case** — Why this could work (with evidence from threads)
5. **Bear Case** — Why this might fail (risks, challenges)
6. **Validation Steps** — Concrete next steps to test this idea cheaply
7. **Go/No-Go Recommendation** — Your honest assessment

Here are the bookmarked threads:

\`\`\`json
${bookmarksJson}
\`\`\`

Be honest and rigorous in your validation.`,
  },

  skill: {
    name: "Skill / Action Plan",
    icon: "🎯",
    description: "Create a learning plan or action plan from these threads",
    template: (bookmarksJson) => `You are a personal coach and learning strategist. I'm sharing X/Twitter threads I've bookmarked about skills, techniques, or strategies I want to learn and apply.

Create a structured action plan:

1. **Skills Identified** — What skills/knowledge do these threads teach?
2. **Priority Ranking** — Which skills have the highest ROI to learn first?
3. **Learning Path** — Step-by-step progression from beginner to competent
4. **Key Takeaways** — The most actionable advice from each thread
5. **Practice Exercises** — Specific things I can do this week to start
6. **Resources** — Any tools, books, or resources mentioned
7. **30-Day Plan** — A concrete daily/weekly plan to build these skills
8. **Success Metrics** — How I'll know I'm making progress

Here are the bookmarked threads:

\`\`\`json
${bookmarksJson}
\`\`\`

Make the action plan practical and immediately actionable.`,
  },

  summary: {
    name: "Summarize",
    icon: "📝",
    description: "Get a clean summary of these bookmarks",
    template: (bookmarksJson) => `Summarize these X/Twitter bookmarks concisely. For each thread, provide:
- **Author** and their apparent expertise
- **Key Point** in 1-2 sentences
- **Notable Quote** if any stands out
- **Actionable Insight** — what can I do with this info?

Then provide an **Overall Themes** section grouping related bookmarks.

\`\`\`json
${bookmarksJson}
\`\`\``,
  },
};

export function generatePrompt(templateKey, bookmarks) {
  const template = promptTemplates[templateKey];
  if (!template) return "";

  const cleaned = bookmarks.map((b) => ({
    author: `@${b.author_username}` + (b.author_name ? ` (${b.author_name})` : ""),
    text: b.text,
    url: b.url,
    likes: b.likes,
    retweets: b.retweets,
    date: b.created_at,
  }));

  return template.template(JSON.stringify(cleaned, null, 2));
}
