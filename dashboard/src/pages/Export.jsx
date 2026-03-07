import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { MdContentCopy, MdDownload, MdArrowForward } from "react-icons/md";
import { db } from "../lib/db";
import { promptTemplates, generatePrompt } from "../lib/prompts";

const TEMPLATE_CATEGORIES = ["All", "Product", "Business", "Technical", "Marketing", "Operations", "Research", "AI"];

export default function Export() {
  const location = useLocation();
  const [bookmarks, setBookmarks] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [limit, setLimit] = useState(20);
  const [sortExportBy, setSortExportBy] = useState("likes-desc");
  const [filterCat, setFilterCat] = useState("All");

  useEffect(() => {
    async function load() {
      const all = await db.bookmarks.toArray();
      setBookmarks(all);
      if (location.state?.selectedIds) setSelectedIds(new Set(location.state.selectedIds));
    }
    load();
  }, [location.state]);

  const getExportBookmarks = () => {
    let pool = selectedIds.size > 0 ? bookmarks.filter((bm) => selectedIds.has(bm.id)) : bookmarks;
    const [field, dir] = sortExportBy.split("-");
    pool = [...pool].sort((a, b) => { const va = a[field] || 0, vb = b[field] || 0; return dir === "desc" ? vb - va : va - vb; });
    return pool.slice(0, limit);
  };

  const handleSelectTemplate = (key) => {
    const prompt = generatePrompt(key, getExportBookmarks());
    setActiveTemplate(key);
    setGeneratedPrompt(prompt);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      toast.success("Copied to clipboard", { description: "Paste into Claude to get started" });
    } catch {
      const ta = document.createElement("textarea");
      ta.value = generatedPrompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast.success("Copied!");
    }
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(getExportBookmarks(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `x-bookmarks-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPrompt = () => {
    if (!generatedPrompt) return;
    const blob = new Blob([generatedPrompt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claude-prompt-${activeTemplate}-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredTemplates = Object.entries(promptTemplates).filter(
    ([, tmpl]) => filterCat === "All" || tmpl.category === filterCat
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <SidebarTrigger />
        <h1 className="text-lg font-bold">Generate Documents</h1>
      </div>

      <Card className="mb-5">
        <CardContent className="p-4">
          <p className="text-sm font-bold mb-3">Export Settings</p>
          <div className="flex gap-4 flex-wrap items-center">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Max bookmarks to include</p>
              <Input type="number" className="h-8 text-sm w-[100px]" value={limit} onChange={(e) => setLimit(Number(e.target.value))} min={1} max={200} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Sort by</p>
              <select className="h-8 text-sm rounded-md border bg-background px-2" value={sortExportBy} onChange={(e) => setSortExportBy(e.target.value)}>
                <option value="likes-desc">Most Liked</option>
                <option value="retweets-desc">Most Retweeted</option>
                <option value="views-desc">Most Viewed</option>
                <option value="created_at-desc">Newest</option>
              </select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Source</p>
              <Badge variant={selectedIds.size > 0 ? "default" : "secondary"}>
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : `All (${bookmarks.length})`}
              </Badge>
            </div>
          </div>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={downloadJSON}><MdDownload className="mr-1" /> Download Raw JSON</Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm font-bold mb-3">Choose a Document Template</p>
      <div className="flex gap-1 flex-wrap mb-4">
        {TEMPLATE_CATEGORIES.map((cat) => (
          <Button key={cat} variant={filterCat === cat ? "default" : "outline"} size="sm" className="rounded-full text-xs" onClick={() => setFilterCat(cat)}>
            {cat}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-5">
        {filteredTemplates.map(([key, tmpl]) => (
          <Card
            key={key}
            className={`cursor-pointer transition-all hover:-translate-y-0.5 ${activeTemplate === key ? "ring-2 ring-primary" : ""}`}
            onClick={() => handleSelectTemplate(key)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{tmpl.icon}</span>
                <div>
                  <p className="text-sm font-bold">{tmpl.name}</p>
                  <Badge variant="secondary" className="text-[9px]">{tmpl.category}</Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{tmpl.description}</p>
              <div className="flex justify-end mt-3">
                <MdArrowForward className="text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {generatedPrompt && (
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
              <p className="text-sm font-bold">Generated Prompt ({getExportBookmarks().length} bookmarks)</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={copyToClipboard}><MdContentCopy className="mr-1" /> Copy to Clipboard</Button>
                <Button variant="outline" size="sm" onClick={downloadPrompt}><MdDownload className="mr-1" /> Download .txt</Button>
              </div>
            </div>
            <textarea
              className="w-full min-h-[300px] font-mono text-xs rounded-lg border bg-muted p-3 resize-y"
              value={generatedPrompt}
              readOnly
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
