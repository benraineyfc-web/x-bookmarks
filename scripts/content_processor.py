#!/usr/bin/env python3
"""
Content Processor — transform scraped X content into actionable documents.

Takes the JSON output from x_content_scraper.py and transforms it into
structured documents: markdown notes, business SOPs, PIDs, or concept docs.

Usage:
    python3 x_content_scraper.py "https://x.com/..." | python3 content_processor.py --format sop
    python3 content_processor.py --format pid --input scraped.json
    python3 content_processor.py --format concept --input scraped.json --context "Apply to our SaaS onboarding"

Formats:
    markdown  — Clean markdown note (default)
    sop       — Business Standard Operating Procedure (AI prompt)
    pid       — Project Initiation Document (AI prompt)
    concept   — Concept document (AI prompt)

For SOP/PID/Concept, the tool generates a ready-to-paste prompt that you
copy into Claude, ChatGPT, or Gemini to get a high-quality formatted document.
The markdown format renders directly.

All formats use stdlib only — zero external dependencies.
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# --- Template Definitions ---

TEMPLATES = {
    "markdown": """\
# {title}

{attribution}

---

## Content

{content}

---

{linked_content}

{metadata}
""",

    "sop": """\
# Standard Operating Procedure

| Field | Value |
|-------|-------|
| **Title** | {title} |
| **Source** | {source_url} |
| **Author** | {author} |
| **Created** | {date} |
| **Version** | 1.0 — Draft |

---

## 1. Purpose

This SOP documents the process/methodology described by {author}.

{purpose_summary}

## 2. Scope

This procedure applies to:

{scope_items}

## 3. Prerequisites

Before executing this procedure, ensure:

{prerequisites}

## 4. Procedure

{procedure_steps}

## 5. Expected Outcomes

{outcomes}

## 6. Notes & Caveats

{notes}

---

## Source Material

{content}

{linked_content}
""",

    "pid": """\
# Project Initiation Document

| Field | Value |
|-------|-------|
| **Project Name** | {title} |
| **Source** | {source_url} |
| **Author** | {author} |
| **Date** | {date} |
| **Status** | Draft |

---

## 1. Project Overview

{overview}

## 2. Objectives

{objectives}

## 3. Scope & Deliverables

### In Scope
{in_scope}

### Deliverables
{deliverables}

## 4. Key Stakeholders

| Role | Responsibility |
|------|---------------|
| Project Owner | Define requirements and approve deliverables |
| Implementer | Execute the project plan |
| Reviewer | Validate outputs against objectives |

## 5. Approach & Methodology

{approach}

## 6. Timeline & Milestones

| Phase | Description | Duration |
|-------|-------------|----------|
| Discovery | Research and validate approach | TBD |
| Implementation | Execute core work | TBD |
| Review | Test and validate outcomes | TBD |
| Launch | Deploy and monitor | TBD |

## 7. Risks & Mitigations

{risks}

## 8. Success Criteria

{success_criteria}

---

## Source Material

{content}

{linked_content}
""",

    "concept": """\
# Concept: {title}

| Field | Value |
|-------|-------|
| **Source** | {source_url} |
| **Author** | {author} |
| **Date** | {date} |

---

## Core Idea

{core_idea}

## Key Insights

{key_insights}

## How This Applies

{applications}

## Potential Actions

{actions}

## Open Questions

{open_questions}

---

## Raw Source Material

{content}

{linked_content}
""",
}

# --- AI Prompt Templates ---
# These are pasted into Claude / ChatGPT / Gemini to generate high-quality docs.

AI_PROMPTS = {
    "sop": """\
Create a **Standard Operating Procedure (SOP)** from the source material below.

---

## Source Material

**Author:** {author}
**Original URL:** {source_url}
**Date:** {date}

### Post/Tweet

{content}

### Linked Article Content

{linked_content}

{context_block}

---

## Output Requirements

Generate a professional SOP in **Markdown** format with these sections:

