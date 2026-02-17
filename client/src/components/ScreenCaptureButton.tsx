import { useState, useCallback, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Camera, Save, X, Loader2, Trash2, MousePointer, MapPin, Square, Image, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProvokeText } from "@/components/ProvokeText";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnnotationKind = "pointer" | "region";

export interface CaptureAnnotation {
  number: number;
  kind: AnnotationKind;
  /** Natural (original image) coordinates. For pointers: tip position. For regions: top-left corner. */
  position: { x: number; y: number };
  /** Only for region kind: width and height in natural coordinates */
  size?: { width: number; height: number };
  narration: string;
}

/** @deprecated Use CaptureAnnotation instead */
export interface CaptureRegion {
  number: number;
  rect: { x: number; y: number; width: number; height: number };
  narration: string;
}

export interface CaptureRequirementsSummary {
  annotatedImageDataUrl: string;
  annotations: CaptureAnnotation[];
  subImages: { dataUrl: string; annotation: CaptureAnnotation }[];
}

interface ScreenCaptureButtonProps {
  /** Called with the annotated base64 image and annotation details */
  onCapture: (imageDataUrl: string, annotations: CaptureAnnotation[]) => void;
  /** Called when the user closes the annotator without saving. Receives the keyword "elephant". */
  onClose?: (keyword: string) => void;
  disabled?: boolean;
  /** DOM element ID to capture. If omitted, captures document.body */
  targetElementId?: string;
  /** URL of the website displayed in the iframe. When provided, tries server-side screenshot first. */
  websiteUrl?: string;
  /** Async callback invoked before capture starts (e.g. to expand browser to full screen). Resolves when ready. */
  onPreCapture?: () => Promise<void>;
  /** Callback invoked after save or close (e.g. to collapse browser back to normal). */
  onPostCapture?: () => void;
}

// ─── Pointer rendering helpers ────────────────────────────────────────────────

/** Draw a map-pin pointer at display coordinates on a canvas context */
function drawPointerPin(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  number: number,
  scale: number = 1,
) {
  const pinHeight = 32 * scale;
  const circleR = 12 * scale;
  const neckWidth = 7 * scale;
  const cx = tipX;
  const cy = tipY - pinHeight + circleR;

  // Shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 4 * scale;
  ctx.shadowOffsetY = 1 * scale;

  // Pin body (triangle from tip to circle base)
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(cx - neckWidth, cy + circleR - 2 * scale);
  ctx.lineTo(cx + neckWidth, cy + circleR - 2 * scale);
  ctx.closePath();
  ctx.fillStyle = "rgba(239, 68, 68, 0.95)";
  ctx.fill();

  // Circle head
  ctx.beginPath();
  ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(239, 68, 68, 0.95)";
  ctx.fill();

  ctx.restore(); // Remove shadow

  // White circle border
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
  ctx.stroke();

  // Number text
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${13 * scale}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), cx, cy);
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Multi-step screen capture with annotation support:
 * 1. Captures a target element (or full page) as a high-resolution screenshot
 * 2. Full-screen annotator where user places numbered pointers or draws regions
 * 3. Instant narration prompt per annotation
 * 4. Save opens a review dialog with context crops + bundled narrations
 * 5. Confirming save sends the annotated image to the Document via onCapture
 */
