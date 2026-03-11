/**
 * EventBusExpandedView — Full overlay for Event Bus nodes.
 *
 * Configures mode (publish/listen), channel name, overwrite toggle, and shows the event log.
 */

import { useState } from "react";
import { Radio, Send, Headphones, Copy, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FlowNode } from "../useFlowCanvas";
import { ExpandedViewLayout } from "./ExpandedViewLayout";

interface EventBusExpandedViewProps {
  node: FlowNode;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onPlayNode?: (nodeId: string) => void;
}

export function EventBusExpandedView({
  node,
  onUpdateNode,
  onPlayNode,
}: EventBusExpandedViewProps) {
  const mode = node.eventBusMode || "publish";
  const channel = node.eventBusChannel || "default";
  const log = node.eventBusLog || [];
  const overwrite = node.eventBusOverwrite ?? false;
  const [copied, setCopied] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  const setMode = (m: "publish" | "listen") =>
    onUpdateNode(node.id, { eventBusMode: m });

  const setChannel = (c: string) =>
    onUpdateNode(node.id, { eventBusChannel: c });

  const handleCopyChannel = () => {
    navigator.clipboard.writeText(channel);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <ExpandedViewLayout
      defaultLeftSize={35}
      left={
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-border/50">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-500" />
              Event Bus Settings
            </h3>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-5">
            {/* Mode selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Mode
              </label>
              <div className="flex gap-2">
                <Button
                  variant={mode === "publish" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => setMode("publish")}
                >
                  <Send className="w-3.5 h-3.5" />
                  Publish
                </Button>
                <Button
                  variant={mode === "listen" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => setMode("listen")}
                >
                  <Headphones className="w-3.5 h-3.5" />
                  Listen
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {mode === "publish"
                  ? "Sends upstream content as task events for local agents."
                  : "Receives results from local agents as document nodes."}
              </p>
            </div>

            {/* Channel */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Channel
              </label>
              <div className="flex gap-2">
                <Input
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  placeholder="default"
                  className="text-sm h-8"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={handleCopyChannel}
                  title="Copy channel name"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Publish and listen nodes on the same channel are paired.
              </p>
            </div>

            {/* Overwrite toggle (listen mode only) */}
            {mode === "listen" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Result Handling
                </label>
                <Button
                  variant={overwrite ? "default" : "outline"}
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => onUpdateNode(node.id, { eventBusOverwrite: !overwrite })}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {overwrite ? "Overwrite Mode (ON)" : "Overwrite Mode (OFF)"}
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {overwrite
                    ? "Updates a single linked document with the latest result. Full history is kept in the log below."
                    : "Creates a new document node for each incoming result."}
                </p>
              </div>
            )}
          </div>

          {/* Play button (publish mode only) */}
          {mode === "publish" && onPlayNode && (
            <div className="p-4 border-t border-border/50">
              <Button
                size="sm"
                className="w-full bg-cyan-600 hover:bg-cyan-700"
                onClick={() => onPlayNode(node.id)}
                disabled={node.eventBusStatus === "publishing"}
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {node.eventBusStatus === "publishing" ? "Publishing..." : "Publish Event"}
              </Button>
            </div>
          )}
        </div>
      }
      right={
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 border-b border-border/50">
            <h3 className="text-sm font-semibold">
              {mode === "publish" ? "Publish Log" : "Incoming Results"}
            </h3>
            {log.length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{log.length} event(s)</p>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Connection instructions (collapsed when log has entries) */}
            {log.length === 0 && (
              <div className="bg-muted/30 rounded-lg p-4 text-xs space-y-3">
                <p className="font-medium text-sm text-foreground">
                  {mode === "publish"
                    ? "How agents subscribe to events:"
                    : "How agents post results back:"}
                </p>
                {mode === "publish" ? (
                  <div className="space-y-2 font-mono text-[11px] text-muted-foreground">
                    <p className="font-sans text-xs text-foreground font-medium">SSE Subscribe (real-time):</p>
                    <code className="block bg-background/50 rounded p-2">
                      GET /api/webhook/events/{"<canvasId>"}/subscribe?channel={channel}
                    </code>
                    <p className="font-sans text-xs text-foreground font-medium mt-3">Poll (fallback):</p>
                    <code className="block bg-background/50 rounded p-2">
                      GET /api/webhook/events/{"<canvasId>"}?channel={channel}
                    </code>
                    <p className="font-sans text-xs text-foreground font-medium mt-3">MCP Tool:</p>
                    <code className="block bg-background/50 rounded p-2">
                      poll_events(canvasId, "{channel}")
                    </code>
                  </div>
                ) : (
                  <div className="space-y-2 font-mono text-[11px] text-muted-foreground">
                    <p className="font-sans text-xs text-foreground font-medium">Post Result:</p>
                    <code className="block bg-background/50 rounded p-2 whitespace-pre">{`POST /api/webhook/events/<canvasId>/result
{
  "channel": "${channel}",
  "label": "Result Title",
  "content": "Full result content..."
}`}</code>
                    <p className="font-sans text-xs text-foreground font-medium mt-3">MCP Tool:</p>
                    <code className="block bg-background/50 rounded p-2">
                      post_result(canvasId, "{channel}", "Title", "Content")
                    </code>
                  </div>
                )}
              </div>
            )}

            {/* Event log */}
            {log.length > 0 && (
              <ScrollArea className="h-full rounded-md border border-border">
                <div className="p-2 space-y-0.5">
                  {[...log].reverse().map((entry, i) => {
                    const idx = log.length - 1 - i;
                    const isExpanded = expandedLogId === idx;
                    return (
                      <div key={idx} className="border-b border-border/50 last:border-0">
                        <button
                          className="w-full text-left text-[11px] flex gap-2 py-1.5 px-1 hover:bg-muted/30 rounded transition-colors"
                          onClick={() => setExpandedLogId(isExpanded ? null : idx)}
                        >
                          <span className="text-muted-foreground shrink-0 w-16">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                          <span className={`shrink-0 w-16 ${
                            entry.type === "published" ? "text-cyan-500"
                              : entry.type === "result" ? "text-emerald-500"
                              : "text-muted-foreground"
                          }`}>
                            {entry.type === "published" ? "sent" : entry.type}
                          </span>
                          <span className="truncate">{entry.summary}</span>
                        </button>
                        {isExpanded && entry.content && (
                          <div className="px-2 pb-2">
                            <pre className="text-[10px] bg-background/50 rounded p-2 whitespace-pre-wrap break-words text-muted-foreground max-h-40 overflow-auto">
                              {entry.content}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            {log.length === 0 && mode === "listen" && (
              <div className="text-center py-8 text-muted-foreground">
                <Headphones className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Waiting for agent results...</p>
                <p className="text-[11px] mt-1">Results will appear as document nodes connected to this node.</p>
              </div>
            )}

            {log.length === 0 && mode === "publish" && (
              <div className="text-center py-8 text-muted-foreground">
                <Send className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No events published yet</p>
                <p className="text-[11px] mt-1">Connect upstream nodes and click Publish to send events.</p>
              </div>
            )}
          </div>
        </div>
      }
    />
  );
}
