import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Paintbrush,
  Image as ImageIcon,
  Loader2,
  X,
  Sparkles,
  RectangleHorizontal,
  Square,
  RectangleVertical,
  Download,
  Copy,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/tracking";

// ── Style presets ──────────────────────────────────────────
const STYLE_PRESETS = [
  { id: "realistic", label: "Realistic Photo", emoji: "📷" },
  { id: "watercolor", label: "Watercolor", emoji: "🎨" },
  { id: "illustration", label: "Illustration", emoji: "✏️" },
  { id: "3d-render", label: "3D Render", emoji: "🧊" },
  { id: "sketch", label: "Pencil Sketch", emoji: "✍️" },
  { id: "oil-painting", label: "Oil Painting", emoji: "🖼️" },
  { id: "flat-design", label: "Flat Design", emoji: "📐" },
  { id: "anime", label: "Anime", emoji: "🌸" },
  { id: "pixel-art", label: "Pixel Art", emoji: "👾" },
  { id: "infographic", label: "Infographic", emoji: "📊" },
] as const;

// ── Aspect ratio options ───────────────────────────────────
const ASPECT_RATIOS = [
  { id: "1:1", label: "1:1", icon: Square, description: "Square" },
  { id: "16:9", label: "16:9", icon: RectangleHorizontal, description: "Widescreen" },
  { id: "9:16", label: "9:16", icon: RectangleVertical, description: "Portrait" },
  { id: "4:3", label: "4:3", icon: RectangleHorizontal, description: "Standard" },
  { id: "3:4", label: "3:4", icon: RectangleVertical, description: "Tall" },
] as const;

// ── Mood options ───────────────────────────────────────────
const MOODS = [
  { id: "vibrant", label: "Vibrant" },
  { id: "moody", label: "Moody" },
  { id: "minimal", label: "Minimal" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "dramatic", label: "Dramatic" },
  { id: "serene", label: "Serene" },
  { id: "whimsical", label: "Whimsical" },
] as const;

interface ArtifyPanelProps {
  /** The source text to artify */
  sourceText: string;
  /** Label for the source (e.g. "Document" or "Transcript") */
  sourceLabel: string;
  /** Callback when panel should close */
  onClose: () => void;
  /** Callback when an image is generated — passes the data URL */
  onImageGenerated?: (imageUrl: string, prompt: string) => void;
}

