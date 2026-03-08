import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { MdRefresh } from "react-icons/md";
import BookmarkCard from "../components/bookmarks/BookmarkCard";
import { db, recategorizeAll } from "../lib/db";
import { getCategoryColor } from "../lib/categorize";

const BADGE_COLORS = {
  purple: "bg-purple-100 text-purple-700", blue: "bg-blue-100 text-blue-700",
  pink: "bg-pink-100 text-pink-700", cyan: "bg-cyan-100 text-cyan-700",
  teal: "bg-teal-100 text-teal-700", orange: "bg-orange-100 text-orange-700",
  red: "bg-red-100 text-red-700", green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700", gray: "bg-gray-100 text-gray-700",
};

export default function Categories() {
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [categoryCounts, setCategoryCounts] = useState({});
  const [uncategorized, setUncategorized] = useState(0);
  const [recategorizing, setRecategorizing] = useState(false);

  const loadData = async () => {
    const all = await db.bookmarks.toArray();
    setBookmarks(all);
    const counts = {};
    let uncat = 0;
    for (const bm of all) {
      if (!bm.categories || bm.categories.length === 0) uncat++;
      else for (const cat of bm.categories) counts[cat] = (counts[cat] || 0) + 1;
    }
    setCategoryCounts(counts);
    setUncategorized(uncat);
  };

  useEffect(() => { loadData(); }, []);

  const handleRecategorize = async () => {
    setRecategorizing(true);
    try {
      const count = await recategorizeAll();
      toast.success(`Recategorized ${count} bookmarks`);
      await loadData();
    } catch (e) {
      toast.error("Error recategorizing", { description: e.message });
    }
    setRecategorizing(false);
  };

  const handleDelete = (id) => { setBookmarks((prev) => prev.filter((bm) => bm.id !== id)); setTimeout(loadData, 100); };
  const handleFavoriteToggle = (id, val) => setBookmarks((prev) => prev.map((bm) => (bm.id === id ? { ...bm, favorite: val } : bm)));

  const filteredBookmarks = activeCategory
    ? activeCategory === "__uncategorized"
      ? bookmarks.filter((bm) => !bm.categories || bm.categories.length === 0)
      : bookmarks.filter((bm) => bm.categories && bm.categories.includes(activeCategory))
    : [];

  const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <SidebarTrigger />
        <h1 className="text-lg font-bold">Categories</h1>
      </div>

      <Card className="mb-5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-bold">Auto-Categorization</p>
              <p className="text-xs text-muted-foreground">Analyzes tweet text and scraped content to assign categories automatically</p>
            </div>
            <Button size="sm" disabled={recategorizing} onClick={handleRecategorize}>
              <MdRefresh className="mr-1" /> {recategorizing ? "Categorizing..." : "Recategorize All"}
            </Button>
          </div>
          {recategorizing && <Progress className="mt-3 h-1" />}
        </CardContent>
      </Card>

      <p className="text-sm font-bold mb-3">{sortedCategories.length} Categories Found</p>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-5">
        {sortedCategories.map(([cat, count]) => (
          <Card
            key={cat}
            className={`cursor-pointer transition-all hover:-translate-y-0.5 ${activeCategory === cat ? "ring-2 ring-primary" : ""}`}
            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
          >
            <CardContent className="p-4">
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full mb-2 ${BADGE_COLORS[getCategoryColor(cat)] || "bg-gray-100 text-gray-700"}`}>{cat}</span>
              <p className="text-2xl font-extrabold">{count}</p>
              <p className="text-xs text-muted-foreground">bookmark{count !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>
        ))}
        {uncategorized > 0 && (
          <Card
            className={`cursor-pointer transition-all hover:-translate-y-0.5 ${activeCategory === "__uncategorized" ? "ring-2 ring-primary" : ""}`}
            onClick={() => setActiveCategory(activeCategory === "__uncategorized" ? null : "__uncategorized")}
          >
            <CardContent className="p-4">
              <span className="inline-block text-xs px-2 py-0.5 rounded-full mb-2 bg-gray-100 text-gray-700">Uncategorized</span>
              <p className="text-2xl font-extrabold">{uncategorized}</p>
              <p className="text-xs text-muted-foreground">bookmark{uncategorized !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {activeCategory && (
        <>
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-bold">
              {activeCategory === "__uncategorized" ? "Uncategorized" : activeCategory} ({filteredBookmarks.length})
            </p>
            <Button variant="ghost" size="sm" onClick={() => setActiveCategory(null)}>Clear Filter</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredBookmarks.map((bm) => (
              <BookmarkCard key={bm.id} bookmark={bm} onDelete={handleDelete} onFavoriteToggle={handleFavoriteToggle} />
            ))}
          </div>
        </>
      )}

      {!activeCategory && bookmarks.length > 0 && (
        <Card><CardContent className="p-4 text-center text-muted-foreground py-8 text-sm">Click a category above to view its bookmarks</CardContent></Card>
      )}

      {bookmarks.length === 0 && (
        <Card><CardContent className="p-4 text-center text-muted-foreground py-10">No bookmarks yet. Import some first!</CardContent></Card>
      )}
    </div>
  );
}
