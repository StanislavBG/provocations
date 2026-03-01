import { useState, useCallback, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Paintbrush,
  Loader2,
  SlidersHorizontal,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronRight,
  Minus,
  FileText,
  Pin,
  Target,
  Settings2,
  Info,
  type LucideIcon,
} from "lucide-react";
import { LlmHoverButton, type ContextBlock, type SummaryItem } from "@/components/LlmHoverButton";

// ── Reuse the same schema shape as Writer's SmartButtonDef ──────────────

interface SmartOption {
  id: string;
  label: string;
  description: string;
}

interface SmartButtonDef {
  id: string;
  label: string;
  icon: LucideIcon;
  options: SmartOption[];
}

/** A selected painter configuration — same shape as WriterConfig */
export interface PainterConfig {
  category: string;
  option: string;
  categoryLabel: string;
  optionLabel: string;
}

// ── Painter-specific configuration tree ─────────────────────────────────

const PAINTER_BUTTONS: SmartButtonDef[] = [
  {
    id: "style",
    label: "Style",
    icon: Paintbrush,
    options: [
      { id: "realistic", label: "Realistic Photo", description: "Photographic realism with natural lighting" },
      { id: "watercolor", label: "Watercolor", description: "Soft washes and organic pigment flow" },
      { id: "illustration", label: "Illustration", description: "Clean vector-like artwork" },
      { id: "3d-render", label: "3D Render", description: "Rendered volumetric shapes and materials" },
      { id: "sketch", label: "Pencil Sketch", description: "Hand-drawn graphite linework" },
      { id: "oil-painting", label: "Oil Painting", description: "Rich impasto textures and deep colors" },
    ],
  },
  {
    id: "mood",
    label: "Mood",
    icon: Paintbrush,
    options: [
      { id: "vibrant", label: "Vibrant", description: "Bold saturated colors, high energy" },
      { id: "moody", label: "Moody", description: "Dark tones, atmospheric tension" },
      { id: "serene", label: "Serene", description: "Calm, soft, peaceful" },
      { id: "dramatic", label: "Dramatic", description: "High contrast, theatrical lighting" },
      { id: "minimal", label: "Minimal", description: "Reduced palette, negative space" },
      { id: "whimsical", label: "Whimsical", description: "Playful, dreamlike, fantastical" },
    ],
  },
  {
    id: "composition",
    label: "Composition",
    icon: Paintbrush,
    options: [
      { id: "close-up", label: "Close-up", description: "Tight framing on the subject" },
      { id: "wide-shot", label: "Wide Shot", description: "Full scene with environment" },
      { id: "birds-eye", label: "Bird's Eye", description: "Top-down overhead perspective" },
      { id: "centered", label: "Centered", description: "Subject centered with symmetry" },
      { id: "rule-of-thirds", label: "Rule of Thirds", description: "Subject offset for dynamic balance" },
    ],
  },
  {
    id: "detail",
    label: "Detail",
    icon: Paintbrush,
    options: [
      { id: "minimal", label: "Minimal", description: "Simple shapes, low complexity" },
      { id: "moderate", label: "Moderate", description: "Balanced detail and abstraction" },
      { id: "high", label: "Highly Detailed", description: "Intricate textures and fine elements" },
      { id: "photorealistic", label: "Photorealistic", description: "Maximum fidelity and realism" },
    ],
  },
  {
    id: "format",
    label: "Format",
    icon: Paintbrush,
    options: [
      { id: "1:1", label: "Square (1:1)", description: "Equal width and height" },
      { id: "16:9", label: "Widescreen (16:9)", description: "Cinematic landscape ratio" },
      { id: "9:16", label: "Portrait (9:16)", description: "Tall vertical ratio" },
      { id: "4:3", label: "Standard (4:3)", description: "Classic photograph ratio" },
    ],
  },
];

// ── View mode type ──────────────────────────────────────────────────────

