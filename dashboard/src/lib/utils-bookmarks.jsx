import { useState } from "react";
import { MdImage } from "react-icons/md";

export const BADGE_VARIANTS = {
  purple: "bg-purple-100 text-purple-700", blue: "bg-blue-100 text-blue-700",
  pink: "bg-pink-100 text-pink-700", cyan: "bg-cyan-100 text-cyan-700",
  teal: "bg-teal-100 text-teal-700", orange: "bg-orange-100 text-orange-700",
  red: "bg-red-100 text-red-700", green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700", gray: "bg-gray-100 text-gray-700",
};

export function formatNumber(n) {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

export function formatDate(dateStr) {
  if (!dateStr) return "";
  try { return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); } catch { return dateStr; }
}

/** Image component that shows a placeholder on error instead of hiding */
export function SafeImg({ src, alt, className, loading, onClick }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-muted text-muted-foreground ${className || ""}`} style={{ minHeight: 60 }}>
        <MdImage className="size-6 opacity-40" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt || ""}
      className={className}
      loading={loading}
      onClick={onClick}
      onError={() => setFailed(true)}
    />
  );
}

/** Extract author info with URL fallback */
export function getAuthorInfo(bookmark) {
  let username = bookmark.author_username || "";
  let name = bookmark.author_name || "";

  // Fallback: extract from tweet URL
  if (!username && bookmark.url) {
    const match = bookmark.url.match(/(?:x\.com|twitter\.com)\/([^/]+)\/status/);
    if (match) username = match[1];
  }

  if (!name) name = username;
  if (!name) name = "Unknown";

  return { username, name };
}
