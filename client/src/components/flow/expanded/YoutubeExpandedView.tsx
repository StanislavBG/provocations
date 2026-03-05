/**
 * YoutubeExpandedView — Full expanded view for YouTube nodes.
 *
 * Supports three input modes:
 *   1. URL — paste a single YouTube video URL
 *   2. Search — keyword search, pick results to process
 *   3. Playlist — paste a playlist URL, process multiple videos
 *
 * Features: transcript fetch with chapters, metadata display,
 * thumbnail preview, search within transcript, embedded player.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Youtube, Loader2, Search, List, Link2, Play, ChevronDown, ChevronRight,
  Clock, Eye, User, Calendar, CheckSquare, Square, Hash, Scissors,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProvokeText } from "@/components/ProvokeText";
import { useToast } from "@/hooks/use-toast";
import type { FlowNode } from "../useFlowCanvas";
import { lifecycleLogStore } from "@/lib/lifecycleLog";

type InputMode = "url" | "search" | "playlist";

interface SearchResult {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration?: string;
  viewCount?: string;
}

interface Chapter {
  title: string;
  startTime: string;
  content: string;
}

interface YoutubeExpandedViewProps {
  node: FlowNode;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
}

/** Extract YouTube video ID from various URL formats */
function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export function YoutubeExpandedView({ node, onUpdateNode }: YoutubeExpandedViewProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<InputMode>(node.youtubeMode ?? "url");
  const [url, setUrl] = useState(node.youtubeUrl || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>(node.youtubeSearchResults ?? []);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set(node.youtubeSelectedVideos ?? []));
  const [topN, setTopN] = useState(node.youtubeTopN ?? 3);
  const [isSearching, setIsSearching] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>(node.youtubeChapters ?? []);
  const [expandedChapterIdx, setExpandedChapterIdx] = useState<number | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);
  const isFetching = node.youtubeFetchStatus === "fetching";
  const transcript = node.content || "";

  const lcLog = useCallback(
    (phase: "pre-process" | "process" | "post-process", status: "start" | "success" | "error", message: string, extra?: { durationMs?: number; error?: string }) => {
      lifecycleLogStore.push({ phase, status, nodeId: node.id, nodeType: node.type, nodeLabel: node.label || "YouTube", message, ...extra });
    },
    [node.id, node.type, node.label],
  );

  // ── Search ──
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch("/api/youtube/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery.trim(), maxResults: 10 }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json() as { results: SearchResult[] };
      setSearchResults(data.results);
      onUpdateNode(node.id, { youtubeSearchResults: data.results, youtubeMode: "search" });
    } catch (err) {
      toast({ title: "Search failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, node.id, onUpdateNode, toast]);

  // ── Toggle video selection ──
  const toggleVideoSelection = useCallback((videoId: string) => {
    setSelectedVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      onUpdateNode(node.id, { youtubeSelectedVideos: Array.from(next) });
      return next;
    });
  }, [node.id, onUpdateNode]);

  // ── Select top N ──
  const selectTopN = useCallback((n: number) => {
    const top = searchResults.slice(0, n).map((r) => r.videoId);
    setSelectedVideoIds(new Set(top));
    setTopN(n);
    onUpdateNode(node.id, { youtubeSelectedVideos: top, youtubeTopN: n });
  }, [searchResults, node.id, onUpdateNode]);

  // ── Detect chapters from transcript ──
  const detectChapters = useCallback(async (transcriptText: string) => {
    if (!transcriptText || transcriptText.length < 500) return;
    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Analyze this transcript and break it into logical chapters/sections. For each chapter provide a title, the approximate start timestamp, and a 1-2 sentence summary of what's discussed.\n\nOutput as JSON array:\n[{"title": "Chapter Title", "startTime": "[MM:SS]", "content": "Summary of this section"}]\n\nTranscript:\n${transcriptText.slice(0, 8000)}` }],
          model: "default",
        }),
      });
      if (!res.ok) return;
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === "token") accumulated += evt.token;
            } catch { /* skip */ }
          }
        }
      }
      // Extract JSON from response
      const jsonMatch = accumulated.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Chapter[];
        setChapters(parsed);
        onUpdateNode(node.id, { youtubeChapters: parsed });
      }
    } catch {
      // Chapter detection is best-effort
    }
  }, [node.id, onUpdateNode]);

  // ── Fetch transcript ──
  const handleFetch = useCallback(async (videoUrl?: string) => {
    const targetUrl = videoUrl || url.trim();
    if (!targetUrl) return;
    const t0 = performance.now();

    const videoId = extractVideoId(targetUrl);
    if (!videoId) {
      onUpdateNode(node.id, { youtubeFetchStatus: "error", youtubeError: "Invalid YouTube URL" });
      toast({ title: "Invalid URL", variant: "destructive" });
      return;
    }

    lcLog("pre-process", "success", `Video ID: ${videoId}`);
    onUpdateNode(node.id, {
      youtubeUrl: targetUrl,
      youtubeFetchStatus: "fetching",
      snippet: "Fetching transcript...",
      youtubeError: undefined,
      youtubeThumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    });

    try {
      const res = await fetch("/api/youtube/process-video", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ videoId, videoUrl: targetUrl, videoTitle: "" }),
      });

      if (!res.ok) throw new Error("Transcript fetch failed");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";
      let title = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "chunk") {
              accumulated += (accumulated ? "\n" : "") + evt.text;
              onUpdateNode(node.id, {
                content: accumulated,
                snippet: `${evt.progress}% — ${accumulated.length.toLocaleString()} chars`,
              });
            } else if (evt.type === "done") {
              const elapsed = Math.round(performance.now() - t0);
              title = evt.videoTitle || "";
              lcLog("process", "success", `${evt.totalChars?.toLocaleString()} chars`, { durationMs: elapsed });
              onUpdateNode(node.id, {
                youtubeFetchStatus: "done",
                llmStatus: "done", // Signal chain completion
                youtubeTitle: title,
                content: evt.transcript,
                documentContent: evt.transcript,
                snippet: evt.transcript.slice(0, 150),
                label: `YT: ${(title || "Video").slice(0, 25)}`,
              });
              toast({ title: "Transcript ready", description: `${evt.totalSegments} segments` });
              // Auto-detect chapters
              detectChapters(evt.transcript);
            } else if (evt.type === "error") {
              throw new Error(evt.message);
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== "Unexpected end of JSON input") throw parseErr;
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      lcLog("process", "error", msg, { error: msg, durationMs: Math.round(performance.now() - t0) });
      onUpdateNode(node.id, { youtubeFetchStatus: "error", youtubeError: msg, snippet: msg });
      toast({ title: "Fetch failed", description: msg, variant: "destructive" });
    }
  }, [url, node.id, onUpdateNode, toast, lcLog, detectChapters]);

  // ── Fetch selected videos (multi-video) ──
  const handleFetchSelected = useCallback(async () => {
    const ids = Array.from(selectedVideoIds);
    if (ids.length === 0) {
      toast({ title: "No videos selected", variant: "destructive" });
      return;
    }

    onUpdateNode(node.id, {
      youtubeFetchStatus: "fetching",
      snippet: `Fetching ${ids.length} video transcripts...`,
      youtubeError: undefined,
    });

    let allTranscripts = "";
    let processedCount = 0;

    for (const videoId of ids) {
      const result = searchResults.find((r) => r.videoId === videoId);
      try {
        const res = await fetch("/api/youtube/process-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId, videoUrl: `https://youtube.com/watch?v=${videoId}`, videoTitle: result?.title || "" }),
        });
        if (!res.ok) continue;
        const data = await res.json() as { transcript: string; videoTitle: string };
        allTranscripts += `\n\n--- ${data.videoTitle || result?.title || videoId} ---\n\n${data.transcript}`;
        processedCount++;
        onUpdateNode(node.id, {
          snippet: `Processed ${processedCount}/${ids.length} videos...`,
        });
      } catch {
        // Skip failed videos
      }
    }

    onUpdateNode(node.id, {
      youtubeFetchStatus: "done",
      llmStatus: "done",
      content: allTranscripts.trim(),
      documentContent: allTranscripts.trim(),
      snippet: `${processedCount} videos — ${allTranscripts.length.toLocaleString()} chars`,
      label: `YT: ${processedCount} videos`,
    });
    toast({ title: `Fetched ${processedCount} transcripts` });
  }, [selectedVideoIds, searchResults, node.id, onUpdateNode, toast]);

  // Persist mode changes
  useEffect(() => {
    onUpdateNode(node.id, { youtubeMode: mode });
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered transcript for search
  const filteredTranscript = searchText.trim()
    ? transcript.split("\n").filter((line) => line.toLowerCase().includes(searchText.toLowerCase())).join("\n")
    : transcript;

  const videoId = url ? extractVideoId(url) : null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Config */}
      <div className="w-80 border-r flex flex-col shrink-0 bg-card/50">
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Mode selector */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Input Mode</p>
              <div className="flex items-center gap-1 bg-muted/20 rounded-lg p-1 border">
                {([
                  { id: "url" as const, icon: Link2, label: "URL" },
                  { id: "search" as const, icon: Search, label: "Search" },
                  { id: "playlist" as const, icon: List, label: "Playlist" },
                ] as const).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
                      mode === m.id ? "bg-red-600 text-white" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <m.icon className="w-3 h-3" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* URL mode */}
            {mode === "url" && (
              <>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">YouTube URL</p>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full px-3 py-2 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-red-500/50 placeholder:text-muted-foreground/50"
                    disabled={isFetching}
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full gap-1.5 bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => handleFetch()}
                  disabled={isFetching || !url.trim()}
                >
                  {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Youtube className="w-3.5 h-3.5" />}
                  {isFetching ? "Fetching..." : "Get Transcript"}
                </Button>
              </>
            )}

            {/* Search mode */}
            {mode === "search" && (
              <>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Search Keywords</p>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="e.g. react server components tutorial"
                      className="flex-1 px-3 py-2 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-red-500/50 placeholder:text-muted-foreground/50"
                      onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                      disabled={isSearching}
                    />
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white shrink-0" onClick={handleSearch} disabled={isSearching}>
                      {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* Quick select buttons */}
                {searchResults.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Results ({searchResults.length})
                      </p>
                      <div className="flex items-center gap-1">
                        {[1, 3, 5].map((n) => (
                          <button
                            key={n}
                            onClick={() => selectTopN(n)}
                            className={`px-2 py-0.5 text-[9px] rounded border transition-colors ${
                              topN === n && selectedVideoIds.size === n
                                ? "bg-red-600/20 border-red-600/40 text-red-600"
                                : "border-border/50 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Top {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Search result list */}
                    <div className="space-y-1 max-h-[300px] overflow-y-auto">
                      {searchResults.map((r) => {
                        const isSelected = selectedVideoIds.has(r.videoId);
                        return (
                          <div
                            key={r.videoId}
                            className={`flex items-start gap-2 p-1.5 rounded-lg border text-left transition-colors ${
                              isSelected
                                ? "border-red-600/40 bg-red-600/5"
                                : "border-border/50 hover:bg-muted/30"
                            }`}
                          >
                            {/* Thumbnail — click to preview */}
                            <button
                              className="relative shrink-0 w-16 h-10 rounded overflow-hidden group/thumb"
                              onClick={() => setPreviewVideoId(r.videoId)}
                              title="Preview video"
                            >
                              <img
                                src={r.thumbnailUrl || `https://i.ytimg.com/vi/${r.videoId}/default.jpg`}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                                <Play className="w-4 h-4 text-white" />
                              </div>
                            </button>
                            {/* Selection checkbox + info */}
                            <button
                              className="flex-1 flex items-start gap-1.5 min-w-0 text-left"
                              onClick={() => toggleVideoSelection(r.videoId)}
                            >
                              {isSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-medium leading-tight truncate">{r.title}</p>
                                <div className="flex items-center gap-2 mt-0.5 text-[9px] text-muted-foreground">
                                  <span className="flex items-center gap-0.5"><User className="w-2.5 h-2.5" />{r.channelTitle}</span>
                                  {r.duration && <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{r.duration}</span>}
                                  {r.viewCount && <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{r.viewCount}</span>}
                                </div>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <Button
                      size="sm"
                      className="w-full gap-1.5 bg-red-600 hover:bg-red-700 text-white"
                      onClick={handleFetchSelected}
                      disabled={isFetching || selectedVideoIds.size === 0}
                    >
                      {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Youtube className="w-3.5 h-3.5" />}
                      {isFetching ? "Fetching..." : `Get ${selectedVideoIds.size} Transcript${selectedVideoIds.size !== 1 ? "s" : ""}`}
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Playlist mode */}
            {mode === "playlist" && (
              <>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Playlist URL</p>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://youtube.com/playlist?list=..."
                    className="w-full px-3 py-2 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-red-500/50 placeholder:text-muted-foreground/50"
                    disabled={isFetching}
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full gap-1.5 bg-red-600 hover:bg-red-700 text-white"
                  onClick={async () => {
                    if (!url.trim()) return;
                    setIsSearching(true);
                    try {
                      const res = await fetch("/api/youtube/playlist", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ playlistUrl: url.trim(), maxResults: 20 }),
                      });
                      if (!res.ok) throw new Error("Playlist fetch failed");
                      const data = await res.json() as { playlistTitle: string; videos: SearchResult[] };
                      const results = data.videos.map((v) => ({ ...v, duration: undefined, viewCount: undefined }));
                      setSearchResults(results);
                      // Auto-select all
                      const allIds = results.map((r) => r.videoId);
                      setSelectedVideoIds(new Set(allIds));
                      onUpdateNode(node.id, {
                        youtubeSearchResults: results,
                        youtubeSelectedVideos: allIds,
                        youtubeMode: "playlist",
                      });
                      toast({ title: `Found ${results.length} videos in playlist` });
                    } catch (err) {
                      toast({ title: "Playlist failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
                    } finally {
                      setIsSearching(false);
                    }
                  }}
                  disabled={isSearching || !url.trim()}
                >
                  {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <List className="w-3.5 h-3.5" />}
                  {isSearching ? "Loading..." : "Load Playlist"}
                </Button>

                {/* Show playlist results with selection (reuse search result list) */}
                {searchResults.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Videos ({selectedVideoIds.size}/{searchResults.length} selected)
                      </p>
                    </div>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {searchResults.map((r) => {
                        const isSelected = selectedVideoIds.has(r.videoId);
                        return (
                          <button
                            key={r.videoId}
                            className={`w-full flex items-center gap-2 p-1.5 rounded border text-left transition-colors text-[10px] ${
                              isSelected ? "border-red-600/40 bg-red-600/5" : "border-border/50 hover:bg-muted/30"
                            }`}
                            onClick={() => toggleVideoSelection(r.videoId)}
                          >
                            {isSelected ? <CheckSquare className="w-3 h-3 text-red-600 shrink-0" /> : <Square className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
                            <span className="truncate">{r.title}</span>
                          </button>
                        );
                      })}
                    </div>
                    <Button
                      size="sm"
                      className="w-full gap-1.5 bg-red-600 hover:bg-red-700 text-white"
                      onClick={handleFetchSelected}
                      disabled={isFetching || selectedVideoIds.size === 0}
                    >
                      {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Youtube className="w-3.5 h-3.5" />}
                      {isFetching ? "Fetching..." : `Get ${selectedVideoIds.size} Transcript${selectedVideoIds.size !== 1 ? "s" : ""}`}
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Thumbnail preview */}
            {(node.youtubeThumbnailUrl || (videoId && mode === "url")) && (
              <div className="space-y-1.5 border-t pt-3">
                <div className="relative group cursor-pointer" onClick={() => setShowPlayer(!showPlayer)}>
                  <img
                    src={node.youtubeThumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                    alt="Video thumbnail"
                    className="w-full rounded-lg border"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>
            )}

            {/* Metadata */}
            {node.youtubeTitle && (
              <div className="space-y-1.5 border-t pt-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Video Title</p>
                <p className="text-xs text-foreground">{node.youtubeTitle}</p>
              </div>
            )}

            {node.youtubeMetadata && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  {node.youtubeMetadata.duration && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3 h-3" /> {node.youtubeMetadata.duration}
                    </div>
                  )}
                  {node.youtubeMetadata.viewCount && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Eye className="w-3 h-3" /> {node.youtubeMetadata.viewCount}
                    </div>
                  )}
                  {node.youtubeMetadata.channelTitle && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <User className="w-3 h-3" /> {node.youtubeMetadata.channelTitle}
                    </div>
                  )}
                  {node.youtubeMetadata.publishedAt && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="w-3 h-3" /> {new Date(node.youtubeMetadata.publishedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stats */}
            {transcript && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Words</span>
                  <Badge variant="outline" className="text-[10px]">
                    {transcript.split(/\s+/).length.toLocaleString()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Characters</span>
                  <Badge variant="outline" className="text-[10px]">
                    {transcript.length.toLocaleString()}
                  </Badge>
                </div>
                {chapters.length > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Chapters</span>
                    <Badge variant="outline" className="text-[10px]">
                      {chapters.length}
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Chapter detection button */}
            {transcript && chapters.length === 0 && (
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-1.5 text-xs"
                onClick={() => detectChapters(transcript)}
              >
                <Scissors className="w-3.5 h-3.5" />
                Detect Chapters
              </Button>
            )}

            {/* Error */}
            {node.youtubeError && (
              <div className="p-2 bg-destructive/10 border border-destructive/30 rounded-md">
                <p className="text-xs text-destructive">{node.youtubeError}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right: Transcript / Player */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Embedded player — from URL mode thumbnail click or search result preview */}
        {(showPlayer && videoId || previewVideoId) && (
          <div className="border-b bg-black relative">
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube-nocookie.com/embed/${previewVideoId || videoId}?rel=0&autoplay=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="YouTube player"
              />
            </div>
            {previewVideoId && (
              <button
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors z-10"
                onClick={() => setPreviewVideoId(null)}
                title="Close preview"
              >
                <span className="text-xs font-bold">&times;</span>
              </button>
            )}
          </div>
        )}

        {/* Toolbar */}
        <div className="px-4 py-2 border-b bg-muted/20 flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1">
            {chapters.length > 0 ? "Chapters" : "Transcript"}
          </h3>
          {transcript && (
            <div className="flex items-center gap-1">
              <Search className="w-3 h-3 text-muted-foreground" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search..."
                className="w-32 px-2 py-0.5 text-[11px] bg-muted/30 border rounded outline-none"
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* Chapters view */}
          {chapters.length > 0 && !searchText.trim() ? (
            <div className="space-y-1.5 max-w-3xl">
              {chapters.map((ch, idx) => (
                <div key={idx} className="border rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedChapterIdx(expandedChapterIdx === idx ? null : idx)}
                  >
                    {expandedChapterIdx === idx ? (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                    <Badge variant="outline" className="text-[9px] h-4 shrink-0">{ch.startTime}</Badge>
                    <span className="text-xs font-medium truncate">{ch.title}</span>
                  </button>
                  {expandedChapterIdx === idx && (
                    <div className="px-4 pb-3 border-t">
                      <p className="text-xs text-muted-foreground leading-relaxed mt-2">{ch.content}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : transcript ? (
            <ProvokeText
              value={filteredTranscript}
              onChange={() => {}}
              readOnly
              chrome="bare"
              variant="textarea"
              showCopy
              showClear={false}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <Youtube className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground/50">No transcript yet</p>
                <p className="text-xs text-muted-foreground/40">
                  {mode === "search"
                    ? "Search for videos by keyword, select results, and fetch transcripts"
                    : mode === "playlist"
                    ? "Paste a playlist URL to load and process videos"
                    : "Paste a YouTube URL and click Get Transcript"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
