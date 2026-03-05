/**
 * FlowDetailsPanel — Slide-in panel showing node system properties,
 * I/O descriptions, and pre/post process hooks.
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { X, ArrowDownToLine, ArrowUpFromLine, Info, Cpu, Link2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FlowNode, FlowEdge } from "./useFlowCanvas";
import { getEffectiveLockMode } from "./useFlowCanvas";
import { FLOW_NODE_REGISTRY } from "./FlowNodeRegistry";
import {
  useLifecycleLog,
  getPhaseLabel,
  type LifecycleLogEntry,
  type LifecyclePhase,
  type LifecycleStatus,
} from "@/lib/lifecycleLog";

interface FlowDetailsPanelProps {
  node: FlowNode;
  nodes: FlowNode[];
  edges: FlowEdge[];
  onClose: () => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
}

type DetailsTab = "properties" | "logs";

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
  const [activeTab, setActiveTab] = useState<DetailsTab>("properties");

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

  // Node-specific lifecycle logs
  const { entries } = useLifecycleLog();
  const nodeLogs = useMemo(
    () => entries.filter((e) => e.nodeId === node.id),
    [entries, node.id],
  );

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

      {/* Tab bar */}
      <div className="flex border-b shrink-0">
        <button
          className={cn(
            "flex-1 text-[10px] font-semibold uppercase tracking-wider py-1.5 transition-colors border-b-2",
            activeTab === "properties"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setActiveTab("properties")}
        >
          Properties
        </button>
        <button
          className={cn(
            "flex-1 text-[10px] font-semibold uppercase tracking-wider py-1.5 transition-colors border-b-2 flex items-center justify-center gap-1",
            activeTab === "logs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setActiveTab("logs")}
        >
          Logs
          {nodeLogs.length > 0 && (
            <Badge variant="outline" className="text-[8px] h-3.5 px-1 py-0">
              {nodeLogs.length}
            </Badge>
          )}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "properties" ? (
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
      ) : (
        <NodeLogsTab logs={nodeLogs} nodeLabel={node.label} />
      )}
    </div>
  );
}

// ── Node Logs Tab ──

const NODE_LOG_PHASE_COLORS: Record<LifecyclePhase, string> = {
  "pre-process": "bg-blue-500/20 text-blue-500 border-blue-500/30",
  process: "bg-violet-500/20 text-violet-500 border-violet-500/30",
  "post-process": "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  activate: "bg-green-500/20 text-green-500 border-green-500/30",
  deactivate: "bg-red-500/20 text-red-500 border-red-500/30",
  tick: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  chain: "bg-cyan-500/20 text-cyan-500 border-cyan-500/30",
};

const NODE_LOG_STATUS_COLORS: Record<LifecycleStatus, string> = {
  start: "text-blue-400",
  success: "text-emerald-400",
  error: "text-red-400",
  skipped: "text-muted-foreground/60",
};

function NodeLogsTab({ logs, nodeLabel }: { logs: LifecycleLogEntry[]; nodeLabel: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  if (logs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground/50 text-xs p-4">
        No lifecycle events for this node yet
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto text-xs">
      <div className="px-3 py-2 border-b border-border/30 bg-muted/10">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-muted-foreground/50" />
          <span className="text-[10px] text-muted-foreground">
            {logs.length} event{logs.length !== 1 ? "s" : ""} for <span className="font-medium text-foreground">{nodeLabel}</span>
          </span>
        </div>
      </div>
      <div className="divide-y divide-border/20">
        {logs.map((entry) => {
          const time = new Date(entry.timestamp).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          return (
            <div key={entry.id} className="px-3 py-1.5 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground/50 tabular-nums font-mono text-[10px] w-14 shrink-0">{time}</span>
                <Badge
                  variant="outline"
                  className={cn("text-[8px] px-1 py-0 h-3.5 shrink-0 font-semibold", NODE_LOG_PHASE_COLORS[entry.phase])}
                >
                  {getPhaseLabel(entry.phase)}
                </Badge>
                <span className={cn("text-[8px] font-semibold uppercase shrink-0", NODE_LOG_STATUS_COLORS[entry.status])}>
                  {entry.status}
                </span>
                {entry.durationMs !== undefined && (
                  <span className="text-muted-foreground/40 text-[9px] tabular-nums font-mono ml-auto shrink-0">
                    {entry.durationMs}ms
                  </span>
                )}
              </div>
              {entry.message && (
                <p className="text-muted-foreground/70 text-[10px] mt-0.5 pl-[60px]">{entry.message}</p>
              )}
              {entry.error && (
                <p className="text-red-400/80 text-[10px] mt-0.5 pl-[60px]">{entry.error}</p>
              )}
            </div>
          );
        })}
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
