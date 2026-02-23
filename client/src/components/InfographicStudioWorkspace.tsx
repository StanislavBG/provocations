import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { errorLogStore } from "@/lib/errorLog";
import { generateId } from "@/lib/utils";
import { ProvokeText } from "@/components/ProvokeText";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  FileText,
  Wand2,
  Image as ImageIcon,
  Loader2,
  Download,
  RefreshCw,
  Info,
  Palette,
  LayoutGrid,
  Sparkles,
  Upload,
  BookOpen,
  PaintBucket,
  Library,
  SlidersHorizontal,
  Shuffle,
  Check,
  Plus,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenerateImageResponse {
  imageUrl: string;
  revisedPrompt?: string;
}

interface SummarizeResponse {
  summary: string;
}

/** Enrichment options that shape the summary generation */
interface EnrichmentOptions {
  audience: string;
  visualStyle: string;
  emphasis: string;
  includeDataPoints: boolean;
  includeCallToAction: boolean;
}

/** Fine-tunable image generation parameters */
interface ImageParams {
  aspectRatio: string;
  colorScheme: string;
  complexity: string;
  temperature: number;
}

/** One generated variant in the gallery */
interface InfographicVariant {
  id: string;
  label: string;
  params: ImageParams;
  imageUrl: string | null;
  revisedPrompt: string | null;
  isGenerating: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUDIENCE_OPTIONS = [
  { value: "general", label: "General" },
  { value: "executive", label: "Executive" },
  { value: "technical", label: "Technical" },
  { value: "marketing", label: "Marketing" },
  { value: "students", label: "Students" },
];

const VISUAL_STYLE_OPTIONS = [
  { value: "modern-minimal", label: "Minimal" },
  { value: "corporate", label: "Corporate" },
  { value: "playful", label: "Playful" },
  { value: "data-heavy", label: "Data-Heavy" },
  { value: "editorial", label: "Editorial" },
];

const EMPHASIS_OPTIONS = [
  { value: "key-stats", label: "Stats" },
  { value: "process-flow", label: "Process" },
  { value: "comparison", label: "Compare" },
  { value: "timeline", label: "Timeline" },
  { value: "hierarchy", label: "Hierarchy" },
];

/** Predefined artistic interpretation presets */
const ARTISTIC_PRESETS = [
  { value: "whiteboard", label: "Whiteboard", description: "Hand-drawn sketch style on white background" },
  { value: "education", label: "Education", description: "Clean educational diagrams with clear labels" },
  { value: "business", label: "Business", description: "Professional corporate infographic style" },
  { value: "professional", label: "Professional", description: "Polished, magazine-quality design" },
  { value: "creative", label: "Creative", description: "Bold colors, artistic flair, abstract elements" },
  { value: "technical", label: "Technical", description: "Blueprint-style with precise technical detail" },
];

const ASPECT_RATIO_OPTIONS = [
  { value: "1:1", label: "1:1 Square" },
  { value: "16:9", label: "16:9 Wide" },
  { value: "9:16", label: "9:16 Tall" },
  { value: "4:3", label: "4:3 Standard" },
];

const COLOR_SCHEME_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "warm", label: "Warm" },
  { value: "cool", label: "Cool" },
  { value: "monochrome", label: "Mono" },
  { value: "vibrant", label: "Vibrant" },
  { value: "pastel", label: "Pastel" },
];

const COMPLEXITY_OPTIONS = [
  { value: "simple", label: "Simple" },
  { value: "moderate", label: "Moderate" },
  { value: "detailed", label: "Detailed" },
];

const DEFAULT_ENRICHMENT: EnrichmentOptions = {
  audience: "general",
  visualStyle: "modern-minimal",
  emphasis: "key-stats",
  includeDataPoints: true,
  includeCallToAction: false,
};

const DEFAULT_PARAMS: ImageParams = {
  aspectRatio: "1:1",
  colorScheme: "auto",
  complexity: "moderate",
  temperature: 0.7,
};