1. **Purpose** — What this procedure achieves and why it matters (1-2 paragraphs)
2. **Scope** — Who this applies to: teams, roles, industries, company stages
3. **Prerequisites** — Specific tools, accounts, access, skills, or knowledge needed before starting
4. **Procedure** — Detailed, numbered step-by-step instructions extracted from the content. Be specific — include tool names, exact actions, and any metrics or benchmarks mentioned
5. **Expected Outcomes** — Concrete results when the procedure is followed correctly. Include any revenue figures, timelines, or KPIs from the source
6. **Notes & Caveats** — Edge cases, common mistakes, dependencies, and things to watch out for

**Rules:**
- Extract SPECIFIC steps and details from the source — no generic placeholders
- Include any tools, platforms, pricing, or services mentioned by name
- Include any numbers, costs, timelines, or metrics mentioned
- If a section lacks source material, briefly note what additional info is needed
- Keep the tone professional but practical
""",

    "pid": """\
Create a **Project Initiation Document (PID)** from the source material below.

---

## Source Material

**Author:** {author}
**Original URL:** {source_url}
**Date:** {date}

### Post/Tweet

{content}

### Linked Article Content

{linked_content}

{context_block}

---

## Output Requirements

Generate a professional PID in **Markdown** format with these sections:

1. **Project Overview** — What this project is about and the opportunity/problem it addresses (2-3 paragraphs)
2. **Objectives** — 3-5 measurable objectives or key results, using specific numbers from the source where available
3. **Scope & Deliverables** — What's in scope, what's out of scope, and a list of concrete deliverables
4. **Key Stakeholders** — Roles and responsibilities table (infer from the content)
5. **Approach & Methodology** — How to execute, broken into phases with specific actions
6. **Timeline & Milestones** — Table with phases, descriptions, and estimated durations
7. **Risks & Mitigations** — Table identifying 3-5 risks with impact, likelihood, and mitigation strategies
8. **Success Criteria** — How to measure whether the project succeeded, with specific metrics

**Rules:**
- Extract REAL data from the source — revenue targets, costs, timelines, tools
- Use Markdown tables for stakeholders, timeline, and risks sections
- Be specific about the approach — reference actual methods/tools from the content
- If information is missing for a section, note what needs to be defined
- Treat the source content as a brief/pitch that needs to be structured into a plan
""",

    "concept": """\
Create a **Concept Note** from the source material below.

---

## Source Material

**Author:** {author}
**Original URL:** {source_url}
**Date:** {date}

### Post/Tweet

{content}

### Linked Article Content

{linked_content}

{context_block}

---

## Output Requirements

Generate an insightful Concept Note in **Markdown** format with these sections:

1. **Core Idea** — The central thesis or insight in 2-3 clear paragraphs. What is the author really saying?
2. **Key Insights** — 5-8 bullet points capturing the most important, non-obvious takeaways
3. **How This Applies** — 3-5 concrete ways this could be applied to real work. Be specific about use cases, industries, or scenarios
4. **Potential Actions** — Numbered list of immediate next steps someone could take to act on this
5. **Open Questions** — 3-5 questions that need further investigation or validation before acting
6. **Related Concepts** — Other frameworks, methodologies, or ideas that connect to this (if apparent)

