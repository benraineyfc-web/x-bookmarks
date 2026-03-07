import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { MdFileUpload, MdContentPaste, MdCheckCircle, MdClose, MdRefresh, MdDeleteForever } from "react-icons/md";
import { normalize, importBookmarks, deleteAllBookmarks } from "../lib/db";

export default function Import() {
  const [jsonText, setJsonText] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("paste");
  const [updateExisting, setUpdateExisting] = useState(true);
  const [freshImport, setFreshImport] = useState(false);
  const fileRef = useRef();

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const removeTag = (tag) => setTags(tags.filter((t) => t !== tag));

  const [diagnostics, setDiagnostics] = useState(null);

  const doImport = async (rawJson) => {
    setError("");
    setResult(null);
    setDiagnostics(null);
    setLoading(true);
    try {
      const parsed = JSON.parse(rawJson);
      const normalized = normalize(parsed);

      // Build diagnostics from first item with media
      const rawArray = Array.isArray(parsed) ? parsed : (parsed.data || parsed.bookmarks || parsed.tweets || parsed.results || [parsed]);
      const sampleRaw = rawArray[0];
      const sampleNorm = normalized[0];
      const withMedia = normalized.filter(b => b.media && b.media.length > 0 && b.media.some(m => m.url && m.url.startsWith('http')));
      const withAuthor = normalized.filter(b => b.author_username);
      // Find a sample with media to show in diagnostics
      const mediaSample = withMedia[0];
      // Find matching raw item for media sample
      const rawMediaSample = mediaSample ? rawArray.find(r => String(r.id || r.id_str || "") === mediaSample.id) : null;
      setDiagnostics({
        rawKeys: sampleRaw ? Object.keys(sampleRaw) : [],
        rawSample: sampleRaw ? JSON.stringify(sampleRaw, null, 2).slice(0, 2000) : "none",
        normSample: sampleNorm ? JSON.stringify({ id: sampleNorm.id, author_username: sampleNorm.author_username, author_name: sampleNorm.author_name, media: sampleNorm.media, urls: sampleNorm.urls, quoteTweet: sampleNorm.quoteTweet }, null, 2) : "none",
        totalNormalized: normalized.length,
        withValidMedia: withMedia.length,
        withAuthor: withAuthor.length,
        mediaSampleNorm: mediaSample ? JSON.stringify({ id: mediaSample.id, author_username: mediaSample.author_username, media: mediaSample.media }, null, 2) : "none",
        rawMediaSample: rawMediaSample ? JSON.stringify({ id: rawMediaSample.id, screen_name: rawMediaSample.screen_name, media: rawMediaSample.media?.slice(0, 1) }, null, 2).slice(0, 2000) : "none",
      });

      if (normalized.length === 0) { setError("No valid bookmarks found in the data. Check the format."); setLoading(false); return; }
      // Fresh import: delete everything first
      if (freshImport) {
        await deleteAllBookmarks();
      }
      const { added, skipped, updated } = await importBookmarks(normalized, tags, { updateExisting: !freshImport && updateExisting });
      setResult({ added, skipped, updated, total: normalized.length });
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
          <p className="text-sm text-green-700">
            Added {result.added} new bookmarks.
            {result.updated > 0 && ` Updated ${result.updated} existing bookmarks with media/links.`}
            {result.skipped > 0 && ` ${result.skipped} unchanged.`}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-5">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {diagnostics && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 mb-5">
          <p className="font-semibold text-blue-800 mb-2">Import Diagnostics</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center p-2 bg-white rounded">
              <p className="text-lg font-bold">{diagnostics.totalNormalized}</p>
              <p className="text-[10px] text-muted-foreground">Total Parsed</p>
            </div>
            <div className="text-center p-2 bg-white rounded">
              <p className="text-lg font-bold">{diagnostics.withValidMedia}</p>
              <p className="text-[10px] text-muted-foreground">With Media</p>
            </div>
            <div className="text-center p-2 bg-white rounded">
              <p className="text-lg font-bold">{diagnostics.withAuthor}</p>
              <p className="text-[10px] text-muted-foreground">With Author</p>
            </div>
          </div>
          <details className="mb-2">
            <summary className="text-xs font-semibold text-blue-700 cursor-pointer">Raw JSON keys: [{diagnostics.rawKeys.join(", ")}]</summary>
            <pre className="text-[10px] font-mono bg-white rounded p-2 mt-1 max-h-[300px] overflow-auto whitespace-pre-wrap break-all">{diagnostics.rawSample}</pre>
          </details>
          <details>
            <summary className="text-xs font-semibold text-blue-700 cursor-pointer">Normalized sample (first bookmark)</summary>
            <pre className="text-[10px] font-mono bg-white rounded p-2 mt-1 max-h-[300px] overflow-auto whitespace-pre-wrap break-all">{diagnostics.normSample}</pre>
          </details>
          <details className="mt-2">
            <summary className="text-xs font-semibold text-blue-700 cursor-pointer">Sample with media (raw + normalized)</summary>
            <p className="text-[10px] font-semibold mt-1 mb-0.5">Raw media object:</p>
            <pre className="text-[10px] font-mono bg-white rounded p-2 max-h-[200px] overflow-auto whitespace-pre-wrap break-all">{diagnostics.rawMediaSample}</pre>
            <p className="text-[10px] font-semibold mt-1 mb-0.5">Normalized media:</p>
            <pre className="text-[10px] font-mono bg-white rounded p-2 max-h-[200px] overflow-auto whitespace-pre-wrap break-all">{diagnostics.mediaSampleNorm}</pre>
          </details>
        </div>
      )}

      <Card className="mb-5">
        <CardContent className="p-4">
          <p className="text-sm font-bold mb-2">Import Options</p>
          <div className="flex items-center gap-2 mb-3">
            <Checkbox id="update-existing" checked={updateExisting} onCheckedChange={setUpdateExisting} />
            <label htmlFor="update-existing" className="text-sm cursor-pointer">
              Update existing bookmarks with media, links & quote tweets
            </label>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            <MdRefresh className="inline size-3.5 mr-1" />
            Re-import the same JSON to update existing bookmarks with images, videos, and link previews that may have been missed.
          </p>
          <div className="flex items-center gap-2 mb-2 mt-3">
            <Checkbox id="fresh-import" checked={freshImport} onCheckedChange={(v) => { setFreshImport(v); if (v) setUpdateExisting(false); }} />
            <label htmlFor="fresh-import" className="text-sm cursor-pointer text-destructive font-medium">
              Fresh import (delete all existing bookmarks first)
            </label>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            <MdDeleteForever className="inline size-3.5 mr-1 text-destructive" />
            Wipes all bookmarks and imports from scratch. Use this if updates aren't applying correctly.
          </p>
          <p className="text-sm font-bold mb-2 mt-4">Auto-tag this import batch (optional)</p>
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
              "Twitter Web Exporter (Tampermonkey) — GraphQL intercept format with full media",
              "bird CLI — likeCount/retweetCount format with media arrays",
              "X API v2 — public_metrics format with media_keys",
              "Raw GraphQL — tweet_results wrapper with extended_entities",
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
