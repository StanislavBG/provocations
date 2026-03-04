/**
 * YoutubeExpandedView — Full expanded view for YouTube nodes.
 *
 * Provides: URL input, fetch button, full transcript with search, metadata.
 */

import { useState, useCallback } from "react";
import { Youtube, Loader2, Copy, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProvokeText } from "@/components/ProvokeText";
import { useToast } from "@/hooks/use-toast";
import type { FlowNode } from "../useFlowCanvas";

interface YoutubeExpandedViewProps {
  node: FlowNode;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
}

export function YoutubeExpandedView({ node, onUpdateNode }: YoutubeExpandedViewProps) {
  const { toast } = useToast();
  const [url, setUrl] = useState(node.youtubeUrl || "");
  const [searchText, setSearchText] = useState("");
  const isFetching = node.youtubeFetchStatus === "fetching";
  const transcript = node.content || "";

  const handleFetch = useCallback(async () => {
    if (!url.trim()) return;

    onUpdateNode(node.id, {
      youtubeUrl: url,
      youtubeFetchStatus: "fetching",
      snippet: "Fetching transcript...",
      youtubeError: undefined,
    });

    try {
      const res = await fetch("/api/youtube/process-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) throw new Error("Failed to fetch transcript");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullTranscript = "";
      let title = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const evt = JSON.parse(line.slice(6));
                if (evt.type === "chunk") {
                  onUpdateNode(node.id, {
                    snippet: `Fetching... ${evt.progress || ""}`,
                  });
                } else if (evt.type === "done") {
                  fullTranscript = evt.transcript || "";
                  title = evt.title || "";
                } else if (evt.type === "error") {
                  throw new Error(evt.message || "Transcript fetch failed");
                }
              } catch (e) {
                if (e instanceof Error && e.message !== "Transcript fetch failed") {
                  // Ignore JSON parse errors from SSE
                }
              }
            }
          }
        }
      }

      onUpdateNode(node.id, {
        youtubeFetchStatus: "done",
        youtubeTitle: title,
        content: fullTranscript,
        documentContent: fullTranscript,
        snippet: fullTranscript.slice(0, 200),
        label: title ? `YouTube: ${title.slice(0, 30)}` : node.label,
      });
      toast({ title: "Transcript fetched" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      onUpdateNode(node.id, {
        youtubeFetchStatus: "error",
        youtubeError: msg,
        snippet: msg,
      });
      toast({ title: "Fetch failed", description: msg, variant: "destructive" });
    }
  }, [url, node.id, node.label, onUpdateNode, toast]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Config */}
      <div className="w-80 border-r flex flex-col shrink-0 bg-card/50">
        <div className="p-4 space-y-4">
          {/* URL input */}
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
            onClick={handleFetch}
            disabled={isFetching || !url.trim()}
          >
            {isFetching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Youtube className="w-3.5 h-3.5" />
            )}
            {isFetching ? "Fetching..." : "Get Transcript"}
          </Button>

          {/* Metadata */}
          {node.youtubeTitle && (
            <div className="space-y-1.5 border-t pt-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Video Title</p>
              <p className="text-xs text-foreground">{node.youtubeTitle}</p>
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
            </div>
          )}

          {/* Error */}
          {node.youtubeError && (
            <div className="p-2 bg-destructive/10 border border-destructive/30 rounded-md">
              <p className="text-xs text-destructive">{node.youtubeError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Transcript */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-2 border-b bg-muted/20 flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1">Transcript</h3>
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
        <div className="flex-1 overflow-auto p-4">
          {transcript ? (
            <ProvokeText
              value={transcript}
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
                <p className="text-xs text-muted-foreground/40">Paste a YouTube URL and click Get Transcript</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
