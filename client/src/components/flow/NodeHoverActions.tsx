/**
 * NodeHoverActions — universal hover toolbar for ALL canvas node types.
 *
 * Renders Copy-ID, Lock, and Delete buttons that appear on group-hover.
 * Every node type must use this component to ensure consistent behavior.
 *
 * Usage:
 *   <NodeHoverActions
 *     nodeId={node.id}
 *     lockMode={lockMode}
 *     onToggleLock={onToggleLock}
 *     onDelete={onDelete}
 *   />
 */
import React, { useState } from "react";
import { Copy, Check, Lock, Unlock, Monitor, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type LockMode = "none" | "canvas" | "screen";

interface NodeHoverActionsProps {
  nodeId: string;
  lockMode: LockMode;
  onToggleLock?: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  /** Extra buttons rendered before the standard ones (e.g. Settings for labels) */
  before?: React.ReactNode;
  /** Custom delete handler that replaces the default (e.g. AudioNode stops recording first) */
  onCustomDelete?: (nodeId: string) => void;
  /** Position variant — most nodes use -top-2.5 -right-2, some use -top-7 right-0 */
  position?: "default" | "above";
  /** Hide entirely (e.g. label nodes hide when editing) */
  hidden?: boolean;
}

export function NodeHoverActions({
  nodeId,
  lockMode,
  onToggleLock,
  onDelete,
  before,
  onCustomDelete,
  position = "default",
  hidden = false,
}: NodeHoverActionsProps) {
  const [copied, setCopied] = useState(false);

  if (hidden) return null;

  const posClass = position === "above"
    ? "absolute -top-7 right-0 z-20"
    : "absolute -top-2.5 -right-2";

  const handleDelete = onCustomDelete || onDelete;

  return (
    <div className={cn(posClass, "flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity")}>
      {/* Extra buttons (e.g. Settings) */}
      {before}

      {/* Copy node ID */}
      <button
        className="w-5 h-5 rounded-full bg-muted text-muted-foreground hover:bg-muted-foreground/20 flex items-center justify-center shadow-sm transition-colors"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(nodeId);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        title={copied ? "Copied!" : "Copy node ID"}
      >
        {copied ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5" />}
      </button>

      {/* Lock toggle */}
      {onToggleLock && (
        <button
          className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center shadow-sm transition-colors",
            lockMode === "canvas" ? "bg-yellow-500 text-white"
              : lockMode === "screen" ? "bg-blue-500 text-white"
              : "bg-muted text-muted-foreground hover:bg-muted-foreground/20",
          )}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onToggleLock(nodeId); }}
          title={lockMode === "none" ? "Lock to canvas" : lockMode === "canvas" ? "Lock to screen" : "Unlock"}
        >
          {lockMode === "none" && <Unlock className="w-2.5 h-2.5" />}
          {lockMode === "canvas" && <Lock className="w-2.5 h-2.5" />}
          {lockMode === "screen" && <Monitor className="w-2.5 h-2.5" />}
        </button>
      )}

      {/* Delete */}
      {lockMode === "none" && (
        <button
          className="w-5 h-5 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive transition-colors"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); handleDelete(nodeId); }}
          title="Delete node"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
}
