import { useState, useCallback, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { EvolveContextPreview } from "./EvolveContextPreview";
import {
  Wand2,
  Loader2,
  SlidersHorizontal,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  ArrowUpDown,
  Lightbulb,
  Palette,
  CheckCircle2,
  RotateCcw,
  FileText,
  Pin,
  Target,
  Settings2,
  Info,
  type LucideIcon,
} from "lucide-react";
import type { ContextItem, EditHistoryEntry } from "@shared/schema";

// ── Types ────────────────────────────────────────────────────────────────

interface SmartOption {
  id: string;
  label: string;
  description: string;
}

interface SmartButtonDef {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  activeBg: string;
  options: SmartOption[];
}

/** A selected writer configuration passed to the evolve handler */
export interface WriterConfig {
  category: string;
  option: string;
  categoryLabel: string;
  optionLabel: string;
}

// ── Configuration tree ───────────────────────────────────────────────────

const SMART_BUTTONS: SmartButtonDef[] = [
  {
    id: "expand",
    label: "Expand",
    icon: Maximize2,
    color: "text-primary/70",
    activeBg: "bg-primary/10 border-primary/30 text-primary dark:text-primary",
    options: [
      { id: "add-examples", label: "Add examples", description: "Concrete illustrations and use cases" },
      { id: "add-detail", label: "Add detail", description: "Deeper explanations and supporting info" },
      { id: "add-data", label: "Supporting data", description: "Statistics, evidence, and references" },
    ],
  },
  {
    id: "condense",
    label: "Condense",
    icon: Minimize2,
    color: "text-primary/70",
    activeBg: "bg-primary/10 border-primary/30 text-primary dark:text-primary",
    options: [
      { id: "tighten", label: "Tighten prose", description: "Remove filler words and weak phrasing" },
      { id: "dedup", label: "Remove redundancy", description: "Eliminate repeated ideas and content" },
      { id: "exec-summary", label: "Executive summary", description: "Create a concise overview" },
    ],
  },
  {
    id: "restructure",
    label: "Restructure",
    icon: ArrowUpDown,
    color: "text-primary/70",
    activeBg: "bg-primary/10 border-primary/30 text-primary dark:text-primary",
    options: [
      { id: "reorder", label: "Reorder sections", description: "Improve logical flow and progression" },
      { id: "headings", label: "Add headings", description: "Create section hierarchy and navigation" },
      { id: "outline", label: "Outline view", description: "Convert to structured outline format" },
    ],
  },
  {
    id: "clarify",
    label: "Clarify",
    icon: Lightbulb,
    color: "text-primary/70",
    activeBg: "bg-primary/10 border-primary/30 text-primary dark:text-primary",
    options: [
      { id: "simplify", label: "Simplify language", description: "Make complex ideas accessible" },
      { id: "define", label: "Define terms", description: "Add definitions for jargon and acronyms" },
      { id: "context", label: "Add context", description: "Background info for new readers" },
    ],
  },
  {
    id: "style",
    label: "Style",
    icon: Palette,
    color: "text-primary/70",
    activeBg: "bg-primary/10 border-primary/30 text-primary dark:text-primary",
    options: [
      { id: "professional", label: "Professional", description: "Formal business tone" },
      { id: "casual", label: "Casual", description: "Conversational and friendly" },
      { id: "academic", label: "Academic", description: "Scholarly and precise" },
    ],
  },
];

// ── View mode type ──────────────────────────────────────────────────────

type ViewMode = "sliders" | "cards" | "accordion";

// ── Component props ─────────────────────────────────────────────────────

interface WriterPanelProps {
  documentText: string;
  objective: string;
  onEvolve: (configurations: WriterConfig[]) => void;
  isEvolving: boolean;
  capturedContext?: ContextItem[];
  pinnedDocContents?: Record<number, { title: string; content: string }>;
  sessionNotes?: string;
  editHistory?: EditHistoryEntry[];
  appType?: string;
}

export function WriterPanel({
  documentText,
  objective,
  onEvolve,
  isEvolving,
  capturedContext = [],
  pinnedDocContents = {},
  sessionNotes = "",
  editHistory = [],
  appType,
}: WriterPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("sliders");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["expand"]));

  // Multi-select: Map of categoryId → Set of selected optionIds
  const [selectedConfigs, setSelectedConfigs] = useState<Map<string, Set<string>>>(new Map());

  const pinnedDocs = useMemo(() => Object.values(pinnedDocContents), [pinnedDocContents]);

  const totalSelected = Array.from(selectedConfigs.values()).reduce(
    (sum, s) => sum + s.size,
    0,
  );

  const toggleOption = useCallback((catId: string, optId: string) => {
    setSelectedConfigs((prev) => {
      const next = new Map(prev);
      const catSet = new Set(next.get(catId) || []);
      if (catSet.has(optId)) catSet.delete(optId);
      else catSet.add(optId);
      if (catSet.size === 0) next.delete(catId);
      else next.set(catId, catSet);
      return next;
    });
  }, []);

  const toggleSection = useCallback((catId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }, []);

  const clearSelections = useCallback(() => {
    setSelectedConfigs(new Map());
  }, []);

  const getCategorySelectedCount = (catId: string): number =>
    selectedConfigs.get(catId)?.size || 0;

  /** Build the array of WriterConfig from current selections */
  const buildConfigs = useCallback((): WriterConfig[] => {
    const configs: WriterConfig[] = [];
    SMART_BUTTONS.forEach((btn) => {
      const optIds = selectedConfigs.get(btn.id);
      if (!optIds || optIds.size === 0) return;
      btn.options.forEach((opt) => {
        if (optIds.has(opt.id)) {
          configs.push({
            category: btn.id,
            option: opt.id,
            categoryLabel: btn.label,
            optionLabel: opt.label,
          });
        }
      });
    });
    return configs;
  }, [selectedConfigs]);

  const handleEvolve = useCallback(() => {
    if (!documentText.trim()) return;
    const configs = buildConfigs();
    if (configs.length === 0) {
      onEvolve([{ category: "general", option: "general", categoryLabel: "General", optionLabel: "Improve" }]);
    } else {
      onEvolve(configs);
    }
    clearSelections();
  }, [documentText, buildConfigs, onEvolve, clearSelections]);

  // Compute current labels for summary display
  const currentLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    SMART_BUTTONS.forEach((btn) => {
      const optIds = selectedConfigs.get(btn.id);
      if (optIds && optIds.size > 0) {
        const names = btn.options
          .filter((o) => optIds.has(o.id))
          .map((o) => o.label);
        labels[btn.id] = names.join(", ");
      }
    });
    return labels;
  }, [selectedConfigs]);

  // Determine which sources are active for the indicator
  const hasObjective = !!objective.trim();
  const hasDocument = !!documentText.trim();
  const hasContext = pinnedDocs.length > 0;
  const hasNotes = capturedContext.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0 bg-card">
        <div className="flex items-center gap-1.5">
          <Wand2 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold">Writer</span>
          {totalSelected > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-primary/15 text-primary">
              {totalSelected}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {totalSelected > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={clearSelections}
                  className="flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">Clear all selections</TooltipContent>
            </Tooltip>
          )}
          {/* View mode toggle */}
          <div className="flex items-center gap-0.5 bg-muted/50 rounded-md p-0.5">
            {([
              { mode: "sliders" as ViewMode, icon: SlidersHorizontal, tip: "Slider view" },
              { mode: "cards" as ViewMode, icon: LayoutGrid, tip: "Card view" },
              { mode: "accordion" as ViewMode, icon: List, tip: "Accordion view" },
            ]).map(({ mode, icon: Icon, tip }) => (
              <Tooltip key={mode}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode(mode)}
                    className={`p-1 rounded transition-colors ${
                      viewMode === mode
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">{tip}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* ── Context Sources Indicator ── */}
          <div className="rounded-lg border border-dashed border-muted-foreground/20 bg-muted/20 px-3 py-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Info className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Writer Context
              </span>
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground/80">
              The Writer combines your <strong className="text-foreground/70">document</strong>,{" "}
              <strong className="text-foreground/70">objective</strong>,{" "}
              <strong className="text-foreground/70">active context</strong>, and{" "}
              <strong className="text-foreground/70">edit history</strong> to evolve your document.
              Select configurations below to guide the transformation.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                hasDocument
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "bg-muted/60 text-muted-foreground/50"
              }`}>
                <FileText className="w-2.5 h-2.5" />
                Document {hasDocument ? "" : "(empty)"}
              </span>
              <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                hasObjective
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-muted/60 text-muted-foreground/50"
              }`}>
                <Target className="w-2.5 h-2.5" />
                Objective {hasObjective ? "" : "(empty)"}
              </span>
              <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                hasContext
                  ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                  : "bg-muted/60 text-muted-foreground/50"
              }`}>
                <Pin className="w-2.5 h-2.5" />
                Context {hasContext ? `(${pinnedDocs.length})` : "(none)"}
              </span>
              {hasNotes && (
                <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  <Settings2 className="w-2.5 h-2.5" />
                  Notes ({capturedContext.length})
                </span>
              )}
            </div>
          </div>

          {/* ── Configuration Area — renders based on viewMode ── */}
          {viewMode === "sliders" && (
            <SliderView
              buttons={SMART_BUTTONS}
              selections={selectedConfigs}
              onSelect={toggleOption}
              getCategoryCount={getCategorySelectedCount}
            />
          )}
          {viewMode === "cards" && (
            <CardView
              buttons={SMART_BUTTONS}
              selections={selectedConfigs}
              currentLabels={currentLabels}
              onSelect={toggleOption}
              getCategoryCount={getCategorySelectedCount}
            />
          )}
          {viewMode === "accordion" && (
            <AccordionView
              buttons={SMART_BUTTONS}
              selections={selectedConfigs}
              currentLabels={currentLabels}
              expandedSections={expandedSections}
              onToggleSection={toggleSection}
              onSelect={toggleOption}
              getCategoryCount={getCategorySelectedCount}
            />
          )}
        </div>
      </ScrollArea>

      {/* ── Evolve Button (wrapped with LLM preview on hover) ── */}
      <div className="px-3 py-2.5 border-t shrink-0 bg-card">
        <HoverCard openDelay={300} closeDelay={150}>
          <HoverCardTrigger asChild>
            <Button
              onClick={handleEvolve}
              disabled={isEvolving || !documentText.trim()}
              className={`w-full gap-1.5 text-xs ${
                totalSelected > 0
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              }`}
              variant={totalSelected > 0 ? "default" : "ghost"}
              size="sm"
            >
              {isEvolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              Write{totalSelected > 0 ? ` (${totalSelected})` : ""}
            </Button>
          </HoverCardTrigger>
          <HoverCardContent
            side="top"
            align="center"
            className="w-auto p-0 border-0 bg-transparent shadow-none"
          >
            <EvolveContextPreview
              text={documentText}
              objective={objective}
              configurations={buildConfigs()}
              capturedContext={capturedContext}
              pinnedDocContents={pinnedDocContents}
              sessionNotes={sessionNotes}
              editHistory={editHistory}
              appType={appType}
            />
          </HoverCardContent>
        </HoverCard>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// VIEW MODE 1: Sliders — vertical multi-select groups per category
// ═══════════════════════════════════════════════════════════════════════

function SliderView({
  buttons,
  selections,
  onSelect,
  getCategoryCount,
}: {
  buttons: SmartButtonDef[];
  selections: Map<string, Set<string>>;
  onSelect: (catId: string, optId: string) => void;
  getCategoryCount: (catId: string) => number;
}) {
  return (
    <div className="space-y-3">
      {buttons.map((btn) => {
        const catSelected = selections.get(btn.id);
        const count = getCategoryCount(btn.id);
        return (
          <div key={btn.id}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {btn.label}
              </span>
              {count > 0 && (
                <Badge className="h-3.5 min-w-[14px] px-1 text-[9px] bg-primary/15 text-primary">
                  {count}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {btn.options.map((opt) => {
                const isActive = catSelected?.has(opt.id) || false;
                return (
                  <Tooltip key={opt.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onSelect(btn.id, opt.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all border ${
                          isActive
                            ? btn.activeBg
                            : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        }`}
                      >
                        {isActive && <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />}
                        {opt.label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[10px] max-w-[180px]">
                      {opt.description}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// VIEW MODE 2: Cards — 2-column grid of tappable cards
// ═══════════════════════════════════════════════════════════════════════

function CardView({
  buttons,
  selections,
  currentLabels,
  onSelect,
  getCategoryCount,
}: {
  buttons: SmartButtonDef[];
  selections: Map<string, Set<string>>;
  currentLabels: Record<string, string>;
  onSelect: (catId: string, optId: string) => void;
  getCategoryCount: (catId: string) => number;
}) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {buttons.map((btn) => {
          const isExpanded = expandedCard === btn.id;
          const currentLabel = currentLabels[btn.id];
          const count = getCategoryCount(btn.id);
          const catSelected = selections.get(btn.id);
          return (
            <button
              key={btn.id}
              onClick={() => setExpandedCard(isExpanded ? null : btn.id)}
              className={`text-left rounded-lg border p-2.5 transition-all ${
                isExpanded
                  ? "col-span-2 ring-1 ring-primary/30 border-primary/30 bg-primary/5"
                  : currentLabel
                    ? "border-primary/20 bg-primary/5 hover:bg-primary/10"
                    : "bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {btn.label}
                  </span>
                  {count > 0 && (
                    <Badge className="h-3.5 min-w-[14px] px-1 text-[9px] bg-primary/15 text-primary">
                      {count}
                    </Badge>
                  )}
                </div>
                {!isExpanded && currentLabel && (
                  <span className="text-[10px] font-medium text-primary truncate ml-1">
                    {currentLabel}
                  </span>
                )}
              </div>
              {isExpanded && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {btn.options.map((opt) => {
                    const isActive = catSelected?.has(opt.id) || false;
                    return (
                      <button
                        key={opt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(btn.id, opt.id);
                        }}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all border ${
                          isActive
                            ? btn.activeBg
                            : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        }`}
                      >
                        {isActive && <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// VIEW MODE 3: Accordion — collapsible sections with inline lists
// ═══════════════════════════════════════════════════════════════════════

function AccordionView({
  buttons,
  selections,
  currentLabels,
  expandedSections,
  onToggleSection,
  onSelect,
  getCategoryCount,
}: {
  buttons: SmartButtonDef[];
  selections: Map<string, Set<string>>;
  currentLabels: Record<string, string>;
  expandedSections: Set<string>;
  onToggleSection: (catId: string) => void;
  onSelect: (catId: string, optId: string) => void;
  getCategoryCount: (catId: string) => number;
}) {
  return (
    <div className="border rounded-lg divide-y overflow-hidden">
      {buttons.map((btn) => {
        const isExpanded = expandedSections.has(btn.id);
        const currentLabel = currentLabels[btn.id];
        const count = getCategoryCount(btn.id);
        const catSelected = selections.get(btn.id);
        return (
          <div key={btn.id}>
            <button
              onClick={() => onToggleSection(btn.id)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                )}
                <span className="text-[11px] font-semibold text-foreground">{btn.label}</span>
                {count > 0 && (
                  <Badge className="h-3.5 min-w-[14px] px-1 text-[9px] bg-primary/15 text-primary">
                    {count}
                  </Badge>
                )}
              </div>
              {!isExpanded && currentLabel && (
                <span className="text-[10px] text-primary font-medium truncate ml-2">
                  {currentLabel}
                </span>
              )}
            </button>
            {isExpanded && (
              <div className="px-3 pb-2 space-y-0.5">
                {btn.options.map((opt) => {
                  const isActive = catSelected?.has(opt.id) || false;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => onSelect(btn.id, opt.id)}
                      className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      }`}
                    >
                      <div
                        className={`w-3 h-3 rounded shrink-0 flex items-center justify-center border-2 ${
                          isActive ? "border-primary bg-primary/20" : "border-muted-foreground/30"
                        }`}
                      >
                        {isActive && <CheckCircle2 className="w-2.5 h-2.5 text-primary" />}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-medium block">{opt.label}</span>
                        <span className="text-[9px] text-muted-foreground/70 block truncate">
                          {opt.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
