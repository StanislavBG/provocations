import React, { useCallback, useState, useEffect } from "react";
import { Youtube, Loader2, Trash2, Lock, Unlock, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FlowNode } from "./useFlowCanvas";
import { getEffectiveLockMode } from "./useFlowCanvas";
import { FlowPortDots } from "./FlowPortDots";
import { lifecycleLogStore } from "@/lib/lifecycleLog";

interface FlowYoutubeNodeProps {
  node: FlowNode;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onToggleLock?: (nodeId: string) => void;
  onPortMouseDown?: (e: React.MouseEvent, nodeId: string, portType: "input" | "output") => void;
  onDoubleClick?: (e: React.MouseEvent, nodeId: string) => void;
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
  onToggleLock,
  onPortMouseDown,
  onDoubleClick,
}: FlowYoutubeNodeProps) {
  const { toast } = useToast();
  const status = node.youtubeFetchStatus ?? "idle";
  const [localUrl, setLocalUrl] = useState(node.youtubeUrl || "");

  // Sync externally-injected URLs (e.g. from Research node)
  useEffect(() => {
    if (node.youtubeUrl && node.youtubeUrl !== localUrl) {
      setLocalUrl(node.youtubeUrl);
    }
  }, [node.youtubeUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalUrl(e.target.value);
      onUpdateNode(node.id, { youtubeUrl: e.target.value });
    },
    [node.id, onUpdateNode],
  );

  const lcLog = useCallback(
    (phase: "pre-process" | "process" | "post-process", status: "start" | "success" | "error", message: string, extra?: { durationMs?: number; error?: string }) => {
      lifecycleLogStore.push({ phase, status, nodeId: node.id, nodeType: node.type, nodeLabel: node.label || "YouTube", message, ...extra });
    },
    [node.id, node.type, node.label],
  );

  const handleFetchTranscript = useCallback(async () => {
    const url = localUrl.trim();
    if (!url) return;
    const t0 = performance.now();

    const videoId = extractVideoId(url);
    if (!videoId) {
      lcLog("pre-process", "error", "Invalid YouTube URL", { error: "Bad URL" });
      onUpdateNode(node.id, { youtubeFetchStatus: "error", youtubeError: "Invalid YouTube URL" });
      toast({ title: "Invalid URL", description: "Paste a valid YouTube video URL", variant: "destructive" });
      return;
    }

    lcLog("pre-process", "success", `Video ID: ${videoId}`);
    onUpdateNode(node.id, { youtubeFetchStatus: "fetching", youtubeError: undefined, snippet: "Fetching transcript…" });
    lcLog("process", "start", "Fetching transcript via SSE");

    try {
      // Use SSE streaming for progressive transcript delivery
      const res = await fetch("/api/youtube/process-video", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ videoId, videoUrl: url, videoTitle: "" }),
      });

      if (!res.ok) throw new Error("Transcript fetch failed");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "status") {
              onUpdateNode(node.id, { snippet: evt.message });
            } else if (evt.type === "chunk") {
              accumulated += (accumulated ? "\n" : "") + evt.text;
              onUpdateNode(node.id, {
                content: accumulated,
                snippet: `${evt.progress}% — ${accumulated.length.toLocaleString()} chars`,
              });
            } else if (evt.type === "done") {
              const elapsed = Math.round(performance.now() - t0);
              lcLog("process", "success", `${evt.totalChars?.toLocaleString() || "?"} chars, ${evt.totalSegments || "?"} segments`, { durationMs: elapsed });
              onUpdateNode(node.id, {
                youtubeFetchStatus: "done",
                youtubeTitle: evt.videoTitle,
                content: evt.transcript,
                snippet: evt.transcript.slice(0, 150),
                label: `YT: ${(evt.videoTitle || "Video").slice(0, 25)}`,
              });
              lcLog("post-process", "success", `Title: ${evt.videoTitle || "(none)"}`);
              toast({ title: "Transcript ready", description: `${evt.totalSegments} segments, ${evt.totalChars.toLocaleString()} chars` });
            } else if (evt.type === "error") {
              throw new Error(evt.message);
            }
          } catch (parseErr) {
            // Skip malformed SSE lines
            if (parseErr instanceof Error && parseErr.message !== "Unexpected end of JSON input") throw parseErr;
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fetch failed";
      lcLog("process", "error", msg, { error: msg, durationMs: Math.round(performance.now() - t0) });
      onUpdateNode(node.id, { youtubeFetchStatus: "error", youtubeError: msg, snippet: "Error fetching transcript" });
      toast({ title: "Transcript fetch failed", description: msg, variant: "destructive" });
    }
  }, [node.id, localUrl, onUpdateNode, toast, lcLog]);

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
        onDoubleClick={onDoubleClick ? (e) => onDoubleClick(e, node.id) : undefined}
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

      {/* Lock + Delete buttons */}
      {(() => {
        const lm = getEffectiveLockMode(node);
        return (
          <div className="absolute -top-2.5 -right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {onToggleLock && (
              <button
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center shadow-sm transition-colors",
                  lm === "canvas" ? "bg-yellow-500 text-white"
                    : lm === "screen" ? "bg-blue-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted-foreground/20",
                )}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onToggleLock(node.id); }}
                title={lm === "none" ? "Lock to canvas" : lm === "canvas" ? "Lock to screen" : "Unlock"}
              >
                {lm === "none" && <Unlock className="w-2.5 h-2.5" />}
                {lm === "canvas" && <Lock className="w-2.5 h-2.5" />}
                {lm === "screen" && <Monitor className="w-2.5 h-2.5" />}
              </button>
            )}
            {lm === "none" && (
              <button
                className="w-5 h-5 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive transition-colors"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
                title="Delete node"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
});