**Rules:**
- Focus on INSIGHT over summary — what's the non-obvious takeaway?
- Extract the author's actual arguments, not just topic labels
- For "How This Applies", imagine you're advising a team that just read this — what would you tell them?
- Actions should be specific and time-bound where possible
- Keep the tone thoughtful and analytical
""",
}


# --- Content Extraction ---


def extract_tweet_content(data: dict) -> dict:
    """Extract key fields from scraped data for template filling."""
    tweet = data.get("tweet")
    articles = data.get("articles", [])

    if tweet:
        author = f"@{tweet['author']['username']} ({tweet['author']['name']})"
        content = tweet["text"]
        source_url = data.get("source_url", "")
        date = tweet.get("created_at", datetime.now(timezone.utc).isoformat())
        metrics = tweet.get("metrics", {})

        # If tweet content is just a URL, try to use article title/description
        content_stripped = content.strip()
        is_url_only = bool(re.match(r"^https?://\S+$", content_stripped))
        if is_url_only and articles:
            best = next((a for a in articles if a.get("title") and not a.get("error")), None)
            if best:
                content = best["title"]
                if best.get("description"):
                    content += f"\n\n{best['description']}"

        title = _derive_title(content)

        attribution = f"**{tweet['author']['name']}** (@{tweet['author']['username']})"
        if tweet["author"].get("bio"):
            attribution += f"\n*{tweet['author']['bio']}*"
    else:
        author = "Unknown"
        title = articles[0].get("title", "Untitled") if articles else "Untitled"
        content = ""
        source_url = data.get("source_url", "")
        date = datetime.now(timezone.utc).isoformat()
        metrics = {}
        attribution = ""

    # Build linked content section
    linked_parts = []
    for article in articles:
        if article.get("error"):
            linked_parts.append(f"### {article.get('url', 'Unknown URL')}\n*Failed to fetch: {article['error']}*\n")
            continue
        art_title = article.get("title", "Untitled")
        linked_parts.append(f"### {art_title}\n")
        if article.get("description"):
            linked_parts.append(f"*{article['description']}*\n")
        linked_parts.append(f"URL: {article['url']}\n")
        linked_parts.append(article.get("markdown", ""))
        linked_parts.append("")

    linked_content = "\n".join(linked_parts) if linked_parts else "*No linked articles.*"

    # Metrics line
    metadata = ""
    if metrics:
        m_parts = []
        if metrics.get("likes"):
            m_parts.append(f"{metrics['likes']} likes")
        if metrics.get("retweets"):
            m_parts.append(f"{metrics['retweets']} retweets")
        if metrics.get("views"):
            m_parts.append(f"{metrics['views']} views")
        if m_parts:
            metadata = f"*Engagement: {' | '.join(m_parts)}*"

    return {
        "title": title,
        "author": author,
        "attribution": attribution,
        "content": content,
        "linked_content": linked_content,
        "source_url": source_url,
        "date": date,
        "metadata": metadata,
        "full_text": _build_full_text(content, articles),
    }


def _derive_title(text: str) -> str:
    """Derive a title from tweet text (first sentence or first 80 chars)."""
    clean = text.strip()
    # If text is just a URL, use the domain/path as title
    if re.match(r"^https?://\S+$", clean):
        from urllib.parse import urlparse
        parsed = urlparse(clean)
        path = parsed.path.strip("/")
        if path:
            return path.rsplit("/", 1)[-1][:80] or parsed.netloc
        return parsed.netloc
    # Take first sentence (skip dots inside URLs)
    for delim in [".", "!", "?", "\n"]:
        idx = clean.find(delim)
        if 0 < idx < 120:
            # Don't split on dots that are inside URLs
            if delim == "." and re.match(r"^https?://", clean[:idx + 1]):
                continue
            return clean[:idx + 1].strip()
    # Fallback: first 80 chars
    if len(clean) > 80:
        return clean[:77].strip() + "..."
    return clean


def _build_full_text(tweet_text: str, articles: list) -> str:
    """Combine tweet text and article content for analysis."""
    parts = [tweet_text] if tweet_text else []
    for a in articles:
        if a.get("markdown"):
            parts.append(a["markdown"])
    return "\n\n---\n\n".join(parts)


# --- Template Filling ---

# Placeholder generators for structured formats.
# These provide scaffold sections that the user/agent fills in.
# The content from the tweet/article is always included as source material.

def fill_markdown(fields: dict) -> str:
    return TEMPLATES["markdown"].format(**fields)


def fill_sop(fields: dict, context: str = "") -> str:
    full = fields["full_text"]
    ctx_note = f"\n\n*User context: {context}*" if context else ""

    scope_items, prereq_items = _extract_scope_and_prereqs(full)
    financial = _extract_financial_lines(full)

    values = {
        **fields,
        "purpose_summary": (
            f"Based on content shared by {fields['author']}:{ctx_note}\n\n"
            f"> {_truncate(fields['content'], 300)}"
        ),
        "scope_items": (
            "\n".join(f"- {s}" for s in scope_items)
            if scope_items
            else "- *Define the teams/systems/processes this applies to*"
        ),
        "prerequisites": (
            "\n".join(f"- {s}" for s in prereq_items)
            if prereq_items
            else "- *List tools, access, or knowledge required*"
        ),
        "procedure_steps": _format_steps(full),
        "outcomes": (
            "\n".join(f"- {f}" for f in financial)
            if financial
            else "- *Define expected results when this procedure is followed correctly*"
        ),
        "notes": (
            f"- Original source: {fields['source_url']}\n"
            f"- Author: {fields['author']}\n"
            "- *Add implementation notes, edge cases, exceptions*"
        ),
    }
    return TEMPLATES["sop"].format(**values)


def fill_pid(fields: dict, context: str = "") -> str:
    full = fields["full_text"]
    ctx_note = f"\n\n*User context: {context}*" if context else ""

    scope_items, prereqs = _extract_scope_and_prereqs(full)
    steps = _extract_steps(full)
    financial = _extract_financial_lines(full)
    timeline = _extract_timeline_items(full)

    # Build deliverables from action items
    action_items = _extract_action_items(full)
    deliverables_text = (
        "\n".join(f"- {a}" for a in action_items[:8])
        if action_items
        else "- *List concrete deliverables*"
    )

    # Build objectives from thesis
    thesis = _extract_thesis(full, 300)

    # Build timeline table if we have milestones
    if timeline:
        timeline_rows = "| Phase | Description | Duration |\n|-------|-------------|----------|\n"
        for phase, desc in timeline:
            timeline_rows += f"| {phase} | {_truncate(desc, 80)} | TBD |\n"
    else:
        timeline_rows = (
            "| Phase | Description | Duration |\n"
            "|-------|-------------|----------|\n"
            "| Discovery | Research and validate approach | TBD |\n"
            "| Implementation | Execute core work | TBD |\n"
            "| Review | Test and validate outcomes | TBD |\n"
            "| Launch | Deploy and monitor | TBD |"
        )

    values = {
        **fields,
        "overview": (
            f"Project inspired by content from {fields['author']}.{ctx_note}\n\n"
            f"> {_truncate(thesis, 400)}"
        ),
        "objectives": (
            "\n".join(f"- {f}" for f in financial[:5])
            if financial
            else "- *Define measurable key results from the source content*"
        ),
        "in_scope": (
            "\n".join(f"- {s}" for s in scope_items[:5])
            if scope_items
            else "- *Define what's included in this project*"
        ),
        "deliverables": deliverables_text,
        "approach": _format_steps(full),
        "risks": (
            "| Risk | Impact | Likelihood | Mitigation |\n"
            "|------|--------|------------|------------|\n"
            "| *Identify from source* | TBD | TBD | TBD |\n"
            "| *Technical complexity* | TBD | TBD | TBD |"
        ),
        "success_criteria": (
            "\n".join(f"- {f}" for f in financial[-5:])
            if financial
            else "- *Define what success looks like*"
        ),
    }

    # Override timeline in template
    pid_output = TEMPLATES["pid"].format(**values)
    # Replace default timeline table with extracted one
    default_timeline = (
        "| Phase | Description | Duration |\n"
        "|-------|-------------|----------|\n"
        "| Discovery | Research and validate approach | TBD |\n"
        "| Implementation | Execute core work | TBD |\n"
        "| Review | Test and validate outcomes | TBD |\n"
        "| Launch | Deploy and monitor | TBD |"
    )
    if timeline:
        pid_output = pid_output.replace(default_timeline, timeline_rows)
    return pid_output


def fill_concept(fields: dict, context: str = "") -> str:
    full = fields["full_text"]
    ctx_note = f"\n\n*User context: {context}*" if context else ""

    # Core idea: thesis from the article, not just the tweet text
    thesis = _extract_thesis(full, 600)

    # Actions: extracted from the content
    action_items = _extract_action_items(full)
    actions_text = (
        "\n".join(f"- {a}" for a in action_items[:10])
        if action_items
        else "- *No explicit action items found — review source material below*"
    )

    values = {
        **fields,
        "core_idea": f"{thesis}{ctx_note}",
        "key_insights": _extract_insights(full, exclude_title=fields.get("title", "")),
        "applications": (
            "- *How does this apply to your current work?*\n"
            "- *What existing processes could this improve?*\n"
            "- *What new opportunities does this create?*"
        ),
        "actions": actions_text,
        "open_questions": (
            "- *What needs further investigation?*\n"
            "- *What assumptions need validation?*\n"
            "- *What are the unknowns?*"
        ),
    }
    return TEMPLATES["concept"].format(**values)


# --- Helpers ---

# Words that signal promotional/CTA content (penalized in scoring)
_CTA_PATTERNS = re.compile(
    r"(check out|subscribe|follow me|join|sign up|click|free trending|daily\s*\.?\s*$)",
    re.IGNORECASE,
)

# Words that signal substantive content (boosted in scoring)
_INSIGHT_KEYWORDS = {
    "key", "important", "strategy", "approach", "insight", "learn", "result",
    "success", "fail", "grow", "build", "create", "improve", "optimize",
    "scale", "revenue", "profit", "cost", "customer", "user", "product",
    "system", "process", "framework", "model", "method", "principle",
    "business", "niche", "vertical", "clients", "service", "playbook",
    "opportunity", "workflow", "automate", "intelligence", "operating",
}

# Verbs that start actionable sentences
_ACTION_VERBS = {
    "pick", "choose", "select", "find", "create", "build", "make", "run",
    "start", "launch", "deploy", "set", "turn", "record", "document",
    "transcribe", "use", "implement", "define", "identify", "get", "grow",
    "upsell", "charge", "land", "convert", "validate", "research",
}


def _truncate(text: str, max_len: int) -> str:
    if len(text) <= max_len:
        return text
    return text[:max_len - 3].strip() + "..."


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences, handling URLs and abbreviations."""
    # Split on sentence-ending punctuation followed by space+capital or newline
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z\n])", text)
    sentences = []
    for part in parts:
        # Also split on double newlines (paragraph breaks)
        for sub in part.split("\n\n"):
            clean = sub.strip()
            if clean:
                sentences.append(clean)
    return sentences


