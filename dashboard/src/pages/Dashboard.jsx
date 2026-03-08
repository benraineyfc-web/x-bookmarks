import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  MdBookmarks, MdPerson, MdFavorite, MdTrendingUp,
  MdCloudDownload, MdStar, MdCheckCircle, MdArrowForward,
  MdCategory, MdDescription, MdFileUpload, MdAutoAwesome,
} from "react-icons/md";
import BookmarkCard from "../components/bookmarks/BookmarkCard";
import { db, recategorizeAll } from "../lib/db";
import { getCategoryColor } from "../lib/categorize";
import { scrapeBookmarkBatch } from "../lib/scraper";

const CATEGORY_DOT_COLORS = {
  purple: "bg-purple-500", blue: "bg-blue-500", pink: "bg-pink-500",
  cyan: "bg-cyan-500", teal: "bg-teal-500", orange: "bg-orange-500",
  red: "bg-red-500", green: "bg-green-500", yellow: "bg-yellow-500", gray: "bg-gray-500",
};

function MiniStat({ name, value, icon: Icon, bg }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{name}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className={`size-12 rounded-full ${bg} flex items-center justify-center`}>
          <Icon className="size-6 text-white" />
        </div>
      </CardContent>
    </Card>
  );
}

function TrendChart({ data, title, color }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div>
      <p className="text-sm font-semibold mb-3">{title}</p>
      <div className="flex items-end gap-1 h-[100px]">
        {data.map((d, i) => (
          <div key={i} className="flex flex-col items-center flex-1 min-w-0">
            <div className="w-full max-w-8 rounded-t transition-all" style={{ height: `${Math.max((d.value / max) * 80, 2)}px`, backgroundColor: color }} title={`${d.label}: ${d.value}`} />
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-1">
        {data.map((d, i) => <p key={i} className="flex-1 text-[9px] text-muted-foreground text-center truncate">{d.label}</p>)}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, authors: 0, totalLikes: 0, thisWeek: 0, favorites: 0, categorized: 0 });
  const [recent, setRecent] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [topAuthors, setTopAuthors] = useState([]);
  const [weeklyTrend, setWeeklyTrend] = useState([]);
  const [engagementData, setEngagementData] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [topActions, setTopActions] = useState([]);
  const [scraping, setScraping] = useState(false);

  const loadStats = async () => {
    const all = await db.bookmarks.toArray();
    const authors = new Map();
    let totalLikes = 0, favCount = 0, categorizedCount = 0;
    const catCounts = {}, allActions = [];
    const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    let thisWeek = 0;

    for (const bm of all) {
      totalLikes += bm.likes || 0;
      if (bm.author_username) authors.set(bm.author_username, (authors.get(bm.author_username) || 0) + 1);
      if (bm.importedAt && new Date(bm.importedAt) > oneWeekAgo) thisWeek++;
      if (bm.favorite) favCount++;
      if (bm.categories?.length > 0) { categorizedCount++; for (const cat of bm.categories) catCounts[cat] = (catCounts[cat] || 0) + 1; }
      if (bm.actionItems?.length > 0) allActions.push(...bm.actionItems.slice(0, 2).map((text) => ({ text, author: bm.author_username })));
    }

    setStats({ total: all.length, authors: authors.size, totalLikes, thisWeek, favorites: favCount, categorized: categorizedCount });
    setRecent([...all].sort((a, b) => new Date(b.importedAt || 0) - new Date(a.importedAt || 0)).slice(0, 6));
    setFavorites(all.filter((bm) => bm.favorite).sort((a, b) => new Date(b.importedAt || 0) - new Date(a.importedAt || 0)).slice(0, 4));
    setTopAuthors([...authors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })));
    setCategoryBreakdown(Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count })));
    setTopActions(allActions.slice(0, 8));

    const weeks = [];
    for (let w = 7; w >= 0; w--) {
      const start = new Date(); start.setDate(start.getDate() - w * 7); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 7);
      weeks.push({ label: start.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), value: all.filter((bm) => { const d = new Date(bm.importedAt || bm.created_at || 0); return d >= start && d < end; }).length });
    }
    setWeeklyTrend(weeks);
    setEngagementData([...authors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name]) => {
      const bms = all.filter((bm) => bm.author_username === name);
      return { label: `@${name.slice(0, 8)}`, value: Math.round(bms.reduce((s, bm) => s + (bm.likes || 0), 0) / bms.length) };
    }));
  };

  useEffect(() => { loadStats(); }, []);

  const handleScrapeAll = async () => {
    setScraping(true);
    try {
      const data = await scrapeBookmarkBatch(10);
      toast.success(`Scraped ${data.scraped} bookmarks`, { description: `${data.failed} failed, ${data.remaining} remaining` });
      loadStats();
    } catch (e) { toast.error("Scrape failed", { description: e.message }); }
    setScraping(false);
  };

  const handleDelete = (id) => { setRecent((p) => p.filter((b) => b.id !== id)); setFavorites((p) => p.filter((b) => b.id !== id)); setTimeout(loadStats, 100); };
  const handleFavoriteToggle = (id, val) => { setRecent((p) => p.map((b) => (b.id === id ? { ...b, favorite: val } : b))); setFavorites((p) => p.map((b) => (b.id === id ? { ...b, favorite: val } : b))); setTimeout(loadStats, 100); };
  const fmtLikes = stats.totalLikes >= 1e6 ? (stats.totalLikes / 1e6).toFixed(1) + "M" : stats.totalLikes >= 1e3 ? (stats.totalLikes / 1e3).toFixed(1) + "K" : stats.totalLikes.toLocaleString();

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <SidebarTrigger />
        <h1 className="text-lg font-bold">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <MiniStat name="Total Bookmarks" value={stats.total.toLocaleString()} icon={MdBookmarks} bg="bg-blue-500" />
        <MiniStat name="Unique Authors" value={stats.authors.toLocaleString()} icon={MdPerson} bg="bg-green-500" />
        <MiniStat name="Total Likes" value={fmtLikes} icon={MdFavorite} bg="bg-red-500" />
        <MiniStat name="Added This Week" value={stats.thisWeek.toLocaleString()} icon={MdTrendingUp} bg="bg-orange-500" />
        <MiniStat name="Favorites" value={stats.favorites.toLocaleString()} icon={MdStar} bg="bg-yellow-500" />
        <MiniStat name="Categorized" value={stats.categorized.toLocaleString()} icon={MdCategory} bg="bg-purple-500" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Button variant="outline" className="justify-start h-10" onClick={() => navigate("/import")}><MdFileUpload className="mr-2" /> Import</Button>
        <Button variant="outline" className="justify-start h-10" onClick={() => navigate("/export")}><MdDescription className="mr-2" /> Generate Docs</Button>
        <Button variant="outline" className="justify-start h-10" onClick={() => navigate("/categories")}><MdAutoAwesome className="mr-2" /> Auto-Categorize</Button>
        <Button variant="outline" className="justify-start h-10" disabled={scraping} onClick={handleScrapeAll}><MdCloudDownload className="mr-2" /> {scraping ? "Scraping..." : "Batch Scrape"}</Button>
      </div>
      {scraping && <Progress className="mb-4 h-1" />}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-6">
        <Card><CardContent className="p-4"><TrendChart data={weeklyTrend} title="Bookmarks Added (Last 8 Weeks)" color="#2563eb" /></CardContent></Card>
        <Card><CardContent className="p-4"><TrendChart data={engagementData} title="Avg Likes by Top Authors" color="#16a34a" /></CardContent></Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-semibold">Categories</p>
              <Button variant="ghost" size="sm" className="text-primary h-7" onClick={() => navigate("/categories")}>View All <MdArrowForward className="ml-1" /></Button>
            </div>
            {categoryBreakdown.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No categories yet</p> : (
              <div className="space-y-2">
                {categoryBreakdown.map((cat) => (
                  <div key={cat.name} className="flex justify-between items-center cursor-pointer hover:opacity-80" onClick={() => navigate(`/bookmarks?category=${encodeURIComponent(cat.name)}`)}>
                    <div className="flex items-center gap-2"><span className={`size-2 rounded-full ${CATEGORY_DOT_COLORS[getCategoryColor(cat.name)] || "bg-gray-400"}`} /><span className="text-sm">{cat.name}</span></div>
                    <span className="text-sm font-semibold text-primary">{cat.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {topActions.length > 0 && (
        <Card className="mb-6"><CardContent className="p-4">
          <p className="text-sm font-semibold mb-2.5">Actionable Steps</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {topActions.map((a, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-green-50 text-xs">
                <MdCheckCircle className="size-3.5 text-green-500 mt-0.5 shrink-0" />
                <div><p>{a.text}</p><p className="text-[10px] text-muted-foreground">from @{a.author}</p></div>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-6">
          {favorites.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-2.5">
                <p className="text-sm font-semibold">Favorites</p>
                <Button variant="ghost" size="sm" className="text-primary h-7" onClick={() => navigate("/bookmarks?favorites=true")}>View All <MdArrowForward className="ml-1" /></Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">{favorites.map((bm) => <BookmarkCard key={bm.id} bookmark={bm} onDelete={handleDelete} onFavoriteToggle={handleFavoriteToggle} />)}</div>
            </div>
          )}
          <div>
            <div className="flex justify-between items-center mb-2.5">
              <p className="text-sm font-semibold">Recently Added</p>
              <Button variant="ghost" size="sm" className="text-primary h-7" onClick={() => navigate("/bookmarks")}>View All <MdArrowForward className="ml-1" /></Button>
            </div>
            {recent.length === 0 ? <Card><CardContent className="p-4 text-center text-muted-foreground py-10">No bookmarks yet. Import some first!</CardContent></Card> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">{recent.map((bm) => <BookmarkCard key={bm.id} bookmark={bm} onDelete={handleDelete} onFavoriteToggle={handleFavoriteToggle} />)}</div>
            )}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold mb-2.5">Top Authors</p>
          <Card><CardContent className="p-4">
            {topAuthors.length === 0 ? <p className="text-sm text-muted-foreground text-center py-5">No data yet</p> : (
              <div className="space-y-2.5">
                {topAuthors.map((a, i) => (
                  <div key={a.name} className="flex justify-between items-center cursor-pointer hover:opacity-70" onClick={() => navigate(`/bookmarks?search=${encodeURIComponent(a.name)}`)}>
                    <div className="flex items-center gap-2"><span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span><span className="text-sm">@{a.name}</span></div>
                    <span className="text-sm font-semibold text-primary">{a.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </div>
      </div>
    </div>
  );
}
