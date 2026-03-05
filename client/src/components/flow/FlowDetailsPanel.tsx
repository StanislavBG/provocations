/**
 * FlowDetailsPanel — Slide-in panel showing node system properties,
 * I/O descriptions, and pre/post process hooks.
 */

import { useState, useEffect } from "react";
import { X, ArrowDownToLine, ArrowUpFromLine, Info, Cpu, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { FlowNode, FlowEdge } from "./useFlowCanvas";
import { getEffectiveLockMode } from "./useFlowCanvas";
import { FLOW_NODE_REGISTRY } from "./FlowNodeRegistry";

interface FlowDetailsPanelProps {
  node: FlowNode;
  nodes: FlowNode[];
  edges: FlowEdge[];
  onClose: () => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
}

export function FlowDetailsPanel({
  node,
  nodes,
  edges,
  onClose,
  onUpdateNode,
}: FlowDetailsPanelProps) {
  const def = FLOW_NODE_REGISTRY[node.type];
  const style = def.style;
  const Icon = def.icon;
  const lm = getEffectiveLockMode(node);

  const [preProcess, setPreProcess] = useState(node.preProcess || "");
  const [postProcess, setPostProcess] = useState(node.postProcess || "");

  // Sync when node changes
  useEffect(() => {
    setPreProcess(node.preProcess || "");
    setPostProcess(node.postProcess || "");
  }, [node.id, node.preProcess, node.postProcess]);

  // Connected edges
  const inEdges = edges.filter((e) => e.toNodeId === node.id);
  const outEdges = edges.filter((e) => e.fromNodeId === node.id);

  const commitPreProcess = () => {
    const val = preProcess.trim() || undefined;
    if (val !== (node.preProcess || undefined)) {
      onUpdateNode(node.id, { preProcess: val });
    }
  };

  const commitPostProcess = () => {
    const val = postProcess.trim() || undefined;
    if (val !== (node.postProcess || undefined)) {
      onUpdateNode(node.id, { postProcess: val });
    }
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 z-[42] bg-card border-l border-border shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className={cn("flex items-center gap-2 px-3 py-2 border-b shrink-0", style.headerBg, style.headerBorder)}>
        <Icon className={cn("w-4 h-4 shrink-0", style.iconClass)} />
        <h3 className="text-sm font-semibold truncate flex-1">{node.label}</h3>
        <span className={cn("text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded", style.badgeBg, style.badgeText)}>
          {style.badge}
        </span>
        <Button variant="ghost" size="icon" className="w-6 h-6" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto text-xs">
        {/* System Properties */}
        <Section title="System Properties" icon={<Cpu className="w-3 h-3" />}>
          <PropRow label="ID" value={node.id} />
          <PropRow label="Type" value={node.type} />
          <PropRow label="Position" value={`${Math.round(node.x)}, ${Math.round(node.y)}`} />
          <PropRow label="Size" value={`${Math.round(node.width)} × ${Math.round(node.height)}`} />
          <PropRow label="Lock" value={lm} />
          <PropRow label="Lifecycle" value={def.lifecyclePreset} />
          <PropRow label="Playable" value={def.playable ? "Yes" : "No"} />
          <PropRow label="Chain exec" value={def.supportsChainExecution ? "Yes" : "No"} />
          <PropRow label="Expand" value={def.expandMode} />
        </Section>

        {/* Input description */}
        <Section title="Input" icon={<ArrowDownToLine className="w-3 h-3" />}>
          <p className="text-muted-foreground/80 leading-relaxed mb-2">{def.inputDescription}</p>
          {inEdges.length > 0 ? (
            <div className="space-y-1">
              {inEdges.map((e) => {
                const src = nodes.find((n) => n.id === e.fromNodeId);
                return (
                  <div key={e.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/30">
                    <Link2 className="w-2.5 h-2.5 text-muted-foreground/50" />
                    <span className="truncate flex-1">{src?.label || "Unknown"}</span>
                    {e.role && (
                      <span className={cn(
                        "text-[7px] font-semibold uppercase px-1 py-0.5 rounded",
                        e.role === "objective" ? "bg-blue-500/20 text-blue-400" :
                        e.role === "output-format" ? "bg-violet-500/20 text-violet-400" :
                        "bg-amber-500/20 text-amber-400",
                      )}>
                        {e.role}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground/40 italic">No inputs connected</p>
          )}
        </Section>

        {/* Output description */}
        <Section title="Output" icon={<ArrowUpFromLine className="w-3 h-3" />}>
          <p className="text-muted-foreground/80 leading-relaxed mb-2">{def.outputDescription}</p>
          {outEdges.length > 0 ? (
            <div className="space-y-1">
              {outEdges.map((e) => {
                const tgt = nodes.find((n) => n.id === e.toNodeId);
                return (
                  <div key={e.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/30">
                    <Link2 className="w-2.5 h-2.5 text-muted-foreground/50" />
                    <span className="truncate">{tgt?.label || "Unknown"}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground/40 italic">No outputs connected</p>
          )}
        </Section>

        {/* Pre-Process Hook */}
        <Section title="Pre-Process Hook" icon={<ArrowDownToLine className="w-3 h-3 text-emerald-400" />}>
          <p className="text-muted-foreground/60 mb-1.5">
            Instruction to transform input before main execution.
          </p>
          <textarea
            className="w-full h-16 text-xs bg-muted/20 border border-border/50 rounded px-2 py-1.5 resize-none focus:outline-none focus:border-primary/50"
            placeholder="e.g. Clean up formatting, remove duplicates..."
            value={preProcess}
            onChange={(e) => setPreProcess(e.target.value)}
            onBlur={commitPreProcess}
          />
        </Section>

        {/* Post-Process Hook */}
        <Section title="Post-Process Hook" icon={<ArrowUpFromLine className="w-3 h-3 text-amber-400" />}>
          <p className="text-muted-foreground/60 mb-1.5">
            Instruction to transform output after main execution.
          </p>
          <textarea
            className="w-full h-16 text-xs bg-muted/20 border border-border/50 rounded px-2 py-1.5 resize-none focus:outline-none focus:border-primary/50"
            placeholder="e.g. Summarize to 3 paragraphs, add citations..."
            value={postProcess}
            onChange={(e) => setPostProcess(e.target.value)}
            onBlur={commitPostProcess}
          />
        </Section>

        {/* Output Config (if any) */}
        {node.outputConfig && (
          <Section title="Output Config" icon={<Info className="w-3 h-3" />}>
            <pre className="text-[10px] bg-muted/20 rounded p-2 overflow-x-auto whitespace-pre-wrap text-muted-foreground/70">
              {JSON.stringify(node.outputConfig, null, 2)}
            </pre>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5 border-b border-border/30">
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{title}</span>
      </div>
      {children}
    </div>
  );
}

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-muted-foreground/50">{label}</span>
      <span className="text-foreground/80 font-mono text-[10px]">{value}</span>
    </div>
  );
}
