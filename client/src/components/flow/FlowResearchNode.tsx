import React, { useCallback } from "react";
import { Sparkles, Play, Loader2, Trash2, Lock, Unlock, Monitor, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode, FlowEdge } from "./useFlowCanvas";
import { getEffectiveLockMode } from "./useFlowCanvas";
import { FlowPortDots } from "./FlowPortDots";
import { useNodeResize } from "./useNodeResize";
import { ResizeHandles } from "./ResizeHandles";

// ── Output config options ──

const FORMAT_OPTIONS = [
  { value: "prose", label: "Prose" },
  { value: "structured", label: "Structured" },
  { value: "outline", label: "Outline" },
  { value: "academic", label: "Academic" },
] as const;

const FOCUS_OPTIONS = [
  { value: "explore", label: "Explore" },
  { value: "gather", label: "Gather" },
  { value: "analyze", label: "Analyze" },
  { value: "synthesize", label: "Synthesize" },
  { value: "deep-research", label: "Deep" },
] as const;

const DETAIL_OPTIONS = [
  { value: "brief", label: "Brief" },
  { value: "standard", label: "Standard" },
  { value: "detailed", label: "Detailed" },
  { value: "exhaustive", label: "Exhaustive" },
] as const;

/** Default output config applied when a Research node is created */
export const DEFAULT_RESEARCH_OUTPUT_CONFIG: NonNullable<FlowNode["outputConfig"]> = {
  format: "structured",
  detail: "standard",
  focusMode: "explore",
  audience: "general",
  tone: "neutral",
  outputCount: undefined,
  customInstruction: undefined,
};

interface FlowResearchNodeProps {
  node: FlowNode;
  edges: FlowEdge[];
  isSelected: boolean;
  zoom: number;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDoubleClick: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onToggleLock?: (nodeId: string) => void;
  onPortMouseDown?: (e: React.MouseEvent, nodeId: string, portType: "input" | "output") => void;
  onPlayNode?: (nodeId: string) => void;
}

