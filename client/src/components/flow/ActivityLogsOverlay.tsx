/**
 * ActivityLogsOverlay — Full-screen overlay for browsing lifecycle activity logs.
 *
 * Two view modes:
 *   Flat   — Original table view with all entries in chronological order
 *   Grouped — Entries grouped by node, collapsible, with click-to-navigate
 */

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  useLifecycleLog,
  matchesFilter,
  getPhaseLabel,
  formatLifecycleLog,
  type LifecycleLogEntry,
  type LifecycleFilter,
  type LifecyclePhase,
  type LifecycleStatus,
} from "@/lib/lifecycleLog";
import { FLOW_NODE_REGISTRY } from "./FlowNodeRegistry";
import type { FlowNodeType } from "./useFlowCanvas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X,
  Trash2,
  Copy,
  Search,
  Activity,
  Pause,
  Play,
  ArrowDown,
  Download,
  ChevronRight,
  ChevronDown,
  Crosshair,
  List,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const PHASE_COLORS: Record<LifecyclePhase, string> = {
  "pre-process": "bg-blue-500/20 text-blue-500 border-blue-500/30",
  process: "bg-violet-500/20 text-violet-500 border-violet-500/30",
  "post-process": "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  activate: "bg-green-500/20 text-green-500 border-green-500/30",
  deactivate: "bg-red-500/20 text-red-500 border-red-500/30",
  tick: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  chain: "bg-cyan-500/20 text-cyan-500 border-cyan-500/30",
};

const STATUS_COLORS: Record<LifecycleStatus, string> = {
  start: "text-blue-400",
  success: "text-emerald-400",
  error: "text-red-400",
  skipped: "text-muted-foreground/60",
};

const ALL_PHASES: LifecyclePhase[] = [
  "pre-process",
  "process",
  "post-process",
  "activate",
  "deactivate",
  "tick",
  "chain",
];
const ALL_STATUSES: LifecycleStatus[] = ["start", "success", "error", "skipped"];

type ViewMode = "flat" | "grouped";

interface ActivityLogsOverlayProps {
  onClose: () => void;
  /** Navigate the canvas to center on a specific node */
  onNavigateToNode?: (nodeId: string) => void;
}

interface NodeGroup {
  nodeId: string;
  nodeLabel: string;
  nodeType: FlowNodeType;
  entries: LifecycleLogEntry[];
  errorCount: number;
  totalDurationMs: number;
  avgDurationMs: number;
}

