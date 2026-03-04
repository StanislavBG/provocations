import React, { useCallback, useState } from "react";
import { Youtube, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FlowNode } from "./useFlowCanvas";
import { FlowPortDots } from "./FlowPortDots";

interface FlowYoutubeNodeProps {
  node: FlowNode;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onPortMouseDown?: (e: React.MouseEvent, nodeId: string, portType: "input" | "output") => void;
}

/** Extract YouTube video ID from various URL formats */
function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export const FlowYoutubeNode = React.memo(function FlowYoutubeNode({
  node,
  isSelected,
  onMouseDown,
  onDelete,
  onUpdateNode,
  onPortMouseDown,
}: FlowYoutubeNodeProps) {
  const { toast } = useToast();
  const status = node.youtubeFetchStatus ?? "idle";
  const [localUrl, setLocalUrl] = useState(node.youtubeUrl || "");

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalUrl(e.target.value);
      onUpdateNode(node.id, { youtubeUrl: e.target.value });
    },
    [node.id, onUpdateNode],
  );

  const handleFetchTranscript = useCallback(async () => {
    const url = localUrl.trim();
    if (!url) return;

    const videoId = extractVideoId(url);
    if (!videoId) {
      onUpdateNode(node.id, { youtubeFetchStatus: "error", youtubeError: "Invalid YouTube URL" });
      toast({ title: "Invalid URL", description: "Paste a valid YouTube video URL", variant: "destructive" });
      return;
    }

    onUpdateNode(node.id, { youtubeFetchStatus: "fetching", youtubeError: undefined, snippet: "Fetching transcript..." });

    try {
      const res = await apiRequest("POST", "/api/youtube/process-video", {
        videoId,
        videoUrl: url,
        videoTitle: "",
      });
      const data = (await res.json()) as { videoTitle: string; transcript: string };

      onUpdateNode(node.id, {
        youtubeFetchStatus: "done",
        youtubeTitle: data.videoTitle,
        content: data.transcript,
        snippet: data.transcript.slice(0, 150),
        label: `YT: ${(data.videoTitle || "Video").slice(0, 25)}`,
      });
      toast({ title: "Transcript ready" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fetch failed";
      onUpdateNode(node.id, { youtubeFetchStatus: "error", youtubeError: msg, snippet: "Error fetching transcript" });
      toast({ title: "Transcript fetch failed", description: msg, variant: "destructive" });
    }
  }, [node.id, localUrl, onUpdateNode, toast]);

  return (
    <div
      className={cn(
        "absolute select-none rounded-lg border-2 shadow-md transition-shadow group flex flex-col",
        "bg-card hover:shadow-lg border-red-600/60",
        isSelected && "ring-2 ring-primary shadow-lg",
      )}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height, zIndex: node.zIndex }}
    >
      {/* Draggable header */}
      <div
        className="flex items-center gap-1.5 px-2 py-1 border-b bg-red-600/15 border-red-600/40 rounded-t-lg cursor-grab shrink-0"
        onMouseDown={(e) => onMouseDown(e, node.id)}
      >
        <Youtube className="w-3 h-3 text-red-600 shrink-0" />
        <span className="text-[10px] font-medium truncate flex-1">{node.label || "YouTube"}</span>
        <span className="text-[8px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded bg-red-600/25 text-red-700 dark:text-red-400">
          Video
        </span>
      </div>

      {/* Interactive body */}
      <div className="flex-1 overflow-auto min-h-0 flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        {/* URL input */}
        <div className="px-2 py-1 border-b border-border/50">
          <input
            type="text"
            className="w-full text-[9px] bg-transparent border border-border/50 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-red-600/50 placeholder:text-muted-foreground/40"
            placeholder="Paste YouTube URL..."
            value={localUrl}
            onChange={handleUrlChange}
            disabled={status === "fetching"}
          />
        </div>

        {/* Fetch button */}
        <div className="px-2 py-1 border-b border-border/50">
          <button
            className="w-full flex items-center justify-center gap-1.5 text-[9px] font-medium px-2 py-1.5 rounded bg-red-600/20 hover:bg-red-600/30 transition-colors disabled:opacity-50"
            onClick={handleFetchTranscript}
            disabled={status === "fetching" || !localUrl.trim()}
          >
            {status === "fetching" ? (
              <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Fetching...</>
            ) : (
              "Get Transcript"
            )}
          </button>
        </div>

        {/* Status / output */}
        {status === "error" && node.youtubeError && (
          <div className="px-2 py-1 text-[8px] text-red-600 bg-red-600/5 italic">{node.youtubeError}</div>
        )}
        {status === "done" && node.content && (
          <div className="px-2 py-1 flex-1 overflow-auto">
            <p className="text-[9px] text-muted-foreground leading-relaxed line-clamp-3">
              {node.content.slice(0, 200)}
            </p>
          </div>
        )}
        {status === "idle" && (
          <div className="px-2 py-1 text-[9px] text-muted-foreground/60 italic">
            Paste a YouTube URL above
          </div>
        )}
      </div>

      {/* Port dots */}
      <FlowPortDots node={node} isSelected={isSelected} onPortMouseDown={onPortMouseDown} accentColor="red" />

      {/* Delete button */}
      <button
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
});
