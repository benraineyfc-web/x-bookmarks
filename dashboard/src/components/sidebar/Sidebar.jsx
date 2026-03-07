import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  MdDashboard,
  MdBookmarks,
  MdFileUpload,
  MdDescription,
  MdLabel,
  MdFolder,
  MdStar,
  MdInbox,
} from "react-icons/md";
import { db } from "../../lib/db";
import { getCategoryColor } from "../../lib/categorize";

const CATEGORY_DOT_COLORS = {
  purple: "bg-purple-500",
  blue: "bg-blue-500",
  pink: "bg-pink-500",
  cyan: "bg-cyan-500",
  teal: "bg-teal-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  gray: "bg-gray-500",
};

export default function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0, unsorted: 0, favorites: 0,
    categories: [], collections: [], tags: [],
  });

  useEffect(() => {
    async function load() {
      const all = await db.bookmarks.toArray();
      const collections = await db.collections.toArray();
      let unsorted = 0, favCount = 0;
      const catCounts = {}, tagCounts = {};

      for (const bm of all) {
        if (!bm.categories || bm.categories.length === 0) unsorted++;
        if (bm.favorite) favCount++;
        if (bm.categories) for (const c of bm.categories) catCounts[c] = (catCounts[c] || 0) + 1;
        if (bm.tags) for (const t of bm.tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
      }

      const collectionItems = await db.collectionItems.toArray();
      const collCounts = {};
      for (const item of collectionItems) collCounts[item.collectionId] = (collCounts[item.collectionId] || 0) + 1;

      setStats({
        total: all.length, unsorted, favorites: favCount,
        categories: Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
        collections: collections.map((c) => ({ ...c, count: collCounts[c.id] || 0 })),
        tags: Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => ({ name, count })),
      });
    }
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (path) => {
    if (path.includes("?")) return location.pathname + location.search === path;
    return location.pathname === path;
  };

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4">
        <h1 className="text-lg font-bold tracking-tight">X Bookmarks</h1>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive("/bookmarks")}>
                <NavLink to="/bookmarks">
                  <MdBookmarks className="size-4" />
                  <span>All Bookmarks</span>
                  {stats.total > 0 && <span className="ml-auto text-xs text-muted-foreground">{stats.total}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={isActive("/bookmarks?category=unsorted")} onClick={() => navigate("/bookmarks?category=unsorted")}>
                <MdInbox className="size-4" />
                <span>Unsorted</span>
                {stats.unsorted > 0 && <span className="ml-auto text-xs text-muted-foreground">{stats.unsorted}</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive("/")}>
                <NavLink to="/"><MdDashboard className="size-4" /><span>Dashboard</span></NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={isActive("/bookmarks?favorites=true")} onClick={() => navigate("/bookmarks?favorites=true")}>
                <MdStar className="size-4" />
                <span>Favorites</span>
                {stats.favorites > 0 && <span className="ml-auto text-xs text-muted-foreground">{stats.favorites}</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Categories</SidebarGroupLabel>
          <SidebarMenu>
            {stats.categories.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">Import & auto-categorize</p>
            ) : (
              stats.categories.map((cat) => (
                <SidebarMenuItem key={cat.name}>
                  <SidebarMenuButton className="h-7" onClick={() => navigate(`/bookmarks?category=${encodeURIComponent(cat.name)}`)}>
                    <span className={`size-2 rounded-full shrink-0 ${CATEGORY_DOT_COLORS[getCategoryColor(cat.name)] || "bg-gray-400"}`} />
                    <span className="truncate">{cat.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{cat.count}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
            )}
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="h-7 text-primary">
                <NavLink to="/categories"><span className="text-xs">Manage Categories</span></NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Folders</SidebarGroupLabel>
          <SidebarMenu>
            {stats.collections.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">No folders yet</p>
            ) : (
              stats.collections.map((coll) => (
                <SidebarMenuItem key={coll.id}>
                  <SidebarMenuButton className="h-7" onClick={() => navigate("/collections")}>
                    <MdFolder className="size-4 shrink-0" />
                    <span className="truncate">{coll.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{coll.count}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
            )}
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="h-7 text-primary">
                <NavLink to="/collections"><span className="text-xs">Manage Folders</span></NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {stats.tags.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Tags</SidebarGroupLabel>
              <SidebarMenu>
                {stats.tags.map((tag) => (
                  <SidebarMenuItem key={tag.name}>
                    <SidebarMenuButton className="h-7" onClick={() => navigate(`/bookmarks?tag=${encodeURIComponent(tag.name)}`)}>
                      <span className="text-muted-foreground">#</span>
                      <span className="truncate">{tag.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{tag.count}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="h-7 text-primary">
                    <NavLink to="/tags"><span className="text-xs">All Tags</span></NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive("/import")}>
                <NavLink to="/import"><MdFileUpload className="size-4" /><span>Import</span></NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive("/export")}>
                <NavLink to="/export"><MdDescription className="size-4" /><span>Generate Docs</span></NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive("/tags")}>
                <NavLink to="/tags"><MdLabel className="size-4" /><span>Manage Tags</span></NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