export function ScreenCaptureButton({
  onCapture,
  onClose,
  disabled,
  targetElementId,
  websiteUrl,
  onPreCapture,
  onPostCapture,
}: ScreenCaptureButtonProps) {
  const { toast } = useToast();
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [annotations, setAnnotations] = useState<CaptureAnnotation[]>([]);
  const [showAnnotator, setShowAnnotator] = useState(false);
  const [annotationMode, setAnnotationMode] = useState<AnnotationKind>("pointer");

  // Requirements review dialog
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [croppedSubImages, setCroppedSubImages] = useState<
    { dataUrl: string; annotation: CaptureAnnotation }[]
  >([]);

  // Drawing state (for region mode)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const annotationsEndRef = useRef<HTMLDivElement>(null);

  // ─── Capture via Screen Capture API (captures iframe content) ───────

  const captureViaDisplayMedia = useCallback(
    async (targetEl: HTMLElement | null): Promise<string | null> => {
      if (!navigator.mediaDevices?.getDisplayMedia) return null;

      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "browser" } as MediaTrackConstraints,
          // @ts-expect-error preferCurrentTab is a non-standard Chrome option
          preferCurrentTab: true,
        });

        // Create video element to extract a frame
        const video = window.document.createElement("video");
        video.srcObject = stream;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;

        // Wait for video to be ready AND playing
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("timeout")), 8000);
          video.onloadedmetadata = () => {
            video.play().then(() => {
              clearTimeout(timer);
              resolve();
            }).catch(() => {
              clearTimeout(timer);
              resolve();
            });
          };
        });

        const fullWidth = video.videoWidth;
        const fullHeight = video.videoHeight;

        if (fullWidth === 0 || fullHeight === 0) {
          stream.getTracks().forEach((t) => t.stop());
          video.srcObject = null;
          return null;
        }

        const fullCanvas = window.document.createElement("canvas");
        fullCanvas.width = fullWidth;
        fullCanvas.height = fullHeight;
        const fullCtx = fullCanvas.getContext("2d")!;

        // Helper: check if the current canvas content is mostly black
        const isFrameBlank = () => {
          const sample = fullCtx.getImageData(0, 0, fullWidth, fullHeight);
          const d = sample.data;
          const step = Math.max(4, Math.floor(d.length / 4 / 400)) * 4;
          let dark = 0;
          let total = 0;
          for (let i = 0; i < d.length; i += step) {
            total++;
            if (d[i] < 10 && d[i + 1] < 10 && d[i + 2] < 10) dark++;
          }
          return total > 0 && dark / total > 0.95;
        };

        // Wait for a non-black frame from the stream. After the permission
        // dialog closes Chrome needs time to re-composite the tab, so the
        // first several frames may be blank. Poll using
        // requestVideoFrameCallback (Chrome/Edge) or setTimeout fallback.
        const waitForFrame = (): Promise<void> =>
          new Promise((resolve) => {
            if ("requestVideoFrameCallback" in video) {
              (video as any).requestVideoFrameCallback(() => resolve());
            } else {
              setTimeout(resolve, 200);
            }
          });

        const MAX_ATTEMPTS = 30; // ~5 seconds at 60fps, or 6s with setTimeout fallback
        let gotGoodFrame = false;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          await waitForFrame();
          fullCtx.clearRect(0, 0, fullWidth, fullHeight);
          fullCtx.drawImage(video, 0, 0, fullWidth, fullHeight);

          if (!isFrameBlank()) {
            gotGoodFrame = true;
            break;
          }
        }

        // Stop stream after capture
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;

        if (!gotGoodFrame) {
          console.warn("getDisplayMedia: all frames were blank after polling. Falling back.");
          return null;
        }

        // Crop to target element if specified
        if (targetEl) {
          const rect = targetEl.getBoundingClientRect();
          const dpr = fullWidth / window.innerWidth;

          const cropX = Math.round(rect.left * dpr);
          const cropY = Math.round(rect.top * dpr);
          const cropW = Math.round(rect.width * dpr);
          const cropH = Math.round(rect.height * dpr);

          // Clamp to canvas bounds
          const safeW = Math.min(cropW, fullWidth - Math.max(0, cropX));
          const safeH = Math.min(cropH, fullHeight - Math.max(0, cropY));

          if (safeW > 0 && safeH > 0) {
            const cropCanvas = window.document.createElement("canvas");
            cropCanvas.width = safeW;
            cropCanvas.height = safeH;
            const cropCtx = cropCanvas.getContext("2d")!;
            cropCtx.drawImage(
              fullCanvas,
              Math.max(0, cropX), Math.max(0, cropY), safeW, safeH,
              0, 0, safeW, safeH,
            );
            return cropCanvas.toDataURL("image/png");
          }
        }

        return fullCanvas.toDataURL("image/png");
      } catch {
        // User cancelled or API not supported — will fall back to html2canvas
        return null;
      }
    },
    [],
  );

  // ─── Server-side screenshot (Playwright) ─────────────────────────

  const captureViaServer = useCallback(
    async (): Promise<string | null> => {
      if (!websiteUrl) return null;
      try {
        const resp = await fetch("/api/screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: websiteUrl, width: 1280, height: 800 }),
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        return data.dataUrl ?? null;
      } catch {
        return null;
      }
    },
    [websiteUrl],
  );

  // ─── Capture (server → Screen Capture API → html2canvas fallback) ──

  const handleCapture = useCallback(async () => {
    setIsCapturing(true);
    try {
      // Allow parent to prepare (e.g. expand browser to full screen) before capture
      if (onPreCapture) {
        await onPreCapture();
      }

      const targetEl = targetElementId
        ? window.document.getElementById(targetElementId)
        : null;

      // 1. Try server-side screenshot first (captures any URL reliably, no prompt)
      let dataUrl = await captureViaServer();

      // 2. Try Screen Capture API (captures cross-origin iframe content)
      if (!dataUrl) {
        dataUrl = await captureViaDisplayMedia(targetEl);
      }

      // 3. Fall back to html2canvas (DOM-based, no iframe content but no prompt)
      if (!dataUrl) {
        try {
          const target = targetEl || window.document.body;
          const computedBg = getComputedStyle(target).backgroundColor;

          const canvas = await html2canvas(target, {
            useCORS: true,
            allowTaint: true,
            scale: 1,
            logging: false,
            backgroundColor: computedBg || "#ffffff",
          });
          dataUrl = canvas.toDataURL("image/png");
        } catch {
          dataUrl = null;
        }
      }

      if (!dataUrl) {
        toast({
          title: "Capture Failed",
          description: "Could not capture the screen. Please try again.",
          variant: "destructive",
        });
        return;
      }

      setCapturedImage(dataUrl);
      setAnnotations([]);
      setAnnotationMode("pointer");
      setShowAnnotator(true);

      // Pre-load the image element for canvas rendering
      const img = new window.Image();
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
  }, [toast, targetElementId, captureViaDisplayMedia, captureViaServer, onPreCapture]);

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

    // Draw existing annotations
    annotations.forEach((annotation) => {
      if (annotation.kind === "region" && annotation.size) {
        // Region: rectangle with number badge
        const tl = naturalToDisplay(annotation.position.x, annotation.position.y);
        const br = naturalToDisplay(
          annotation.position.x + annotation.size.width,
          annotation.position.y + annotation.size.height,
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
        ctx.fillText(String(annotation.number), bx, by);
      } else if (annotation.kind === "pointer") {
        // Pointer: map pin
        const display = naturalToDisplay(annotation.position.x, annotation.position.y);
        drawPointerPin(ctx, display.x, display.y, annotation.number);
      }
    });

    // Draw current drag preview (region mode only)
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
      const nextNum = annotations.length + 1;
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
  }, [annotations, isDragging, dragStart, dragEnd, naturalToDisplay]);

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

  // ─── Mouse handlers ────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDragStart({ x, y });
    setDragEnd({ x, y });

    if (annotationMode === "region") {
      setIsDragging(true);
    }
  }, [annotationMode]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (annotationMode !== "region" || !isDragging) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      setDragEnd({
        x: Math.max(0, Math.min(e.clientX - rect.left, rect.width)),
        y: Math.max(0, Math.min(e.clientY - rect.top, rect.height)),
      });
    },
    [annotationMode, isDragging],
  );

  const finalizeDrag = useCallback(() => {
    if (!isDragging || !dragStart || !dragEnd) {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
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

      const newAnnotation: CaptureAnnotation = {
        number: annotations.length + 1,
        kind: "region",
        position: { x: topLeft.x, y: topLeft.y },
        size: {
          width: bottomRight.x - topLeft.x,
          height: bottomRight.y - topLeft.y,
        },
        narration: "",
      };
      setAnnotations((prev) => [...prev, newAnnotation]);

      // Auto-scroll annotations panel to new item
      requestAnimationFrame(() => {
        annotationsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, displayToNatural, annotations.length]);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (annotationMode === "pointer" && dragStart) {
        // Check if it's a click (not a drag)
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const dist = Math.hypot(x - dragStart.x, y - dragStart.y);

        if (dist < 10) {
          const natural = displayToNatural(x, y);
          const newAnnotation: CaptureAnnotation = {
            number: annotations.length + 1,
            kind: "pointer",
            position: natural,
            narration: "",
          };
          setAnnotations((prev) => [...prev, newAnnotation]);

          // Auto-scroll annotations panel
          requestAnimationFrame(() => {
            annotationsEndRef.current?.scrollIntoView({ behavior: "smooth" });
          });
        }

        setDragStart(null);
        setDragEnd(null);
      } else {
        // Region mode
        finalizeDrag();
      }
    },
    [annotationMode, dragStart, displayToNatural, annotations.length, finalizeDrag],
  );

  // ─── Annotation management ────────────────────────────────────────────

  const updateNarration = useCallback((index: number, narration: string) => {
    setAnnotations((prev) =>
      prev.map((a, i) => (i === index ? { ...a, narration } : a)),
    );
  }, []);

  const deleteAnnotation = useCallback((index: number) => {
    setAnnotations((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((a, i) => ({ ...a, number: i + 1 }));
    });
  }, []);

  // ─── Sub-image cropping ───────────────────────────────────────────────

  const cropSubImages = useCallback((): { dataUrl: string; annotation: CaptureAnnotation }[] => {
    if (!imageEl || annotations.length === 0) return [];

    return annotations.map((annotation) => {
      const cropCanvas = window.document.createElement("canvas");
      const ctx = cropCanvas.getContext("2d");

      if (annotation.kind === "region" && annotation.size) {
        // Crop the exact region
        const { x, y } = annotation.position;
        const { width, height } = annotation.size;
        cropCanvas.width = width;
        cropCanvas.height = height;
        if (ctx) {
          ctx.drawImage(imageEl, x, y, width, height, 0, 0, width, height);
        }
      } else {
        // Pointer: crop a context area around the pointer tip
        const contextSize = 300; // natural pixels
        const halfCtx = contextSize / 2;
        const cx = Math.max(0, annotation.position.x - halfCtx);
        const cy = Math.max(0, annotation.position.y - halfCtx);
        const cw = Math.min(contextSize, imageEl.naturalWidth - cx);
        const ch = Math.min(contextSize, imageEl.naturalHeight - cy);
        cropCanvas.width = cw;
        cropCanvas.height = ch;
        if (ctx) {
          ctx.drawImage(imageEl, cx, cy, cw, ch, 0, 0, cw, ch);

          // Draw a small crosshair at the pointer location within the crop
          const localX = annotation.position.x - cx;
          const localY = annotation.position.y - cy;
          ctx.strokeStyle = "rgba(239, 68, 68, 0.8)";
          ctx.lineWidth = 2;
          const armLen = 10;
          ctx.beginPath();
          ctx.moveTo(localX - armLen, localY);
          ctx.lineTo(localX + armLen, localY);
          ctx.moveTo(localX, localY - armLen);
          ctx.lineTo(localX, localY + armLen);
          ctx.stroke();
        }
      }

      return {
        dataUrl: cropCanvas.toDataURL("image/jpeg", 0.82),
        annotation,
      };
    });
  }, [imageEl, annotations]);

  // ─── Close: triggers "elephant" keyword ───────────────────────────────

  const handleClose = useCallback(() => {
    // Trigger the "elephant" keyword response
    onClose?.("elephant");

    // Reset all state
    setShowAnnotator(false);
    setCapturedImage(null);
    setImageEl(null);
    setAnnotations([]);
    setAnnotationMode("pointer");
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    setShowReviewDialog(false);
    setCroppedSubImages([]);

    // Allow parent to clean up (e.g. collapse browser back to normal)
    onPostCapture?.();
  }, [onClose, onPostCapture]);

  // ─── Save: open review dialog ─────────────────────────────────────────

  const handleSaveClick = useCallback(() => {
    if (annotations.length === 0) return;

    // Crop sub-images for each annotation
    const subImages = cropSubImages();
    setCroppedSubImages(subImages);
    setShowReviewDialog(true);
  }, [annotations, cropSubImages]);

  // ─── Confirm save: burn annotations and fire onCapture ────────────────

  const handleConfirmSave = useCallback(() => {
    if (!capturedImage || !imageEl || annotations.length === 0) return;

    // Burn annotation overlays onto a new canvas
    const offscreen = window.document.createElement("canvas");
    offscreen.width = imageEl.naturalWidth;
    offscreen.height = imageEl.naturalHeight;
    const ctx = offscreen.getContext("2d")!;

    ctx.drawImage(imageEl, 0, 0);

    annotations.forEach((annotation) => {
      if (annotation.kind === "region" && annotation.size) {
        // Region: burn rectangle + badge
        const { x, y } = annotation.position;
        const { width, height } = annotation.size;

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
        ctx.fillText(String(annotation.number), bx, by);
      } else if (annotation.kind === "pointer") {
        // Pointer: burn map pin at natural coordinates
        const pinScale = Math.max(1, imageEl.naturalWidth / 1000);
        drawPointerPin(ctx, annotation.position.x, annotation.position.y, annotation.number, pinScale);
      }
    });

    // Downscale to keep the image under ~2MB while still legible
    const MAX_DIM = 1600;
    let outCanvas: HTMLCanvasElement = offscreen;
    if (offscreen.width > MAX_DIM || offscreen.height > MAX_DIM) {
      const ratio = Math.min(MAX_DIM / offscreen.width, MAX_DIM / offscreen.height);
      const dw = Math.round(offscreen.width * ratio);
      const dh = Math.round(offscreen.height * ratio);
      const scaled = window.document.createElement("canvas");
      scaled.width = dw;
      scaled.height = dh;
      const sctx = scaled.getContext("2d")!;
      sctx.drawImage(offscreen, 0, 0, dw, dh);
      outCanvas = scaled;
    }
    const annotatedDataUrl = outCanvas.toDataURL("image/jpeg", 0.82);
    onCapture(annotatedDataUrl, annotations);

    // Reset everything
    setShowReviewDialog(false);
    setCroppedSubImages([]);
    setShowAnnotator(false);
    setCapturedImage(null);
    setImageEl(null);
    setAnnotations([]);
    setAnnotationMode("pointer");

    // Allow parent to clean up (e.g. collapse browser back to normal)
    onPostCapture?.();

    toast({
      title: "Capture Saved",
      description: `Screenshot with ${annotations.length} annotation${annotations.length !== 1 ? "s" : ""} sent to the document.`,
    });
  }, [capturedImage, imageEl, annotations, onCapture, toast, onPostCapture]);

  const handleCloseReviewDialog = useCallback(() => {
    setShowReviewDialog(false);
    setCroppedSubImages([]);
  }, []);

  // Escape key to close annotator
  useEffect(() => {
    if (!showAnnotator) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showReviewDialog) {
          handleCloseReviewDialog();
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showAnnotator, showReviewDialog, handleClose, handleCloseReviewDialog]);

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCapture}
        disabled={disabled || isCapturing}
        className="gap-1.5"
        title="Capture website view and annotate"
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
                {annotationMode === "pointer"
                  ? "Click to place numbered pointers, then describe each"
                  : "Draw rectangles to mark areas, then explain each"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Annotation mode toggle */}
              <div className="flex items-center gap-0.5 bg-muted/50 rounded-md p-0.5">
                <Button
                  variant={annotationMode === "pointer" ? "default" : "ghost"}
                  size="sm"
                  className="h-6 px-2 text-xs gap-1"
                  onClick={() => setAnnotationMode("pointer")}
                  title="Pointer mode — click to place markers"
                >
                  <MapPin className="w-3 h-3" />
                  Pointer
                </Button>
                <Button
                  variant={annotationMode === "region" ? "default" : "ghost"}
                  size="sm"
                  className="h-6 px-2 text-xs gap-1"
                  onClick={() => setAnnotationMode("region")}
                  title="Region mode — drag to draw rectangles"
                >
                  <Square className="w-3 h-3" />
                  Region
                </Button>
              </div>

              <Button variant="ghost" size="sm" onClick={handleClose}>
                <X className="w-4 h-4 mr-1" />
                Close
              </Button>
              <Button
                size="sm"
                onClick={handleSaveClick}
                disabled={annotations.length === 0}
                className="gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                Save ({annotations.length})
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

              {/* Helper tooltip when no annotations yet */}
              {annotations.length === 0 && !isDragging && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none">
                  <div className="bg-foreground/80 text-background px-4 py-2 rounded-full flex items-center gap-2 text-sm shadow-lg">
                    {annotationMode === "pointer" ? (
                      <>
                        <MapPin className="w-4 h-4" />
                        Click to place a pointer
                      </>
                    ) : (
                      <>
                        <MousePointer className="w-4 h-4" />
                        Click and drag to mark areas of interest
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Right: annotations panel ── */}
            <div className="lg:w-80 w-full border-t lg:border-t-0 lg:border-l bg-card overflow-y-auto shrink-0">
              <div className="px-4 py-3 border-b sticky top-0 bg-card z-10">
                <h3 className="font-semibold text-sm">
                  Annotations{annotations.length > 0 ? ` (${annotations.length})` : ""}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Describe why each marked point or area matters
                </p>
              </div>

              {annotations.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No annotations yet.
                  <br />
                  {annotationMode === "pointer"
                    ? "Click on the screenshot to place pointers."
                    : "Draw rectangles on the screenshot to begin."}
                </div>
              ) : (
                <div className="divide-y">
                  {annotations.map((annotation, idx) => (
                    <div key={`annotation-${annotation.number}-${idx}`} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {annotation.number}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            {annotation.kind === "pointer" ? (
                              <MapPin className="w-3 h-3" />
                            ) : (
                              <Square className="w-3 h-3" />
                            )}
                            {annotation.kind === "pointer" ? "Pointer" : "Region"} {annotation.number}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteAnnotation(idx)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <ProvokeText
                        variant="textarea"
                        chrome="bare"
                        value={annotation.narration}
                        onChange={(val) => updateNarration(idx, val)}
                        placeholder={
                          annotation.kind === "pointer"
                            ? "What does this point to? Why is it important..."
                            : "Why did you capture this area? What needs attention here..."
                        }
                        className="text-sm"
                        minRows={2}
                        maxRows={4}
                        showCopy={false}
                        showClear={false}
                        voice={{ mode: "replace" }}
                        onVoiceTranscript={(text) => updateNarration(idx, text)}
                        autoFocus={idx === annotations.length - 1}
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

      {/* ── Review Dialog ── */}
      <Dialog open={showReviewDialog} onOpenChange={(open) => { if (!open) handleCloseReviewDialog(); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Capture Review
            </DialogTitle>
            <DialogDescription>
              Review all annotations and their descriptions before sending to the document.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-2">
              {croppedSubImages.map(({ dataUrl, annotation }, idx) => (
                <div
                  key={`review-${annotation.number}-${idx}`}
                  className="border rounded-lg overflow-hidden bg-muted/30"
                >
                  {/* Sub-image header */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
                    <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {annotation.number}
                    </span>
                    <span className="font-medium text-sm flex items-center gap-1">
                      {annotation.kind === "pointer" ? (
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      {annotation.kind === "pointer" ? "Pointer" : "Region"} {annotation.number}
                    </span>
                    <Image className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
                  </div>

                  {/* Cropped context image */}
                  <div className="p-3 flex justify-center bg-background/50">
                    <img
                      src={dataUrl}
                      alt={`Captured ${annotation.kind} ${annotation.number}`}
                      className="max-w-full max-h-48 rounded border border-border/50 object-contain"
                    />
                  </div>

                  {/* Narration */}
                  <div className="px-3 py-2.5 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                    <p className="text-sm leading-relaxed">
                      {annotation.narration || (
                        <span className="italic text-muted-foreground">No description provided</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Summary footer */}
          <div className="border-t pt-3 -mx-6 px-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <Camera className="w-3.5 h-3.5" />
              <span>
                {croppedSubImages.length} annotation{croppedSubImages.length !== 1 ? "s" : ""} captured
                {" \u00b7 "}
                {croppedSubImages.filter(s => s.annotation.narration.trim()).length} with descriptions
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseReviewDialog}>
              Back to Annotator
            </Button>
            <Button onClick={handleConfirmSave} className="gap-1.5">
              <Save className="w-3.5 h-3.5" />
              Send to Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