export function ActivityLogsOverlay({ onClose, onNavigateToNode }: ActivityLogsOverlayProps) {
  const { entries, clear, getNodeTypes, getNodeIds } = useLifecycleLog();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const [pausedSnapshot, setPausedSnapshot] = useState<LifecycleLogEntry[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Filters
  const [filter, setFilter] = useState<LifecycleFilter>({});
  const [keyword, setKeyword] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [initiatorFilter, setInitiatorFilter] = useState<"all" | "user" | "system">("all");

  const displayEntries = paused ? pausedSnapshot : entries;

  const filtered = useMemo(() => {
    let result = displayEntries;

    const hasFilter = filter.nodeId || filter.nodeType || filter.phase || filter.status;
    if (hasFilter) {
      result = result.filter((e) => matchesFilter(e, filter));
    }

    if (keyword.trim()) {
      const kw = keyword.toLowerCase();
      result = result.filter(
        (e) =>
          e.message.toLowerCase().includes(kw) ||
          e.nodeLabel.toLowerCase().includes(kw) ||
          e.nodeType.toLowerCase().includes(kw) ||
          (e.error && e.error.toLowerCase().includes(kw))
      );
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      result = result.filter((e) => e.timestamp >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000;
      result = result.filter((e) => e.timestamp < to);
    }

    if (initiatorFilter === "user") {
      result = result.filter((e) => e.phase === "process" || e.phase === "pre-process" || e.phase === "post-process");
    } else if (initiatorFilter === "system") {
      result = result.filter((e) => e.phase === "chain" || e.phase === "tick" || e.phase === "activate" || e.phase === "deactivate");
    }

    return result;
  }, [displayEntries, filter, keyword, dateFrom, dateTo, initiatorFilter]);

  // Grouped view data
  const nodeGroups = useMemo((): NodeGroup[] => {
    const map = new Map<string, NodeGroup>();
    for (const entry of filtered) {
      let group = map.get(entry.nodeId);
      if (!group) {
        group = {
          nodeId: entry.nodeId,
          nodeLabel: entry.nodeLabel,
          nodeType: entry.nodeType as FlowNodeType,
          entries: [],
          errorCount: 0,
          totalDurationMs: 0,
          avgDurationMs: 0,
        };
        map.set(entry.nodeId, group);
      }
      group.entries.push(entry);
      if (entry.status === "error") group.errorCount++;
      if (entry.durationMs !== undefined) group.totalDurationMs += entry.durationMs;
    }
    // Compute averages
    for (const group of Array.from(map.values())) {
      const withDuration = group.entries.filter((e: LifecycleLogEntry) => e.durationMs !== undefined);
      group.avgDurationMs = withDuration.length > 0 ? Math.round(group.totalDurationMs / withDuration.length) : 0;
    }
    return Array.from(map.values());
  }, [filtered]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && !paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered.length, autoScroll, paused]);

  const handlePauseToggle = useCallback(() => {
    if (paused) {
      setPaused(false);
    } else {
      setPausedSnapshot(entries);
      setPaused(true);
    }
  }, [paused, entries]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(formatLifecycleLog(filtered));
    toast({ title: "Copied", description: `${filtered.length} entries copied to clipboard` });
  }, [filtered, toast]);

  const handleExport = useCallback(() => {
    const text = formatLifecycleLog(filtered);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const handleClear = useCallback(() => {
    clear();
    setPausedSnapshot([]);
  }, [clear]);

  const toggleNodeExpanded = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedNodes(new Set(nodeGroups.map((g) => g.nodeId)));
  }, [nodeGroups]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  const handleNavigate = useCallback((nodeId: string) => {
    onNavigateToNode?.(nodeId);
  }, [onNavigateToNode]);

  const nodeTypes = useMemo(() => getNodeTypes(), [displayEntries.length]);
  const nodeIds = useMemo(() => getNodeIds(), [displayEntries.length]);

  const clearAllFilters = () => {
    setFilter({});
    setKeyword("");
    setDateFrom("");
    setDateTo("");
    setInitiatorFilter("all");
  };

  const activeFilterCount =
    [filter.nodeId, filter.nodeType, filter.phase, filter.status].filter(Boolean).length +
    (keyword.trim() ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (initiatorFilter !== "all" ? 1 : 0);

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b bg-muted/30 shrink-0">
        <Activity className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-serif font-semibold flex-1">Activity Logs</h2>

        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
          {filtered.length}
          {filtered.length !== displayEntries.length ? `/${displayEntries.length}` : ""} events
        </Badge>

        {/* View mode toggle */}
        <div className="flex gap-0.5 bg-muted/40 rounded p-0.5">
          <button
            className={cn("px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
              viewMode === "grouped" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            onClick={() => setViewMode("grouped")}
            title="Group by node"
          >
            <Layers className="w-3 h-3" />
          </button>
          <button
            className={cn("px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
              viewMode === "flat" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            onClick={() => setViewMode("flat")}
            title="Flat list"
          >
            <List className="w-3 h-3" />
          </button>
        </div>

        {/* Toolbar */}
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 px-2 gap-1 text-xs", paused && "bg-amber-500/10 text-amber-500")}
          onClick={handlePauseToggle}
        >
          {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          {paused ? "Resume" : "Pause"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 px-2 text-xs", autoScroll && "text-primary")}
          onClick={() => setAutoScroll(!autoScroll)}
          title="Auto-scroll"
        >
          <ArrowDown className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopy} title="Copy">
          <Copy className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleExport} title="Export">
          <Download className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={handleClear} title="Clear all">
          <Trash2 className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Body: filters left, content right */}
      <div className="flex flex-1 min-h-0">
        {/* Left filter panel */}
        <div className="w-56 sm:w-64 shrink-0 border-r bg-muted/10 p-3 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Filters</span>
            {activeFilterCount > 0 && (
              <button className="text-[10px] text-primary hover:underline" onClick={clearAllFilters}>
                Clear all
              </button>
            )}
          </div>

          {/* Keyword search */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Keyword</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
              <Input
                className="h-7 text-xs pl-7"
                placeholder="Search messages..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
          </div>

          {/* Initiator */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Initiator</Label>
            <div className="flex gap-1">
              {(["all", "user", "system"] as const).map((v) => (
                <button
                  key={v}
                  className={cn(
                    "flex-1 text-[10px] py-1 rounded border transition-colors capitalize",
                    initiatorFilter === v
                      ? "bg-primary/15 border-primary/40 text-primary font-medium"
                      : "border-border/40 text-muted-foreground hover:bg-muted/50"
                  )}
                  onClick={() => setInitiatorFilter(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <FilterSelect
            label="Node Type"
            value={filter.nodeType || ""}
            options={nodeTypes.map((t) => ({
              value: t,
              label: FLOW_NODE_REGISTRY[t]?.style.badge || t,
            }))}
            onChange={(v) => setFilter((f) => ({ ...f, nodeType: (v || undefined) as FlowNodeType | undefined }))}
          />

          <FilterSelect
            label="Node"
            value={filter.nodeId || ""}
            options={nodeIds.map((n) => ({
              value: n.id,
              label: `${n.label} (${n.type})`,
            }))}
            onChange={(v) => setFilter((f) => ({ ...f, nodeId: v || undefined }))}
          />

          <FilterSelect
            label="Phase"
            value={filter.phase || ""}
            options={ALL_PHASES.map((p) => ({ value: p, label: getPhaseLabel(p) }))}
            onChange={(v) => setFilter((f) => ({ ...f, phase: (v || undefined) as LifecyclePhase | undefined }))}
          />

          <FilterSelect
            label="Status"
            value={filter.status || ""}
            options={ALL_STATUSES.map((s) => ({ value: s, label: s }))}
            onChange={(v) => setFilter((f) => ({ ...f, status: (v || undefined) as LifecycleStatus | undefined }))}
          />

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Date From</Label>
            <Input type="date" className="h-7 text-xs" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Date To</Label>
            <Input type="date" className="h-7 text-xs" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          {/* Grouped view controls */}
          {viewMode === "grouped" && nodeGroups.length > 0 && (
            <div className="flex gap-1 pt-2 border-t">
              <button className="text-[10px] text-primary hover:underline" onClick={expandAll}>Expand all</button>
              <span className="text-[10px] text-muted-foreground/40">|</span>
              <button className="text-[10px] text-primary hover:underline" onClick={collapseAll}>Collapse all</button>
            </div>
          )}
        </div>

        {/* Right: content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {viewMode === "flat" ? (
            <>
              {/* Flat table header */}
              <div className="flex items-center gap-2 px-4 py-1.5 border-b bg-muted/20 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                <span className="w-20">Time</span>
                <span className="w-20">Phase</span>
                <span className="w-14">Status</span>
                <span className="w-16">Initiator</span>
                <span className="w-32">Node</span>
                <span className="flex-1">Message</span>
                <span className="w-16 text-right">Duration</span>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-auto min-h-0">
                {filtered.length === 0 ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground/50 text-xs">
                    {entries.length === 0 ? "No lifecycle events yet" : "No events match filters"}
                  </div>
                ) : (
                  <div className="divide-y divide-border/20">
                    {filtered.map((entry) => (
                      <LogTableRow key={entry.id} entry={entry} onNavigate={handleNavigate} />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Grouped view */
            <div ref={scrollRef} className="flex-1 overflow-auto min-h-0">
              {nodeGroups.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground/50 text-xs">
                  {entries.length === 0 ? "No lifecycle events yet" : "No events match filters"}
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {nodeGroups.map((group) => (
                    <NodeGroupRow
                      key={group.nodeId}
                      group={group}
                      expanded={expandedNodes.has(group.nodeId)}
                      onToggle={() => toggleNodeExpanded(group.nodeId)}
                      onNavigate={() => handleNavigate(group.nodeId)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Paused indicator */}
          {paused && (
            <div className="flex items-center justify-center py-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-wider border-t">
              Feed Paused
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Node Group Row (grouped view) ──

function NodeGroupRow({
  group,
  expanded,
  onToggle,
  onNavigate,
}: {
  group: NodeGroup;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const nodeStyle = FLOW_NODE_REGISTRY[group.nodeType]?.style;
  const Icon = FLOW_NODE_REGISTRY[group.nodeType]?.icon;

  // Group entries by phase for expanded view
  const phaseGroups = useMemo(() => {
    const map = new Map<LifecyclePhase, LifecycleLogEntry[]>();
    for (const entry of group.entries) {
      let arr = map.get(entry.phase);
      if (!arr) { arr = []; map.set(entry.phase, arr); }
      arr.push(entry);
    }
    return map;
  }, [group.entries]);

  return (
    <div>
      {/* Group header */}
      <button
        className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted/20 transition-colors text-left"
        onClick={onToggle}
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}

        {Icon && <Icon className={cn("w-4 h-4 shrink-0", nodeStyle?.iconClass)} />}

        <span className={cn("text-xs font-medium truncate", nodeStyle?.iconClass || "text-foreground")}>
          {group.nodeLabel}
        </span>

        <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-3.5 shrink-0", nodeStyle?.badgeBg, nodeStyle?.badgeText)}>
          {nodeStyle?.badge || group.nodeType}
        </Badge>

        <span className="flex-1" />

        {/* Stats */}
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          {group.entries.length} events
        </span>
        {group.errorCount > 0 && (
          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 text-red-500 border-red-500/30 shrink-0">
            {group.errorCount} errors
          </Badge>
        )}
        {group.avgDurationMs > 0 && (
          <span className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0">
            avg {group.avgDurationMs}ms
          </span>
        )}

        {/* Navigate to node button */}
        <button
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground/50 hover:text-primary transition-colors shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate();
          }}
          title="Locate on canvas"
        >
          <Crosshair className="w-3.5 h-3.5" />
        </button>
      </button>

      {/* Expanded entries grouped by phase */}
      {expanded && (
        <div className="bg-muted/5 border-t border-border/20">
          {ALL_PHASES.map((phase) => {
            const phaseEntries = phaseGroups.get(phase);
            if (!phaseEntries || phaseEntries.length === 0) return null;
            return (
              <div key={phase}>
                <div className="flex items-center gap-2 px-8 py-1 bg-muted/10">
                  <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-3.5 font-semibold", PHASE_COLORS[phase])}>
                    {getPhaseLabel(phase)}
                  </Badge>
                  <span className="text-[9px] text-muted-foreground/50">{phaseEntries.length}</span>
                </div>
                {phaseEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 px-10 py-1 text-[10px] hover:bg-muted/10 font-mono">
                    <span className="text-muted-foreground/50 shrink-0 w-16 tabular-nums">
                      {new Date(entry.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                    <span className={cn("shrink-0 font-semibold uppercase text-[8px] w-12", STATUS_COLORS[entry.status])}>
                      {entry.status}
                    </span>
                    <span className="text-muted-foreground flex-1 min-w-0 truncate">
                      {entry.message}
                      {entry.error && <span className="text-red-400 ml-1">{entry.error}</span>}
                    </span>
                    <span className="text-muted-foreground/40 shrink-0 w-14 text-right tabular-nums">
                      {entry.durationMs !== undefined ? `${entry.durationMs}ms` : ""}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Flat view row ──

function LogTableRow({ entry, onNavigate }: { entry: LifecycleLogEntry; onNavigate: (nodeId: string) => void }) {
  const time = new Date(entry.timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = new Date(entry.timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  const nodeStyle = FLOW_NODE_REGISTRY[entry.nodeType]?.style;
  const Icon = FLOW_NODE_REGISTRY[entry.nodeType]?.icon;

  const isSystemPhase =
    entry.phase === "chain" || entry.phase === "tick" || entry.phase === "activate" || entry.phase === "deactivate";

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-[10px] hover:bg-muted/20 transition-colors font-mono">
      <span className="text-muted-foreground/50 shrink-0 w-20 tabular-nums">
        {date} {time}
      </span>

      <span className="w-20 shrink-0">
        <Badge
          variant="outline"
          className={cn("text-[8px] px-1 py-0 h-3.5 font-semibold", PHASE_COLORS[entry.phase])}
        >
          {getPhaseLabel(entry.phase)}
        </Badge>
      </span>

      <span className={cn("shrink-0 font-semibold uppercase text-[8px] w-14", STATUS_COLORS[entry.status])}>
        {entry.status}
      </span>

      <span className="w-16 shrink-0 text-[9px]">
        <Badge
          variant="outline"
          className={cn(
            "text-[8px] px-1 py-0 h-3.5",
            isSystemPhase
              ? "bg-muted/30 text-muted-foreground border-border/50"
              : "bg-primary/10 text-primary border-primary/30"
          )}
        >
          {isSystemPhase ? "System" : "User"}
        </Badge>
      </span>

      <button
        className="flex items-center gap-1 shrink-0 w-32 min-w-0 hover:underline"
        onClick={() => onNavigate(entry.nodeId)}
        title="Locate on canvas"
      >
        {Icon && <Icon className={cn("w-3 h-3 shrink-0", nodeStyle?.iconClass)} />}
        <span className={cn("font-medium truncate", nodeStyle?.iconClass || "text-foreground")}>
          {entry.nodeLabel}
        </span>
      </button>

      <span className="text-muted-foreground flex-1 min-w-0 truncate">
        {entry.message}
        {entry.error && <span className="text-red-400 ml-1">{entry.error}</span>}
        {entry.downstreamIds && entry.downstreamIds.length > 0 && (
          <span className="text-cyan-500/70 ml-1">-&gt;{entry.downstreamIds.length}</span>
        )}
      </span>

      <span className="text-muted-foreground/40 shrink-0 w-16 text-right tabular-nums">
        {entry.durationMs !== undefined ? `${entry.durationMs}ms` : ""}
      </span>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <select
        className="w-full text-xs bg-background border rounded px-2 py-1 text-foreground h-7"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
