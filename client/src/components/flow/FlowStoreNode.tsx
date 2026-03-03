import React, { useCallback, useState } from "react";
import { BookOpen, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContextSidebar } from "@/components/notebook/ContextSidebar";
import { apiRequest } from "@/lib/queryClient";
import type { FlowNode } from "./useFlowCanvas";

interface FlowStoreNodeProps {
  node: FlowNode;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onPickDocument: (doc: { id: number; title: string; content: string }) => void;
}

export const FlowStoreNode = React.memo(function FlowStoreNode({
  node,
  isSelected,
  onMouseDown,
  onDelete,
  onPickDocument,
}: FlowStoreNodeProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDocClick = useCallback(
    async (id: number, title: string) => {
      if (isLoading) return;
      setIsLoading(true);
      try {
        const res = await apiRequest("GET", `/api/documents/${id}`);
        const data = (await res.json()) as { title: string; content: string };
        onPickDocument({ id, title: data.title || title, content: data.content });
      } catch {
        onPickDocument({ id, title, content: "" });
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, onPickDocument],
  );

  return (
    <div
      className={cn(
        "absolute select-none rounded-lg border shadow-sm transition-shadow group flex flex-col",
        "bg-card border-primary/30 hover:shadow-md",
        isSelected && "ring-2 ring-primary shadow-md",
      )}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        zIndex: node.zIndex,
      }}
    >
      {/* Draggable header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b bg-primary/10 border-primary/20 rounded-t-lg cursor-grab shrink-0"
        onMouseDown={(e) => onMouseDown(e, node.id)}
      >
        <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium truncate flex-1">Context Store</span>
        {isLoading && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary">
          Store
        </span>
      </div>

      {/* Embedded ContextSidebar — scrollable, interactive */}
      <div
        className="flex-1 overflow-auto min-h-0"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <ContextSidebar
          pinnedDocIds={new Set()}
          onPinDoc={() => {}}
          onUnpinDoc={() => {}}
          onPreviewDoc={handleDocClick}
          isCollapsed={false}
          onToggleCollapse={() => {}}
          embedded
        />
      </div>

      {/* Delete button */}
      <button
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(node.id);
        }}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
});
