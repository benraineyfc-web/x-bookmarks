import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { MdFileUpload, MdContentPaste, MdCheckCircle, MdClose } from "react-icons/md";
import { normalize, importBookmarks } from "../lib/db";

export default function Import() {
  const [jsonText, setJsonText] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("paste");
  const fileRef = useRef();

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const removeTag = (tag) => setTags(tags.filter((t) => t !== tag));

  const doImport = async (rawJson) => {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const parsed = JSON.parse(rawJson);
      const normalized = normalize(parsed);
      if (normalized.length === 0) { setError("No valid bookmarks found in the data. Check the format."); setLoading(false); return; }
      const { added, skipped } = await importBookmarks(normalized, tags);
      setResult({ added, skipped, total: normalized.length });
      setJsonText("");
    } catch (e) { setError(`Failed to parse JSON: ${e.message}`); }
    setLoading(false);
  };

  const handlePaste = () => doImport(jsonText);
  const handleFile = async (e) => { const file = e.target.files?.[0]; if (!file) return; doImport(await file.text()); };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <SidebarTrigger />
        <h1 className="text-lg font-bold">Import Bookmarks</h1>
      </div>

      {result && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 mb-5">
          <p className="font-semibold text-green-800">Import Complete</p>
          <p className="text-sm text-green-700">Added {result.added} new bookmarks. {result.skipped > 0 && `${result.skipped} duplicates skipped.`}</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-5">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <Card className="mb-5">
        <CardContent className="p-4">
          <p className="text-sm font-bold mb-2">Auto-tag this import batch (optional)</p>
          <div className="flex gap-2 mb-2">
            <Input className="max-w-[250px] h-8 text-sm" placeholder="e.g. startups, ai, week-10" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} />
            <Button variant="outline" size="sm" onClick={addTag}>Add</Button>
          </div>
          {tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {tags.map((t) => (
                <Badge key={t} className="gap-1">{t} <MdClose className="size-3 cursor-pointer" onClick={() => removeTag(t)} /></Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 mb-4">
        <Button variant={activeTab === "paste" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("paste")}>
          <MdContentPaste className="mr-1" /> Paste JSON
        </Button>
        <Button variant={activeTab === "upload" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("upload")}>
          <MdFileUpload className="mr-1" /> Upload File
        </Button>
      </div>

      {activeTab === "paste" && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-3">
              Paste your exported JSON from Tampermonkey, bird CLI, or any X export tool. We auto-detect the format.
            </p>
            <textarea
              className="w-full min-h-[200px] font-mono text-xs rounded-lg border bg-background p-3 mb-4 resize-y"
              placeholder='[{"id": "123", "text": "...", ...}]'
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
            />
            <Button disabled={!jsonText.trim() || loading} onClick={handlePaste}>
              {loading ? "Importing..." : "Import Bookmarks"}
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === "upload" && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-4">Upload a .json file exported from Tampermonkey or other tools.</p>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
            <div
              className="flex flex-col items-center justify-center border-2 border-dashed border-primary rounded-2xl p-10 cursor-pointer hover:bg-accent transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <MdFileUpload className="size-10 text-primary mb-3" />
              <p className="text-sm font-semibold">Click to upload JSON file</p>
              <p className="text-xs text-muted-foreground mt-1">.json files from Tampermonkey, bird CLI, X API exports</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-5">
        <CardContent className="p-4">
          <p className="text-sm font-bold mb-3">Supported Formats</p>
          <div className="space-y-2">
            {[
              "Twitter Web Exporter (Tampermonkey) — GraphQL intercept format",
              "bird CLI — likeCount/retweetCount format",
              "X API v2 — public_metrics format",
              "Raw GraphQL — tweet_results wrapper",
              "Generic — best-effort for any JSON with id + text fields",
            ].map((fmt) => (
              <div key={fmt} className="flex items-center gap-2">
                <MdCheckCircle className="text-green-500 shrink-0" />
                <span className="text-xs text-muted-foreground">{fmt}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
