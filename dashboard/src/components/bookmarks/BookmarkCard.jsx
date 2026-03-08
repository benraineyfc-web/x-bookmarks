import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MdOpenInNew, MdFavorite, MdRepeat, MdVisibility,
  MdStar, MdStarBorder, MdDelete, MdPlayCircle,
  MdImage, MdArticle, MdFormatQuote,
} from "react-icons/md";
import { db } from "../../lib/db";
import { getCategoryColor } from "../../lib/categorize";
import BookmarkDetailDialog from "./BookmarkDetailDialog";

const BADGE_VARIANTS = {
  purple: "bg-purple-100 text-purple-700", blue: "bg-blue-100 text-blue-700",
  pink: "bg-pink-100 text-pink-700", cyan: "bg-cyan-100 text-cyan-700",
  teal: "bg-teal-100 text-teal-700", orange: "bg-orange-100 text-orange-700",
  red: "bg-red-100 text-red-700", green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700", gray: "bg-gray-100 text-gray-700",
};

function formatNumber(n) {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try { return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); } catch { return dateStr; }
}

/** Image component that shows a placeholder on error instead of hiding */
function SafeImg({ src, alt, className, loading, onClick }) {
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
function getAuthorInfo(bookmark) {
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

export default function BookmarkCard({ bookmark, onSelect, isSelected, onTagClick, onDelete, onFavoriteToggle }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [isFav, setIsFav] = useState(bookmark.favorite || false);
  // Resolve best URL for each media item, preferring non-t.co URLs
  const validMedia = (bookmark.media || []).map(m => {
    const bestUrl = [m.url, m.preview_image_url, m.video_url].find(
      u => u && u.startsWith('http') && !u.includes('t.co/')
    );
    if (!bestUrl) return null;
    return { ...m, url: m.url?.includes('t.co/') ? bestUrl : m.url, preview_image_url: m.preview_image_url || bestUrl };
  }).filter(Boolean);
  const hasMedia = validMedia.length > 0;
  const hasQuote = bookmark.quoteTweet && bookmark.quoteTweet.text;
  const hasUrls = bookmark.urls && bookmark.urls.length > 0;
  const hasScraped = bookmark.scraped_json && Object.keys(bookmark.scraped_json).length > 0;
  const hasNotes = bookmark.notes && bookmark.notes.trim();

  const { username: authorUsername, name: authorName } = getAuthorInfo(bookmark);

  const handleFavorite = async (e) => {
    e.stopPropagation();
    const newVal = !isFav;
    setIsFav(newVal);
    await db.bookmarks.update(bookmark.id, { favorite: newVal });
    onFavoriteToggle?.(bookmark.id, newVal);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    await db.bookmarks.delete(bookmark.id);
    onDelete?.(bookmark.id);
  };

  const handleCardClick = (e) => {
    if (e.target.closest("button") || e.target.closest("a") || e.target.closest('[role="checkbox"]')) return;
    setDetailOpen(true);
  };

  return (
    <>
      <Card
        className={`cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md group ${isSelected ? "ring-2 ring-primary bg-accent/50" : ""}`}
        onClick={handleCardClick}
      >
        {/* Media preview at top of card */}
        {hasMedia && (
          <div className={`overflow-hidden ${validMedia.length === 1 ? "" : "grid grid-cols-2 gap-0.5"}`}>
            {validMedia.slice(0, 4).map((m, i) => (
              <div key={i} className={`relative overflow-hidden ${validMedia.length === 1 ? "max-h-[200px]" : "max-h-[120px]"} bg-muted`}>
                {(m.type === "video" || m.type === "animated_gif") ? (
                  <div className="relative w-full h-full min-h-[100px] flex items-center justify-center bg-muted">
                    <SafeImg src={m.preview_image_url || m.url} className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <MdPlayCircle className="size-8 text-white drop-shadow-lg" />
                    </div>
                    {m.type === "video" && <span className="absolute bottom-1 right-1 text-[9px] text-white bg-black/60 px-1.5 py-0.5 rounded">Video</span>}
                  </div>
                ) : (
                  <SafeImg
                    src={m.url}
                    alt={m.alt_text || ""}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
                {i === 3 && validMedia.length > 4 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">+{validMedia.length - 4}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <CardContent className="p-4">
          {/* Author row with selection checkbox */}
          <div className="flex items-center gap-2.5 mb-2">
            {onSelect && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect(bookmark)}
                onClick={(e) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100 transition-opacity shrink-0"
              />
            )}
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                {authorName[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">{authorName}</p>
              {authorUsername && <p className="text-[11px] text-muted-foreground leading-tight">@{authorUsername}</p>}
            </div>
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="size-6" onClick={handleFavorite}>
                {isFav ? <MdStar className="size-3.5 text-orange-400" /> : <MdStarBorder className="size-3.5 text-muted-foreground" />}
              </Button>
              <a href={bookmark.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="size-6"><MdOpenInNew className="size-3.5 text-muted-foreground" /></Button>
              </a>
              <Button variant="ghost" size="icon" className="size-6 hover:text-destructive" onClick={handleDelete}>
                <MdDelete className="size-3.5 text-muted-foreground" />
              </Button>
            </div>
            {isFav && (
              <MdStar className="size-4 text-orange-400 shrink-0 group-hover:hidden" />
            )}
          </div>

          {/* Tweet text - truncated */}
          <p className="text-sm leading-relaxed whitespace-pre-wrap line-clamp-4 mb-2">
            {bookmark.text}
          </p>

          {/* Quote tweet preview */}
          {hasQuote && (
            <div className="border rounded-lg p-2.5 mb-2 bg-muted/50">
              <div className="flex items-center gap-1.5 mb-1">
                <MdFormatQuote className="size-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold text-muted-foreground">
                  @{bookmark.quoteTweet.author_username}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{bookmark.quoteTweet.text}</p>
              {bookmark.quoteTweet.media?.length > 0 && (
                <div className="flex gap-1 mt-1.5">
                  {bookmark.quoteTweet.media.slice(0, 2).map((m, i) => (
                    <SafeImg key={i} src={m.url} className="h-12 w-16 object-cover rounded" loading="lazy" />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* URL/article link card preview */}
          {hasUrls && !hasQuote && (
            <div className="border rounded-lg overflow-hidden mb-2 bg-muted/50">
              {bookmark.urls[0].thumbnail && (
                <SafeImg src={bookmark.urls[0].thumbnail} className="w-full h-24 object-cover" loading="lazy" />
              )}
              <div className="p-2">
                {bookmark.urls[0].title && <p className="text-xs font-semibold line-clamp-1">{bookmark.urls[0].title}</p>}
                {bookmark.urls[0].description && <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{bookmark.urls[0].description}</p>}
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{bookmark.urls[0].display_url || bookmark.urls[0].url}</p>
              </div>
            </div>
          )}

          {/* Categories */}
          {bookmark.categories && bookmark.categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {bookmark.categories.map((cat) => (
                <span key={cat} className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium rounded-full ${BADGE_VARIANTS[getCategoryColor(cat)] || BADGE_VARIANTS.gray}`}>
                  {cat}
                </span>
              ))}
            </div>
          )}

          {/* Footer: stats + metadata indicators */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground"><MdFavorite className="size-3 text-red-400" /> {formatNumber(bookmark.likes)}</span>
              <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground"><MdRepeat className="size-3 text-green-500" /> {formatNumber(bookmark.retweets)}</span>
              <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground"><MdVisibility className="size-3" /> {formatNumber(bookmark.views)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {hasMedia && <MdImage className="size-3.5 text-muted-foreground" title={`${validMedia.length} media`} />}
              {hasScraped && <MdArticle className="size-3.5 text-blue-400" title="Has scraped content" />}
              {hasNotes && <span className="size-2 rounded-full bg-orange-400" title="Has notes" />}
              <span className="text-[10px] text-muted-foreground">{formatDate(bookmark.created_at)}</span>
            </div>
          </div>

          {/* Tags */}
          {bookmark.tags && bookmark.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {bookmark.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] h-5 cursor-pointer hover:bg-muted" onClick={(e) => { e.stopPropagation(); onTagClick?.(tag); }}>
                  #{tag}
                </Badge>
              ))}
              {bookmark.tags.length > 3 && <span className="text-[10px] text-muted-foreground self-center">+{bookmark.tags.length - 3}</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <BookmarkDetailDialog
        bookmark={bookmark}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onFavoriteToggle={onFavoriteToggle}
        onDelete={onDelete}
        onTagClick={onTagClick}
      />
    </>
  );
}
