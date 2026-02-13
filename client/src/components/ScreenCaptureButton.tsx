import { useState, useCallback, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Camera, Send, X, Loader2, Trash2, MousePointer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProvokeText } from "@/components/ProvokeText";

export interface CaptureRegion {
  number: number;
  /** Rectangle in natural (original image) coordinates */
  rect: { x: number; y: number; width: number; height: number };
  narration: string;
}

interface ScreenCaptureButtonProps {
  /** Called with the annotated base64 image and region details */
  onCapture: (imageDataUrl: string, regions: CaptureRegion[]) => void;
  disabled?: boolean;
}

/**
 * Multi-step screen capture:
 * 1. Captures the current app state as a screenshot
 * 2. Full-screen annotator where user draws numbered rectangular regions
 * 3. User adds narration per region
 * 4. Fires onCapture with annotated image + region data
 */
export function ScreenCaptureButton({
  onCapture,
  disabled,
}: ScreenCaptureButtonProps) {
  const { toast } = useToast();
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [regions, setRegions] = useState<CaptureRegion[]>([]);
  const [showAnnotator, setShowAnnotator] = useState(false);

  // Drawing state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const annotationsEndRef = useRef<HTMLDivElement>(null);

  // ─── Capture ──────────────────────────────────────────────────────────

  const handleCapture = useCallback(async () => {
    setIsCapturing(true);
    try {
      const target = document.body;

      // Resolve computed background color to avoid html2canvas failing
      // on CSS custom properties (hsl vars, oklch, etc.)
      const computedBg = getComputedStyle(target).backgroundColor;

      const canvas = await html2canvas(target, {
        useCORS: true,
        allowTaint: true,
        scale: 1,
        logging: false,
        backgroundColor: computedBg || "#ffffff",
      });

      const dataUrl = canvas.toDataURL("image/png");
      setCapturedImage(dataUrl);
      setRegions([]);
      setShowAnnotator(true);

      // Pre-load the image element for canvas rendering
      const img = new Image();
      img.onload = () => setImageEl(img);
      img.src = dataUrl;
    } catch (error) {
      console.error("Screen capture failed:", error);
      toast({
        title: "Capture Failed",
        description: "Could not capture the screen. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCapturing(false);
    }
  }, [toast]);

  // ─── Coordinate mapping ───────────────────────────────────────────────

  const getScale = useCallback(() => {
    const img = imageRef.current;
    if (!img || !imageEl) return { sx: 1, sy: 1 };
    return {
      sx: imageEl.naturalWidth / img.clientWidth,
      sy: imageEl.naturalHeight / img.clientHeight,
    };
  }, [imageEl]);

  const displayToNatural = useCallback(
    (dx: number, dy: number) => {
      const { sx, sy } = getScale();
      return { x: dx * sx, y: dy * sy };
    },
    [getScale],
  );

  const naturalToDisplay = useCallback(
    (nx: number, ny: number) => {
      const { sx, sy } = getScale();
      return { x: nx / sx, y: ny / sy };
    },
    [getScale],
  );

  // ─── Canvas rendering ─────────────────────────────────────────────────

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    // Match canvas pixel buffer to its CSS display size (retina-aware)
    const dpr = window.devicePixelRatio || 1;
    const w = img.clientWidth;
    const h = img.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Draw existing regions
    regions.forEach((region) => {
      const tl = naturalToDisplay(region.rect.x, region.rect.y);
      const br = naturalToDisplay(
        region.rect.x + region.rect.width,
        region.rect.y + region.rect.height,
      );
      const rw = br.x - tl.x;
      const rh = br.y - tl.y;

      // Rectangle stroke + fill
      ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(tl.x, tl.y, rw, rh);
      ctx.fillStyle = "rgba(239, 68, 68, 0.08)";
      ctx.fillRect(tl.x, tl.y, rw, rh);

      // Number badge (circle)
      const badgeR = 12;
      const bx = tl.x + badgeR + 2;
      const by = tl.y + badgeR + 2;
      ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
      ctx.beginPath();
      ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(region.number), bx, by);
    });

    // Draw current drag preview
    if (isDragging && dragStart && dragEnd) {
      const x = Math.min(dragStart.x, dragEnd.x);
      const y = Math.min(dragStart.y, dragEnd.y);
      const rw = Math.abs(dragEnd.x - dragStart.x);
      const rh = Math.abs(dragEnd.y - dragStart.y);

      ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(x, y, rw, rh);
      ctx.fillStyle = "rgba(239, 68, 68, 0.05)";
      ctx.fillRect(x, y, rw, rh);
      ctx.setLineDash([]);

      // Preview number badge
      const nextNum = regions.length + 1;
      const badgeR = 12;
      const bx = x + badgeR + 2;
      const by = y + badgeR + 2;
      ctx.fillStyle = "rgba(239, 68, 68, 0.5)";
      ctx.beginPath();
      ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(nextNum), bx, by);
    }
  }, [regions, isDragging, dragStart, dragEnd, naturalToDisplay]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Resize observer to keep canvas in sync with image size changes
  useEffect(() => {
    const img = imageRef.current;
    if (!img || !showAnnotator) return;

    const observer = new ResizeObserver(() => redrawCanvas());
    observer.observe(img);
    return () => observer.disconnect();
  }, [showAnnotator, redrawCanvas]);

  // ─── Mouse handlers for drawing ───────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsDragging(true);
    setDragStart({ x, y });
    setDragEnd({ x, y });
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      setDragEnd({
        x: Math.max(0, Math.min(e.clientX - rect.left, rect.width)),
        y: Math.max(0, Math.min(e.clientY - rect.top, rect.height)),
      });
    },
    [isDragging],
  );

  const finalizeDrag = useCallback(() => {
    if (!isDragging || !dragStart || !dragEnd) {
      setIsDragging(false);
      return;
    }

    const MIN_SIZE = 20; // minimum display-pixel size
    const w = Math.abs(dragEnd.x - dragStart.x);
    const h = Math.abs(dragEnd.y - dragStart.y);

    if (w >= MIN_SIZE && h >= MIN_SIZE) {
      const topLeft = displayToNatural(
        Math.min(dragStart.x, dragEnd.x),
        Math.min(dragStart.y, dragEnd.y),
      );
      const bottomRight = displayToNatural(
        Math.max(dragStart.x, dragEnd.x),
        Math.max(dragStart.y, dragEnd.y),
      );

      const newRegion: CaptureRegion = {
        number: regions.length + 1,
        rect: {
          x: topLeft.x,
          y: topLeft.y,
          width: bottomRight.x - topLeft.x,
          height: bottomRight.y - topLeft.y,
        },
        narration: "",
      };
      setRegions((prev) => [...prev, newRegion]);

      // Auto-scroll annotations panel to new region
      requestAnimationFrame(() => {
        annotationsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, displayToNatural, regions.length]);

  const handleMouseUp = useCallback(() => finalizeDrag(), [finalizeDrag]);

  // ─── Region management ────────────────────────────────────────────────

  const updateNarration = useCallback((index: number, narration: string) => {
    setRegions((prev) =>
      prev.map((r, i) => (i === index ? { ...r, narration } : r)),
    );
  }, []);

  const deleteRegion = useCallback((index: number) => {
    setRegions((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((r, i) => ({ ...r, number: i + 1 }));
    });
  }, []);

  // ─── Submit: burn annotations into image ──────────────────────────────

  const handleSubmit = useCallback(() => {
    if (!capturedImage || !imageEl || regions.length === 0) return;

    // Burn annotation overlays onto a new canvas
    const offscreen = document.createElement("canvas");
    offscreen.width = imageEl.naturalWidth;
    offscreen.height = imageEl.naturalHeight;
    const ctx = offscreen.getContext("2d")!;

    ctx.drawImage(imageEl, 0, 0);

    regions.forEach((region) => {
      const { x, y, width, height } = region.rect;

      // Rectangle
      const lineW = Math.max(3, imageEl.naturalWidth * 0.002);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
      ctx.lineWidth = lineW;
      ctx.strokeRect(x, y, width, height);

      // Number badge
      const badgeR = Math.max(14, imageEl.naturalWidth * 0.012);
      const bx = x + badgeR + lineW;
      const by = y + badgeR + lineW;
      ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
      ctx.beginPath();
      ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = `bold ${badgeR * 1.1}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(region.number), bx, by);
    });

    const annotatedDataUrl = offscreen.toDataURL("image/png");
    onCapture(annotatedDataUrl, regions);

    // Reset
    setShowAnnotator(false);
    setCapturedImage(null);
    setImageEl(null);
    setRegions([]);

    toast({
      title: "Capture Added",
      description: `Screenshot with ${regions.length} annotated region${regions.length !== 1 ? "s" : ""} will be merged into the document.`,
    });
  }, [capturedImage, imageEl, regions, onCapture, toast]);

  const handleClose = useCallback(() => {
    setShowAnnotator(false);
    setCapturedImage(null);
    setImageEl(null);
    setRegions([]);
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, []);

  // Escape key to close
  useEffect(() => {
    if (!showAnnotator) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showAnnotator, handleClose]);

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCapture}
        disabled={disabled || isCapturing}
        className="gap-1.5"
        title="Capture screen and annotate regions"
      >
        {isCapturing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Camera className="w-4 h-4" />
        )}
        Capture
      </Button>

      {/* ── Full-screen annotation overlay ── */}
      {showAnnotator && capturedImage && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-card shrink-0">
            <div className="flex items-center gap-3">
              <Camera className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Annotate Screenshot</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Draw rectangles to mark areas, then narrate each one
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleClose}>
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={regions.length === 0}
                className="gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Add to Document ({regions.length})
              </Button>
            </div>
          </div>

          {/* Main content: image + annotations side-by-side */}
          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
            {/* ── Left: image with canvas overlay ── */}
            <div className="flex-1 relative overflow-auto p-4 flex items-start justify-center">
              <div className="relative inline-block">
                <img
                  ref={imageRef}
                  src={capturedImage}
                  alt="Screenshot for annotation"
                  className="max-w-full max-h-[calc(100vh-160px)] rounded-lg border border-border/50 select-none"
                  draggable={false}
                  onLoad={redrawCanvas}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 cursor-crosshair"
                  style={{ touchAction: "none" }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => {
                    if (isDragging) finalizeDrag();
                  }}
                />
              </div>

              {/* Helper tooltip when no regions yet */}
              {regions.length === 0 && !isDragging && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none">
                  <div className="bg-foreground/80 text-background px-4 py-2 rounded-full flex items-center gap-2 text-sm shadow-lg">
                    <MousePointer className="w-4 h-4" />
                    Click and drag to mark areas of interest
                  </div>
                </div>
              )}
            </div>

            {/* ── Right: annotations panel ── */}
            <div className="lg:w-80 w-full border-t lg:border-t-0 lg:border-l bg-card overflow-y-auto shrink-0">
              <div className="px-4 py-3 border-b sticky top-0 bg-card z-10">
                <h3 className="font-semibold text-sm">
                  Annotations{regions.length > 0 ? ` (${regions.length})` : ""}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add narration for each marked area
                </p>
              </div>

              {regions.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No regions marked yet.
                  <br />
                  Draw rectangles on the screenshot to begin.
                </div>
              ) : (
                <div className="divide-y">
                  {regions.map((region, idx) => (
                    <div key={`region-${region.number}-${idx}`} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {region.number}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Region {region.number}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteRegion(idx)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <ProvokeText
                        variant="textarea"
                        chrome="bare"
                        value={region.narration}
                        onChange={(val) => updateNarration(idx, val)}
                        placeholder="Describe what this area shows or what needs attention..."
                        className="text-sm"
                        minRows={2}
                        maxRows={4}
                        showCopy={false}
                        showClear={false}
                        voice={{ mode: "replace" }}
                        onVoiceTranscript={(text) => updateNarration(idx, text)}
                        autoFocus={idx === regions.length - 1}
                      />
                    </div>
                  ))}
                  <div ref={annotationsEndRef} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
