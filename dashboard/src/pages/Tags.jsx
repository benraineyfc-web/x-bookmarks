import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { MdDelete, MdEdit } from "react-icons/md";
import { db } from "../lib/db";

export default function Tags() {
  const navigate = useNavigate();
  const [tagCounts, setTagCounts] = useState([]);
  const [editingTag, setEditingTag] = useState(null);
  const [editValue, setEditValue] = useState("");

  const loadTags = async () => {
    const all = await db.bookmarks.toArray();
    const counts = new Map();
    for (const bm of all) {
      if (bm.tags) for (const t of bm.tags) counts.set(t, (counts.get(t) || 0) + 1);
    }
    setTagCounts([...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })));
  };

  useEffect(() => { loadTags(); }, []);

  const removeTag = async (tagName) => {
    const all = await db.bookmarks.where("tags").equals(tagName).toArray();
    await db.transaction("rw", db.bookmarks, async () => {
      for (const bm of all) await db.bookmarks.update(bm.id, { tags: (bm.tags || []).filter((t) => t !== tagName) });
    });
    loadTags();
  };

  const renameTag = async (oldName, newName) => {
    if (!newName || oldName === newName) return;
    const all = await db.bookmarks.where("tags").equals(oldName).toArray();
    await db.transaction("rw", db.bookmarks, async () => {
      for (const bm of all) {
        const tags = (bm.tags || []).map((t) => (t === oldName ? newName : t));
        await db.bookmarks.update(bm.id, { tags: [...new Set(tags)] });
      }
    });
    loadTags();
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <SidebarTrigger />
        <h1 className="text-lg font-bold">Tags</h1>
      </div>

      <Card className="mb-5">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Tags are applied during import or from the Bookmarks page. Here you can manage and browse them.
          </p>
        </CardContent>
      </Card>

      {tagCounts.length === 0 ? (
        <Card><CardContent className="p-4 text-center text-muted-foreground py-10">
          No tags yet. Add tags when importing bookmarks or from the Bookmarks page.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tagCounts.map(({ name, count }) => (
            <Card key={name}>
              <CardContent className="p-4">
                {editingTag === name ? (
                  <div className="flex gap-2">
                    <Input
                      className="h-8 text-sm"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { renameTag(name, editValue.trim()); setEditingTag(null); }
                        if (e.key === "Escape") setEditingTag(null);
                      }}
                      autoFocus
                    />
                    <Button size="sm" onClick={() => { renameTag(name, editValue.trim()); setEditingTag(null); }}>Save</Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingTag(null)}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                      <Badge className="cursor-pointer" onClick={() => navigate(`/bookmarks?tag=${encodeURIComponent(name)}`)}>
                        {name}
                      </Badge>
                      <span className="text-sm font-semibold">{count} bookmark{count !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditingTag(name); setEditValue(name); }}>
                        <MdEdit className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => removeTag(name)}>
                        <MdDelete className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