export function ArtifyPanel({
  sourceText,
  sourceLabel,
  onClose,
  onImageGenerated,
}: ArtifyPanelProps) {
  const { toast } = useToast();

  // Controls state
  const [selectedStyle, setSelectedStyle] = useState<string>("realistic");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>("16:9");
  const [selectedMood, setSelectedMood] = useState<string>("vibrant");
  const [creativity, setCreativity] = useState<number[]>([50]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [numberOfImages, setNumberOfImages] = useState<number[]>([1]);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [usedPrompt, setUsedPrompt] = useState("");

  const handleGenerate = useCallback(async () => {
    if (!sourceText.trim() && !customPrompt.trim()) {
      toast({ title: "No content", description: "Provide source text or a custom prompt.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setGeneratedImages([]);

    try {
      // Build the style directive
      const styleName = STYLE_PRESETS.find((s) => s.id === selectedStyle)?.label || selectedStyle;
      const moodName = MOODS.find((m) => m.id === selectedMood)?.label || selectedMood;

      // If there's a custom prompt, use it directly; otherwise summarize the source
      let imagePrompt: string;
      if (customPrompt.trim()) {
        imagePrompt = customPrompt.trim();
      } else {
        // Use the LLM to distill the source text into a visual prompt
        const summaryRes = await apiRequest("POST", "/api/summarize-intent", {
          transcript: sourceText.slice(0, 8000),
          context: "visual",
          mode: "clean",
        });
        const summaryData = (await summaryRes.json()) as { summary?: string };
        imagePrompt = summaryData.summary || sourceText.slice(0, 500);
      }

      // Call Gemini Imagen
      const response = await apiRequest("POST", "/api/generate-imagen", {
        prompt: imagePrompt,
        style: `${styleName}, ${moodName} mood`,
        aspectRatio: selectedAspectRatio,
        negativePrompt: negativePrompt.trim() || undefined,
        numberOfImages: numberOfImages[0],
      });

      const data = (await response.json()) as { images?: string[]; error?: string };

      if (data.error && (!data.images || data.images.length === 0)) {
        toast({ title: "Generation issue", description: data.error, variant: "destructive" });
        return;
      }

      if (data.images && data.images.length > 0) {
        setGeneratedImages(data.images);
        setUsedPrompt(imagePrompt);
        if (onImageGenerated) {
          onImageGenerated(data.images[0], imagePrompt);
        }
        trackEvent("artify_generated", { metadata: { style: selectedStyle, aspectRatio: selectedAspectRatio, mood: selectedMood } });
      }
    } catch (error) {
      console.error("[artify] generation error:", error);
      toast({ title: "Generation failed", description: "Could not generate image. Check your API key.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [sourceText, customPrompt, selectedStyle, selectedAspectRatio, selectedMood, negativePrompt, numberOfImages, toast, onImageGenerated]);

  const handleDownload = useCallback((imageUrl: string, index: number) => {
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `artify-${selectedStyle}-${index + 1}.png`;
    a.click();
  }, [selectedStyle]);

  const handleCopyImage = useCallback(async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      toast({ title: "Copied", description: "Image copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy image to clipboard", variant: "destructive" });
    }
  }, [toast]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0 bg-purple-50/40 dark:bg-purple-950/10">
        <Paintbrush className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        <span className="text-sm font-semibold text-purple-900/80 dark:text-purple-200/80">Artify</span>
        <Badge variant="outline" className="text-[10px]">{sourceLabel}</Badge>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Style Presets */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Style</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {STYLE_PRESETS.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    selectedStyle === style.id
                      ? "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 ring-1 ring-purple-300 dark:ring-purple-700"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{style.emoji}</span>
                  <span>{style.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aspect Ratio</Label>
            <div className="flex gap-1.5">
              {ASPECT_RATIOS.map((ar) => {
                const Icon = ar.icon;
                return (
                  <Tooltip key={ar.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setSelectedAspectRatio(ar.id)}
                        className={`flex flex-col items-center gap-1 px-3 py-2 rounded-md text-xs transition-all flex-1 ${
                          selectedAspectRatio === ar.id
                            ? "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 ring-1 ring-purple-300 dark:ring-purple-700"
                            : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="font-medium">{ar.label}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{ar.description}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* Mood */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mood</Label>
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map((mood) => (
                <button
                  key={mood.id}
                  onClick={() => setSelectedMood(mood.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedMood === mood.id
                      ? "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 ring-1 ring-purple-300 dark:ring-purple-700"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mood.label}
                </button>
              ))}
            </div>
          </div>

          {/* Creativity slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Number of Images</Label>
              <span className="text-xs font-mono text-muted-foreground">{numberOfImages[0]}</span>
            </div>
            <Slider
              value={numberOfImages}
              onValueChange={setNumberOfImages}
              min={1}
              max={4}
              step={1}
              className="w-full"
            />
          </div>

          {/* Custom prompt modifier */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Custom Prompt <span className="normal-case font-normal">(overrides source text)</span>
            </Label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Optional: describe the image you want instead of using the source text..."
              className="w-full h-16 px-2.5 py-1.5 text-xs rounded-md border bg-background resize-none focus:ring-1 focus:ring-purple-300"
            />
          </div>

          {/* Negative prompt */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Negative Prompt <span className="normal-case font-normal">(what to exclude)</span>
            </Label>
            <input
              type="text"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="e.g. blurry, text, watermark, low quality..."
              className="w-full px-2.5 py-1.5 text-xs rounded-md border bg-background focus:ring-1 focus:ring-purple-300"
            />
          </div>

          {/* Generate button */}
          <Button
            className="w-full gap-2"
            onClick={handleGenerate}
            disabled={isGenerating || (!sourceText.trim() && !customPrompt.trim())}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Image
              </>
            )}
          </Button>

          {/* Generated images */}
          {generatedImages.length > 0 && (
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Generated</Label>
              {generatedImages.map((img, i) => (
                <div key={i} className="relative group rounded-lg overflow-hidden border bg-muted/20">
                  <img src={img} alt={`Generated ${i + 1}`} className="w-full h-auto" />
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-7 w-7 bg-background/80 backdrop-blur-sm"
                      onClick={() => handleCopyImage(img)}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-7 w-7 bg-background/80 backdrop-blur-sm"
                      onClick={() => handleDownload(img, i)}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {usedPrompt && (
                <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                  Prompt: {usedPrompt.slice(0, 200)}{usedPrompt.length > 200 ? "..." : ""}
                </p>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
