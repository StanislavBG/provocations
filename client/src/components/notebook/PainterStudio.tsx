import { useState, useCallback, useMemo, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import {
  Paintbrush,
  Loader2,
  X,
  Download,
  Copy,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Maximize2,
  ChevronDown,
  ChevronRight,
  Minus,
  FileText,
  Pin,
  Target,
  Settings2,
  Info,
  BarChart3,
  Sparkles,
  Shield,
  ImagePlus,
  Repeat,
  Dice1,
  Maximize,
  Users,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LlmHoverButton, type ContextBlock, type SummaryItem } from "@/components/LlmHoverButton";

// ── Shared interfaces & types ────────────────────────────────────────────

interface SmartOption {
  id: string;
  label: string;
  description: string;
}

interface SmartButtonDef {
  id: string;
  label: string;
  icon?: LucideIcon;
  options: SmartOption[];
}

/** Art vs Infographic mode */
export type PainterMode = "art" | "infographic";

/** Context sources that can be excluded per-call */
export type PainterSource = "description" | "document" | "context";

/** Advanced generation parameters passed to the Gemini API */
export interface PainterAdvancedParams {
  temperature?: number;
  topP?: number;
  topK?: number;
  seed?: number;
  imageSize?: "1K" | "2K" | "4K";
  personGeneration?: "all" | "adult" | "none";
  outputMimeType?: string;
  safetyLevel?: "off" | "none" | "high" | "medium" | "low";
  systemInstruction?: string;
  numberOfImages?: number;
}

/** Full paint request payload */
export interface PaintImageRequest {
  painterConfigs: PainterConfig[];
  painterObjective: string;
  negativePrompt?: string;
  painterMode: PainterMode;
  excludedSources?: Set<PainterSource>;
  advancedParams?: PainterAdvancedParams;
}

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
      { id: "3:2", label: "Photo (3:2)", description: "Standard DSLR ratio" },
      { id: "2:3", label: "Portrait (2:3)", description: "Vertical photo ratio" },
      { id: "21:9", label: "Ultra-wide (21:9)", description: "Panoramic cinematic" },
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

// ═══════════════════════════════════════════════════════════════════════
// PRESET CONFIGURATIONS — goal-oriented quick starts (studio only)
// ═══════════════════════════════════════════════════════════════════════

interface Preset {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  mode: PainterMode;
  configs: Record<string, string>;
  advanced: Partial<PainterAdvancedParams>;
  negativePrompt?: string;
}

const PRESETS: Preset[] = [
  // ── Art Presets ──
  {
    id: "photorealistic-portrait",
    label: "Photorealistic Portrait",
    description: "Studio-quality portrait with natural lighting and sharp detail",
    icon: Users,
    mode: "art",
    configs: { style: "realistic", mood: "dramatic", composition: "close-up", detail: "photorealistic", format: "4:3" },
    advanced: { temperature: 0.6, imageSize: "2K", personGeneration: "all", safetyLevel: "off" },
    negativePrompt: "cartoon, anime, low quality, blurry, distorted",
  },
  {
    id: "concept-art",
    label: "Concept Art",
    description: "Cinematic concept art with bold composition and rich detail",
    icon: Sparkles,
    mode: "art",
    configs: { style: "illustration", mood: "dramatic", composition: "wide-shot", detail: "high", format: "16:9" },
    advanced: { temperature: 0.9, imageSize: "2K", safetyLevel: "off" },
    negativePrompt: "photo, realistic, amateur, simple",
  },
  {
    id: "oil-masterpiece",
    label: "Oil Masterpiece",
    description: "Rich classical oil painting with gallery-quality textures",
    icon: Palette,
    mode: "art",
    configs: { style: "oil-painting", mood: "moody", composition: "rule-of-thirds", detail: "high", format: "4:3" },
    advanced: { temperature: 0.7, imageSize: "2K", safetyLevel: "off" },
    negativePrompt: "digital, flat, cartoon, low resolution",
  },
  {
    id: "product-shot",
    label: "Product Photography",
    description: "Clean e-commerce product shot on white background",
    icon: ImagePlus,
    mode: "art",
    configs: { style: "realistic", mood: "minimal", composition: "centered", detail: "photorealistic", format: "1:1" },
    advanced: { temperature: 0.3, imageSize: "2K", personGeneration: "none", safetyLevel: "off" },
    negativePrompt: "people, busy background, text, watermark",
  },
  // ── Infographic Presets ──
  {
    id: "executive-dashboard",
    label: "Executive Dashboard",
    description: "Board-ready KPI dashboard with clean data visualization",
    icon: BarChart3,
    mode: "infographic",
    configs: { layout: "dashboard", "data-style": "charts", palette: "corporate", typography: "geometric", density: "executive", format: "16:9" },
    advanced: { temperature: 0.4, imageSize: "2K", safetyLevel: "off" },
  },
  {
    id: "tech-comparison",
    label: "Tech Comparison",
    description: "Side-by-side feature comparison with modern tech aesthetic",
    icon: Repeat,
    mode: "infographic",
    configs: { layout: "comparison", "data-style": "tables", palette: "modern-tech", typography: "bold-impact", density: "detailed", format: "16:9" },
    advanced: { temperature: 0.5, imageSize: "2K", safetyLevel: "off" },
  },
  {
    id: "social-story",
    label: "Social Media Story",
    description: "Vertical infographic optimized for Instagram/TikTok stories",
    icon: ImagePlus,
    mode: "infographic",
    configs: { layout: "hero-stat", "data-style": "icons-stats", palette: "bold-contrast", typography: "bold-impact", density: "executive", format: "9:16" },
    advanced: { temperature: 0.6, imageSize: "2K", safetyLevel: "off" },
  },
];

// ── Advanced section definitions (studio only) ──────────────────────────

const IMAGE_SIZES: { id: string; label: string; desc: string }[] = [
  { id: "1K", label: "1K", desc: "1024px — Fast, standard quality" },
  { id: "2K", label: "2K", desc: "2048px — High quality, slower" },
  { id: "4K", label: "4K", desc: "4096px — Maximum resolution" },
];

const PERSON_OPTIONS: { id: string; label: string; desc: string }[] = [
  { id: "all", label: "Allow All", desc: "Adults and children" },
  { id: "adult", label: "Adults Only", desc: "Generate adults, block children" },
  { id: "none", label: "No People", desc: "Block all person generation" },
];

const SAFETY_LEVELS: { id: string; label: string; desc: string }[] = [
  { id: "off", label: "Off", desc: "Safety filter disabled" },
  { id: "none", label: "None", desc: "Block none (most permissive)" },
  { id: "high", label: "High Only", desc: "Block only high-severity" },
  { id: "medium", label: "Medium+", desc: "Block medium and above" },
  { id: "low", label: "Low+", desc: "Block low and above (strictest)" },
];

// ── View mode type (panel variant only) ─────────────────────────────────

type ViewMode = "sliders" | "cards" | "accordion";

// ═══════════════════════════════════════════════════════════════════════
// UNIFIED COMPONENT
// ═══════════════════════════════════════════════════════════════════════

interface PainterStudioProps {
  /** "panel" = compact sidebar, "studio" = fullscreen overlay */
  variant?: "panel" | "studio";
  documentText: string;
  objective: string;
  onPaintImage: (config: PaintImageRequest) => void;
  isPainting: boolean;
  pinnedDocContents?: Record<number, { title: string; content: string }>;
  /** Studio-only: gallery of generated images */
  generatedImages?: Map<string, { imageUrl: string | null; prompt: string; isGenerating: boolean }>;
  /** Studio-only: close handler */
  onClose?: () => void;
  /** Panel-only: open the studio fullscreen */
  onOpenStudio?: () => void;
}

export function PainterStudio({
  variant = "studio",
  documentText,
  objective,
  onPaintImage,
  isPainting,
  pinnedDocContents = {},
  generatedImages,
  onClose,
  onOpenStudio,
}: PainterStudioProps) {
  const { toast } = useToast();

  // Mode & config selections
  const [painterMode, setPainterMode] = useState<PainterMode>("art");
  const [artSelections, setArtSelections] = useState<Map<string, string>>(new Map());
  const [infoSelections, setInfoSelections] = useState<Map<string, string>>(new Map());
  const [painterObjective, setPainterObjective] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [showNegative, setShowNegative] = useState(false);
  const [excludedSources, setExcludedSources] = useState<Set<PainterSource>>(new Set());

  // Panel-only view mode
  const [viewMode, setViewMode] = useState<ViewMode>("sliders");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["style"]));

  // Studio-only state
  const [systemInstruction, setSystemInstruction] = useState("");
  const [showSystem, setShowSystem] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.95);
  const [topK, setTopK] = useState(40);
  const [seed, setSeed] = useState<number | null>(null);
  const [imageSize, setImageSize] = useState<"1K" | "2K" | "4K">("1K");
  const [personGeneration, setPersonGeneration] = useState<"all" | "adult" | "none">("all");
  const [safetyLevel, setSafetyLevel] = useState<"off" | "none" | "high" | "medium" | "low">("off");
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [expandedAdvanced, setExpandedAdvanced] = useState(true);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const selections = painterMode === "art" ? artSelections : infoSelections;
  const setSelections = painterMode === "art" ? setArtSelections : setInfoSelections;
  const activeButtons = painterMode === "art" ? ART_BUTTONS : INFOGRAPHIC_BUTTONS;
  const pinnedDocs = useMemo(() => Object.values(pinnedDocContents), [pinnedDocContents]);
  const isArt = painterMode === "art";
  const isPanel = variant === "panel";

  // Close on Escape (studio only)
  useEffect(() => {
    if (isPanel || !onClose) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isPanel, onClose]);

  const selectOption = useCallback((catId: string, optId: string) => {
    setActivePreset(null);
    setSelections((prev) => {
      const next = new Map(prev);
      if (next.get(catId) === optId) next.delete(catId);
      else next.set(catId, optId);
      return next;
    });
  }, [setSelections]);

  const toggleSource = useCallback((source: PainterSource) => {
    setExcludedSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
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

  const applyPreset = useCallback((preset: Preset) => {
    setActivePreset(preset.id);
    setPainterMode(preset.mode);
    const setter = preset.mode === "art" ? setArtSelections : setInfoSelections;
    setter(new Map(Object.entries(preset.configs)));
    if (preset.negativePrompt) setNegativePrompt(preset.negativePrompt);
    const a = preset.advanced;
    if (a.temperature !== undefined) setTemperature(a.temperature);
    if (a.imageSize) setImageSize(a.imageSize);
    if (a.personGeneration) setPersonGeneration(a.personGeneration);
    if (a.safetyLevel) setSafetyLevel(a.safetyLevel);
  }, []);

  const randomizeSeed = useCallback(() => {
    setSeed(Math.floor(Math.random() * 2147483647));
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
    const skipDesc = excludedSources.has("description");
    const skipDoc = excludedSources.has("document");
    const skipCtx = excludedSources.has("context");

    let effectiveObjective = "";
    if (!skipDesc) {
      effectiveObjective = painterObjective.trim() || objective || "";
    }
    if (!effectiveObjective && !skipDoc && documentText.trim()) {
      effectiveObjective = `Create a visual representation of: ${documentText.slice(0, 300)}`;
    }
    if (!effectiveObjective && !skipCtx && pinnedDocs.length > 0) {
      const contextSummary = pinnedDocs.map((d) => `[${d.title}] ${d.content.slice(0, 300)}`).join("\n");
      effectiveObjective = `Create a visual representation based on this context:\n${contextSummary}`;
    }

    const request: PaintImageRequest = {
      painterConfigs: configs,
      painterObjective: effectiveObjective,
      negativePrompt: negativePrompt.trim() || undefined,
      painterMode,
      excludedSources: excludedSources.size > 0 ? new Set(excludedSources) : undefined,
    };

    // Studio variant includes advanced params
    if (!isPanel) {
      request.advancedParams = {
        temperature,
        topP,
        topK,
        seed: seed ?? undefined,
        imageSize,
        personGeneration,
        safetyLevel,
        systemInstruction: systemInstruction.trim() || undefined,
        numberOfImages,
      };
    }

    onPaintImage(request);
  }, [buildConfigs, onPaintImage, painterObjective, objective, documentText, negativePrompt, painterMode, excludedSources, pinnedDocs, isPanel, temperature, topP, topK, seed, imageSize, personGeneration, safetyLevel, systemInstruction, numberOfImages]);

  // Compute current labels for summary display (panel variant)
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

  // ── LLM preview blocks for the Paint button hover (panel variant) ──
  const previewBlocks: ContextBlock[] = useMemo(() => {
    const skipDesc = excludedSources.has("description");
    const skipDoc = excludedSources.has("document");
    const skipCtx = excludedSources.has("context");
    const descriptionText = painterObjective.trim() || objective;
    const configText = buildConfigs()
      .map((c) => `${c.categoryLabel}: ${c.optionLabel}`)
      .join(", ");
    const pinnedChars = skipCtx ? 0 : pinnedDocs.reduce((s, d) => s + Math.min(d.content.length, 500), 0);

    return [
      { label: skipDesc ? "Description (excluded)" : "Description", chars: skipDesc ? 0 : descriptionText.length, color: painterMode === "art" ? "text-rose-400" : "text-indigo-400" },
      { label: skipDoc ? "Document (excluded)" : "Document", chars: skipDoc ? 0 : documentText.length, color: "text-blue-400" },
      { label: skipCtx ? "Active Context (excluded)" : "Active Context", chars: pinnedChars, color: "text-cyan-400" },
      { label: painterMode === "art" ? "Style / Config" : "Infographic Config", chars: configText.length + 50, color: "text-emerald-400" },
    ];
  }, [painterObjective, objective, documentText, pinnedDocs, buildConfigs, painterMode, excludedSources]);

  const previewSummary: SummaryItem[] = useMemo(() => {
    const skipDesc = excludedSources.has("description");
    const skipDoc = excludedSources.has("document");
    const skipCtx = excludedSources.has("context");
    const descriptionText = painterObjective.trim() || objective;
    const docWords = (!skipDoc && documentText.trim()) ? documentText.split(/\s+/).filter(Boolean).length : 0;

    return [
      {
        icon: <Target className="w-3 h-3 text-rose-400" />,
        label: skipDesc ? "Description (excluded)" : "Description",
        count: (!skipDesc && descriptionText.trim()) ? 1 : 0,
        detail: (!skipDesc && descriptionText.trim()) ? descriptionText.slice(0, 60) + (descriptionText.length > 60 ? "..." : "") : skipDesc ? "Excluded" : undefined,
      },
      {
        icon: <FileText className="w-3 h-3 text-blue-400" />,
        label: skipDoc ? "Document (excluded)" : "Document",
        count: docWords > 0 ? 1 : 0,
        detail: docWords > 0 ? `${docWords} words` : skipDoc ? "Excluded" : undefined,
        emptyLabel: "No document",
      },
      {
        icon: <Pin className="w-3 h-3 text-cyan-400" />,
        label: skipCtx ? "Active Context (excluded)" : "Active Context Docs",
        count: skipCtx ? 0 : pinnedDocs.length,
        detail: skipCtx ? "Excluded" : undefined,
        emptyLabel: "None pinned",
      },
      {
        icon: <Settings2 className="w-3 h-3 text-emerald-400" />,
        label: painterMode === "art" ? "Style Configs" : "Infographic Configs",
        count: selections.size,
        emptyLabel: painterMode === "art" ? "No style selected" : "No config selected",
      },
    ];
  }, [painterObjective, objective, documentText, pinnedDocs, selections, painterMode, excludedSources]);

  const hasDescription = !!(painterObjective.trim() || objective.trim());
  const hasDocument = !!documentText.trim();
  const hasContext = pinnedDocs.length > 0;
  const descExcluded = excludedSources.has("description");
  const docExcluded = excludedSources.has("document");
  const ctxExcluded = excludedSources.has("context");
  const filteredPresets = PRESETS.filter((p) => p.mode === painterMode);

  // Gallery of generated images (studio only)
  const imageEntries = useMemo(() => {
    if (!generatedImages) return [];
    return Array.from(generatedImages.entries())
      .filter(([, d]) => d.imageUrl || d.isGenerating)
      .reverse();
  }, [generatedImages]);

  const handleCopyImage = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast({ title: "Copied", description: "Image copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }, [toast]);

  const handleDownloadImage = useCallback((url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `painter-${Date.now()}.png`;
    a.click();
  }, []);

  // Explicit Tailwind classes (no dynamic interpolation — required for purge safety)
  const accentBg = isArt
    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
    : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";

  const paintButtonDisabled = isPainting || (!painterObjective.trim() && !objective.trim() && !documentText.trim() && pinnedDocs.length === 0);

  // ═════════════════════════════════════════════════════════════════════
  // PANEL VARIANT
  // ═════════════════════════════════════════════════════════════════════
  if (isPanel) {
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
          <div className="flex items-center gap-1">
            {/* Studio fullscreen */}
            {onOpenStudio && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={onOpenStudio} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
                    <Maximize2 className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">Open Painter Studio</TooltipContent>
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
            <ContextSourcesIndicator
              isArt={isArt}
              hasDescription={hasDescription}
              hasDocument={hasDocument}
              hasContext={hasContext}
              descExcluded={descExcluded}
              docExcluded={docExcluded}
              ctxExcluded={ctxExcluded}
              pinnedDocsCount={pinnedDocs.length}
              accentBg={accentBg}
              toggleSource={toggleSource}
              variant="panel"
            />

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
              disabled={paintButtonDisabled}
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

  // ═════════════════════════════════════════════════════════════════════
  // STUDIO VARIANT (fullscreen overlay)
  // ═════════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" onClick={(e) => e.stopPropagation()}>
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0 bg-card">
        <div className="flex items-center gap-2">
          {isArt ? (
            <Paintbrush className="w-4 h-4 text-rose-500" />
          ) : (
            <BarChart3 className="w-4 h-4 text-indigo-500" />
          )}
          <span className="text-sm font-bold">Painter Studio</span>
          {totalSelected > 0 && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              isArt ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
            }`}>{totalSelected} configs</span>
          )}
          {activePreset && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium">
              {PRESETS.find((p) => p.id === activePreset)?.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex items-center gap-0.5 bg-muted/50 rounded-md p-0.5">
            <button
              onClick={() => setPainterMode("art")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                isArt ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Paintbrush className="w-3 h-3" />
              Art
            </button>
            <button
              onClick={() => setPainterMode("infographic")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                !isArt ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="w-3 h-3" />
              Infographic
            </button>
          </div>
          {onClose && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close Studio (Esc)</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ── Main Content: 3-column layout ── */}
      <div className="flex-1 flex min-h-0">
        {/* ── LEFT: Controls ── */}
        <div className="w-[340px] border-r flex flex-col shrink-0 bg-card/50">
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {/* Presets */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Quick Presets
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {filteredPresets.map((preset) => {
                    const Icon = preset.icon;
                    const isActive = activePreset === preset.id;
                    return (
                      <Tooltip key={preset.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => applyPreset(preset)}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left transition-all border ${
                              isActive
                                ? isArt
                                  ? "bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-400"
                                  : "bg-indigo-500/10 border-indigo-500/40 text-indigo-700 dark:text-indigo-400"
                                : "bg-muted/20 border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                            }`}
                          >
                            <Icon className="w-3 h-3 shrink-0" />
                            <span className="text-[10px] font-medium truncate">{preset.label}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-[10px] max-w-[200px]">{preset.description}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              {/* Prompt */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  {isArt ? "Image Description" : "Infographic Brief"}
                </label>
                <textarea
                  value={painterObjective}
                  onChange={(e) => setPainterObjective(e.target.value)}
                  placeholder={isArt ? "Describe what you want to see..." : "What story should this infographic tell?"}
                  rows={3}
                  className={`w-full text-xs rounded-md border bg-background px-2.5 py-2 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 resize-none ${
                    isArt ? "focus:ring-rose-500/50" : "focus:ring-indigo-500/50"
                  }`}
                />
              </div>

              {/* Negative prompt */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Negative Prompt
                </label>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="What to avoid in the image..."
                  rows={2}
                  className="w-full text-xs rounded-md border bg-background px-2.5 py-2 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-muted-foreground/30 resize-none"
                />
              </div>

              {/* Context Sources */}
              <ContextSourcesIndicator
                isArt={isArt}
                hasDescription={hasDescription}
                hasDocument={hasDocument}
                hasContext={hasContext}
                descExcluded={descExcluded}
                docExcluded={docExcluded}
                ctxExcluded={ctxExcluded}
                pinnedDocsCount={pinnedDocs.length}
                accentBg={accentBg}
                toggleSource={toggleSource}
                variant="studio"
              />

              {/* Style Configurations */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  {isArt ? "Style Configuration" : "Infographic Configuration"}
                </span>
                <div className="space-y-2.5">
                  {activeButtons.map((btn) => {
                    const selected = selections.get(btn.id);
                    return (
                      <div key={btn.id}>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70 block mb-1">
                          {btn.label}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {btn.options.map((opt) => {
                            const isActive = selected === opt.id;
                            return (
                              <Tooltip key={opt.id}>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => selectOption(btn.id, opt.id)}
                                    className={`px-2 py-1 rounded text-[10px] font-medium transition-all border ${
                                      isActive
                                        ? isArt
                                          ? "bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-400"
                                          : "bg-indigo-500/10 border-indigo-500/40 text-indigo-700 dark:text-indigo-400"
                                        : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-[10px] max-w-[180px]">{opt.description}</TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* System Instruction (collapsible) */}
              <div>
                <button
                  onClick={() => setShowSystem(!showSystem)}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showSystem ? <Minus className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                  <span className="font-bold uppercase tracking-wider">System Instruction</span>
                </button>
                {showSystem && (
                  <textarea
                    value={systemInstruction}
                    onChange={(e) => setSystemInstruction(e.target.value)}
                    placeholder="Optional system-level guidance for the image model (e.g. 'Always produce high-contrast images suitable for print')..."
                    rows={3}
                    className="w-full mt-1 text-xs rounded-md border bg-background px-2.5 py-2 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-muted-foreground/30 resize-none"
                  />
                )}
              </div>
            </div>
          </ScrollArea>

          {/* Paint Button */}
          <div className="px-3 py-2.5 border-t shrink-0 bg-card">
            <Button
              onClick={handlePaint}
              disabled={paintButtonDisabled}
              className={`w-full text-white gap-1.5 text-xs ${
                isArt ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"
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
              {isArt ? "Paint" : "Generate"}
              {numberOfImages > 1 ? ` (${numberOfImages}x)` : ""}
              {totalSelected > 0 ? ` — ${totalSelected} configs` : ""}
            </Button>
          </div>
        </div>

        {/* ── CENTER: Image Gallery ── */}
        <div className="flex-1 flex flex-col min-w-0 bg-neutral-950/5 dark:bg-neutral-950/40">
          {imageEntries.length === 0 && !isPainting ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-muted-foreground/60">
                {isArt ? (
                  <Paintbrush className="w-16 h-16" />
                ) : (
                  <BarChart3 className="w-16 h-16" />
                )}
                <div className="text-center">
                  <p className="text-sm font-medium">No images yet</p>
                  <p className="text-xs mt-1 max-w-[300px]">
                    Configure your settings, choose a preset, and click{" "}
                    <strong>{isArt ? "Paint" : "Generate"}</strong> to create
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {imageEntries.map(([id, data]) => (
                    <div key={id} className="rounded-lg border bg-card overflow-hidden group">
                      {data.isGenerating ? (
                        <div className="aspect-square flex items-center justify-center bg-muted/20">
                          <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
                            <span className="text-xs text-muted-foreground">Painting...</span>
                          </div>
                        </div>
                      ) : data.imageUrl ? (
                        <div className="relative">
                          <img
                            src={data.imageUrl}
                            alt={data.prompt || "Generated image"}
                            className="w-full object-contain"
                            draggable={false}
                          />
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="secondary" size="sm" className="h-6 w-6 p-0 bg-black/50 hover:bg-black/70 text-white" onClick={() => handleCopyImage(data.imageUrl!)}>
                              <Copy className="w-3 h-3" />
                            </Button>
                            <Button variant="secondary" size="sm" className="h-6 w-6 p-0 bg-black/50 hover:bg-black/70 text-white" onClick={() => handleDownloadImage(data.imageUrl!)}>
                              <Download className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      {data.prompt && (
                        <div className="px-3 py-2 border-t">
                          <p className="text-[10px] text-muted-foreground line-clamp-2" title={data.prompt}>{data.prompt}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* ── RIGHT: Advanced Controls ── */}
        <div className="w-[280px] border-l flex flex-col shrink-0 bg-card/50">
          <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
            <div className="flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">Advanced Controls</span>
            </div>
            <button
              onClick={() => setExpandedAdvanced(!expandedAdvanced)}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              {expandedAdvanced ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          </div>
          {expandedAdvanced && (
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-4">
                {/* Temperature */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Temperature</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{temperature.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[temperature]}
                    onValueChange={([v]) => setTemperature(v)}
                    min={0}
                    max={2}
                    step={0.05}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[8px] text-muted-foreground/50 mt-0.5">
                    <span>Precise</span>
                    <span>Creative</span>
                  </div>
                </div>

                {/* Top-P */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Top-P (Nucleus)</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{topP.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[topP]}
                    onValueChange={([v]) => setTopP(v)}
                    min={0}
                    max={1}
                    step={0.05}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[8px] text-muted-foreground/50 mt-0.5">
                    <span>Focused</span>
                    <span>Diverse</span>
                  </div>
                </div>

                {/* Top-K */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Top-K</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{topK}</span>
                  </div>
                  <Slider
                    value={[topK]}
                    onValueChange={([v]) => setTopK(v)}
                    min={1}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[8px] text-muted-foreground/50 mt-0.5">
                    <span>Conservative</span>
                    <span>Exploratory</span>
                  </div>
                </div>

                {/* Seed */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Seed</span>
                    <div className="flex items-center gap-1">
                      {seed !== null && (
                        <button
                          onClick={() => setSeed(null)}
                          className="text-[9px] text-muted-foreground hover:text-foreground"
                        >
                          Clear
                        </button>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={randomizeSeed}
                            className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Dice1 className="w-3 h-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px]">Randomize seed</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <input
                    type="number"
                    value={seed ?? ""}
                    onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Random (default)"
                    className="w-full text-[11px] rounded-md border bg-background px-2 py-1.5 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-muted-foreground/30"
                  />
                  <p className="text-[8px] text-muted-foreground/50 mt-0.5">Fixed seed = reproducible output</p>
                </div>

                {/* Number of Images */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Variations</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{numberOfImages}</span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        onClick={() => setNumberOfImages(n)}
                        className={`flex-1 py-1 rounded text-[10px] font-medium transition-all border ${
                          numberOfImages === n
                            ? isArt
                              ? "bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-400"
                              : "bg-indigo-500/10 border-indigo-500/40 text-indigo-700 dark:text-indigo-400"
                            : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/60"
                        }`}
                      >
                        {n}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Image Size */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    <Maximize className="w-3 h-3 inline mr-1" />
                    Output Resolution
                  </span>
                  <div className="flex gap-1">
                    {IMAGE_SIZES.map((s) => (
                      <Tooltip key={s.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setImageSize(s.id as "1K" | "2K" | "4K")}
                            className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-all border ${
                              imageSize === s.id
                                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                                : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/60"
                            }`}
                          >
                            {s.label}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px]">{s.desc}</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>

                {/* Person Generation */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    <Users className="w-3 h-3 inline mr-1" />
                    Person Generation
                  </span>
                  <div className="space-y-1">
                    {PERSON_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setPersonGeneration(opt.id as "all" | "adult" | "none")}
                        className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
                          personGeneration === opt.id
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full border-2 shrink-0 flex items-center justify-center ${
                          personGeneration === opt.id ? "border-amber-500" : "border-muted-foreground/30"
                        }`}>
                          {personGeneration === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-medium block">{opt.label}</span>
                          <span className="text-[8px] text-muted-foreground/60 block">{opt.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Safety Level */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    <Shield className="w-3 h-3 inline mr-1" />
                    Safety Filter
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {SAFETY_LEVELS.map((lvl) => (
                      <Tooltip key={lvl.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setSafetyLevel(lvl.id as typeof safetyLevel)}
                            className={`px-2 py-1 rounded text-[10px] font-medium transition-all border ${
                              safetyLevel === lvl.id
                                ? lvl.id === "off" || lvl.id === "none"
                                  ? "bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-400"
                                  : "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                                : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/60"
                            }`}
                          >
                            {lvl.label}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px]">{lvl.desc}</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SHARED SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

/** Context sources indicator — shared between panel and studio variants */
function ContextSourcesIndicator({
  isArt,
  hasDescription,
  hasDocument,
  hasContext,
  descExcluded,
  docExcluded,
  ctxExcluded,
  pinnedDocsCount,
  accentBg,
  toggleSource,
  variant,
}: {
  isArt: boolean;
  hasDescription: boolean;
  hasDocument: boolean;
  hasContext: boolean;
  descExcluded: boolean;
  docExcluded: boolean;
  ctxExcluded: boolean;
  pinnedDocsCount: number;
  accentBg: string;
  toggleSource: (source: PainterSource) => void;
  variant: "panel" | "studio";
}) {
  if (variant === "studio") {
    // Studio uses a compact loop-based renderer
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/20 bg-muted/20 px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Info className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Context Sources</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([
            { source: "description" as PainterSource, has: hasDescription, label: isArt ? "Description" : "Brief", icon: Target, color: isArt ? "rose" : "indigo" },
            { source: "document" as PainterSource, has: hasDocument, label: "Document", icon: FileText, color: "blue" },
            { source: "context" as PainterSource, has: hasContext, label: `Context${hasContext ? ` (${pinnedDocsCount})` : ""}`, icon: Pin, color: "cyan" },
          ] as const).map(({ source, has, label, icon: Icon, color }) => {
            const excluded = source === "description" ? descExcluded : source === "document" ? docExcluded : ctxExcluded;
            return (
              <Tooltip key={source}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => has && toggleSource(source)}
                    className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full transition-all ${
                      !has
                        ? "bg-muted/60 text-muted-foreground/50"
                        : excluded
                          ? "bg-muted/40 text-muted-foreground/40 line-through cursor-pointer"
                          : `bg-${color}-500/10 text-${color}-600 dark:text-${color}-400 cursor-pointer hover:opacity-80`
                    }`}
                  >
                    <Icon className="w-2.5 h-2.5" />
                    {label} {has ? "" : "(empty)"}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">
                  {!has ? `No ${source}` : excluded ? "Click to include" : "Click to exclude"}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  }

  // Panel variant — explicit per-source buttons with full Tailwind classes (purge-safe)
  return (
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
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => hasDescription && toggleSource("description")}
              className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full transition-all ${
                !hasDescription
                  ? "bg-muted/60 text-muted-foreground/50"
                  : descExcluded
                    ? "bg-muted/40 text-muted-foreground/40 line-through cursor-pointer"
                    : `${accentBg} cursor-pointer hover:opacity-80`
              }`}
            >
              <Target className="w-2.5 h-2.5" />
              {isArt ? "Description" : "Brief"} {hasDescription ? "" : "(empty)"}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-[10px]">
            {!hasDescription ? "No description provided" : descExcluded ? "Click to include in this paint call" : "Click to exclude from this paint call"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => hasDocument && toggleSource("document")}
              className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full transition-all ${
                !hasDocument
                  ? "bg-muted/60 text-muted-foreground/50"
                  : docExcluded
                    ? "bg-muted/40 text-muted-foreground/40 line-through cursor-pointer"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 cursor-pointer hover:opacity-80"
              }`}
            >
              <FileText className="w-2.5 h-2.5" />
              Document {hasDocument ? "" : "(empty)"}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-[10px]">
            {!hasDocument ? "No document content" : docExcluded ? "Click to include in this paint call" : "Click to exclude from this paint call"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => hasContext && toggleSource("context")}
              className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full transition-all ${
                !hasContext
                  ? "bg-muted/60 text-muted-foreground/50"
                  : ctxExcluded
                    ? "bg-muted/40 text-muted-foreground/40 line-through cursor-pointer"
                    : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 cursor-pointer hover:opacity-80"
              }`}
            >
              <Pin className="w-2.5 h-2.5" />
              Context {hasContext ? `(${pinnedDocsCount})` : "(none)"}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-[10px]">
            {!hasContext ? "No context pinned" : ctxExcluded ? "Click to include in this paint call" : "Click to exclude from this paint call"}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// VIEW MODE 1: Sliders — vertical radio groups per category (panel only)
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
// VIEW MODE 2: Cards — 2-column grid of tappable cards (panel only)
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
// VIEW MODE 3: Accordion — collapsible sections with inline lists (panel only)
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