type ViewMode = "sliders" | "cards" | "accordion";

// ── Component props ─────────────────────────────────────────────────────

interface PainterPanelProps {
  documentText: string;
  objective: string;
  onPaintImage: (config: {
    painterConfigs: PainterConfig[];
    painterObjective: string;
    negativePrompt?: string;
  }) => void;
  isPainting: boolean;
  pinnedDocContents?: Record<number, { title: string; content: string }>;
}

export function PainterPanel({
  documentText,
  objective,
  onPaintImage,
  isPainting,
  pinnedDocContents = {},
}: PainterPanelProps) {
  // Per-category selection (single-select per category for Painter)
  const [selections, setSelections] = useState<Map<string, string>>(new Map());
  const [painterObjective, setPainterObjective] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [showNegative, setShowNegative] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("sliders");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["style"]));

  const pinnedDocs = useMemo(() => Object.values(pinnedDocContents), [pinnedDocContents]);

  const selectOption = useCallback((catId: string, optId: string) => {
    setSelections((prev) => {
      const next = new Map(prev);
      if (next.get(catId) === optId) {
        next.delete(catId); // deselect
      } else {
        next.set(catId, optId);
      }
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

  const totalSelected = selections.size;

  const buildConfigs = useCallback((): PainterConfig[] => {
    const configs: PainterConfig[] = [];
    PAINTER_BUTTONS.forEach((btn) => {
      const optId = selections.get(btn.id);
      if (!optId) return;
      const opt = btn.options.find((o) => o.id === optId);
      if (!opt) return;
      configs.push({
        category: btn.id,
        option: opt.id,
        categoryLabel: btn.label,
        optionLabel: opt.label,
      });
    });
    return configs;
  }, [selections]);

  const handlePaint = useCallback(() => {
    const configs = buildConfigs();
    onPaintImage({
      painterConfigs: configs,
      painterObjective: painterObjective.trim() || objective,
      negativePrompt: negativePrompt.trim() || undefined,
    });
  }, [buildConfigs, onPaintImage, painterObjective, objective, negativePrompt]);

  // Compute current labels for summary display
  const currentLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    PAINTER_BUTTONS.forEach((btn) => {
      const optId = selections.get(btn.id);
      if (optId) {
        const opt = btn.options.find((o) => o.id === optId);
        labels[btn.id] = opt?.label || optId;
      }
    });
    return labels;
  }, [selections]);

  // ── LLM preview blocks for the Paint button hover ──
  const previewBlocks: ContextBlock[] = useMemo(() => {
    const descriptionText = painterObjective.trim() || objective;
    const configText = buildConfigs()
      .map((c) => `${c.categoryLabel}: ${c.optionLabel}`)
      .join(", ");
    const pinnedChars = pinnedDocs.reduce((s, d) => s + Math.min(d.content.length, 500), 0);

    return [
      { label: "Description", chars: descriptionText.length, color: "text-rose-400" },
      { label: "Document", chars: documentText.length, color: "text-blue-400" },
      { label: "Active Context", chars: pinnedChars, color: "text-cyan-400" },
      { label: "Style / Config", chars: configText.length + 50, color: "text-emerald-400" },
    ];
  }, [painterObjective, objective, documentText, pinnedDocs, buildConfigs]);

  const previewSummary: SummaryItem[] = useMemo(() => {
    const descriptionText = painterObjective.trim() || objective;
    const docWords = documentText.trim() ? documentText.split(/\s+/).filter(Boolean).length : 0;

    return [
      {
        icon: <Target className="w-3 h-3 text-rose-400" />,
        label: "Description",
        count: descriptionText.trim() ? 1 : 0,
        detail: descriptionText.trim() ? descriptionText.slice(0, 60) + (descriptionText.length > 60 ? "..." : "") : undefined,
      },
      {
        icon: <FileText className="w-3 h-3 text-blue-400" />,
        label: "Document",
        count: docWords > 0 ? 1 : 0,
        detail: docWords > 0 ? `${docWords} words` : undefined,
        emptyLabel: "No document",
      },
      {
        icon: <Pin className="w-3 h-3 text-cyan-400" />,
        label: "Active Context Docs",
        count: pinnedDocs.length,
        emptyLabel: "None pinned",
      },
      {
        icon: <Settings2 className="w-3 h-3 text-emerald-400" />,
        label: "Style Configs",
        count: selections.size,
        emptyLabel: "No style selected",
      },
    ];
  }, [painterObjective, objective, documentText, pinnedDocs, selections]);

  // Determine which sources are active for the indicator
  const hasDescription = !!(painterObjective.trim() || objective.trim());
  const hasDocument = !!documentText.trim();
  const hasContext = pinnedDocs.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0 bg-card">
        <div className="flex items-center gap-1.5">
          <Paintbrush className="w-3.5 h-3.5 text-rose-500" />
          <span className="text-xs font-semibold">Painter</span>
          {totalSelected > 0 && (
            <span className="text-[9px] bg-rose-500/15 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded-full font-medium">
              {totalSelected}
            </span>
          )}
        </div>
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

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* ── Painter Objective ── */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Image Description
            </label>
            <textarea
              value={painterObjective}
              onChange={(e) => setPainterObjective(e.target.value)}
              placeholder="Describe what you want to see..."
              rows={3}
              className="w-full text-xs rounded-md border bg-background px-2.5 py-2 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-rose-500/50 resize-none"
            />
          </div>

          {/* ── Context Sources Indicator ── */}
          <div className="rounded-lg border border-dashed border-muted-foreground/20 bg-muted/20 px-3 py-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Info className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Painter Context
              </span>
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground/80">
              The Painter combines your <strong className="text-foreground/70">description</strong>,{" "}
              <strong className="text-foreground/70">current document</strong>, and{" "}
              <strong className="text-foreground/70">active context</strong> to curate the image.
              For best results, refine your document and use it as the primary source.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                hasDescription
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-muted/60 text-muted-foreground/50"
              }`}>
                <Target className="w-2.5 h-2.5" />
                Description {hasDescription ? "" : "(empty)"}
              </span>
              <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                hasDocument
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "bg-muted/60 text-muted-foreground/50"
              }`}>
                <FileText className="w-2.5 h-2.5" />
                Document {hasDocument ? "" : "(empty)"}
              </span>
              <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                hasContext
                  ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                  : "bg-muted/60 text-muted-foreground/50"
              }`}>
                <Pin className="w-2.5 h-2.5" />
                Context {hasContext ? `(${pinnedDocs.length})` : "(none)"}
              </span>
            </div>
          </div>

          {/* ── Configuration Area — renders based on viewMode ── */}
          {viewMode === "sliders" && (
            <SliderView
              buttons={PAINTER_BUTTONS}
              selections={selections}
              onSelect={selectOption}
            />
          )}
          {viewMode === "cards" && (
            <CardView
              buttons={PAINTER_BUTTONS}
              selections={selections}
              currentLabels={currentLabels}
              onSelect={selectOption}
            />
          )}
          {viewMode === "accordion" && (
            <AccordionView
              buttons={PAINTER_BUTTONS}
              selections={selections}
              currentLabels={currentLabels}
              expandedSections={expandedSections}
              onToggleSection={toggleSection}
              onSelect={selectOption}
            />
          )}

          {/* ── Negative Prompt (collapsible) ── */}
          <div>
            <button
              onClick={() => setShowNegative(!showNegative)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showNegative ? <Minus className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
              <span className="font-medium uppercase tracking-wider">Negative Prompt</span>
            </button>
            {showNegative && (
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="What to avoid in the image..."
                rows={2}
                className="w-full mt-1 text-xs rounded-md border bg-background px-2.5 py-2 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-rose-500/50 resize-none"
              />
            )}
          </div>
        </div>
      </ScrollArea>

      {/* ── Paint Button (wrapped with LLM preview on hover) ── */}
      <div className="px-3 py-2.5 border-t shrink-0 bg-card">
        <LlmHoverButton
          previewTitle="Paint Image"
          previewBlocks={previewBlocks}
          previewSummary={previewSummary}
          side="top"
          align="center"
        >
          <Button
            onClick={handlePaint}
            disabled={isPainting || (!painterObjective.trim() && !objective.trim())}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white gap-1.5 text-xs"
            size="sm"
          >
            {isPainting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Paintbrush className="w-3.5 h-3.5" />
            )}
            Paint{totalSelected > 0 ? ` (${totalSelected})` : ""}
          </Button>
        </LlmHoverButton>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// VIEW MODE 1: Sliders — vertical radio groups per category
// ═══════════════════════════════════════════════════════════════════════

function SliderView({
  buttons,
  selections,
  onSelect,
}: {
  buttons: SmartButtonDef[];
  selections: Map<string, string>;
  onSelect: (catId: string, optId: string) => void;
}) {
  return (
    <div className="space-y-3">
      {buttons.map((btn) => {
        const selected = selections.get(btn.id);
        return (
          <div key={btn.id}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
              {btn.label}
            </span>
            <div className="flex flex-wrap gap-1">
              {btn.options.map((opt) => {
                const isActive = selected === opt.id;
                return (
                  <Tooltip key={opt.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onSelect(btn.id, opt.id)}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-all border ${
                          isActive
                            ? "bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-400"
                            : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        }`}
                      >
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
}: {
  buttons: SmartButtonDef[];
  selections: Map<string, string>;
  currentLabels: Record<string, string>;
  onSelect: (catId: string, optId: string) => void;
}) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {buttons.map((btn) => {
          const isExpanded = expandedCard === btn.id;
          const currentLabel = currentLabels[btn.id];
          return (
            <button
              key={btn.id}
              onClick={() => setExpandedCard(isExpanded ? null : btn.id)}
              className={`text-left rounded-lg border p-2.5 transition-all ${
                isExpanded
                  ? "col-span-2 ring-1 ring-rose-500/30 border-rose-500/30 bg-rose-500/5"
                  : currentLabel
                    ? "border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10"
                    : "bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {btn.label}
                </span>
                {!isExpanded && currentLabel && (
                  <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400 truncate ml-1">
                    {currentLabel}
                  </span>
                )}
              </div>
              {isExpanded && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {btn.options.map((opt) => {
                    const isActive = selections.get(btn.id) === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(btn.id, opt.id);
                        }}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-all border ${
                          isActive
                            ? "bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-400"
                            : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        }`}
                      >
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
}: {
  buttons: SmartButtonDef[];
  selections: Map<string, string>;
  currentLabels: Record<string, string>;
  expandedSections: Set<string>;
  onToggleSection: (catId: string) => void;
  onSelect: (catId: string, optId: string) => void;
}) {
  return (
    <div className="border rounded-lg divide-y overflow-hidden">
      {buttons.map((btn) => {
        const isExpanded = expandedSections.has(btn.id);
        const currentLabel = currentLabels[btn.id];
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
              </div>
              {!isExpanded && currentLabel && (
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium truncate ml-2">
                  {currentLabel}
                </span>
              )}
            </button>
            {isExpanded && (
              <div className="px-3 pb-2 space-y-0.5">
                {btn.options.map((opt) => {
                  const isActive = selections.get(btn.id) === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => onSelect(btn.id, opt.id)}
                      className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
                        isActive
                          ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      }`}
                    >
                      <div
                        className={`w-3 h-3 rounded-full border-2 shrink-0 flex items-center justify-center ${
                          isActive
                            ? "border-rose-500"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {isActive && (
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        )}
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
