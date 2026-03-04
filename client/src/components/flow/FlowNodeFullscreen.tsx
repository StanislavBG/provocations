import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { FlowNode } from "./useFlowCanvas";
import { NODE_STYLES, NODE_ICONS } from "./FlowNodeRenderer";

/** Accent color → Tailwind bg class for the subheader bar */
const ACCENT_BG: Record<string, string> = {
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  primary: "bg-primary",
  rose: "bg-rose-500",
  cyan: "bg-cyan-500",
  orange: "bg-orange-500",
  indigo: "bg-indigo-500",
  red: "bg-red-500",
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  sky: "bg-sky-500",
};

interface FlowNodeFullscreenProps {
  node: FlowNode;
  onClose: () => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
}

export function FlowNodeFullscreen({ node, onClose, onUpdateNode }: FlowNodeFullscreenProps) {
  const style = NODE_STYLES[node.type];
  const Icon = NODE_ICONS[node.type];
  const accentBg = ACCENT_BG[style.accent] || "bg-primary";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in duration-200"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      {/* Accent subheader */}
      <div className={cn("flex items-center gap-2 px-4 py-2 text-white shrink-0", accentBg)}>
        <Icon className="w-4 h-4" />
        <h2 className="text-sm font-semibold truncate flex-1">{node.label || style.badge}</h2>
        <span className="text-[10px] uppercase tracking-wider opacity-75 font-semibold">
          {style.badge}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-6">
        {/* Editable label */}
        <div className="mb-4">
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
            Label
          </label>
          <input
            className="w-full text-lg font-semibold bg-transparent border-b border-border/50 pb-1 focus:outline-none focus:border-primary"
            value={node.label || ""}
            onChange={(e) => onUpdateNode(node.id, { label: e.target.value })}
          />
        </div>

        {/* Node content */}
        <div className="mb-4">
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
            Content
          </label>
          <textarea
            className="w-full min-h-[300px] text-sm bg-muted/30 border border-border/50 rounded-lg p-3 resize-y focus:outline-none focus:ring-1 focus:ring-primary/50 leading-relaxed"
            value={node.content || node.documentContent || ""}
            onChange={(e) => onUpdateNode(node.id, {
              content: e.target.value,
              documentContent: e.target.value,
              snippet: e.target.value.slice(0, 200),
            })}
            placeholder="No content yet..."
          />
        </div>

        {/* Image preview if applicable */}
        {node.imageUrl && (
          <div className="mb-4">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
              Image
            </label>
            <img
              src={node.imageUrl}
              alt={node.label || "Image"}
              className="max-w-full max-h-[400px] object-contain rounded-lg border border-border/30"
            />
          </div>
        )}

        {/* Node metadata */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground/60 mt-4 pt-4 border-t border-border/30">
          <span>Type: {style.badge}</span>
          <span>ID: {node.id.slice(0, 8)}</span>
          {node.content && <span>{node.content.split(/\s+/).length} words</span>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