def _get_paragraphs(text: str) -> list[str]:
    """Split text into non-empty paragraphs."""
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]


def _extract_thesis(text: str, max_chars: int = 600) -> str:
    """Extract the core thesis — first 2-3 substantial paragraphs."""
    paragraphs = _get_paragraphs(text)
    parts = []
    total = 0
    for p in paragraphs:
        # Skip short headers, section labels, or CTA lines
        if len(p) < 25 or _CTA_PATTERNS.search(p):
            continue
        # Skip lines that are just numbered steps (save for actions section)
        if re.match(r"^\d+[.)]\s", p):
            continue
        parts.append(p)
        total += len(p)
        if total >= max_chars:
            break
    return "\n\n".join(parts) if parts else _truncate(text, max_chars)


def _extract_steps(text: str) -> list[str]:
    """Extract numbered, bulleted, and arrow-prefixed steps from text."""
    lines = text.split("\n")
    steps = []

    for line in lines:
        stripped = line.strip()
        if not stripped or len(stripped) < 8:
            continue
        # Numbered: "1.", "2)", etc.
        if re.match(r"^\d+[.)]\s+", stripped):
            steps.append(stripped)
        # Arrow: "→", "->", "=>"
        elif stripped.startswith(("→ ", "-> ", "=> ")):
            steps.append(stripped)
        # Bullet: "- " or "* " (but not markdown horizontal rules)
        elif re.match(r"^[-*]\s+\S", stripped) and len(stripped) > 10:
            steps.append(stripped)

    return steps


