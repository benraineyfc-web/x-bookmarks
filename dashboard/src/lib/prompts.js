/**
 * Pre-built prompt templates for exporting bookmarks to Claude.
 * Each template wraps the selected bookmarks JSON with context.
 */

export const promptTemplates = {
  prd: {
    name: "Product Requirements Doc (PRD)",
    icon: "📋",
    category: "Product",
    description: "Generate a comprehensive Product Requirements Document from these threads",
    template: (bookmarksJson) => `You are a senior product manager. I'm sharing X/Twitter threads I've bookmarked that relate to a product idea or feature area. Analyze these threads and create a comprehensive Product Requirements Document (PRD).

Include:
- Problem Statement (derived from the discussions)
- Target Users & Personas
- Key Features & User Stories (with acceptance criteria)
- Success Metrics & KPIs
- Technical Considerations & Architecture Notes
- Risks & Mitigations
- MVP Scope vs Future Iterations
- Timeline Recommendations
- Dependencies & Assumptions

Here are the bookmarked threads:

\`\`\`json
${bookmarksJson}
\`\`\`

Create the PRD based on the themes, insights, and ideas found in these threads.`,
  },

  brd: {
    name: "Business Requirements Doc (BRD)",
    icon: "💼",
    category: "Business",
    description: "Create a Business Requirements Document outlining business needs and objectives",
    template: (bookmarksJson) => `You are a business analyst. I'm sharing X/Twitter threads I've bookmarked related to a business opportunity or initiative. Create a comprehensive Business Requirements Document (BRD).

Include:
- Executive Summary
- Business Objectives & Goals
- Current State Analysis (from thread insights)
- Proposed Solution Overview
- Business Requirements (functional & non-functional)
- Stakeholder Analysis
- Cost-Benefit Analysis Framework
- Success Criteria & Acceptance Criteria
- Constraints & Assumptions
- Risk Assessment

Here are the bookmarked threads:

\`\`\`json
${bookmarksJson}
\`\`\`

Create the BRD based on the business insights found in these threads.`,
  },

  mrd: {
    name: "Market Requirements Doc (MRD)",
    icon: "📊",
    category: "Business",
    description: "Create a Market Requirements Document analyzing market opportunity",
    template: (bookmarksJson) => `You are a market research analyst. I'm sharing X/Twitter threads I've bookmarked about a market opportunity. Create a comprehensive Market Requirements Document (MRD).

Include:
- Market Overview & Size Estimation
- Target Market Segments
- Customer Needs & Pain Points (from thread discussions)
- Competitive Landscape Analysis
- Market Trends & Drivers
- Positioning Strategy
- Pricing Considerations
- Distribution Channels
- Market Entry Barriers
- Revenue Model Recommendations
- Key Success Factors

Here are the bookmarked threads:

\`\`\`json
${bookmarksJson}
\`\`\`

Create the MRD based on the market signals and insights found in these threads.`,
  },

  trd: {
    name: "Technical Requirements Doc (TRD)",
    icon: "🔧",
    category: "Technical",
    description: "Create a Technical Requirements Document with architecture and specs",
    template: (bookmarksJson) => `You are a senior software architect. I'm sharing X/Twitter threads I've bookmarked about technical approaches, tools, and architectures. Create a comprehensive Technical Requirements Document (TRD).

Include:
- System Architecture Overview
- Technology Stack Recommendations (based on thread insights)
- Functional Requirements (detailed)
- Non-Functional Requirements (performance, scalability, security)
- API Specifications & Integration Points
- Data Model & Storage Requirements
- Infrastructure Requirements
- Security Requirements & Threat Model
- Testing Strategy
- Deployment Architecture
- Monitoring & Observability
- Technical Debt Considerations

Here are the bookmarked threads:

\`\`\`json
${bookmarksJson}
\`\`\`

Create the TRD based on the technical discussions and recommendations found in these threads.`,
  },

  srd: {
    name: "Software Requirements Spec (SRD)",
    icon: "📐",
    category: "Technical",
    description: "Create a Software Requirements Specification with detailed specs",
    template: (bookmarksJson) => `You are a requirements engineer. I'm sharing X/Twitter threads I've bookmarked about software features and capabilities. Create a comprehensive Software Requirements Specification (SRD/SRS).

Include:
- Purpose & Scope
- Overall Description
- System Features (with priorities: Must/Should/Could/Won't)
- External Interface Requirements
- Functional Requirements (numbered, testable)
- Non-Functional Requirements
- Database Requirements
- Design Constraints
- Software System Attributes (reliability, availability, maintainability)
- Verification & Validation Criteria
- Traceability Matrix

Here are the bookmarked threads:

\`\`\`json
${bookmarksJson}
\`\`\`

Create the SRD based on the software discussions found in these threads.`,
  },

  sop: {
    name: "Standard Operating Procedure (SOP)",
    icon: "📖",
    category: "Operations",
    description: "Create a Standard Operating Procedure from workflow insights",
    template: (bookmarksJson) => `You are an operations manager. I'm sharing X/Twitter threads I've bookmarked about processes, workflows, and best practices. Create a comprehensive Standard Operating Procedure (SOP).

Include:
- Purpose & Scope
- Roles & Responsibilities
- Prerequisites & Required Tools
- Step-by-Step Procedure (numbered, clear, actionable)
- Decision Points & Branching Logic
- Quality Checkpoints
- Troubleshooting Guide
- Escalation Procedures
- Documentation Requirements
- Review & Update Schedule
- Appendices (templates, checklists, reference materials)

Here are the bookmarked threads:

\`\`\`json
${bookmarksJson}
\`\`\`

Create the SOP based on the workflow insights and best practices found in these threads.`,
  },

  gtm: {
    name: "Go-To-Market Plan (GTM)",
    icon: "🚀",
    category: "Marketing",
    description: "Create a Go-To-Market strategy and launch plan",
    template: (bookmarksJson) => `You are a growth strategist. I'm sharing X/Twitter threads I've bookmarked about market opportunities, growth strategies, and launch approaches. Create a comprehensive Go-To-Market (GTM) Plan.

Include:
- Executive Summary
- Market Analysis & Opportunity Size
- Target Customer Segments & ICPs
- Value Proposition & Messaging Framework
- Competitive Positioning
- Pricing Strategy
- Distribution & Channel Strategy
- Marketing Launch Plan (pre-launch, launch day, post-launch)
- Sales Strategy & Process
- Content Strategy & Calendar
- Partnership Opportunities
- Budget Allocation
- KPIs & Success Metrics
- 90-Day Execution Timeline

Here are the bookmarked threads:

\`\`\`json
${bookmarksJson}
\`\`\`

Create the GTM plan based on the market insights and growth strategies found in these threads.`,
  },

  icp: {
    name: "ICP & Marketing Plan",
    icon: "🎯",
    category: "Marketing",
    description: "Define Ideal Customer Profile and create a targeted marketing plan",
    template: (bookmarksJson) => `You are a marketing strategist. I'm sharing X/Twitter threads I've bookmarked about customer segments, marketing approaches, and audience insights. Create an Ideal Customer Profile (ICP) and Marketing Plan.

Include:

**ICP Definition:**
- Demographic Profile
- Psychographic Profile
- Firmographic Profile (if B2B)
- Pain Points & Challenges
- Goals & Aspirations
- Buying Behavior & Decision Process
- Where They Hang Out (channels, communities)
- Objections & Concerns

**Marketing Plan:**
- Marketing Objectives & KPIs
- Brand Positioning & Voice
- Content Strategy (topics, formats, frequency)
- Channel Strategy (organic, paid, community)
- Email Marketing & Nurture Sequences
- Social Media Strategy
- SEO & Content Distribution
- Influencer & Partnership Strategy
- Budget Breakdown
- Monthly Execution Calendar
- Measurement & Optimization Framework

Here are the bookmarked threads:

\`\`\`json
${bookmarksJson}
\`\`\`

Create the ICP and Marketing Plan based on the audience and marketing insights found in these threads.`,
  },

  api_automation: {
    name: "API & Automation Build",
    icon: "⚡",
    category: "Technical",
    description: "Design an API and automation architecture from technical discussions",
    template: (bookmarksJson) => `You are a solutions architect specializing in APIs and automation. I'm sharing X/Twitter threads I've bookmarked about tools, integrations, and automation workflows. Create a comprehensive API & Automation Build Plan.

Include:
- System Architecture Diagram (text-based)
- API Design (endpoints, methods, payloads)
- Authentication & Authorization Strategy
- Integration Points & Third-Party Services
- Automation Workflows (trigger → action → result)
- Data Flow & Transformation Logic
- Error Handling & Retry Strategies
- Rate Limiting & Throttling
- Webhook Configuration
- Monitoring & Alerting
- CI/CD Pipeline Design
- Environment Strategy (dev/staging/prod)
- Implementation Roadmap (phased)
- Tools & Services Recommendations

Here are the bookmarked threads:

\`\`\`json
${bookmarksJson}
\`\`\`

Create the API & Automation plan based on the technical discussions and tool recommendations found in these threads.`,
  },

  claude_skipps: {
    name: "Claude SKIPPS",
    icon: "🧠",
    category: "AI",
    description: "Generate a Claude System Prompt (SKIPPS format) from your bookmarked knowledge",
    template: (bookmarksJson) => `You are an expert at creating effective AI system prompts. I'm sharing X/Twitter threads I've bookmarked that contain domain knowledge, expertise, and insights. Create a Claude System Prompt using the SKIPPS framework.

SKIPPS stands for:
- **S**ituation: Set the context and background
- **K**nowledge: Define the domain expertise and knowledge base
- **I**dentity: Define who Claude should be (role, personality, tone)
- **P**urpose: Define the primary goal and objectives
- **P**rocess: Define the step-by-step approach to follow
- **S**afeguards: Define boundaries, limitations, and guardrails

Create a production-ready system prompt that:
1. Incorporates the domain knowledge from these threads
2. Sets up Claude as an expert in the topics discussed
3. Provides clear instructions for handling queries in this domain
4. Includes relevant examples and edge cases from the threads
5. Has appropriate guardrails

Here are the bookmarked threads containing the domain knowledge:

\`\`\`json
${bookmarksJson}
\`\`\`

Output the complete system prompt ready to be used with Claude.`,
  },

  research: {
    name: "Deep Research Brief",
    icon: "🔬",
    category: "Research",
    description: "Deep research analysis of the topics in these threads",
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
    name: "Idea Validation",
    icon: "✅",
    category: "Business",
    description: "Validate a business or product idea using these threads as evidence",
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

  action_plan: {
    name: "Action Plan",
    icon: "📝",
    category: "Operations",
    description: "Create a practical action plan from these threads",
    template: (bookmarksJson) => `You are a personal coach and strategist. I'm sharing X/Twitter threads I've bookmarked about skills, techniques, or strategies I want to implement.

Create a structured action plan:

1. **Key Insights** — The most important takeaways from each thread
2. **Priority Actions** — Ranked by impact and effort (Quick Wins, Big Bets, Fill-Ins, Avoid)
3. **Week 1 Actions** — What to do immediately (specific, measurable tasks)
4. **30-Day Plan** — Weekly milestones and targets
5. **Tools & Resources** — Specific tools, services, or resources mentioned
6. **Success Metrics** — How to measure progress
7. **Potential Blockers** — Anticipated challenges and workarounds
8. **Review Cadence** — When and how to assess progress

Here are the bookmarked threads:

\`\`\`json
${bookmarksJson}
\`\`\`

Make the action plan practical and immediately actionable.`,
  },

  summary: {
    name: "Quick Summary",
    icon: "📄",
    category: "Research",
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
    categories: b.categories || [],
    actionItems: b.actionItems || [],
  }));

  return template.template(JSON.stringify(cleaned, null, 2));
}
