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
  BarChart3,
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

/** Art vs Infographic mode */
export type PainterMode = "art" | "infographic";

/** A selected painter configuration — same shape as WriterConfig */
export interface PainterConfig {
  category: string;
  option: string;
  categoryLabel: string;
  optionLabel: string;
}

// ── Art-mode configuration tree ─────────────────────────────────────────

const ART_BUTTONS: SmartButtonDef[] = [
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

// ── Infographic-mode configuration tree ─────────────────────────────────

const INFOGRAPHIC_BUTTONS: SmartButtonDef[] = [
  {
    id: "layout",
    label: "Layout",
    icon: BarChart3,
    options: [
      { id: "hero-stat", label: "Hero Stat", description: "Large key metric with supporting details below" },
      { id: "timeline", label: "Timeline", description: "Chronological flow of events or milestones" },
      { id: "comparison", label: "Comparison", description: "Side-by-side analysis of two or more items" },
      { id: "process-flow", label: "Process Flow", description: "Step-by-step sequence with connecting arrows" },
      { id: "hierarchy", label: "Hierarchy", description: "Org chart or tree structure showing relationships" },
      { id: "dashboard", label: "Dashboard", description: "Multi-panel overview with KPIs and charts" },
      { id: "mind-map", label: "Mind Map", description: "Central concept radiating to related topics" },
    ],
  },
  {
    id: "data-style",
    label: "Data Style",
    icon: BarChart3,
    options: [
      { id: "charts", label: "Charts & Graphs", description: "Bar, line, pie, and area charts for quantitative data" },
      { id: "icons-stats", label: "Icon Stats", description: "Large numbers with icons and percentage indicators" },
      { id: "tables", label: "Tables & Matrices", description: "Structured rows and columns for comparison data" },
      { id: "pictograms", label: "Pictograms", description: "Icon arrays showing proportions visually" },
      { id: "maps", label: "Maps & Geo", description: "Geographic data visualization and location mapping" },
      { id: "callouts", label: "Callout Blocks", description: "Highlighted key facts, quotes, and takeaways" },
    ],
  },
  {
    id: "palette",
    label: "Color Scheme",
    icon: BarChart3,
    options: [
      { id: "corporate", label: "Corporate", description: "Navy, slate, and steel blue — boardroom ready" },
      { id: "modern-tech", label: "Modern Tech", description: "Deep purple, electric blue, neon accents" },
      { id: "warm-earth", label: "Warm Earth", description: "Amber, terracotta, olive — approachable and grounded" },
      { id: "bold-contrast", label: "Bold Contrast", description: "High-contrast dark/light with vivid accent pops" },
      { id: "pastel-clean", label: "Pastel Clean", description: "Soft pastels on white — light and minimal" },
      { id: "dark-mode", label: "Dark Mode", description: "Dark backgrounds with luminous data elements" },
    ],
  },
  {
    id: "typography",
    label: "Typography",
    icon: BarChart3,
    options: [
      { id: "editorial", label: "Editorial", description: "Serif headings, elegant hierarchy — magazine quality" },
      { id: "geometric", label: "Geometric Sans", description: "Clean geometric sans-serif — modern startup feel" },
      { id: "bold-impact", label: "Bold Impact", description: "Heavy weights, tight tracking — data-first emphasis" },
      { id: "humanist", label: "Humanist", description: "Rounded, friendly type — accessible and warm" },
    ],
  },
  {
    id: "density",
    label: "Density",
    icon: BarChart3,
    options: [
      { id: "executive", label: "Executive Summary", description: "3-5 key points, large type, maximum whitespace" },
      { id: "balanced", label: "Balanced", description: "Moderate content with clear visual breathing room" },
      { id: "detailed", label: "Detailed", description: "Rich content with multiple data sections and annotations" },
      { id: "comprehensive", label: "Comprehensive", description: "Maximum information density — report-grade detail" },
    ],
  },
  {
    id: "format",
    label: "Output Size",
    icon: BarChart3,
    options: [
      { id: "1:1", label: "Square (1:1)", description: "Social media posts, dashboard tiles" },
      { id: "16:9", label: "Widescreen (16:9)", description: "Presentations, slide decks, blog headers" },
      { id: "9:16", label: "Portrait (9:16)", description: "Stories, mobile reports, tall infographics" },
      { id: "4:3", label: "Standard (4:3)", description: "Print-ready, traditional report format" },
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
    painterMode: PainterMode;
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
  const [painterMode, setPainterMode] = useState<PainterMode>("art");
  // Per-mode selections so switching modes doesn't lose choices
  const [artSelections, setArtSelections] = useState<Map<string, string>>(new Map());
  const [infoSelections, setInfoSelections] = useState<Map<string, string>>(new Map());
  const [painterObjective, setPainterObjective] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [showNegative, setShowNegative] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("sliders");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["style"]));

  const selections = painterMode === "art" ? artSelections : infoSelections;
  const setSelections = painterMode === "art" ? setArtSelections : setInfoSelections;
  const activeButtons = painterMode === "art" ? ART_BUTTONS : INFOGRAPHIC_BUTTONS;

  const pinnedDocs = useMemo(() => Object.values(pinnedDocContents), [pinnedDocContents]);

  const selectOption = useCallback((catId: string, optId: string) => {
    setSelections((prev) => {
      const next = new Map(prev);
      if (next.get(catId) === optId) {
        next.delete(catId);
      } else {
        next.set(catId, optId);
      }
      return next;
    });
  }, [setSelections]);

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
    activeButtons.forEach((btn) => {
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
  }, [selections, activeButtons]);

  const handlePaint = useCallback(() => {
    const configs = buildConfigs();
    // Fall back through: explicit painter objective → workspace objective → document summary
    const effectiveObjective = painterObjective.trim()
      || objective
      || (documentText.trim()
        ? `Create a visual representation of: ${documentText.slice(0, 300)}`
        : "");
    onPaintImage({
      painterConfigs: configs,
      painterObjective: effectiveObjective,
      negativePrompt: negativePrompt.trim() || undefined,
      painterMode,
    });
  }, [buildConfigs, onPaintImage, painterObjective, objective, documentText, negativePrompt, painterMode]);

  // Compute current labels for summary display
  const currentLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    activeButtons.forEach((btn) => {
      const optId = selections.get(btn.id);
      if (optId) {
        const opt = btn.options.find((o) => o.id === optId);
        labels[btn.id] = opt?.label || optId;
      }
    });
    return labels;
  }, [selections, activeButtons]);

  // ── LLM preview blocks for the Paint button hover ──
  const previewBlocks: ContextBlock[] = useMemo(() => {
    const descriptionText = painterObjective.trim() || objective;
    const configText = buildConfigs()
      .map((c) => `${c.categoryLabel}: ${c.optionLabel}`)
      .join(", ");
    const pinnedChars = pinnedDocs.reduce((s, d) => s + Math.min(d.content.length, 500), 0);

    return [
      { label: "Description", chars: descriptionText.length, color: painterMode === "art" ? "text-rose-400" : "text-indigo-400" },
      { label: "Document", chars: documentText.length, color: "text-blue-400" },
      { label: "Active Context", chars: pinnedChars, color: "text-cyan-400" },
      { label: painterMode === "art" ? "Style / Config" : "Infographic Config", chars: configText.length + 50, color: "text-emerald-400" },
    ];
  }, [painterObjective, objective, documentText, pinnedDocs, buildConfigs, painterMode]);

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
        label: painterMode === "art" ? "Style Configs" : "Infographic Configs",
        count: selections.size,
        emptyLabel: painterMode === "art" ? "No style selected" : "No config selected",
      },
    ];
  }, [painterObjective, objective, documentText, pinnedDocs, selections, painterMode]);

  // Determine which sources are active for the indicator
  const hasDescription = !!(painterObjective.trim() || objective.trim());
  const hasDocument = !!documentText.trim();
  const hasContext = pinnedDocs.length > 0;

  const isArt = painterMode === "art";
  // Explicit Tailwind classes (no dynamic interpolation — required for purge safety)
  const accentActive = isArt
    ? "bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-400"
    : "bg-indigo-500/10 border-indigo-500/40 text-indigo-700 dark:text-indigo-400";
  const accentText = isArt
    ? "text-rose-600 dark:text-rose-400"
    : "text-indigo-600 dark:text-indigo-400";
  const accentBg = isArt
    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
    : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0 bg-card">
        <div className="flex items-center gap-1.5">
          {isArt ? (
            <Paintbrush className="w-3.5 h-3.5 text-rose-500" />
          ) : (
            <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
          )}
          <span className="text-xs font-semibold">Painter</span>
          {totalSelected > 0 && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
              isArt
                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
            }`}>
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

      {/* ── Mode Toggle (Art / Infographic) ── */}
      <div className="flex items-center gap-1 px-3 py-2 border-b shrink-0 bg-muted/10">
        <button
          onClick={() => setPainterMode("art")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex-1 justify-center ${
            isArt
              ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-1 ring-rose-500/30"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <Paintbrush className="w-3.5 h-3.5" />
          Art
        </button>
        <button
          onClick={() => setPainterMode("infographic")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex-1 justify-center ${
            !isArt
              ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-500/30"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Infographic
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* ── Painter Objective ── */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              {isArt ? "Image Description" : "Infographic Brief"}
            </label>
            <textarea
              value={painterObjective}
              onChange={(e) => setPainterObjective(e.target.value)}
              placeholder={isArt
                ? "Describe what you want to see..."
                : "What story should this infographic tell? Key data points, audience, purpose..."
              }
              rows={3}
              className={`w-full text-xs rounded-md border bg-background px-2.5 py-2 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 resize-none ${
                isArt ? "focus:ring-rose-500/50" : "focus:ring-indigo-500/50"
              }`}
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
              {isArt ? (
                <>
                  The Painter combines your <strong className="text-foreground/70">description</strong>,{" "}
                  <strong className="text-foreground/70">current document</strong>, and{" "}
                  <strong className="text-foreground/70">active context</strong> to curate the image.
                  For best results, refine your document and use it as the primary source.
                </>
              ) : (
                <>
                  The Infographic engine synthesizes your <strong className="text-foreground/70">brief</strong>,{" "}
                  <strong className="text-foreground/70">document content</strong>, and{" "}
                  <strong className="text-foreground/70">pinned context</strong> into a rich visual.
                  The more structured your document, the better the output.
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                hasDescription
                  ? accentBg
                  : "bg-muted/60 text-muted-foreground/50"
              }`}>
                <Target className="w-2.5 h-2.5" />
                {isArt ? "Description" : "Brief"} {hasDescription ? "" : "(empty)"}
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
              buttons={activeButtons}
              selections={selections}
              onSelect={selectOption}
              isArt={isArt}
            />
          )}
          {viewMode === "cards" && (
            <CardView
              buttons={activeButtons}
              selections={selections}
              currentLabels={currentLabels}
              onSelect={selectOption}
              isArt={isArt}
            />
          )}
          {viewMode === "accordion" && (
            <AccordionView
              buttons={activeButtons}
              selections={selections}
              currentLabels={currentLabels}
              expandedSections={expandedSections}
              onToggleSection={toggleSection}
              onSelect={selectOption}
              isArt={isArt}
            />
          )}

          {/* ── Negative Prompt (collapsible) ── */}
          <div>
            <button
              onClick={() => setShowNegative(!showNegative)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showNegative ? <Minus className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
              <span className="font-medium uppercase tracking-wider">
                {isArt ? "Negative Prompt" : "Exclude"}
              </span>
            </button>
            {showNegative && (
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder={isArt
                  ? "What to avoid in the image..."
                  : "Elements to exclude (e.g. clip art, stock photos, generic icons)..."
                }
                rows={2}
                className={`w-full mt-1 text-xs rounded-md border bg-background px-2.5 py-2 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 resize-none ${
                  isArt ? "focus:ring-rose-500/50" : "focus:ring-indigo-500/50"
                }`}
              />
            )}
          </div>
        </div>
      </ScrollArea>

      {/* ── Paint Button (wrapped with LLM preview on hover) ── */}
      <div className="px-3 py-2.5 border-t shrink-0 bg-card">
        <LlmHoverButton
          previewTitle={isArt ? "Paint Image" : "Generate Infographic"}
          previewBlocks={previewBlocks}
          previewSummary={previewSummary}
          side="top"
          align="center"
        >
          <Button
            onClick={handlePaint}
            disabled={isPainting || (!painterObjective.trim() && !objective.trim() && !documentText.trim())}
            className={`w-full text-white gap-1.5 text-xs ${
              isArt
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
            size="sm"
          >
            {isPainting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isArt ? (
              <Paintbrush className="w-3.5 h-3.5" />
            ) : (
              <BarChart3 className="w-3.5 h-3.5" />
            )}
            {isArt ? "Paint" : "Generate"}{totalSelected > 0 ? ` (${totalSelected})` : ""}
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
  isArt,
}: {
  buttons: SmartButtonDef[];
  selections: Map<string, string>;
  onSelect: (catId: string, optId: string) => void;
  isArt: boolean;
}) {
  const activeClass = isArt
    ? "bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-400"
    : "bg-indigo-500/10 border-indigo-500/40 text-indigo-700 dark:text-indigo-400";

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
                            ? activeClass
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
  isArt,
}: {
  buttons: SmartButtonDef[];
  selections: Map<string, string>;
  currentLabels: Record<string, string>;
  onSelect: (catId: string, optId: string) => void;
  isArt: boolean;
}) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const expandedClass = isArt
    ? "col-span-2 ring-1 ring-rose-500/30 border-rose-500/30 bg-rose-500/5"
    : "col-span-2 ring-1 ring-indigo-500/30 border-indigo-500/30 bg-indigo-500/5";
  const selectedClass = isArt
    ? "border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10"
    : "border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10";
  const labelTextClass = isArt
    ? "text-rose-600 dark:text-rose-400"
    : "text-indigo-600 dark:text-indigo-400";
  const optActiveClass = isArt
    ? "bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-400"
    : "bg-indigo-500/15 border-indigo-500/40 text-indigo-700 dark:text-indigo-400";

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
                  ? expandedClass
                  : currentLabel
                    ? selectedClass
                    : "bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {btn.label}
                </span>
                {!isExpanded && currentLabel && (
                  <span className={`text-[10px] font-medium ${labelTextClass} truncate ml-1`}>
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
                            ? optActiveClass
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
  isArt,
}: {
  buttons: SmartButtonDef[];
  selections: Map<string, string>;
  currentLabels: Record<string, string>;
  expandedSections: Set<string>;
  onToggleSection: (catId: string) => void;
  onSelect: (catId: string, optId: string) => void;
  isArt: boolean;
}) {
  const labelTextClass = isArt
    ? "text-rose-600 dark:text-rose-400"
    : "text-indigo-600 dark:text-indigo-400";
  const rowActiveClass = isArt
    ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
    : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400";
  const radioBorderClass = isArt ? "border-rose-500" : "border-indigo-500";
  const radioDotClass = isArt ? "bg-rose-500" : "bg-indigo-500";

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
                <span className={`text-[10px] ${labelTextClass} font-medium truncate ml-2`}>
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
                          ? rowActiveClass
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      }`}
                    >
                      <div
                        className={`w-3 h-3 rounded-full border-2 shrink-0 flex items-center justify-center ${
                          isActive ? radioBorderClass : "border-muted-foreground/30"
                        }`}
                      >
                        {isActive && (
                          <div className={`w-1.5 h-1.5 rounded-full ${radioDotClass}`} />
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