function randomizeParams(base: ImageParams): ImageParams {
  const ratios = ASPECT_RATIO_OPTIONS.map((o) => o.value);
  const colors = COLOR_SCHEME_OPTIONS.map((o) => o.value);
  const complexities = COMPLEXITY_OPTIONS.map((o) => o.value);

  const pick = <T,>(arr: T[], exclude: T): T => {
    const filtered = arr.filter((x) => x !== exclude);
    return filtered[Math.floor(Math.random() * filtered.length)] ?? exclude;
  };

  return {
    aspectRatio: pick(ratios, base.aspectRatio),
    colorScheme: pick(colors, base.colorScheme),
    complexity: pick(complexities, base.complexity),
    temperature: Math.round((Math.random() * 1.4 + 0.3) * 10) / 10,
  };
}

function makeVariants(userParams: ImageParams): InfographicVariant[] {
  return [
    { id: "primary", label: "Your Config", params: { ...userParams }, imageUrl: null, revisedPrompt: null, isGenerating: false, error: null },
    { id: "variation-a", label: "Variation A", params: randomizeParams(userParams), imageUrl: null, revisedPrompt: null, isGenerating: false, error: null },
    { id: "variation-b", label: "Variation B", params: randomizeParams(userParams), imageUrl: null, revisedPrompt: null, isGenerating: false, error: null },
  ];
}

// ---------------------------------------------------------------------------
// Compact inline select helper
// ---------------------------------------------------------------------------

