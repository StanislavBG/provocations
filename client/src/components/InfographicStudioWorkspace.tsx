import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { errorLogStore } from "@/lib/errorLog";
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
  Type,
  Sparkles,
  Upload,
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

/** Controls the LLM behaviour for the summary panel */
interface SummaryControls {
  tone: string;
  length: string;
  detailLevel: string;
}

/** One generated variant in the gallery */
interface InfographicVariant {
  id: string;
  label: string;
  temperature: number;
  imageUrl: string | null;
  revisedPrompt: string | null;
  isGenerating: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUDIENCE_OPTIONS = [
  { value: "general", label: "General Public" },
  { value: "executive", label: "Executives / C-Suite" },
  { value: "technical", label: "Technical Team" },
  { value: "marketing", label: "Marketing / Sales" },
  { value: "students", label: "Students / Educators" },
];

const VISUAL_STYLE_OPTIONS = [
  { value: "modern-minimal", label: "Modern Minimal" },
  { value: "corporate", label: "Corporate / Professional" },
  { value: "playful", label: "Playful / Colorful" },
  { value: "data-heavy", label: "Data-Heavy / Charts" },
  { value: "editorial", label: "Editorial / Magazine" },
];

const EMPHASIS_OPTIONS = [
  { value: "key-stats", label: "Key Statistics" },
  { value: "process-flow", label: "Process / Flow" },
  { value: "comparison", label: "Comparison" },
  { value: "timeline", label: "Timeline" },
  { value: "hierarchy", label: "Hierarchy" },
];

const TONE_OPTIONS = [
  { value: "neutral", label: "Neutral" },
  { value: "persuasive", label: "Persuasive" },
  { value: "analytical", label: "Analytical" },
  { value: "inspirational", label: "Inspirational" },
  { value: "urgent", label: "Urgent" },
];

const LENGTH_OPTIONS = [
  { value: "concise", label: "Concise" },
  { value: "balanced", label: "Balanced" },
  { value: "detailed", label: "Detailed" },
];

const DETAIL_OPTIONS = [
  { value: "high-level", label: "High-Level Overview" },
  { value: "moderate", label: "Moderate Detail" },
  { value: "granular", label: "Granular / In-depth" },
];

const DEFAULT_ENRICHMENT: EnrichmentOptions = {
  audience: "general",
  visualStyle: "modern-minimal",
  emphasis: "key-stats",
  includeDataPoints: true,
  includeCallToAction: false,
};

const DEFAULT_CONTROLS: SummaryControls = {
  tone: "neutral",
  length: "balanced",
  detailLevel: "moderate",
};

function makeVariants(): InfographicVariant[] {
  return [
    { id: "conservative", label: "Conservative", temperature: 0.3, imageUrl: null, revisedPrompt: null, isGenerating: false, error: null },
    { id: "balanced", label: "Balanced", temperature: 0.7, imageUrl: null, revisedPrompt: null, isGenerating: false, error: null },
    { id: "creative", label: "Creative", temperature: 1.2, imageUrl: null, revisedPrompt: null, isGenerating: false, error: null },
  ];
}

// ---------------------------------------------------------------------------
// Selector row helper
// ---------------------------------------------------------------------------

function OptionSelect({
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
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-medium">{label}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">
              <Info className="w-3 h-3 text-muted-foreground/60 hover:text-primary transition-colors" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-[240px]">
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-7 text-xs">
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
  /** Current raw text (synced with Workspace.tsx document) */
  rawText: string;
  onRawTextChange: (text: string) => void;
  /** The user's objective */
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

  // ── Middle panel state: summary + controls ──
  const [summaryText, setSummaryText] = useState("");
  const [controls, setControls] = useState<SummaryControls>(DEFAULT_CONTROLS);

  // ── Right panel state: 3 image variants ──
  const [variants, setVariants] = useState<InfographicVariant[]>(makeVariants);

  // ── Summary generation mutation ──
  const summarizeMutation = useMutation({
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

      const controlPrompt = [
        `Tone: ${TONE_OPTIONS.find((o) => o.value === controls.tone)?.label}`,
        `Length: ${LENGTH_OPTIONS.find((o) => o.value === controls.length)?.label}`,
        `Detail: ${DETAIL_OPTIONS.find((o) => o.value === controls.detailLevel)?.label}`,
      ].join(". ");

      const response = await apiRequest("POST", "/api/summarize-intent", {
        transcript: rawText,
        context: `infographic-summary`,
        systemOverride: `You are an infographic content specialist. Given the user's raw text, create a rich, expanded summary optimized for visual infographic generation.

ENRICHMENT CONTEXT: ${enrichmentPrompt}
OUTPUT CONTROLS: ${controlPrompt}
${objective ? `USER OBJECTIVE: ${objective}` : ""}

Your output should:
- Expand abbreviations and add context where the original is terse
- Organize content into clear sections with headers
- Highlight key statistics, quotes, and data points
- Structure the information for visual hierarchy (hero insight first, supporting details after)
- Include specific visual direction: suggested layout, color notes, icon suggestions
- Be detailed enough to generate a compelling infographic

Format as clean markdown with sections, bullet points, and emphasized key figures.`,
      });
      return (await response.json()) as SummarizeResponse;
    },
    onSuccess: (data) => {
      setSummaryText(data.summary);
      toast({ title: "Summary Generated", description: "Your text has been expanded into an infographic-ready summary." });
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Something went wrong";
      errorLogStore.push({ step: "Generate Summary", endpoint: "/api/summarize-intent", message: msg });
      toast({ title: "Summary Failed", description: msg, variant: "destructive" });
    },
  });

  // ── Image generation for a single variant ──
  const generateVariant = useCallback(
    async (variantId: string) => {
      const variant = variants.find((v) => v.id === variantId);
      if (!variant || !summaryText.trim()) return;

      setVariants((prev) =>
        prev.map((v) => (v.id === variantId ? { ...v, isGenerating: true, error: null } : v)),
      );

      try {
        const response = await apiRequest("POST", "/api/generate-image", {
          description: summaryText,
          temperature: variant.temperature,
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
    [variants, summaryText],
  );

  // ── Generate all 3 variants in parallel ──
  const generateAllVariants = useCallback(() => {
    if (!summaryText.trim()) {
      toast({ title: "No summary", description: "Generate a summary first before creating infographics.", variant: "destructive" });
      return;
    }
    variants.forEach((v) => generateVariant(v.id));
  }, [summaryText, variants, generateVariant, toast]);

  const handleDownload = useCallback((imageUrl: string, label: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `infographic-${label.toLowerCase()}-${Date.now()}.png`;
    link.click();
  }, []);

  /** Upload a text file and append its content to the raw text panel */
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

  const hasRawText = rawText.trim().length > 0;
  const hasSummary = summaryText.trim().length > 0;
  const anyGenerating = variants.some((v) => v.isGenerating);

  // =====================================================================
  // RENDER
  // =====================================================================

  return (
    <div className="flex-1 overflow-hidden">
      <ResizablePanelGroup direction="horizontal">
        {/* ── LEFT PANEL: Raw Text + Enrichment Options ── */}
        <ResizablePanel defaultSize={30} minSize={20}>
          <div className="h-full flex flex-col border-r">
            {/* Header with enrichment options */}
            <div className="shrink-0 border-b bg-muted/20">
              <div className="flex items-center gap-2 px-4 py-2.5">
                <FileText className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Raw Text</h3>
                <div className="ml-auto flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    <Upload className="w-3.5 h-3.5" />
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
                  <Badge variant="outline" className="text-[10px]">
                    {rawText.length} chars
                  </Badge>
                </div>
              </div>

              {/* Enrichment options — collapsed into a compact grid */}
              <div className="px-3 pb-3 space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  Enrichment Options
                </p>
                <div className="grid grid-cols-1 gap-2">
                  <OptionSelect
                    label="Audience"
                    tooltip="Who will view this infographic? Affects language complexity and focus."
                    value={enrichment.audience}
                    options={AUDIENCE_OPTIONS}
                    onChange={(v) => setEnrichment((e) => ({ ...e, audience: v }))}
                  />
                  <OptionSelect
                    label="Visual Style"
                    tooltip="The aesthetic direction for the infographic layout and color palette."
                    value={enrichment.visualStyle}
                    options={VISUAL_STYLE_OPTIONS}
                    onChange={(v) => setEnrichment((e) => ({ ...e, visualStyle: v }))}
                  />
                  <OptionSelect
                    label="Emphasis"
                    tooltip="What type of information should be most prominent in the infographic?"
                    value={enrichment.emphasis}
                    options={EMPHASIS_OPTIONS}
                    onChange={(v) => setEnrichment((e) => ({ ...e, emphasis: v }))}
                  />
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={enrichment.includeDataPoints}
                      onCheckedChange={(v) => setEnrichment((e) => ({ ...e, includeDataPoints: !!v }))}
                    />
                    <span className="text-xs text-muted-foreground">Highlight data points</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={enrichment.includeCallToAction}
                      onCheckedChange={(v) => setEnrichment((e) => ({ ...e, includeCallToAction: !!v }))}
                    />
                    <span className="text-xs text-muted-foreground">Include call to action</span>
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
                placeholder="Paste or type your raw content here — notes, bullet points, paragraphs, data dumps. The messier the better; the AI will structure it."
                showCopy
                showClear
                voice={{ mode: "append" }}
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ── MIDDLE PANEL: Summary + LLM Controls ── */}
        <ResizablePanel defaultSize={35} minSize={20}>
          <div className="h-full flex flex-col">
            {/* Header — mirrors the right panel header layout */}
            <div className="shrink-0 border-b bg-muted/20">
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Summary & Description</h3>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  onClick={() => summarizeMutation.mutate()}
                  disabled={!hasRawText || summarizeMutation.isPending}
                >
                  {summarizeMutation.isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Generating...
                    </>
                  ) : hasSummary ? (
                    <>
                      <RefreshCw className="w-3 h-3" />
                      Regenerate Summary
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3 h-3" />
                      Generate Summary
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Controls bar */}
            <div className="shrink-0 border-b px-3 py-3 space-y-2 bg-muted/10">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <Type className="w-3 h-3" />
                LLM Output Controls
              </p>
              <div className="grid grid-cols-3 gap-2">
                <OptionSelect
                  label="Tone"
                  tooltip="The overall voice of the expanded summary."
                  value={controls.tone}
                  options={TONE_OPTIONS}
                  onChange={(v) => setControls((c) => ({ ...c, tone: v }))}
                />
                <OptionSelect
                  label="Length"
                  tooltip="How verbose the summary should be."
                  value={controls.length}
                  options={LENGTH_OPTIONS}
                  onChange={(v) => setControls((c) => ({ ...c, length: v }))}
                />
                <OptionSelect
                  label="Detail"
                  tooltip="How deep into specifics the summary should go."
                  value={controls.detailLevel}
                  options={DETAIL_OPTIONS}
                  onChange={(v) => setControls((c) => ({ ...c, detailLevel: v }))}
                />
              </div>
            </div>

            {/* Summary text display */}
            <div className="flex-1 min-h-0">
              {hasSummary ? (
                <ProvokeText
                  chrome="bare"
                  variant="editor"
                  value={summaryText}
                  onChange={setSummaryText}
                  placeholder="Summary will appear here..."
                  showCopy
                  showClear={false}
                />
              ) : (
                <div className="h-full flex items-center justify-center p-6">
                  <div className="text-center space-y-3 max-w-xs">
                    <Wand2 className="w-10 h-10 text-muted-foreground/20 mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      {hasRawText
                        ? "Click \"Generate Summary\" to transform your raw text into a rich, infographic-ready description."
                        : "Enter raw text in the left panel, then generate a summary here."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ── RIGHT PANEL: Infographic Gallery (3 variants) ── */}
        <ResizablePanel defaultSize={35} minSize={20}>
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="shrink-0 border-b bg-muted/20">
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Infographic Gallery</h3>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  onClick={generateAllVariants}
                  disabled={!hasSummary || anyGenerating}
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

            {/* Gallery */}
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-4">
                {!hasSummary && (
                  <div className="text-center py-10 space-y-3">
                    <ImageIcon className="w-12 h-12 text-muted-foreground/20 mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      Generate a summary in the middle panel first, then create 3 infographic variants here.
                    </p>
                  </div>
                )}

                {hasSummary &&
                  variants.map((variant) => (
                    <div
                      key={variant.id}
                      className="rounded-xl border bg-card/80 overflow-hidden"
                    >
                      {/* Variant header */}
                      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold">{variant.label}</h4>
                          <Badge variant="outline" className="text-[10px]">
                            temp {variant.temperature}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          {variant.imageUrl && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleDownload(variant.imageUrl!, variant.label)}
                              title="Download"
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => generateVariant(variant.id)}
                            disabled={variant.isGenerating}
                            title="Regenerate"
                          >
                            {variant.isGenerating ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Variant content */}
                      <div className="p-2">
                        {variant.isGenerating && (
                          <div className="flex flex-col items-center justify-center py-8 gap-2">
                            <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
                            <p className="text-xs text-muted-foreground">
                              Generating {variant.label.toLowerCase()} variant...
                            </p>
                          </div>
                        )}

                        {variant.error && (
                          <div className="py-4 text-center">
                            <p className="text-xs text-destructive">{variant.error}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2 text-xs h-7"
                              onClick={() => generateVariant(variant.id)}
                            >
                              Retry
                            </Button>
                          </div>
                        )}

                        {variant.imageUrl && !variant.isGenerating && (
                          <div className="space-y-2">
                            <div className="rounded-lg overflow-hidden border bg-muted/10">
                              <img
                                src={variant.imageUrl}
                                alt={`${variant.label} infographic variant`}
                                className="w-full h-auto"
                              />
                            </div>
                            {variant.revisedPrompt && (
                              <p className="text-[10px] text-muted-foreground/70 leading-relaxed line-clamp-2 px-1">
                                {variant.revisedPrompt}
                              </p>
                            )}
                          </div>
                        )}

                        {!variant.imageUrl && !variant.isGenerating && !variant.error && (
                          <div className="flex flex-col items-center justify-center py-6 gap-2">
                            <ImageIcon className="w-6 h-6 text-muted-foreground/20" />
                            <p className="text-[10px] text-muted-foreground">
                              Click generate to create this variant
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Temperature slider for this variant */}
                      <div className="px-3 pb-2 pt-1 border-t">
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-[10px] text-muted-foreground">Temperature</Label>
                          <span className="text-[10px] font-mono text-muted-foreground">{variant.temperature}</span>
                        </div>
                        <Slider
                          value={[variant.temperature]}
                          min={0}
                          max={2}
                          step={0.1}
                          onValueChange={([v]) =>
                            setVariants((prev) =>
                              prev.map((p) => (p.id === variant.id ? { ...p, temperature: v } : p)),
                            )
                          }
                          className="w-full"
                        />
                      </div>
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