def _extract_action_items(text: str) -> list[str]:
    """Extract actionable items: steps + imperative sentences."""
    items = _extract_steps(text)

    # Also pick up imperative sentences (start with action verb)
    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped or len(stripped) < 15 or stripped in items:
            continue
        first_word = stripped.split()[0].rstrip(".,!:").lower()
        if first_word in _ACTION_VERBS and not _CTA_PATTERNS.search(stripped):
            items.append(stripped)

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for item in items:
        key = item.lower()[:60]
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique[:15]


def _extract_insights(text: str, exclude_title: str = "") -> str:
    """Extract key insight-like sentences from text."""
    paragraphs = _get_paragraphs(text)
    candidates = []
    title_lower = exclude_title.lower().strip() if exclude_title else ""
    # Skip paragraphs that overlap with the thesis (first ~600 chars shown in Core Idea)
    thesis_text = text[:600].lower()

    for para in paragraphs:
        # Skip very short or very long paragraphs
        if len(para) < 30 or len(para) > 500:
            continue
        # Skip the title itself or near-duplicates of it
        if title_lower and para.lower().strip().startswith(title_lower[:40]):
            continue
        # Skip paragraphs already shown in the thesis/core idea section
        if para.lower().strip()[:50] in thesis_text:
            continue
        # Skip CTAs and promotional
        if _CTA_PATTERNS.search(para):
            continue
        # Skip pure numbered steps (those go in actions)
        if re.match(r"^\d+[.)]\s", para):
            continue
        # Skip arrow-only items
        if para.startswith(("→ ", "-> ")):
            continue
        candidates.append(para)

    # Score each candidate
    scored = []
    seen_prefixes = set()
    for s in candidates:
        # Deduplicate by first 50 chars
        prefix = s.lower()[:50]
        if prefix in seen_prefixes:
            continue
        seen_prefixes.add(prefix)

        words = set(s.lower().split())
        score = len(words & _INSIGHT_KEYWORDS) * 2

        # Boost contrasts ("not X, but Y" / "You're not ... You're ...")
        if re.search(r"\bnot\b.{3,30}\b(but|instead|you're)\b", s, re.I):
            score += 4
        # Boost financial data
        if re.search(r"\$[\d,]+", s):
            score += 3
        # Boost framework/model statements
        if re.search(r"(the playbook|the idea|the math|the money|why it works)", s, re.I):
            score += 3
        # Boost strong claims
        if re.search(r"(most businesses|most people|the key|this is where)", s, re.I):
            score += 2
        # Slight length bonus (prefer meatier sentences)
        score += min(len(s) / 150, 2)
        # Penalize promotional
        if _CTA_PATTERNS.search(s):
            score -= 10

        scored.append((score, s))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:6]

    if top:
        return "\n".join(f"- {s}" for _, s in top)

    return "- *No key insights could be extracted automatically.*"


