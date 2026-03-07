import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { MdAdd, MdDelete, MdEdit, MdFolder } from "react-icons/md";
import BookmarkCard from "../components/bookmarks/BookmarkCard";
import { db } from "../lib/db";

export default function Collections() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState([]);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [activeCollection, setActiveCollection] = useState(null);
  const [collectionBookmarks, setCollectionBookmarks] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadCollections = useCallback(async () => {
    const all = await db.collections.toArray();
    const withCounts = await Promise.all(
      all.map(async (c) => {
        const count = await db.collectionItems.where("collectionId").equals(c.id).count();
        return { ...c, count };
      })
    );
    setCollections(withCounts.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
  }, []);

  useEffect(() => { loadCollections(); }, [loadCollections]);

  const createCollection = async () => {
    const name = newName.trim();
    if (!name) return;
    const existing = await db.collections.where("name").equals(name).first();
    if (existing) { toast.warning("Collection already exists"); return; }
    await db.collections.add({ name, createdAt: new Date().toISOString() });
    setNewName("");
    loadCollections();
    toast.success(`Created "${name}"`);
  };

  const deleteCollection = async (id) => {
    await db.collectionItems.where("collectionId").equals(id).delete();
    await db.collections.delete(id);
    loadCollections();
    if (activeCollection?.id === id) { setActiveCollection(null); setCollectionBookmarks([]); setDialogOpen(false); }
    toast.info("Collection deleted");
  };

  const renameCollection = async () => {
    const name = editName.trim();
    if (!name || !editId) return;
    await db.collections.update(editId, { name });
    setEditId(null);
    setEditName("");
    loadCollections();
    if (activeCollection?.id === editId) setActiveCollection((prev) => ({ ...prev, name }));
  };

  const viewCollection = async (collection) => {
    setActiveCollection(collection);
    const items = await db.collectionItems.where("collectionId").equals(collection.id).toArray();
    const bms = await db.bookmarks.where("id").anyOf(items.map((i) => i.bookmarkId)).toArray();
    setCollectionBookmarks(bms);
    setDialogOpen(true);
  };

  const removeFromCollection = async (bookmarkId) => {
    const items = await db.collectionItems.where("collectionId").equals(activeCollection.id).toArray();
    const toRemove = items.filter((i) => i.bookmarkId === bookmarkId);
    if (toRemove.length) await db.collectionItems.bulkDelete(toRemove.map((i) => i.id));
    setCollectionBookmarks((prev) => prev.filter((bm) => bm.id !== bookmarkId));
    loadCollections();
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <SidebarTrigger />
        <h1 className="text-lg font-bold">Collections</h1>
      </div>

      <Card className="mb-5">
        <CardContent className="p-4">
          <p className="text-sm font-bold mb-2">Create a new collection</p>
          <div className="flex gap-2">
            <Input className="max-w-[300px] h-8 text-sm" placeholder="e.g. AI Research, Startup Ideas" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createCollection()} />
            <Button size="sm" disabled={!newName.trim()} onClick={createCollection}><MdAdd className="mr-1" /> Create</Button>
          </div>
        </CardContent>
      </Card>

      {collections.length === 0 ? (
        <Card><CardContent className="p-4 text-center text-muted-foreground py-10">
          No collections yet. Create one above, then add bookmarks from the Bookmarks page.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {collections.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                {editId === c.id ? (
                  <div className="flex gap-2 mb-2">
                    <Input className="h-8 text-sm" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && renameCollection()} autoFocus />
                    <Button size="sm" onClick={renameCollection}>Save</Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2.5 cursor-pointer flex-1" onClick={() => viewCollection(c)}>
                      <MdFolder className="size-5 text-primary" />
                      <div>
                        <p className="text-sm font-bold">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.count} bookmark{c.count !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditId(c.id); setEditName(c.name); }}>
                        <MdEdit className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => deleteCollection(c.id)}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MdFolder className="text-primary" />
              {activeCollection?.name}
              <Badge className="ml-2">{collectionBookmarks.length}</Badge>
            </DialogTitle>
          </DialogHeader>
          {collectionBookmarks.length === 0 ? (
            <p className="text-center text-muted-foreground py-5">No bookmarks in this collection yet. Add them from the Bookmarks page.</p>
          ) : (
            <div className="space-y-3">
              {collectionBookmarks.map((bm) => (
                <div key={bm.id} className="flex items-start gap-2">
                  <div className="flex-1"><BookmarkCard bookmark={bm} /></div>
                  <Button variant="ghost" size="icon" className="size-7 text-destructive mt-2" onClick={() => removeFromCollection(bm.id)}>
                    <MdDelete className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
