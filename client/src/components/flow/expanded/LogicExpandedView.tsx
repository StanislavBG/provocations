/**
 * LogicExpandedView — Shared expanded view for logic nodes
 * (filter, gate, router, merge).
 *
 * Each logic type gets a tailored config panel with its specific controls.
 */

import { useCallback, useMemo } from "react";
import { Filter, ToggleRight, GitBranch, Merge, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FlowNode, FlowEdge } from "../useFlowCanvas";
import { ExpandedViewLayout } from "./ExpandedViewLayout";

interface LogicExpandedViewProps {
  node: FlowNode;
  nodes: FlowNode[];
  edges: FlowEdge[];
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
}

export function LogicExpandedView({ node, nodes, edges, onUpdateNode }: LogicExpandedViewProps) {
  // Gather connected inputs/outputs
  const inputNodes = useMemo(() => {
    const inputEdges = edges.filter((e) => e.toNodeId === node.id);
    return inputEdges
      .map((e) => nodes.find((n) => n.id === e.fromNodeId))
      .filter(Boolean) as FlowNode[];
  }, [node.id, nodes, edges]);

  const outputNodes = useMemo(() => {
    const outputEdges = edges.filter((e) => e.fromNodeId === node.id);
    return outputEdges
      .map((e) => nodes.find((n) => n.id === e.toNodeId))
      .filter(Boolean) as FlowNode[];
  }, [node.id, nodes, edges]);

  return (
    <ExpandedViewLayout
      defaultLeftSize={35}
      left={
        <div className="flex flex-col h-full">
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Node label */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Label</p>
              <input
                type="text"
                value={node.label || ""}
                onChange={(e) => onUpdateNode(node.id, { label: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {/* Type-specific config */}
            {node.type === "filter" && (
              <FilterConfig node={node} onUpdateNode={onUpdateNode} />
            )}
            {node.type === "gate" && (
              <GateConfig node={node} onUpdateNode={onUpdateNode} />
            )}
            {node.type === "router" && (
              <RouterConfig node={node} onUpdateNode={onUpdateNode} />
            )}
            {node.type === "merge" && (
              <MergeConfig node={node} onUpdateNode={onUpdateNode} />
            )}

            {/* Connected nodes info */}
            <div className="space-y-1.5 border-t pt-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Connections</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">{inputNodes.length} inputs</Badge>
                <span>→</span>
                <Badge variant="outline" className="text-[10px]">{outputNodes.length} outputs</Badge>
              </div>
            </div>
          </div>
        </ScrollArea>
        </div>
      }
      right={
        <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-2 border-b bg-muted/20">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data Flow</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="flex items-center gap-6">
            {/* Inputs */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center mb-2">Inputs</p>
              {inputNodes.length > 0 ? inputNodes.map((n) => (
                <div key={n.id} className="px-3 py-2 rounded-md border bg-card text-xs max-w-[180px]">
                  <p className="font-medium truncate">{n.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{n.snippet || "No content"}</p>
                </div>
              )) : (
                <p className="text-xs text-muted-foreground/50 italic">None</p>
              )}
            </div>

            {/* Node icon */}
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-lg border-2 flex items-center justify-center bg-card">
                {node.type === "filter" && <Filter className="w-5 h-5 text-amber-500" />}
                {node.type === "gate" && <ToggleRight className="w-5 h-5 text-emerald-500" />}
                {node.type === "router" && <GitBranch className="w-5 h-5 text-blue-500" />}
                {node.type === "merge" && <Merge className="w-5 h-5 text-violet-500" />}
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">{node.label}</span>
            </div>

            {/* Outputs */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center mb-2">Outputs</p>
              {outputNodes.length > 0 ? outputNodes.map((n) => (
                <div key={n.id} className="px-3 py-2 rounded-md border bg-card text-xs max-w-[180px]">
                  <p className="font-medium truncate">{n.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{n.snippet || "No content"}</p>
                </div>
              )) : (
                <p className="text-xs text-muted-foreground/50 italic">None</p>
              )}
            </div>
          </div>
        </div>
        </div>
      }
    />
  );
}

// ── Type-specific config sub-components ──

function FilterConfig({ node, onUpdateNode }: { node: FlowNode; onUpdateNode: (id: string, patch: Partial<FlowNode>) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Filter Rule</p>
      <textarea
        value={node.logicRule || ""}
        onChange={(e) => onUpdateNode(node.id, { logicRule: e.target.value })}
        placeholder="e.g. content.includes('important') or content.length > 100"
        className="w-full bg-muted/30 border rounded-lg text-xs font-mono text-foreground placeholder:text-muted-foreground/50 resize-none outline-none px-3 py-2 min-h-[80px] leading-relaxed focus:ring-1 focus:ring-amber-500/50"
        rows={3}
      />
      <p className="text-[10px] text-muted-foreground/60">
        Content matching this rule passes through; non-matching content is filtered out.
      </p>
    </div>
  );
}

function GateConfig({ node, onUpdateNode }: { node: FlowNode; onUpdateNode: (id: string, patch: Partial<FlowNode>) => void }) {
  const isOpen = node.gateOpen ?? true;
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Gate State</p>
      <button
        onClick={() => onUpdateNode(node.id, { gateOpen: !isOpen })}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-colors ${
          isOpen
            ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
            : "border-red-500 bg-red-500/10 text-red-600"
        }`}
      >
        <span className="text-sm font-semibold">{isOpen ? "OPEN" : "CLOSED"}</span>
        <ToggleRight className={`w-6 h-6 ${isOpen ? "" : "rotate-180"}`} />
      </button>
      <p className="text-[10px] text-muted-foreground/60">
        {isOpen ? "Data passes through to downstream nodes." : "Data is blocked until the gate is opened."}
      </p>
    </div>
  );
}

function RouterConfig({ node, onUpdateNode }: { node: FlowNode; onUpdateNode: (id: string, patch: Partial<FlowNode>) => void }) {
  const outputs = node.routerOutputs || ["Output A", "Output B"];

  const addOutput = useCallback(() => {
    onUpdateNode(node.id, { routerOutputs: [...outputs, `Output ${String.fromCharCode(65 + outputs.length)}`] });
  }, [node.id, outputs, onUpdateNode]);

  const removeOutput = useCallback((index: number) => {
    if (outputs.length <= 2) return;
    onUpdateNode(node.id, { routerOutputs: outputs.filter((_, i) => i !== index) });
  }, [node.id, outputs, onUpdateNode]);

  const updateOutput = useCallback((index: number, value: string) => {
    const updated = [...outputs];
    updated[index] = value;
    onUpdateNode(node.id, { routerOutputs: updated });
  }, [node.id, outputs, onUpdateNode]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Route Outputs</p>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={addOutput}>
          <Plus className="w-3 h-3" />
        </Button>
      </div>
      {outputs.map((output, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[9px] w-5 h-5 flex items-center justify-center p-0 shrink-0">
            {String.fromCharCode(65 + i)}
          </Badge>
          <input
            type="text"
            value={output}
            onChange={(e) => updateOutput(i, e.target.value)}
            className="flex-1 px-2 py-1 text-xs bg-muted/30 border rounded outline-none focus:ring-1 focus:ring-blue-500/50"
          />
          {outputs.length > 2 && (
            <button onClick={() => removeOutput(i)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
      <div className="space-y-1.5 pt-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Route Rule</p>
        <textarea
          value={node.logicRule || ""}
          onChange={(e) => onUpdateNode(node.id, { logicRule: e.target.value })}
          placeholder="Describe how to route content to different outputs..."
          className="w-full bg-muted/30 border rounded-lg text-xs text-foreground placeholder:text-muted-foreground/50 resize-none outline-none px-3 py-2 min-h-[60px] leading-relaxed focus:ring-1 focus:ring-blue-500/50"
          rows={2}
        />
      </div>
    </div>
  );
}

function MergeConfig({ node, onUpdateNode }: { node: FlowNode; onUpdateNode: (id: string, patch: Partial<FlowNode>) => void }) {
  const rule = node.logicRule || "concat";
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Merge Strategy</p>
      <div className="space-y-1">
        {[
          { id: "concat", label: "Concatenate", desc: "Join all inputs in order" },
          { id: "interleave", label: "Interleave", desc: "Alternate between inputs" },
          { id: "latest", label: "Latest Only", desc: "Use the most recently updated input" },
        ].map((strategy) => (
          <button
            key={strategy.id}
            onClick={() => onUpdateNode(node.id, { logicRule: strategy.id })}
            className={`w-full text-left px-3 py-2 rounded-md border text-xs transition-colors ${
              rule === strategy.id
                ? "border-violet-500 bg-violet-500/10 text-violet-600"
                : "border-border/50 text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <span className="font-medium">{strategy.label}</span>
            <p className="text-[10px] opacity-70 mt-0.5">{strategy.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
