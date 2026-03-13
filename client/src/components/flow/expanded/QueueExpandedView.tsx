/**
 * QueueExpandedView — Full overlay for Queue nodes.
 *
 * Left panel: mode, trigger mode, stats, and action buttons.
 * Right panel: scrollable list of queued items with status badges.
 */

import { ListOrdered, Play, Trash2, ChevronRight, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FlowNode } from "../useFlowCanvas";
import { ExpandedViewLayout } from "./ExpandedViewLayout";

interface QueueExpandedViewProps {
  node: FlowNode;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onPlayNode?: (nodeId: string) => void;
}

export function QueueExpandedView({
  node,
  onUpdateNode,
  onPlayNode,
}: QueueExpandedViewProps) {
  const mode = node.queueMode || "flow_through";
  const triggerMode = node.queueTriggerMode || "process_all";
  const items = node.queueItems || [];
  const stats = node.queueStats || { totalEnqueued: 0, totalReleased: 0, totalProcessed: 0 };
  const autoChain = node.queueAutoChain ?? false;
  const queuedItems = items.filter((i) => i.status === "queued");

  const setMode = (m: "flow_through" | "hold_until_triggered") =>
    onUpdateNode(node.id, { queueMode: m });

  const setTriggerMode = (m: "one_per_trigger" | "process_all") =>
    onUpdateNode(node.id, { queueTriggerMode: m });

  const handleReleaseOne = () => {
    if (queuedItems.length === 0) return;
    const updated = items.map((item, _i) => {
      if (item.id === queuedItems[0].id) {
        return { ...item, status: "released" as const, releasedAt: new Date().toISOString() };
      }
      return item;
    });
    const newStats = { ...stats, totalReleased: stats.totalReleased + 1 };
    onUpdateNode(node.id, {
      queueItems: updated,
      queueStats: newStats,
      snippet: `Queue: ${queuedItems.length - 1} queued`,
    });
    // Also trigger play to create output docs
    if (onPlayNode) onPlayNode(node.id);
  };

  const handleReleaseAll = () => {
    if (queuedItems.length === 0) return;
    const now = new Date().toISOString();
    const updated = items.map((item) => {
      if (item.status === "queued") {
        return { ...item, status: "released" as const, releasedAt: now };
      }
      return item;
    });
    const newStats = { ...stats, totalReleased: stats.totalReleased + queuedItems.length };
    onUpdateNode(node.id, {
      queueItems: updated,
      queueStats: newStats,
      snippet: `Queue: 0 queued`,
    });
    if (onPlayNode) onPlayNode(node.id);
  };

  const handleClearQueue = () => {
    onUpdateNode(node.id, {
      queueItems: items.filter((i) => i.status !== "queued"),
      snippet: "Queue: 0 queued",
    });
  };

  return (
    <ExpandedViewLayout
      defaultLeftSize={35}
      left={
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-border/50">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-emerald-500" />
              Queue Settings
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
                  variant={mode === "flow_through" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => setMode("flow_through")}
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                  Flow Through
                </Button>
                <Button
                  variant={mode === "hold_until_triggered" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => setMode("hold_until_triggered")}
                >
                  <Play className="w-3.5 h-3.5" />
                  Hold
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {mode === "flow_through"
                  ? "Items pass through immediately — queue just tracks them."
                  : "Items accumulate until triggered for release."}
              </p>
            </div>

            {/* Trigger mode (hold only) */}
            {mode === "hold_until_triggered" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Trigger Mode
                </label>
                <div className="space-y-1">
                  <button
                    onClick={() => setTriggerMode("one_per_trigger")}
                    className={`w-full text-left px-3 py-2 rounded-md border text-xs transition-colors ${
                      triggerMode === "one_per_trigger"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                        : "border-border/50 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span className="font-medium">One Per Trigger</span>
                    <p className="text-[10px] opacity-70 mt-0.5">Each trigger releases one item (FIFO)</p>
                  </button>
                  <button
                    onClick={() => setTriggerMode("process_all")}
                    className={`w-full text-left px-3 py-2 rounded-md border text-xs transition-colors ${
                      triggerMode === "process_all"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                        : "border-border/50 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span className="font-medium">Process All</span>
                    <p className="text-[10px] opacity-70 mt-0.5">Each trigger releases all queued items</p>
                  </button>
                </div>
              </div>
            )}

            {/* Auto-chain toggle */}
            <div className="space-y-1.5 border-t pt-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoChain}
                  onChange={(e) => onUpdateNode(node.id, { queueAutoChain: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-muted-foreground">Trigger downstream execution on release</span>
              </label>
            </div>

            {/* Stats */}
            <div className="space-y-1.5 border-t pt-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Stats</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-muted/20 rounded">
                  <p className="text-lg font-semibold">{stats.totalEnqueued}</p>
                  <p className="text-[9px] text-muted-foreground">Enqueued</p>
                </div>
                <div className="text-center p-2 bg-muted/20 rounded">
                  <p className="text-lg font-semibold">{stats.totalReleased}</p>
                  <p className="text-[9px] text-muted-foreground">Released</p>
                </div>
                <div className="text-center p-2 bg-muted/20 rounded">
                  <p className="text-lg font-semibold">{stats.totalProcessed}</p>
                  <p className="text-[9px] text-muted-foreground">Processed</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          {mode === "hold_until_triggered" && (
            <div className="p-4 border-t border-border/50 space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={handleReleaseOne}
                  disabled={queuedItems.length === 0}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  Release One
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={handleReleaseAll}
                  disabled={queuedItems.length === 0}
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                  Release All
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={handleClearQueue}
                disabled={queuedItems.length === 0}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Clear Queue
              </Button>
            </div>
          )}
        </div>
      }
      right={
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 border-b border-border/50">
            <h3 className="text-sm font-semibold">Queue Contents</h3>
            {items.length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {queuedItems.length} queued, {items.filter((i) => i.status === "released").length} released
              </p>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4">
            {items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ListOrdered className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Queue is empty</p>
                <p className="text-[11px] mt-1">Items from upstream nodes will appear here.</p>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="space-y-1">
                  {[...items].reverse().map((item) => (
                    <div
                      key={item.id}
                      className="border rounded-lg p-2.5 bg-muted/10 text-xs"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${
                            item.status === "queued"
                              ? "border-amber-500/50 text-amber-600 bg-amber-500/10"
                              : item.status === "released"
                                ? "border-emerald-500/50 text-emerald-600 bg-emerald-500/10"
                                : "border-blue-500/50 text-blue-600 bg-blue-500/10"
                          }`}
                        >
                          {item.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(item.enqueuedAt).toLocaleTimeString()}
                        </span>
                        {item.sourceNodeLabel && (
                          <span className="text-[10px] text-muted-foreground/60 truncate">
                            from {item.sourceNodeLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-foreground/80 truncate">{item.content.slice(0, 200)}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      }
    />
  );
}