export const FlowResearchNode = React.memo(function FlowResearchNode({
  node,
  edges,
  isSelected,
  zoom,
  onMouseDown,
  onDoubleClick,
  onDelete,
  onUpdateNode,
  onToggleLock,
  onPortMouseDown,
  onPlayNode,
}: FlowResearchNodeProps) {
  const isRunning = node.llmStatus === "running";
  const oc = node.outputConfig || DEFAULT_RESEARCH_OUTPUT_CONFIG;
  const lm = getEffectiveLockMode(node);

  const { handleResizeMouseDown } = useNodeResize({
    nodeId: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    zoom,
    minWidth: 200,
    minHeight: 200,
    onUpdateNode,
  });

  // Resolve connected inputs by role
  const objectiveEdges = edges.filter((e) => e.toNodeId === node.id && e.role === "objective");
  const contextEdges = edges.filter((e) => e.toNodeId === node.id && e.role === "context");
  const outputFormatEdges = edges.filter((e) => e.toNodeId === node.id && e.role === "output-format");
  const plainEdges = edges.filter((e) => e.toNodeId === node.id && !e.role);

  const updateConfig = useCallback(
    (patch: Partial<NonNullable<FlowNode["outputConfig"]>>) => {
      onUpdateNode(node.id, {
        outputConfig: { ...oc, ...patch },
      });
    },
    [node.id, oc, onUpdateNode],
  );

  return (
    <div
      className={cn(
        "absolute select-none rounded-lg border-2 shadow-md transition-shadow cursor-grab group",
        "hover:shadow-lg",
        "bg-card border-blue-500/60",
        isSelected && "ring-2 ring-primary shadow-lg",
      )}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        zIndex: node.zIndex,
      }}
      onMouseDown={(e) => onMouseDown(e, node.id)}
      onDoubleClick={(e) => onDoubleClick(e, node.id)}
    >
      {/* ── HEADER: name + Play ── */}
      <div className="flex items-center gap-1.5 px-2 py-1 border-b rounded-t-lg bg-blue-500/15 border-blue-500/40">
        <Sparkles className="w-3.5 h-3.5 shrink-0 text-blue-500" />
        <span className="text-[11px] font-medium truncate flex-1">{node.label || "Research"}</span>
        {onPlayNode && (
          <button
            className={cn(
              "flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded transition-colors",
              "bg-blue-500/25 text-blue-600 dark:text-blue-400",
              "hover:opacity-80",
              isRunning && "opacity-60 pointer-events-none",
            )}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onPlayNode(node.id); }}
            disabled={isRunning}
          >
            {isRunning ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />}
            {isRunning ? "Running" : "Play"}
          </button>
        )}
      </div>

      {/* ── ZONE 1: OBJECTIVE (top ~20%) ── */}
      <div className="px-2 py-1 border-b border-blue-500/20">
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-semibold uppercase tracking-wider text-blue-400/70">Objective</span>
          {objectiveEdges.length > 0 && (
            <span className="text-[7px] text-blue-400/50">{objectiveEdges.length} linked</span>
          )}
        </div>
      </div>

      {/* ── ZONE 2: CONTEXT (middle) ── */}
      <div className="px-2 py-1 border-b border-blue-500/20">
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-semibold uppercase tracking-wider text-amber-400/70">Context</span>
          {(contextEdges.length + plainEdges.length) > 0 && (
            <span className="text-[7px] text-amber-400/50">{contextEdges.length + plainEdges.length} sources</span>
          )}
        </div>
      </div>

      {/* ── ZONE 3: OUTPUT FORMAT ── */}
      <div className="px-2 py-1 border-b border-blue-500/20" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-semibold uppercase tracking-wider text-violet-400/70">Output Format</span>
          {outputFormatEdges.length > 0 && (
            <span className="text-[7px] text-violet-400/50">{outputFormatEdges.length} template</span>
          )}
          <div className="ml-auto flex items-center gap-0.5">
            <button
              className={cn(
                "text-[7px] px-1 py-0.5 rounded transition-colors",
                (oc.outputMode || "consolidated") === "consolidated"
                  ? "bg-violet-500/30 text-violet-300 font-semibold"
                  : "bg-muted/30 text-muted-foreground/50 hover:bg-muted/50",
              )}
              onClick={(e) => { e.stopPropagation(); updateConfig({ outputMode: "consolidated" }); }}
            >
              1 Doc
            </button>
            <button
              className={cn(
                "text-[7px] px-1 py-0.5 rounded transition-colors",
                oc.outputMode === "split"
                  ? "bg-violet-500/30 text-violet-300 font-semibold"
                  : "bg-muted/30 text-muted-foreground/50 hover:bg-muted/50",
              )}
              onClick={(e) => { e.stopPropagation(); updateConfig({ outputMode: "split" }); }}
            >
              N Docs
            </button>
          </div>
        </div>
      </div>

      {/* ── ZONE 4: CONFIG BODY (shows active settings) ── */}
      <div className="px-2 py-1.5 flex-1 overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 mb-1">
          <Settings2 className="w-2.5 h-2.5 text-muted-foreground/50" />
          <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground/50">Config</span>
        </div>

        {/* Focus mode chips */}
        <div className="flex flex-wrap gap-0.5 mb-1">
          {FOCUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={cn(
                "text-[7px] px-1 py-0.5 rounded transition-colors",
                oc.focusMode === opt.value
                  ? "bg-blue-500/30 text-blue-300 font-semibold"
                  : "bg-muted/30 text-muted-foreground/50 hover:bg-muted/50",
              )}
              onClick={(e) => { e.stopPropagation(); updateConfig({ focusMode: opt.value as typeof oc.focusMode }); }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Format + Detail row */}
        <div className="flex gap-1 mb-1">
          <div className="flex flex-wrap gap-0.5 flex-1">
            {FORMAT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={cn(
                  "text-[7px] px-1 py-0.5 rounded transition-colors",
                  oc.format === opt.value
                    ? "bg-violet-500/30 text-violet-300 font-semibold"
                    : "bg-muted/30 text-muted-foreground/50 hover:bg-muted/50",
                )}
                onClick={(e) => { e.stopPropagation(); updateConfig({ format: opt.value as typeof oc.format }); }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Detail level chips */}
        <div className="flex flex-wrap gap-0.5 mb-1">
          {DETAIL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={cn(
                "text-[7px] px-1 py-0.5 rounded transition-colors",
                oc.detail === opt.value
                  ? "bg-emerald-500/30 text-emerald-300 font-semibold"
                  : "bg-muted/30 text-muted-foreground/50 hover:bg-muted/50",
              )}
              onClick={(e) => { e.stopPropagation(); updateConfig({ detail: opt.value as typeof oc.detail }); }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Output count */}
        <div className="flex items-center gap-1">
          <span className="text-[7px] text-muted-foreground/50">Count:</span>
          <input
            type="number"
            min={1}
            max={100}
            className="w-10 text-[8px] bg-muted/30 border border-border/30 rounded px-1 py-0.5 text-center focus:outline-none focus:border-blue-500/50"
            value={oc.outputCount || ""}
            placeholder="any"
            onChange={(e) => {
              const val = parseInt(e.target.value);
              updateConfig({ outputCount: isNaN(val) ? undefined : Math.max(1, Math.min(100, val)) });
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      {/* ── ZONE 4: OUTPUT preview (bottom) ── */}
      {node.snippet && (
        <div className="px-2 py-1 border-t border-blue-500/20 overflow-hidden">
          <p className="text-[9px] text-muted-foreground/60 line-clamp-2">
            {node.snippet}
          </p>
        </div>
      )}

      {/* Port dots */}
      <FlowPortDots
        node={node}
        isSelected={isSelected}
        onPortMouseDown={onPortMouseDown}
        accentColor="blue"
      />

      {/* Lock + Delete buttons on hover */}
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
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        )}
      </div>

      {/* Resize handles */}
      {lm === "none" && (
        <ResizeHandles
          isSelected={isSelected}
          onResizeMouseDown={handleResizeMouseDown}
        />
      )}
    </div>
  );
});
