import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MdOpenInNew, MdFavorite, MdRepeat, MdVisibility, MdSave,
  MdStar, MdStarBorder, MdCheckCircle, MdContentCopy, MdClose,
  MdImage, MdPlayCircle, MdChat,
} from "react-icons/md";
import { db } from "../../lib/db";
import { getCategoryColor } from "../../lib/categorize";

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
  try { return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch { return dateStr; }
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  try { return new Date(dateStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

/** Parse tweet text into rich segments: text, @mentions, #hashtags, URLs */
function parseTweetText(text) {
  if (!text) return [];
  const parts = [];
  // Match URLs, @mentions, #hashtags
  const regex = /(https?:\/\/[^\s]+)|(@\w+)|(#\w+)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    if (match[1]) parts.push({ type: "url", value: match[1] });
    else if (match[2]) parts.push({ type: "mention", value: match[2] });
    else if (match[3]) parts.push({ type: "hashtag", value: match[3] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }
  return parts;
}

function RichText({ text }) {
  const parts = parseTweetText(text);
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.type === "url") {
          return <a key={i} href={part.value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{part.value}</a>;
        }
        if (part.type === "mention") {
          return <a key={i} href={`https://x.com/${part.value.slice(1)}`} target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">{part.value}</a>;
        }
        if (part.type === "hashtag") {
          return <span key={i} className="text-primary font-medium">{part.value}</span>;
        }
        return <span key={i}>{part.value}</span>;
      })}
    </p>
  );
}

export default function BookmarkDetailDialog({ bookmark, open, onOpenChange, onFavoriteToggle, onDelete, onTagClick }) {
  const [notes, setNotes] = useState(bookmark?.notes || "");
  const [savedNotes, setSavedNotes] = useState(bookmark?.notes || "");
  const [isFav, setIsFav] = useState(bookmark?.favorite || false);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!bookmark) return null;

  const hasMedia = bookmark.media && bookmark.media.length > 0;
  const hasQuote = bookmark.quoteTweet && bookmark.quoteTweet.text;
  const hasUrls = bookmark.urls && bookmark.urls.length > 0;
  const hasScraped = bookmark.scraped_json && Object.keys(bookmark.scraped_json).length > 0;
  const hasActions = bookmark.actionItems && bookmark.actionItems.length > 0;
  const notesChanged = notes !== savedNotes;

  const saveNotes = async () => {
    await db.bookmarks.update(bookmark.id, { notes });
    setSavedNotes(notes);
  };

  const handleFavorite = async () => {
    const newVal = !isFav;
    setIsFav(newVal);
    await db.bookmarks.update(bookmark.id, { favorite: newVal });
    onFavoriteToggle?.(bookmark.id, newVal);
  };

  const handleDelete = async () => {
    await db.bookmarks.delete(bookmark.id);
    onDelete?.(bookmark.id);
    onOpenChange(false);
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(bookmark.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          {/* Media gallery at top */}
          {hasMedia && (
            <div className={`grid gap-1 ${bookmark.media.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {bookmark.media.map((m, i) => (
                <div
                  key={i}
                  className={`relative overflow-hidden group ${bookmark.media.length === 1 ? "max-h-[500px]" : "max-h-[250px]"} ${i === 0 && bookmark.media.length === 3 ? "row-span-2" : ""}`}
                >
                  {(m.type === "video" || m.type === "animated_gif") ? (
                    m.video_url ? (
                      <video
                        src={m.video_url}
                        poster={m.preview_image_url || m.url}
                        controls
                        playsInline
                        loop={m.type === "animated_gif"}
                        autoPlay={m.type === "animated_gif"}
                        muted={m.type === "animated_gif"}
                        className="w-full h-full object-contain bg-black"
                      />
                    ) : (
                      <div className="relative w-full h-full min-h-[180px] bg-muted flex items-center justify-center cursor-pointer" onClick={() => window.open(bookmark.url, "_blank")}>
                        {(m.preview_image_url || m.url) && (
                          <img src={m.preview_image_url || m.url} alt="" className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <MdPlayCircle className="size-12 text-white drop-shadow-lg" />
                        </div>
                        <span className="absolute bottom-2 right-2 text-[10px] text-white bg-black/60 px-2 py-0.5 rounded">View on X</span>
                      </div>
                    )
                  ) : (
                    <img
                      src={m.url}
                      alt={m.alt_text || ""}
                      className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onClick={() => setLightboxImg(m.url)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="p-6 pt-4">
            {/* Author header */}
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="size-10">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                  {(bookmark.author_name || bookmark.author_username || "?")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{bookmark.author_name || bookmark.author_username}</p>
                <p className="text-sm text-muted-foreground">@{bookmark.author_username}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="size-8" onClick={handleFavorite}>
                  {isFav ? <MdStar className="size-5 text-orange-400" /> : <MdStarBorder className="size-5 text-muted-foreground" />}
                </Button>
                <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="size-8">
                    <MdOpenInNew className="size-5 text-muted-foreground" />
                  </Button>
                </a>
              </div>
            </div>

            {/* Tweet text - rich formatted */}
            <RichText text={bookmark.text} />

            {/* Quote tweet */}
            {hasQuote && (
              <div className="border rounded-xl p-4 mt-4 bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="size-6">
                    <AvatarFallback className="bg-muted-foreground text-background text-[9px]">
                      {(bookmark.quoteTweet.author_name || bookmark.quoteTweet.author_username || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-semibold">{bookmark.quoteTweet.author_name}</span>
                  <span className="text-xs text-muted-foreground">@{bookmark.quoteTweet.author_username}</span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{bookmark.quoteTweet.text}</p>
                {bookmark.quoteTweet.media?.length > 0 && (
                  <div className={`grid gap-1 mt-3 ${bookmark.quoteTweet.media.length === 1 ? "" : "grid-cols-2"}`}>
                    {bookmark.quoteTweet.media.map((m, i) => (
                      <img key={i} src={m.url} alt="" className="w-full max-h-[200px] object-cover rounded-lg cursor-pointer" loading="lazy" onClick={() => setLightboxImg(m.url)} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* URL/article link cards */}
            {hasUrls && (
              <div className="space-y-2 mt-4">
                {bookmark.urls.map((u, i) => (
                  <a key={i} href={u.url} target="_blank" rel="noopener noreferrer" className="block border rounded-xl overflow-hidden hover:bg-muted/50 transition-colors">
                    {u.thumbnail && (
                      <img src={u.thumbnail} alt="" className="w-full h-32 object-cover" loading="lazy" />
                    )}
                    <div className="p-3">
                      {u.title && <p className="text-sm font-semibold line-clamp-2">{u.title}</p>}
                      {u.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{u.description}</p>}
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><MdOpenInNew className="size-3" /> {u.display_url || u.url}</p>
                    </div>
                  </a>
                ))}
              </div>
            )}

            {/* Categories */}
            {bookmark.categories && bookmark.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {bookmark.categories.map((cat) => (
                  <span
                    key={cat}
                    className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full cursor-pointer hover:opacity-80 ${BADGE_VARIANTS[getCategoryColor(cat)] || BADGE_VARIANTS.gray}`}
                    onClick={() => { onTagClick?.(null); onOpenChange(false); }}
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}

            {/* Tags */}
            {bookmark.tags && bookmark.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {bookmark.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => { onTagClick?.(tag); onOpenChange(false); }}>
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}

            <Separator className="my-4" />

            {/* Engagement stats */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MdFavorite className="size-4 text-red-400" /> {formatNumber(bookmark.likes)}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MdRepeat className="size-4 text-green-500" /> {formatNumber(bookmark.retweets)}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MdVisibility className="size-4" /> {formatNumber(bookmark.views)}
                </span>
                {bookmark.replies > 0 && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MdChat className="size-4" /> {formatNumber(bookmark.replies)}
                  </span>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{formatDate(bookmark.created_at)}</p>
                <p className="text-xs text-muted-foreground">{formatTime(bookmark.created_at)}</p>
              </div>
            </div>

            {/* Copy + actions row */}
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={copyText}>
                <MdContentCopy className="mr-1 size-3.5" /> {copied ? "Copied!" : "Copy Text"}
              </Button>
              <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <MdOpenInNew className="mr-1 size-3.5" /> Open on X
                </Button>
              </a>
              <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={handleDelete}>
                Delete
              </Button>
            </div>

            {/* Tabbed content: Notes, Scraped, Actions */}
            {(hasScraped || hasActions || true) && (
              <Tabs defaultValue="notes" className="mt-5">
                <TabsList>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  {hasActions && <TabsTrigger value="actions">Actions ({bookmark.actionItems.length})</TabsTrigger>}
                  {hasScraped && <TabsTrigger value="scraped">Linked Content</TabsTrigger>}
                </TabsList>

                <TabsContent value="notes" className="mt-3">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add personal notes about this bookmark..."
                    className="min-h-[100px] text-sm"
                  />
                  {notesChanged && (
                    <Button size="sm" className="mt-2" onClick={saveNotes}>
                      <MdSave className="mr-1 size-3.5" /> Save Notes
                    </Button>
                  )}
                </TabsContent>

                {hasActions && (
                  <TabsContent value="actions" className="mt-3">
                    <div className="bg-green-50 rounded-lg p-4 space-y-2">
                      {bookmark.actionItems.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <MdCheckCircle className="size-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                )}

                {hasScraped && (
                  <TabsContent value="scraped" className="mt-3 space-y-3">
                    {bookmark.scraped_json.articles?.map((article, i) => (
                      <div key={i} className="bg-muted rounded-lg p-4">
                        <p className="font-semibold mb-1">{article.title || "Linked Article"}</p>
                        {article.description && (
                          <p className="text-sm text-muted-foreground mb-2">{article.description}</p>
                        )}
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {article.markdown || article.text || ""}
                        </p>
                        {article.url && (
                          <a href={article.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2">
                            <MdOpenInNew className="size-3.5" /> Open article
                          </a>
                        )}
                      </div>
                    ))}
                  </TabsContent>
                )}
              </Tabs>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center cursor-pointer" onClick={() => setLightboxImg(null)}>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20 size-10" onClick={() => setLightboxImg(null)}>
            <MdClose className="size-6" />
          </Button>
          <img src={lightboxImg} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
