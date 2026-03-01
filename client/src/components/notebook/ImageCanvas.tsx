import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Download,
  Copy,
  ZoomIn,
  ZoomOut,
  Maximize,
  Paintbrush,
  Loader2,
  Save,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Zoom presets ─────────────────────────────────────────────
const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.5, 2] as const;

interface ImageCanvasProps {
  imageUrl: string | null;
  prompt: string;
  isGenerating: boolean;
  onSaveToContext?: (imageUrl: string, prompt: string) => void;
  isSaving?: boolean;
}

export function ImageCanvas({ imageUrl, prompt, isGenerating, onSaveToContext, isSaving }: ImageCanvasProps) {
  const { toast } = useToast();
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => {
      const nextIdx = ZOOM_LEVELS.findIndex((l) => l > z);
      return nextIdx >= 0 ? ZOOM_LEVELS[nextIdx] : z;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => {
      const levels = [...ZOOM_LEVELS];
      levels.reverse();
      const nextIdx = levels.findIndex((l) => l < z);
      return nextIdx >= 0 ? levels[nextIdx] : z;
    });
  }, []);

  const handleFit = useCallback(() => {
    setZoom(1);
  }, []);

  const handleDownload = useCallback(() => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `painter-${Date.now()}.png`;
    a.click();
  }, [imageUrl]);

  const handleCopy = useCallback(async () => {
    if (!imageUrl) return;
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast({ title: "Copied", description: "Image copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy image to clipboard", variant: "destructive" });
    }
  }, [imageUrl, toast]);

  return (
    <div className="flex flex-col h-full bg-neutral-950/5 dark:bg-neutral-950/40">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b shrink-0 bg-card">
        <div className="flex items-center gap-1">
          <Paintbrush className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Image</span>
        </div>

        {imageUrl && (
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleZoomOut}>
                  <ZoomOut className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom out</TooltipContent>
            </Tooltip>

            <span className="text-[10px] text-muted-foreground w-8 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleZoomIn}>
                  <ZoomIn className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom in</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleFit}>
                  <Maximize className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fit to view</TooltipContent>
            </Tooltip>

            <div className="w-px h-4 bg-border mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopy}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy image</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleDownload}>
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download image</TooltipContent>
            </Tooltip>

            {onSaveToContext && imageUrl && (
              <>
                <div className="w-px h-4 bg-border mx-1" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={isSaving}
                      onClick={() => onSaveToContext(imageUrl, prompt)}
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save to Context Store</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        )}
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 overflow-auto flex items-center justify-center min-h-0">
        {isGenerating ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
            <span className="text-sm">Painting...</span>
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={prompt || "Generated image"}
            className="transition-transform duration-200 object-contain max-w-full max-h-full"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
            draggable={false}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground/60">
            <Paintbrush className="w-12 h-12" />
            <div className="text-center">
              <p className="text-sm font-medium">No image yet</p>
              <p className="text-xs mt-1">Configure the Painter and click Paint</p>
            </div>
          </div>
        )}
      </div>

      {/* Prompt footer */}
      {prompt && (
        <div className="border-t px-3 py-1.5 shrink-0 bg-card">
          <p className="text-[10px] text-muted-foreground truncate" title={prompt}>
            {prompt}
          </p>
        </div>
      )}
    </div>
  );
}
