import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  MdSearch, MdSelectAll, MdMoreVert, MdDelete, MdLabel, MdFolder,
  MdStarBorder, MdStar, MdViewModule, MdViewList, MdFilterList, MdSort,
  MdClose, MdAdd, MdContentCopy, MdCheckCircle,
} from "react-icons/md";
import BookmarkCard from "../components/bookmarks/BookmarkCard";
import { db } from "../lib/db";
import { getCategoryColor } from "../lib/categorize";

const SORT_OPTIONS = [
  { value: "importedAt-desc", label: "Recently Added" },
  { value: "created_at-desc", label: "Newest First" },
  { value: "created_at-asc", label: "Oldest First" },
  { value: "likes-desc", label: "Most Liked" },
  { value: "retweets-desc", label: "Most Retweeted" },
  { value: "views-desc", label: "Most Viewed" },
];

const PAGE_SIZE = 30;

export default function Bookmarks() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [bookmarks, setBookmarks] = useState([]);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [sortBy, setSortBy] = useState("importedAt-desc");
  const [filterTag, setFilterTag] = useState(searchParams.get("tag") || "");
  const [filterAuthor, setFilterAuthor] = useState("");
  const [filterCategory, setFilterCategory] = useState(searchParams.get("category") || "");
  const [filterFavorites, setFilterFavorites] = useState(searchParams.get("favorites") === "true");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);
  const [allTags, setAllTags] = useState([]);
  const [allAuthors, setAllAuthors] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [viewMode, setViewMode] = useState("grid");
  const [showFilters, setShowFilters] = useState(false);

  // Dialog states
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [collections, setCollections] = useState([]);
  const [newCollectionName, setNewCollectionName] = useState("");

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setFilterTag(searchParams.get("tag") || "");
    setFilterCategory(searchParams.get("category") || "");
    setFilterFavorites(searchParams.get("favorites") === "true");
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      const all = await db.bookmarks.toArray();
      setBookmarks(all);
      const tags = new Set(), authors = new Set(), categories = new Set();
      for (const bm of all) {
        if (bm.tags) bm.tags.forEach((t) => tags.add(t));
        if (bm.author_username) authors.add(bm.author_username);
        if (bm.categories) bm.categories.forEach((c) => categories.add(c));
      }
      setAllTags([...tags].sort());
      setAllAuthors([...authors].sort());
      setAllCategories([...categories].sort());
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = [...bookmarks];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((bm) =>
        (bm.text || "").toLowerCase().includes(q) ||
        (bm.author_username || "").toLowerCase().includes(q) ||
        (bm.author_name || "").toLowerCase().includes(q)
      );
    }
    if (filterTag) result = result.filter((bm) => bm.tags && bm.tags.includes(filterTag));
    if (filterAuthor) result = result.filter((bm) => bm.author_username === filterAuthor);
    if (filterCategory) {
      if (filterCategory === "unsorted") result = result.filter((bm) => !bm.categories || bm.categories.length === 0);
      else result = result.filter((bm) => bm.categories && bm.categories.includes(filterCategory));
    }
    if (filterFavorites) result = result.filter((bm) => bm.favorite);
    if (dateFrom) { const from = new Date(dateFrom); result = result.filter((bm) => new Date(bm.created_at || bm.importedAt || 0) >= from); }
    if (dateTo) { const to = new Date(dateTo); to.setHours(23, 59, 59, 999); result = result.filter((bm) => new Date(bm.created_at || bm.importedAt || 0) <= to); }

    const [field, dir] = sortBy.split("-");
    result.sort((a, b) => {
      let va = a[field] || 0, vb = b[field] || 0;
      if (typeof va === "string") { va = va.toLowerCase(); vb = (vb || "").toLowerCase(); }
      if (dir === "desc") return va > vb ? -1 : va < vb ? 1 : 0;
      return va < vb ? -1 : va > vb ? 1 : 0;
    });
    return result;
  }, [bookmarks, search, sortBy, filterTag, filterAuthor, filterCategory, filterFavorites, dateFrom, dateTo]);

  const paged = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);

  const toggleSelect = useCallback((bm) => {
    setSelected((prev) => { const next = new Set(prev); if (next.has(bm.id)) next.delete(bm.id); else next.add(bm.id); return next; });
  }, []);

  const selectAll = () => setSelected(new Set(filtered.map((bm) => bm.id)));
  const clearSelection = () => setSelected(new Set());

  const deleteSelected = async () => {
    if (!selected.size) return;
    const count = selected.size;
    await db.bookmarks.bulkDelete([...selected]);
    setBookmarks((prev) => prev.filter((bm) => !selected.has(bm.id)));
    setSelected(new Set());
    toast.success(`Deleted ${count} bookmark${count !== 1 ? "s" : ""}`);
  };

  const handleDelete = (id) => {
    setBookmarks((prev) => prev.filter((bm) => bm.id !== id));
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const handleFavoriteToggle = (id, val) => {
    setBookmarks((prev) => prev.map((bm) => (bm.id === id ? { ...bm, favorite: val } : bm)));
  };

  const exportSelected = () => navigate("/export", { state: { selectedIds: [...selected] } });

  // Tag dialog
  const openTagDialog = () => { setTagInput(""); setTagDialogOpen(true); };
  const addTagToSelected = async () => {
    const tag = tagInput.trim();
    if (!tag) return;
    const ids = [...selected];
    await db.transaction("rw", db.bookmarks, async () => {
      for (const id of ids) {
        const bm = await db.bookmarks.get(id);
        if (bm) { const tags = new Set(bm.tags || []); tags.add(tag); await db.bookmarks.update(id, { tags: [...tags] }); }
      }
    });
    setBookmarks(await db.bookmarks.toArray());
    setTagDialogOpen(false);
    toast.success(`Added tag "${tag}" to ${ids.length} bookmark${ids.length !== 1 ? "s" : ""}`);
  };

  // Collection dialog
  const openCollectionDialog = async () => {
    const colls = await db.collections.toArray();
    setCollections(colls);
    setNewCollectionName("");
    setCollectionDialogOpen(true);
  };

  const addToCollection = async (collId) => {
    for (const bmId of selected) {
      const exists = await db.collectionItems.where("collectionId").equals(collId).filter((i) => i.bookmarkId === bmId).first();
      if (!exists) await db.collectionItems.add({ collectionId: collId, bookmarkId: bmId });
    }
    const coll = collections.find((c) => c.id === collId);
    toast.success(`Added ${selected.size} bookmark${selected.size !== 1 ? "s" : ""} to "${coll?.name || "collection"}"`);
    setSelected(new Set());
    setCollectionDialogOpen(false);
  };

  const createAndAddToCollection = async () => {
    const name = newCollectionName.trim();
    if (!name) return;
    const collId = await db.collections.add({ name, createdAt: new Date().toISOString() });
    for (const bmId of selected) {
      await db.collectionItems.add({ collectionId: collId, bookmarkId: bmId });
    }
    toast.success(`Created "${name}" with ${selected.size} bookmark${selected.size !== 1 ? "s" : ""}`);
    setSelected(new Set());
    setCollectionDialogOpen(false);
  };

  const favoriteSelected = async () => {
    const ids = [...selected];
    await db.transaction("rw", db.bookmarks, async () => {
      for (const id of ids) await db.bookmarks.update(id, { favorite: true });
    });
    setBookmarks((prev) => prev.map((bm) => selected.has(bm.id) ? { ...bm, favorite: true } : bm));
    toast.success(`Favorited ${ids.length} bookmark${ids.length !== 1 ? "s" : ""}`);
  };

  const hasActiveFilters = filterTag || filterAuthor || filterCategory || filterFavorites || search || dateFrom || dateTo;

  let heading = "All Bookmarks";
  if (filterCategory === "unsorted") heading = "Unsorted";
  else if (filterCategory) heading = filterCategory;
  else if (filterFavorites) heading = "Favorites";
  else if (filterTag) heading = `#${filterTag}`;
  else if (filterAuthor) heading = `@${filterAuthor}`;

  return (
    <div>
      {/* Header bar */}
      <div className="flex items-center gap-3 mb-5">
        <SidebarTrigger />
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          <h1 className="text-lg font-bold">{heading}</h1>
          <span className="text-sm text-muted-foreground">{filtered.length} bookmark{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative max-w-[240px]">
            <MdSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Input placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-8 h-8 text-sm" />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm"><MdSort className="mr-1" /> {SORT_OPTIONS.find((o) => o.value === sortBy)?.label || "Sort"}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuItem key={opt.value} onClick={() => setSortBy(opt.value)} className={sortBy === opt.value ? "font-semibold" : ""}>
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant={showFilters ? "default" : "ghost"} size="sm" onClick={() => setShowFilters(!showFilters)}>
            <MdFilterList className="mr-1" /> Filters
          </Button>

          <div className="flex gap-0.5">
            <Button variant={viewMode === "grid" ? "default" : "ghost"} size="icon" className="size-8" onClick={() => setViewMode("grid")}><MdViewModule className="size-4" /></Button>
            <Button variant={viewMode === "list" ? "default" : "ghost"} size="icon" className="size-8" onClick={() => setViewMode("list")}><MdViewList className="size-4" /></Button>
          </div>

          <Button variant="ghost" size="sm" onClick={selectAll}><MdSelectAll className="mr-1" /> Select All</Button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <Card className="mb-4">
          <CardContent className="p-3">
            <div className="flex gap-2.5 flex-wrap items-center">
              {allCategories.length > 0 && (
                <select className="h-8 text-sm rounded-md border bg-background px-2" value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}>
                  <option value="">All Categories</option>
                  <option value="unsorted">Unsorted</option>
                  {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {allTags.length > 0 && (
                <select className="h-8 text-sm rounded-md border bg-background px-2" value={filterTag} onChange={(e) => { setFilterTag(e.target.value); setPage(1); }}>
                  <option value="">All Tags</option>
                  {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              {allAuthors.length > 0 && (
                <select className="h-8 text-sm rounded-md border bg-background px-2" value={filterAuthor} onChange={(e) => { setFilterAuthor(e.target.value); setPage(1); }}>
                  <option value="">All Authors</option>
                  {allAuthors.map((a) => <option key={a} value={a}>@{a}</option>)}
                </select>
              )}
              <Button variant={filterFavorites ? "default" : "outline"} size="sm" onClick={() => { setFilterFavorites(!filterFavorites); setPage(1); }}>
                {filterFavorites ? <MdStar className="mr-1" /> : <MdStarBorder className="mr-1" />} Favorites
              </Button>
              <Input type="date" className="h-8 text-sm max-w-[145px]" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} title="From date" />
              <Input type="date" className="h-8 text-sm max-w-[145px]" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} title="To date" />
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                  setSearch(""); setFilterTag(""); setFilterAuthor(""); setFilterCategory(""); setFilterFavorites(false); setDateFrom(""); setDateTo(""); setPage(1);
                }}>
                  Clear All
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active filter pills */}
      {hasActiveFilters && (
        <div className="flex gap-1.5 flex-wrap mb-4">
          {search && <Badge variant="secondary" className="gap-1">"{search}" <MdClose className="size-3 cursor-pointer" onClick={() => setSearch("")} /></Badge>}
          {filterCategory && <Badge variant="secondary" className="gap-1">{filterCategory === "unsorted" ? "Unsorted" : filterCategory} <MdClose className="size-3 cursor-pointer" onClick={() => setFilterCategory("")} /></Badge>}
          {filterTag && <Badge variant="secondary" className="gap-1">#{filterTag} <MdClose className="size-3 cursor-pointer" onClick={() => setFilterTag("")} /></Badge>}
          {filterAuthor && <Badge variant="secondary" className="gap-1">@{filterAuthor} <MdClose className="size-3 cursor-pointer" onClick={() => setFilterAuthor("")} /></Badge>}
          {filterFavorites && <Badge variant="secondary" className="gap-1">Favorites <MdClose className="size-3 cursor-pointer" onClick={() => setFilterFavorites(false)} /></Badge>}
          {(dateFrom || dateTo) && <Badge variant="secondary" className="gap-1">{dateFrom || "..."} - {dateTo || "..."} <MdClose className="size-3 cursor-pointer" onClick={() => { setDateFrom(""); setDateTo(""); }} /></Badge>}
        </div>
      )}

      {/* Selection toolbar */}
      {selected.size > 0 && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardContent className="p-2.5 px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox checked={selected.size === filtered.length} onCheckedChange={(checked) => checked ? selectAll() : clearSelection()} />
              <span className="text-sm font-semibold">{selected.size} selected</span>
              <Button variant="ghost" size="sm" className="text-xs" onClick={clearSelection}>Clear</Button>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={openTagDialog}>
                <MdLabel className="mr-1 size-3.5" /> Tag
              </Button>
              <Button size="sm" variant="outline" onClick={openCollectionDialog}>
                <MdFolder className="mr-1 size-3.5" /> Collect
              </Button>
              <Button size="sm" variant="outline" onClick={favoriteSelected}>
                <MdStar className="mr-1 size-3.5" /> Favorite
              </Button>
              <Button size="sm" onClick={exportSelected}>
                <MdContentCopy className="mr-1 size-3.5" /> Export
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7"><MdMoreVert /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem className="text-destructive" onClick={deleteSelected}>
                    <MdDelete className="mr-2" /> Delete {selected.size} bookmark{selected.size !== 1 ? "s" : ""}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bookmark grid */}
      {filtered.length === 0 ? (
        <Card><CardContent className="p-4 text-center text-muted-foreground py-10">
          {bookmarks.length === 0 ? "No bookmarks yet. Import some first!" : "No bookmarks match your filters."}
        </CardContent></Card>
      ) : (
        <>
          <div className={viewMode === "list" ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"}>
            {paged.map((bm) => (
              <BookmarkCard
                key={bm.id}
                bookmark={bm}
                isSelected={selected.has(bm.id)}
                onSelect={toggleSelect}
                onTagClick={(tag) => { setFilterTag(tag); setPage(1); }}
                onDelete={handleDelete}
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))}
          </div>
          {paged.length < filtered.length && (
            <div className="flex justify-center mt-6">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>
                Load More ({filtered.length - paged.length} remaining)
              </Button>
            </div>
          )}
        </>
      )}

      {/* Add Tag Dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Tag to {selected.size} Bookmark{selected.size !== 1 ? "s" : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Enter tag name..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTagToSelected()}
              autoFocus
            />
            {allTags.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Existing tags:</p>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.slice(0, 15).map((t) => (
                    <Badge key={t} variant="secondary" className="cursor-pointer hover:bg-primary hover:text-primary-foreground" onClick={() => { setTagInput(t); }}>
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTagDialogOpen(false)}>Cancel</Button>
            <Button onClick={addTagToSelected} disabled={!tagInput.trim()}>Add Tag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Collection Dialog */}
      <Dialog open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {collections.length > 0 && (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {collections.map((c) => (
                  <Button key={c.id} variant="ghost" className="w-full justify-start h-auto py-2.5" onClick={() => addToCollection(c.id)}>
                    <MdFolder className="mr-2 size-4 text-primary" />
                    <span className="font-medium">{c.name}</span>
                  </Button>
                ))}
              </div>
            )}
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground mb-2">Or create a new collection:</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Collection name..."
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createAndAddToCollection()}
                  className="text-sm"
                />
                <Button size="sm" onClick={createAndAddToCollection} disabled={!newCollectionName.trim()}>
                  <MdAdd className="mr-1" /> Create
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