def _extract_financial_lines(text: str) -> list[str]:
    """Extract lines with actual pricing, revenue projections, or metric breakdowns."""
    lines = text.split("\n")
    results = []
    for line in lines:
        stripped = line.strip()
        if not stripped or len(stripped) < 15:
            continue
        if _CTA_PATTERNS.search(stripped):
            continue
        # Count dollar amounts in the line — require concrete pricing, not passing mentions
        dollar_count = len(re.findall(r"\$[\d,]+", stripped))
        has_rate = bool(re.search(r"\$/?(month|mo|yr|year|engagement|week)\b", stripped, re.I))
        has_projection = bool(re.search(r"(months?\s+[\d–\-]+|total\s+by|=\s*\$)", stripped, re.I))
        # Only include lines with multiple dollar amounts, pricing rates, or projections
        if dollar_count >= 2 or has_rate or (dollar_count >= 1 and has_projection):
            results.append(stripped)
    return results[:12]


def _extract_timeline_items(text: str) -> list[tuple[str, str]]:
    """Extract timeline/milestone items like 'Months 1-3: ...'."""
    lines = text.split("\n")
    items = []
    for line in lines:
        stripped = line.strip()
        m = re.match(
            r"(Months?\s+[\d–\-]+|Weeks?\s+[\d–\-]+|Phase\s+\d+|Q[1-4])"
            r"[:\s]+(.+)",
            stripped, re.I,
        )
        if m:
            items.append((m.group(1).strip(), m.group(2).strip()))
    return items


