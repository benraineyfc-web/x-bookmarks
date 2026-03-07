import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MdOpenInNew, MdFavorite, MdRepeat, MdVisibility,
  MdExpandMore, MdExpandLess, MdSave, MdDelete,
  MdStar, MdStarBorder, MdCheckCircle,
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
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch { return dateStr; }
}

export default function BookmarkCard({ bookmark, onSelect, isSelected, onTagClick, onDelete, onFavoriteToggle }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(bookmark.notes || "");
  const [savedNotes, setSavedNotes] = useState(bookmark.notes || "");
  const [isFav, setIsFav] = useState(bookmark.favorite || false);

  const hasScraped = bookmark.scraped_json && Object.keys(bookmark.scraped_json).length > 0;
  const notesChanged = notes !== savedNotes;
  const hasActions = bookmark.actionItems && bookmark.actionItems.length > 0;

  const saveNotes = async (e) => {
    e.stopPropagation();
    await db.bookmarks.update(bookmark.id, { notes });
    setSavedNotes(notes);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    await db.bookmarks.delete(bookmark.id);
    if (onDelete) onDelete(bookmark.id);
  };

  const handleFavorite = async (e) => {
    e.stopPropagation();
    const newVal = !isFav;
    setIsFav(newVal);
    await db.bookmarks.update(bookmark.id, { favorite: newVal });
    if (onFavoriteToggle) onFavoriteToggle(bookmark.id, newVal);
  };

  return (
    <Card
      className={`cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${isSelected ? "ring-2 ring-primary" : ""}`}
      onClick={() => onSelect && onSelect(bookmark)}
    >
      <CardContent className="p-4">
        {/* Author row */}
        <div className="flex items-center gap-2.5 mb-2.5">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {(bookmark.author_name || bookmark.author_username || "?")[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{bookmark.author_name || bookmark.author_username}</p>
            <p className="text-xs text-muted-foreground">@{bookmark.author_username}</p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" onClick={handleFavorite}>
                  {isFav ? <MdStar className="size-4 text-orange-400" /> : <MdStarBorder className="size-4 text-muted-foreground" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isFav ? "Unfavorite" : "Favorite"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <a href={bookmark.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="size-7"><MdOpenInNew className="size-4 text-muted-foreground" /></Button>
                </a>
              </TooltipTrigger>
              <TooltipContent>Open on X</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" onClick={handleDelete}>
                  <MdDelete className="size-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <p className={`text-sm leading-relaxed whitespace-pre-wrap mb-3 ${expanded ? "" : "line-clamp-5"}`}>
          {bookmark.text}
        </p>

        {bookmark.categories && bookmark.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {bookmark.categories.map((cat) => (
              <span key={cat} className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${BADGE_VARIANTS[getCategoryColor(cat)] || BADGE_VARIANTS.gray}`}>
                {cat}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2.5 border-t">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><MdFavorite className="size-3.5 text-red-400" /> {formatNumber(bookmark.likes)}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><MdRepeat className="size-3.5 text-green-500" /> {formatNumber(bookmark.retweets)}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><MdVisibility className="size-3.5" /> {formatNumber(bookmark.views)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-medium">x.com</span>
            <span className="text-[10px] text-muted-foreground">{formatDate(bookmark.created_at)}</span>
            <Button variant="ghost" size="icon" className="size-6" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
              {expanded ? <MdExpandLess className="size-4" /> : <MdExpandMore className="size-4" />}
            </Button>
          </div>
        </div>

        {bookmark.tags && bookmark.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {bookmark.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs cursor-pointer hover:bg-muted" onClick={(e) => { e.stopPropagation(); onTagClick && onTagClick(tag); }}>
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-3">
            {hasActions && (
              <div>
                <p className="text-xs font-semibold text-green-600 mb-1.5">Actionable Steps</p>
                <div className="bg-green-50 rounded-lg p-2.5 space-y-1">
                  {bookmark.actionItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs">
                      <MdCheckCircle className="size-3.5 text-green-500 mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
              <Textarea value={notes} onChange={(e) => { e.stopPropagation(); setNotes(e.target.value); }} onClick={(e) => e.stopPropagation()} placeholder="Add personal notes..." className="text-xs min-h-[60px]" />
              {notesChanged && <Button size="sm" className="mt-1.5" onClick={saveNotes}><MdSave className="size-3.5 mr-1" /> Save</Button>}
            </div>
            {hasScraped && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Scraped Content</p>
                {bookmark.scraped_json.articles?.map((article, i) => (
                  <div key={i} className="bg-muted rounded-lg p-2.5 mb-2 text-xs">
                    <p className="font-semibold mb-0.5">{article.title || "Linked Article"}</p>
                    {article.description && <p className="text-muted-foreground mb-1">{article.description}</p>}
                    <p className="text-muted-foreground line-clamp-6 whitespace-pre-wrap">{article.markdown || article.text || ""}</p>
                    {article.url && <a href={article.url} target="_blank" rel="noopener" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>Open article</a>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
