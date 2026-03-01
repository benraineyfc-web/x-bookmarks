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
    sop       — Business Standard Operating Procedure
    pid       — Project Initiation Document
    concept   — Concept document (ideas, insights, applications)

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
    content = fields["full_text"]
    ctx_note = f"\n\n*User context: {context}*" if context else ""

    values = {
        **fields,
        "purpose_summary": (
            f"Based on content shared by {fields['author']}:{ctx_note}\n\n"
            f"> {_truncate(fields['content'], 300)}"
        ),
        "scope_items": (
            "- [ ] *Define the teams/systems/processes this applies to*\n"
            "- [ ] *Define the frequency of execution*\n"
            "- [ ] *Define any prerequisites or dependencies*"
        ),
        "prerequisites": (
            "- [ ] *List prerequisites extracted from the source content*\n"
            "- [ ] *List tools, access, or knowledge required*"
        ),
        "procedure_steps": _extract_steps(content),
        "outcomes": (
            "- [ ] *Define expected results when this procedure is followed correctly*\n"
            "- [ ] *Define metrics for measuring success*"
        ),
        "notes": (
            f"- Original source: {fields['source_url']}\n"
            f"- Author: {fields['author']}\n"
            "- [ ] *Add implementation notes, edge cases, exceptions*"
        ),
    }
    return TEMPLATES["sop"].format(**values)


def fill_pid(fields: dict, context: str = "") -> str:
    ctx_note = f"\n\n*User context: {context}*" if context else ""

    values = {
        **fields,
        "overview": (
            f"Project inspired by content from {fields['author']}.{ctx_note}\n\n"
            f"> {_truncate(fields['content'], 300)}"
        ),
        "objectives": (
            "- [ ] *Primary objective derived from the source content*\n"
            "- [ ] *Secondary objectives*\n"
            "- [ ] *Define measurable key results*"
        ),
        "in_scope": (
            "- [ ] *Define what's included in this project*\n"
            "- [ ] *Define boundaries*"
        ),
        "deliverables": (
            "- [ ] *List concrete deliverables*\n"
            "- [ ] *Define acceptance criteria for each*"
        ),
        "approach": _extract_steps(fields["full_text"]),
        "risks": (
            "| Risk | Impact | Likelihood | Mitigation |\n"
            "|------|--------|------------|------------|\n"
            "| *Identify from source* | TBD | TBD | TBD |\n"
            "| *Technical complexity* | TBD | TBD | TBD |"
        ),
        "success_criteria": (
            "- [ ] *Define what success looks like*\n"
            "- [ ] *Define measurable outcomes*\n"
            "- [ ] *Define timeline constraints*"
        ),
    }
    return TEMPLATES["pid"].format(**values)


def fill_concept(fields: dict, context: str = "") -> str:
    ctx_note = f"\n\n*User context: {context}*" if context else ""

    values = {
        **fields,
        "core_idea": (
            f"{fields['content']}{ctx_note}"
        ),
        "key_insights": (
            _extract_insights(fields["full_text"])
        ),
        "applications": (
            "- [ ] *How does this apply to your current work?*\n"
            "- [ ] *What existing processes could this improve?*\n"
            "- [ ] *What new opportunities does this create?*"
        ),
        "actions": (
            "- [ ] *Immediate actions you can take*\n"
            "- [ ] *Research or validation needed*\n"
            "- [ ] *People to discuss this with*"
        ),
        "open_questions": (
            "- [ ] *What needs further investigation?*\n"
            "- [ ] *What assumptions need validation?*\n"
            "- [ ] *What are the unknowns?*"
        ),
    }
    return TEMPLATES["concept"].format(**values)


# --- Helpers ---

def _truncate(text: str, max_len: int) -> str:
    if len(text) <= max_len:
        return text
    return text[:max_len - 3].strip() + "..."


def _extract_steps(text: str) -> str:
    """Extract numbered or bulleted steps from text, or create placeholder steps."""
    lines = text.split("\n")
    steps = []

    for line in lines:
        stripped = line.strip()
        # Match numbered lines (1. 2. etc.) or bullet lines (- * etc.)
        if stripped and (
            len(stripped) > 5
            and (stripped[0].isdigit() or stripped[0] in "-*")
        ):
            steps.append(stripped)

    if steps:
        return "\n".join(f"  {s}" for s in steps[:20])

    # No structured steps found — create scaffolding from content
    return (
        "**Steps extracted from source:**\n\n"
        f"> {_truncate(text, 500)}\n\n"
        "**Action items:**\n\n"
        "1. [ ] *Analyze the above content and extract key steps*\n"
        "2. [ ] *Validate steps against your specific context*\n"
        "3. [ ] *Assign owners and timelines*\n"
        "4. [ ] *Execute and track progress*"
    )


def _extract_insights(text: str) -> str:
    """Extract key insight-like sentences from text."""
    sentences = []
    for delim_pattern in [". ", "! ", "? "]:
        parts = text.split(delim_pattern)
        for part in parts:
            clean = part.strip()
            if len(clean) > 30 and len(clean) < 300:
                sentences.append(clean)

    # Pick up to 5 most interesting-looking sentences
    # (heuristic: longer sentences with keywords tend to be more insightful)
    insight_keywords = {"key", "important", "strategy", "approach", "insight",
                        "learn", "result", "success", "fail", "grow", "build",
                        "create", "improve", "optimize", "scale", "revenue",
                        "profit", "cost", "customer", "user", "product", "system",
                        "process", "framework", "model", "method", "principle"}

    scored = []
    for s in sentences:
        words = set(s.lower().split())
        score = len(words & insight_keywords) + (len(s) / 100)
        scored.append((score, s))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:5]

    if top:
        return "\n".join(f"- {s}" for _, s in top)

    return "- [ ] *Extract key insights from the source material below*"


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