function CompactSelect({
  label,
  tooltip,
  value,
  options,
  onChange,
}: {
  label: string;
  tooltip: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <Label className="text-[10px] font-medium text-muted-foreground shrink-0 cursor-help">{label}</Label>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px]">
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-6 text-[10px] min-w-0 px-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface InfographicStudioWorkspaceProps {
  rawText: string;
  onRawTextChange: (text: string) => void;
  objective: string;
}

export function InfographicStudioWorkspace({
  rawText,
  onRawTextChange,
  objective,
}: InfographicStudioWorkspaceProps) {
  const { toast } = useToast();

  // ── Left panel state: enrichment options ──
  const [enrichment, setEnrichment] = useState<EnrichmentOptions>(DEFAULT_ENRICHMENT);

  // ── Panel 2 state: Clean summary + context ──
  const [cleanSummary, setCleanSummary] = useState("");
  const [summaryContext, setSummaryContext] = useState("");
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [loadingDocId, setLoadingDocId] = useState<number | null>(null);
  const [loadedDocIds, setLoadedDocIds] = useState<Set<number>>(new Set());

  // ── Panel 3 state: Artistic summary + presets ──
  const [artisticSummary, setArtisticSummary] = useState("");
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set(["business"]));
  const [artisticContext, setArtisticContext] = useState("");

  // ── Right panel state: image params + 3 variants ──
  const [userParams, setUserParams] = useState<ImageParams>(DEFAULT_PARAMS);
  const [variants, setVariants] = useState<InfographicVariant[]>(() => makeVariants(DEFAULT_PARAMS));

  // ── Context store documents ──
  const { data: savedDocs, isLoading: isLoadingDocs } = useQuery<{ documents: { id: number; title: string; updatedAt: string }[] }>({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/documents");
      return res.json();
    },
    enabled: showStorePicker,
    staleTime: 30_000,
  });

  // ── Load document from store into summary context ──
  const handleLoadStoreDoc = useCallback(async (docId: number, docTitle: string) => {
    setLoadingDocId(docId);
    try {
      const res = await apiRequest("GET", `/api/documents/${docId}`);
      const data = await res.json();
      if (data.content) {
        const prefix = summaryContext ? summaryContext + "\n\n---\n\n" : "";
        setSummaryContext(prefix + `[Context from "${docTitle}"]\n${data.content}`);
        setLoadedDocIds((prev) => new Set(prev).add(docId));
        toast({ title: "Context loaded", description: `"${docTitle}" added to summary context.` });
      }
    } catch {
      toast({ title: "Failed to load", description: "Could not load the document.", variant: "destructive" });
    } finally {
      setLoadingDocId(null);
    }
  }, [summaryContext, toast]);

  // ── Clean summary generation (Panel 2) ──
  const cleanSummaryMutation = useMutation({
    mutationFn: async () => {
      if (!rawText.trim()) throw new Error("No raw text to summarize");

      const enrichmentPrompt = [
        `Audience: ${AUDIENCE_OPTIONS.find((o) => o.value === enrichment.audience)?.label}`,
        `Visual style: ${VISUAL_STYLE_OPTIONS.find((o) => o.value === enrichment.visualStyle)?.label}`,
        `Emphasis: ${EMPHASIS_OPTIONS.find((o) => o.value === enrichment.emphasis)?.label}`,
        enrichment.includeDataPoints ? "Include specific data points and statistics" : "",
        enrichment.includeCallToAction ? "Include a clear call to action" : "",
      ]
        .filter(Boolean)
        .join(". ");

      const contextBlock = summaryContext.trim()
        ? `\n\nADDITIONAL CONTEXT (use this to focus and enrich the summary):\n${summaryContext}`
        : "";

      const response = await apiRequest("POST", "/api/summarize-intent", {
        transcript: rawText,
        context: "infographic-clean-summary",
        systemOverride: `You are a precise journalistic summarizer. Given the user's raw text, create a clean, factual summary that highlights the main points, key data, and core narrative.

ENRICHMENT CONTEXT: ${enrichmentPrompt}
${objective ? `USER OBJECTIVE: ${objective}` : ""}${contextBlock}

Your output should:
- Provide a clean, journalistic description of the content
- Highlight main points, key facts, statistics, and quotes
- Organize information in logical narrative order
- Be factual and objective — no artistic interpretation yet
- Use clear section headers and bullet points where helpful
- Preserve all important data points and relationships

Format as clean markdown. This summary will be used as the factual foundation for artistic infographic generation.`,
      });
      return (await response.json()) as SummarizeResponse;
    },
    onSuccess: (data) => {
      setCleanSummary(data.summary);
      toast({ title: "Clean Summary Generated", description: "Factual summary ready. Now generate the artistic interpretation." });
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Something went wrong";
      errorLogStore.push({ step: "Clean Summary", endpoint: "/api/summarize-intent", message: msg });
      toast({ title: "Summary Failed", description: msg, variant: "destructive" });
    },
  });

  // ── Artistic summary generation (Panel 3) ──
  const artisticSummaryMutation = useMutation({
    mutationFn: async () => {
      if (!cleanSummary.trim()) throw new Error("Generate a clean summary first");

      const presetNames = Array.from(selectedPresets)
        .map((p) => ARTISTIC_PRESETS.find((a) => a.value === p))
        .filter(Boolean)
        .map((p) => `${p!.label}: ${p!.description}`)
        .join("\n- ");

      const artisticBlock = artisticContext.trim()
        ? `\n\nCUSTOM ARTISTIC DIRECTION:\n${artisticContext}`
        : "";

      const response = await apiRequest("POST", "/api/summarize-intent", {
        transcript: cleanSummary,
        context: "infographic-artistic-summary",
        systemOverride: `You are an expert infographic art director. Transform the provided factual summary into a vivid, visually-descriptive infographic specification.

ARTISTIC STYLE PRESETS:
- ${presetNames || "Business: Professional corporate infographic style"}${artisticBlock}

Your output should:
- Rewrite the factual content with visual storytelling language
- Describe specific visual elements: layout sections, icon suggestions, color notes
- Add visual hierarchy direction (hero insight first, supporting details after)
- Include suggested infographic sections (4-7) with visual treatment for each
- Specify visual flow, emphasis areas, and decorative elements
- Blend the factual data with the artistic style direction
- Make the description detailed enough for an image generation model

Format as rich markdown with visual direction embedded throughout. This output will be sent directly to an image generation model.`,
      });
      return (await response.json()) as SummarizeResponse;
    },
    onSuccess: (data) => {
      setArtisticSummary(data.summary);
      toast({ title: "Artistic Summary Generated", description: "Visual specification ready for infographic generation." });
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Something went wrong";
      errorLogStore.push({ step: "Artistic Summary", endpoint: "/api/summarize-intent", message: msg });
      toast({ title: "Artistic Summary Failed", description: msg, variant: "destructive" });
    },
  });

  // ── Image generation for a single variant ──
  const generateVariant = useCallback(
    async (variantId: string) => {
      const variant = variants.find((v) => v.id === variantId);
      if (!variant || !artisticSummary.trim()) return;

      setVariants((prev) =>
        prev.map((v) => (v.id === variantId ? { ...v, isGenerating: true, error: null } : v)),
      );

      try {
        const paramDesc = `Style: ${variant.params.colorScheme} colors, ${variant.params.complexity} complexity, ${variant.params.aspectRatio} aspect ratio.`;
        const response = await apiRequest("POST", "/api/generate-image", {
          description: `${artisticSummary}\n\n${paramDesc}`,
          temperature: variant.params.temperature,
        });
        const data = (await response.json()) as GenerateImageResponse;
        setVariants((prev) =>
          prev.map((v) =>
            v.id === variantId
              ? { ...v, imageUrl: data.imageUrl, revisedPrompt: data.revisedPrompt ?? null, isGenerating: false }
              : v,
          ),
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Generation failed";
        errorLogStore.push({ step: `Generate Image (${variant.label})`, endpoint: "/api/generate-image", message: msg });
        setVariants((prev) =>
          prev.map((v) =>
            v.id === variantId
              ? { ...v, error: msg, isGenerating: false }
              : v,
          ),
        );
      }
    },
    [variants, artisticSummary],
  );

  // ── Generate all 3 variants: primary uses user params, others get randomized ──
  const generateAllVariants = useCallback(() => {
    if (!artisticSummary.trim()) {
      toast({ title: "No artistic summary", description: "Generate an artistic summary first.", variant: "destructive" });
      return;
    }
    const newVariants = [
      { ...variants[0], params: { ...userParams } },
      { ...variants[1], params: randomizeParams(userParams) },
      { ...variants[2], params: randomizeParams(userParams) },
    ];
    setVariants(newVariants);
    // Trigger generation after state update
    setTimeout(() => {
      newVariants.forEach((v) => generateVariant(v.id));
    }, 0);
  }, [artisticSummary, variants, userParams, generateVariant, toast]);

  const handleDownload = useCallback((imageUrl: string, label: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `infographic-${label.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.png`;
    link.click();
  }, []);

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === "string" && content.trim()) {
        onRawTextChange(rawText ? rawText + "\n\n" + content : content);
        toast({ title: "File loaded", description: `"${file.name}" added to raw text.` });
      }
    };
    reader.readAsText(file);
  }, [rawText, onRawTextChange, toast]);

  const togglePreset = useCallback((preset: string) => {
    setSelectedPresets((prev) => {
      const next = new Set(prev);
      if (next.has(preset)) {
        next.delete(preset);
      } else {
        next.add(preset);
      }
      return next;
    });
  }, []);

  const hasRawText = rawText.trim().length > 0;
  const hasCleanSummary = cleanSummary.trim().length > 0;
  const hasArtisticSummary = artisticSummary.trim().length > 0;
  const anyGenerating = variants.some((v) => v.isGenerating);

  // =====================================================================
  // RENDER
  // =====================================================================

  return (
    <div className="flex-1 overflow-hidden">
      <ResizablePanelGroup direction="horizontal">
        {/* ── PANEL 1: Raw Text + Compact Enrichment ── */}
        <ResizablePanel defaultSize={22} minSize={15}>
          <div className="h-full flex flex-col border-r">
            {/* Compact header with enrichment inline */}
            <div className="shrink-0 border-b bg-muted/20">
              <div className="flex items-center gap-2 px-3 py-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <h3 className="text-xs font-semibold">Raw Text</h3>
                <div className="ml-auto flex items-center gap-1.5">
                  <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    <Upload className="w-3 h-3" />
                    Upload
                    <input
                      type="file"
                      accept=".txt,.md,.text,.csv,.json,.xml,.yaml,.yml,.toml"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    {rawText.length}
                  </Badge>
                </div>
              </div>

              {/* Compact enrichment — single row of selects + checkboxes */}
              <div className="px-2 pb-2 space-y-1.5">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  Enrichment
                </p>
                <div className="grid grid-cols-3 gap-1">
                  <CompactSelect
                    label="Aud"
                    tooltip="Target audience"
                    value={enrichment.audience}
                    options={AUDIENCE_OPTIONS}
                    onChange={(v) => setEnrichment((e) => ({ ...e, audience: v }))}
                  />
                  <CompactSelect
                    label="Style"
                    tooltip="Visual style direction"
                    value={enrichment.visualStyle}
                    options={VISUAL_STYLE_OPTIONS}
                    onChange={(v) => setEnrichment((e) => ({ ...e, visualStyle: v }))}
                  />
                  <CompactSelect
                    label="Focus"
                    tooltip="Information emphasis"
                    value={enrichment.emphasis}
                    options={EMPHASIS_OPTIONS}
                    onChange={(v) => setEnrichment((e) => ({ ...e, emphasis: v }))}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <Checkbox
                      className="h-3 w-3"
                      checked={enrichment.includeDataPoints}
                      onCheckedChange={(v) => setEnrichment((e) => ({ ...e, includeDataPoints: !!v }))}
                    />
                    <span className="text-[9px] text-muted-foreground">Data points</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <Checkbox
                      className="h-3 w-3"
                      checked={enrichment.includeCallToAction}
                      onCheckedChange={(v) => setEnrichment((e) => ({ ...e, includeCallToAction: !!v }))}
                    />
                    <span className="text-[9px] text-muted-foreground">CTA</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Raw text editor */}
            <div className="flex-1 min-h-0">
              <ProvokeText
                chrome="bare"
                variant="editor"
                value={rawText}
                onChange={onRawTextChange}
                placeholder="Paste or type raw content — notes, transcripts, data dumps. The messier the better."
                showCopy
                showClear
                voice={{ mode: "append" }}
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ── PANEL 2: Clean Summary + Context ── */}
        <ResizablePanel defaultSize={26} minSize={18}>
          <div className="h-full flex flex-col">
            {/* Header with generate button */}
            <div className="shrink-0 border-b bg-muted/20">
              <div className="flex items-center justify-between px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  <h3 className="text-xs font-semibold">Clean Summary</h3>
                </div>
                <Button
                  size="sm"
                  className="gap-1 text-[10px] h-6 px-2"
                  onClick={() => cleanSummaryMutation.mutate()}
                  disabled={!hasRawText || cleanSummaryMutation.isPending}
                >
                  {cleanSummaryMutation.isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Generating...
                    </>
                  ) : hasCleanSummary ? (
                    <>
                      <RefreshCw className="w-3 h-3" />
                      Regenerate
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3 h-3" />
                      Summarize
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Context input area */}
            <div className="shrink-0 border-b bg-muted/10">
              <div className="px-3 py-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Focus Context (optional)
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-[10px] px-1.5 gap-1"
                    onClick={() => setShowStorePicker(!showStorePicker)}
                  >
                    <Library className="w-3 h-3" />
                    Store
                  </Button>
                </div>
                {showStorePicker && (
                  <div className="border rounded-md bg-background p-1.5 max-h-24 overflow-y-auto space-y-0.5">
                    {isLoadingDocs && (
                      <p className="text-[10px] text-muted-foreground px-1">Loading documents...</p>
                    )}
                    {savedDocs?.documents?.length === 0 && (
                      <p className="text-[10px] text-muted-foreground px-1">No saved documents</p>
                    )}
                    {savedDocs?.documents?.map((doc) => (
                      <button
                        key={doc.id}
                        className="w-full text-left px-1.5 py-0.5 rounded text-[10px] hover:bg-muted/50 flex items-center justify-between gap-1"
                        onClick={() => handleLoadStoreDoc(doc.id, doc.title)}
                        disabled={loadingDocId === doc.id}
                      >
                        <span className="truncate">{doc.title}</span>
                        {loadedDocIds.has(doc.id) ? (
                          <Check className="w-3 h-3 text-green-500 shrink-0" />
                        ) : loadingDocId === doc.id ? (
                          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                        ) : (
                          <Plus className="w-3 h-3 text-muted-foreground shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  className="w-full text-[11px] bg-transparent border rounded-md px-2 py-1 resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  rows={2}
                  placeholder="Add context to focus the summary (e.g. 'focus on revenue metrics' or 'highlight team decisions')..."
                  value={summaryContext}
                  onChange={(e) => setSummaryContext(e.target.value)}
                />
              </div>
            </div>

            {/* Clean summary display */}
            <div className="flex-1 min-h-0">
              {hasCleanSummary ? (
                <ProvokeText
                  chrome="bare"
                  variant="editor"
                  value={cleanSummary}
                  onChange={setCleanSummary}
                  placeholder="Clean summary will appear here..."
                  showCopy
                  showClear={false}
                />
              ) : (
                <div className="h-full flex items-center justify-center p-4">
                  <div className="text-center space-y-2 max-w-[180px]">
                    <BookOpen className="w-8 h-8 text-muted-foreground/15 mx-auto" />
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {hasRawText
                        ? 'Click "Summarize" to extract a clean, factual summary from your raw text.'
                        : "Enter raw text in the left panel first."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ── PANEL 3: Artistic Summary + Presets ── */}
        <ResizablePanel defaultSize={26} minSize={18}>
          <div className="h-full flex flex-col">
            {/* Header with generate button */}
            <div className="shrink-0 border-b bg-muted/20">
              <div className="flex items-center justify-between px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <PaintBucket className="w-3.5 h-3.5 text-primary" />
                  <h3 className="text-xs font-semibold">Artistic Summary</h3>
                </div>
                <Button
                  size="sm"
                  className="gap-1 text-[10px] h-6 px-2"
                  onClick={() => artisticSummaryMutation.mutate()}
                  disabled={!hasCleanSummary || artisticSummaryMutation.isPending}
                >
                  {artisticSummaryMutation.isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Generating...
                    </>
                  ) : hasArtisticSummary ? (
                    <>
                      <RefreshCw className="w-3 h-3" />
                      Regenerate
                    </>
                  ) : (
                    <>
                      <PaintBucket className="w-3 h-3" />
                      Artify
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Artistic presets + custom context */}
            <div className="shrink-0 border-b bg-muted/10">
              <div className="px-3 py-2 space-y-1.5">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Artistic Interpretation
                </p>
                <div className="flex flex-wrap gap-1">
                  {ARTISTIC_PRESETS.map((preset) => (
                    <Tooltip key={preset.value}>
                      <TooltipTrigger asChild>
                        <button
                          className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                            selectedPresets.has(preset.value)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:border-primary/50"
                          }`}
                          onClick={() => togglePreset(preset.value)}
                        >
                          {preset.label}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[200px]">
                        <p className="text-xs">{preset.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
                <textarea
                  className="w-full text-[11px] bg-transparent border rounded-md px-2 py-1 resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  rows={2}
                  placeholder="Custom artistic direction (e.g. 'use warm earth tones, hand-drawn icons, emphasize human connection')..."
                  value={artisticContext}
                  onChange={(e) => setArtisticContext(e.target.value)}
                />
              </div>
            </div>

            {/* Artistic summary display */}
            <div className="flex-1 min-h-0">
              {hasArtisticSummary ? (
                <ProvokeText
                  chrome="bare"
                  variant="editor"
                  value={artisticSummary}
                  onChange={setArtisticSummary}
                  placeholder="Artistic summary will appear here..."
                  showCopy
                  showClear={false}
                />
              ) : (
                <div className="h-full flex items-center justify-center p-4">
                  <div className="text-center space-y-2 max-w-[180px]">
                    <PaintBucket className="w-8 h-8 text-muted-foreground/15 mx-auto" />
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {hasCleanSummary
                        ? 'Select artistic presets and click "Artify" to create a visual specification.'
                        : "Generate a clean summary in Panel 2 first."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ── PANEL 4: Infographic Gallery with Fine-tune Params ── */}
        <ResizablePanel defaultSize={26} minSize={18}>
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="shrink-0 border-b bg-muted/20">
              <div className="flex items-center justify-between px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-primary" />
                  <h3 className="text-xs font-semibold">Gallery</h3>
                </div>
                <Button
                  size="sm"
                  className="gap-1 text-[10px] h-6 px-2"
                  onClick={generateAllVariants}
                  disabled={!hasArtisticSummary || anyGenerating}
                >
                  {anyGenerating ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <LayoutGrid className="w-3 h-3" />
                      Generate All 3
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Fine-tune parameters (user controls for primary image) */}
            <div className="shrink-0 border-b bg-muted/10">
              <div className="px-3 py-2 space-y-1.5">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                  <SlidersHorizontal className="w-2.5 h-2.5" />
                  Image Parameters
                </p>
                <div className="grid grid-cols-3 gap-1">
                  <CompactSelect
                    label="Ratio"
                    tooltip="Image aspect ratio"
                    value={userParams.aspectRatio}
                    options={ASPECT_RATIO_OPTIONS}
                    onChange={(v) => setUserParams((p) => ({ ...p, aspectRatio: v }))}
                  />
                  <CompactSelect
                    label="Color"
                    tooltip="Color scheme"
                    value={userParams.colorScheme}
                    options={COLOR_SCHEME_OPTIONS}
                    onChange={(v) => setUserParams((p) => ({ ...p, colorScheme: v }))}
                  />
                  <CompactSelect
                    label="Detail"
                    tooltip="Visual complexity level"
                    value={userParams.complexity}
                    options={COMPLEXITY_OPTIONS}
                    onChange={(v) => setUserParams((p) => ({ ...p, complexity: v }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[9px] text-muted-foreground shrink-0">Temp</Label>
                  <Slider
                    value={[userParams.temperature]}
                    min={0}
                    max={2}
                    step={0.1}
                    onValueChange={([v]) => setUserParams((p) => ({ ...p, temperature: v }))}
                    className="flex-1"
                  />
                  <span className="text-[9px] font-mono text-muted-foreground w-6 text-right">{userParams.temperature}</span>
                </div>
                <p className="text-[9px] text-muted-foreground/60 flex items-center gap-1">
                  <Shuffle className="w-2.5 h-2.5" />
                  Variations B & C auto-randomize from your settings
                </p>
              </div>
            </div>

            {/* Gallery */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-3">
                {!hasArtisticSummary && (
                  <div className="text-center py-8 space-y-2">
                    <ImageIcon className="w-10 h-10 text-muted-foreground/15 mx-auto" />
                    <p className="text-[11px] text-muted-foreground">
                      Generate an artistic summary first, then create infographics here.
                    </p>
                  </div>
                )}

                {hasArtisticSummary &&
                  variants.map((variant, idx) => (
                    <div
                      key={variant.id}
                      className="rounded-lg border bg-card/80 overflow-hidden"
                    >
                      {/* Variant header */}
                      <div className="flex items-center justify-between px-2.5 py-1.5 border-b bg-muted/30">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-[10px] font-semibold">{variant.label}</h4>
                          {idx === 0 ? (
                            <Badge variant="outline" className="text-[8px] px-1 py-0">
                              Your config
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[8px] px-1 py-0">
                              <Shuffle className="w-2 h-2 mr-0.5" />
                              Randomized
                            </Badge>
                          )}
                          <span className="text-[8px] font-mono text-muted-foreground">
                            t={variant.params.temperature}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {variant.imageUrl && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => handleDownload(variant.imageUrl!, variant.label)}
                              title="Download"
                            >
                              <Download className="w-2.5 h-2.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => generateVariant(variant.id)}
                            disabled={variant.isGenerating}
                            title="Regenerate"
                          >
                            {variant.isGenerating ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-2.5 h-2.5" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Variant content */}
                      <div className="p-1.5">
                        {variant.isGenerating && (
                          <div className="flex flex-col items-center justify-center py-6 gap-1.5">
                            <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
                            <p className="text-[10px] text-muted-foreground">
                              Generating {variant.label.toLowerCase()}...
                            </p>
                          </div>
                        )}

                        {variant.error && (
                          <div className="py-3 text-center">
                            <p className="text-[10px] text-destructive">{variant.error}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-1.5 text-[10px] h-6"
                              onClick={() => generateVariant(variant.id)}
                            >
                              Retry
                            </Button>
                          </div>
                        )}

                        {variant.imageUrl && !variant.isGenerating && (
                          <div className="space-y-1">
                            <div className="rounded overflow-hidden border bg-muted/10">
                              <img
                                src={variant.imageUrl}
                                alt={`${variant.label} infographic variant`}
                                className="w-full h-auto"
                              />
                            </div>
                            {variant.revisedPrompt && (
                              <p className="text-[9px] text-muted-foreground/60 leading-relaxed line-clamp-2 px-0.5">
                                {variant.revisedPrompt}
                              </p>
                            )}
                          </div>
                        )}

                        {!variant.imageUrl && !variant.isGenerating && !variant.error && (
                          <div className="flex flex-col items-center justify-center py-4 gap-1.5">
                            <ImageIcon className="w-5 h-5 text-muted-foreground/15" />
                            <p className="text-[9px] text-muted-foreground">
                              Click generate to create
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Param summary for non-primary variants */}
                      {idx > 0 && (
                        <div className="px-2.5 pb-1.5 pt-0.5 border-t">
                          <p className="text-[8px] text-muted-foreground/60">
                            {variant.params.aspectRatio} · {variant.params.colorScheme} · {variant.params.complexity}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
