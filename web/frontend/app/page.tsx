"use client";

import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Format = "markdown" | "sop" | "pid" | "concept";

interface AuthStatus {
  authenticated: boolean;
  method: string;
}

const FORMAT_LABELS: Record<Format, { label: string; description: string }> = {
  markdown: { label: "Markdown", description: "Clean reference note" },
  sop: {
    label: "SOP",
    description: "Standard Operating Procedure",
  },
  pid: {
    label: "PID",
    description: "Project Initiation Document",
  },
  concept: {
    label: "Concept",
    description: "Key insights & action items",
  },
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<Format>("markdown");
  const [context, setContext] = useState("");
  const [result, setResult] = useState("");
  const [rawData, setRawData] = useState<object | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const [showContext, setShowContext] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/auth/status`, { credentials: "include" })
      .then((r) => r.json())
      .then(setAuth)
      .catch(() => setAuth({ authenticated: false, method: "none" }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!url.trim()) return;

      setLoading(true);
      setError("");
      setResult("");
      setRawData(null);

      try {
        const res = await fetch(`${API_URL}/scrape-and-process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            url: url.trim(),
            format,
            context: context.trim(),
            crawl_links: true,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail || `HTTP ${res.status}`);
        }

        const data = await res.json();
        setResult(data.document);
        setRawData(data.source);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [url, format, context]
  );

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const handleDownload = useCallback(() => {
    const ext = format === "markdown" ? "md" : "md";
    const blob = new Blob([result], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `scraped-${format}-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [result, format]);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          X Content Scraper
        </h1>
        <p style={{ color: "#888", fontSize: "0.9rem" }}>
          Paste a tweet or article URL. Get a structured document back.
        </p>
      </div>

      {/* Auth status */}
      {auth && !auth.authenticated && (
        <div
          style={{
            background: "#1a1a2e",
            border: "1px solid #333",
            borderRadius: 8,
            padding: "1rem",
            marginBottom: "1.5rem",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, marginBottom: "0.75rem", color: "#ccc" }}>
            Connect your X account to scrape tweets
          </p>
          <a
            href={`${API_URL}/auth/login`}
            style={{
              display: "inline-block",
              background: "#1d9bf0",
              color: "#fff",
              padding: "0.5rem 1.5rem",
              borderRadius: 20,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            Connect X Account
          </a>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        {/* URL Input */}
        <div style={{ marginBottom: "1rem" }}>
          <input
            type="url"
            placeholder="Paste an X/Twitter URL or article link..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              fontSize: "1rem",
              background: "#141414",
              border: "1px solid #333",
              borderRadius: 8,
              color: "#ededed",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Format Picker */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          {(Object.keys(FORMAT_LABELS) as Format[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              style={{
                padding: "0.6rem 0.5rem",
                background: format === f ? "#1d9bf0" : "#1a1a1a",
                border: `1px solid ${format === f ? "#1d9bf0" : "#333"}`,
                borderRadius: 8,
                color: format === f ? "#fff" : "#aaa",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: format === f ? 600 : 400,
                textAlign: "center",
              }}
            >
              <div>{FORMAT_LABELS[f].label}</div>
              <div
                style={{
                  fontSize: "0.65rem",
                  marginTop: 2,
                  opacity: 0.7,
                }}
              >
                {FORMAT_LABELS[f].description}
              </div>
            </button>
          ))}
        </div>

        {/* Context toggle */}
        {(format === "sop" || format === "pid" || format === "concept") && (
          <div style={{ marginBottom: "1rem" }}>
            {!showContext ? (
              <button
                type="button"
                onClick={() => setShowContext(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#1d9bf0",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  padding: 0,
                }}
              >
                + Add context (optional)
              </button>
            ) : (
              <textarea
                placeholder="Add context to guide the output, e.g. 'Apply to our SaaS onboarding flow'..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={2}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  fontSize: "0.9rem",
                  background: "#141414",
                  border: "1px solid #333",
                  borderRadius: 8,
                  color: "#ededed",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            )}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !url.trim()}
          style={{
            width: "100%",
            padding: "0.75rem",
            fontSize: "1rem",
            fontWeight: 600,
            background: loading ? "#333" : "#1d9bf0",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: loading ? "wait" : "pointer",
            opacity: !url.trim() ? 0.5 : 1,
          }}
        >
          {loading ? "Scraping..." : "Scrape & Generate"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            background: "#2d1515",
            border: "1px solid #5c2020",
            borderRadius: 8,
            color: "#f87171",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ marginTop: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.5rem",
            }}
          >
            <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>
              Result ({FORMAT_LABELS[format].label})
            </h2>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={handleCopy}
                style={{
                  padding: "0.4rem 0.75rem",
                  fontSize: "0.8rem",
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: 6,
                  color: copied ? "#4ade80" : "#aaa",
                  cursor: "pointer",
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={handleDownload}
                style={{
                  padding: "0.4rem 0.75rem",
                  fontSize: "0.8rem",
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: 6,
                  color: "#aaa",
                  cursor: "pointer",
                }}
              >
                Download
              </button>
            </div>
          </div>
          <pre
            style={{
              background: "#111",
              border: "1px solid #222",
              borderRadius: 8,
              padding: "1rem",
              overflow: "auto",
              maxHeight: "60vh",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: "0.85rem",
              lineHeight: 1.6,
              color: "#d4d4d4",
            }}
          >
            {result}
          </pre>
        </div>
      )}

      {/* Source data toggle */}
      {rawData && (
        <details style={{ marginTop: "1rem" }}>
          <summary
            style={{
              color: "#888",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            View raw scraped data (JSON)
          </summary>
          <pre
            style={{
              background: "#111",
              border: "1px solid #222",
              borderRadius: 8,
              padding: "1rem",
              overflow: "auto",
              maxHeight: "40vh",
              fontSize: "0.75rem",
              color: "#888",
              marginTop: "0.5rem",
            }}
          >
            {JSON.stringify(rawData, null, 2)}
          </pre>
        </details>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: "3rem",
          textAlign: "center",
          color: "#555",
          fontSize: "0.75rem",
        }}
      >
        <p>X Content Scraper v1.0 | Formats: Markdown, SOP, PID, Concept</p>
      </div>
    </div>
  );
}