def _extract_scope_and_prereqs(text: str) -> tuple[list[str], list[str]]:
    """Extract scope items (who/what this applies to) and prerequisites (tools/knowledge)."""
    scope = []
    prereqs = []

    # Skip first non-empty line (usually the title repeated)
    first_line = ""
    for line in text.split("\n"):
        if line.strip():
            first_line = line.strip().lower()
            break

    for line in text.split("\n"):
        stripped = line.strip()
        # Skip very short, very long, or CTA lines
        if not stripped or len(stripped) < 20 or len(stripped) > 150:
            continue
        if _CTA_PATTERNS.search(stripped):
            continue
        # Skip the title line
        if first_line and stripped.lower() == first_line:
            continue

        # Scope: lines describing target audience, verticals, or who this applies to
        # Must mention a specific role/audience AND have qualifying context
        if re.search(r"\b(teams?\s+at|agents?\s+at|employees?\s+(on|at|in)|clients?\s+in)\b", stripped, re.I):
            scope.append(stripped)
        elif re.search(r"\b(dealership|brokerage|solopreneur|vertical|niche)\b", stripped, re.I):
            scope.append(stripped)

        # Prerequisites: lines describing tools to use or things needed
        # Must be actionable (mentions using a specific tool/platform)
        if re.search(r"\b(with\s+(Wispr|Claude|Zapier|n8n)|using\s+\w+|requires?\s+\w+|need\s+\w+)\b", stripped, re.I):
            prereqs.append(stripped)
        elif re.search(r"\b(MCP integrations?|Claude (Projects|skills|memory)|connectors)\b", stripped, re.I):
            prereqs.append(stripped)

    return _dedupe(scope)[:6], _dedupe(prereqs)[:6]


def _dedupe(items: list[str]) -> list[str]:
    """Remove near-duplicate items."""
    seen = set()
    unique = []
    for item in items:
        key = item.lower()[:50]
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique


def _format_steps(text: str) -> str:
    """Extract and format all procedural steps and action items."""
    # Always use the full action items list (steps + imperative sentences)
    # to capture the complete playbook, not just arrows or numbered items
    actions = _extract_action_items(text)
    if actions:
        numbered = []
        for i, a in enumerate(actions[:15], 1):
            # Strip existing numbering/arrows for clean renumbering
            clean = re.sub(r"^(\d+[.)]\s+|→\s*|->?\s*|=>\s*|-\s+|\*\s+)", "", a)
            numbered.append(f"{i}. {clean}")
        return "\n".join(numbered)

    # Last resort: content summary
    return (
        "**From source material:**\n\n"
        f"> {_truncate(text, 500)}\n\n"
        "*Review the source material above and extract concrete steps.*"
    )


# --- AI Prompt Generation ---

def generate_prompt(data: dict, fmt: str, context: str = "") -> str:
    """Generate a ready-to-paste AI prompt for SOP/PID/Concept formats.

    The prompt embeds the scraped content + format-specific instructions.
    User copies it into Claude, ChatGPT, or Gemini to get the final document.
    """
    if fmt not in AI_PROMPTS:
        raise ValueError(f"No AI prompt template for format: {fmt}")

    fields = extract_tweet_content(data)
    context_block = f"### Additional Context\n\n{context}" if context else ""

    return AI_PROMPTS[fmt].format(
        author=fields["author"],
        source_url=fields["source_url"],
        date=fields["date"],
        content=fields["content"],
        linked_content=fields["linked_content"],
        context_block=context_block,
    )


# --- Main ---

def process(data: dict, fmt: str, context: str = "") -> str:
    """Process scraped data into the requested format."""
    fields = extract_tweet_content(data)

    if fmt == "markdown":
        return fill_markdown(fields)
    elif fmt == "sop":
        return fill_sop(fields, context)
    elif fmt == "pid":
        return fill_pid(fields, context)
    elif fmt == "concept":
        return fill_concept(fields, context)
    else:
        return fill_markdown(fields)


def main():
    parser = argparse.ArgumentParser(
        description="Transform scraped X content into structured documents"
    )
    parser.add_argument(
        "--format", "-f",
        choices=["markdown", "sop", "pid", "concept"],
        default="markdown",
        help="Output document format (default: markdown)",
    )
    parser.add_argument(
        "--input", "-i",
        help="Input JSON file (default: read from stdin)",
    )
    parser.add_argument(
        "--context", "-c",
        default="",
        help="Additional context for document generation (e.g. 'Apply to our SaaS onboarding')",
    )
    parser.add_argument(
        "--save", "-s",
        help="Save output to file",
    )

    args = parser.parse_args()

    # Read input
    if args.input:
        data = json.loads(Path(args.input).read_text())
    else:
        data = json.loads(sys.stdin.read())

    output = process(data, args.format, args.context)

    if args.save:
        save_path = Path(args.save)
        save_path.parent.mkdir(parents=True, exist_ok=True)
        save_path.write_text(output, encoding="utf-8")
        print(f"Saved to {save_path}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()
