import React, { useCallback, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Upload,
  X,
  RotateCcw,
  Crop,
  Tag,
  ImageIcon,
  Sparkles,
  Move,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Exported types ──────────────────────────────────────────────────────────

export interface ImageMeta {
  tags: string[];
  label: string;
  altText: string;
  description: string;
}

export interface CropRect {
  /** 0-1 relative */
  x: number;
  /** 0-1 relative */
  y: number;
  /** 0-1 relative */
  width: number;
  /** 0-1 relative */
  height: number;
}

export interface ImageTransform {
  /** percentage offset (-100 to 100) */
  panX: number;
  /** percentage offset (-100 to 100) */
  panY: number;
  /** 0.1 to 5.0 */
  scale: number;
  crop?: CropRect;
}

export interface ImageCustomizerProps {
  /** Current image source (data URL, blob URL, or remote URL) */
  src?: string;
  /** Image transform state */
  transform?: ImageTransform;
  /** Callback when transform changes */
  onTransformChange?: (t: ImageTransform) => void;
  /** Image metadata */
  meta?: ImageMeta;
  /** Callback when metadata changes */
  onMetaChange?: (m: ImageMeta) => void;
  /** Callback when a new image is loaded (from upload or URL) */
  onImageLoad?: (dataUrl: string, fileName: string) => void;
  /** Callback when image is cleared */
  onClear?: () => void;
  /** Whether to show the upload tab */
  showUpload?: boolean;
  /** Whether to show the AI Generate tab (for Painter integration) */
  showGenerate?: boolean;
  /** Callback for AI generation (if showGenerate) */
  onGenerate?: (prompt: string) => void;
  /** Whether currently generating */
  isGenerating?: boolean;
  /** Whether to show metadata editor */
  showMeta?: boolean;
  /** Whether to show crop controls */
  showCrop?: boolean;
  /** Compact mode — smaller layout for embedding in side panels */
  compact?: boolean;
  /** Read-only — just viewing, no editing */
  readOnly?: boolean;
  /** Callback for remove background action */
  onRemoveBackground?: () => void;
}

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_TRANSFORM: ImageTransform = { panX: 0, panY: 0, scale: 1 };
const DEFAULT_META: ImageMeta = { tags: [], label: "", altText: "", description: "" };

const ASPECT_PRESETS: { label: string; ratio: number | null }[] = [
  { label: "Free", ratio: null },
  { label: "1:1", ratio: 1 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "3:2", ratio: 3 / 2 },
];

const ACCEPTED_TYPES = "image/png,image/jpeg,image/gif,image/svg+xml,image/webp";

// ── Component ───────────────────────────────────────────────────────────────

export function ImageCustomizer({
  src,
  transform: transformProp,
  onTransformChange,
  meta: metaProp,
  onMetaChange,
  onImageLoad,
  onClear,
  showUpload = false,
  showGenerate = false,
  onGenerate,
  isGenerating = false,
  showMeta = false,
  showCrop = false,
  compact = false,
  readOnly = false,
  onRemoveBackground,
}: ImageCustomizerProps) {
  // ── Internal state (controlled or uncontrolled) ───────────────────────────

  const [internalTransform, setInternalTransform] = useState<ImageTransform>(DEFAULT_TRANSFORM);
  const transform = transformProp ?? internalTransform;
  const setTransform = useCallback(
    (next: ImageTransform) => {
      setInternalTransform(next);
      onTransformChange?.(next);
    },
    [onTransformChange],
  );

  const [internalMeta, setInternalMeta] = useState<ImageMeta>(DEFAULT_META);
  const meta = metaProp ?? internalMeta;
  const setMeta = useCallback(
    (next: ImageMeta) => {
      setInternalMeta(next);
      onMetaChange?.(next);
    },
    [onMetaChange],
  );

  // ── Drag-to-pan state ─────────────────────────────────────────────────────

  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (readOnly) return;
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        startPanX: transform.panX,
        startPanY: transform.panY,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [readOnly, transform.panX, transform.panY],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current.active) return;
      const vp = viewportRef.current;
      if (!vp) return;
      const rect = vp.getBoundingClientRect();
      const dx = ((e.clientX - dragRef.current.startX) / rect.width) * 100;
      const dy = ((e.clientY - dragRef.current.startY) / rect.height) * 100;
      setTransform({
        ...transform,
        panX: clamp(dragRef.current.startPanX + dx, -100, 100),
        panY: clamp(dragRef.current.startPanY + dy, -100, 100),
      });
    },
    [transform, setTransform],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  // ── Crop state ────────────────────────────────────────────────────────────

  const [cropActive, setCropActive] = useState(false);
  const [selectedAspect, setSelectedAspect] = useState<number | null>(null);
  const [pendingCrop, setPendingCrop] = useState<CropRect>({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });

  const cropDragRef = useRef({
    active: false,
    handle: "" as string,
    startX: 0,
    startY: 0,
    startCrop: { x: 0, y: 0, width: 0, height: 0 } as CropRect,
  });

  const applyCrop = useCallback(() => {
    setTransform({ ...transform, crop: { ...pendingCrop } });
    setCropActive(false);
  }, [transform, pendingCrop, setTransform]);

  const cancelCrop = useCallback(() => {
    setCropActive(false);
  }, []);

  // ── Upload handling ───────────────────────────────────────────────────────

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<string>("current");

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        onImageLoad?.(dataUrl, file.name);
        setActiveTab("current");
      };
      reader.readAsDataURL(file);
    },
    [onImageLoad],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  // ── Tag input ─────────────────────────────────────────────────────────────

  const [tagInput, setTagInput] = useState("");

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim();
      if (!trimmed || meta.tags.includes(trimmed)) return;
      setMeta({ ...meta, tags: [...meta.tags, trimmed] });
    },
    [meta, setMeta],
  );

  const removeTag = useCallback(
    (tag: string) => {
      setMeta({ ...meta, tags: meta.tags.filter((t) => t !== tag) });
    },
    [meta, setMeta],
  );

  // ── Generate prompt ───────────────────────────────────────────────────────

  const [genPrompt, setGenPrompt] = useState("");

  // ── Determine which tabs to show ──────────────────────────────────────────

  const hasTabs = showUpload || showGenerate;
  const tabItems: { value: string; label: string; icon: React.ReactNode }[] = [
    { value: "current", label: "Current", icon: <ImageIcon className="h-3 w-3" /> },
  ];
  if (showUpload) tabItems.push({ value: "upload", label: "Upload", icon: <Upload className="h-3 w-3" /> });
  if (showGenerate) tabItems.push({ value: "generate", label: "AI Generate", icon: <Sparkles className="h-3 w-3" /> });

  // ── Render helpers ────────────────────────────────────────────────────────

  const viewportHeight = compact ? "h-40" : "h-56";

  const renderViewport = () => (
    <div
      ref={viewportRef}
      className={cn(
        "relative w-full overflow-hidden rounded-md border border-border/50 cursor-grab active:cursor-grabbing select-none",
        viewportHeight,
      )}
      style={{
        backgroundImage:
          "repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%)",
        backgroundSize: "16px 16px",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {src ? (
        <img
          src={src}
          alt={meta.altText || "Image preview"}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          draggable={false}
          style={{
            transform: `translate(${transform.panX}%, ${transform.panY}%) scale(${transform.scale})`,
            transformOrigin: "center center",
          }}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
          <ImageIcon className="h-8 w-8 opacity-40" />
          <span className="text-xs opacity-60">No image</span>
        </div>
      )}

      {/* Crop overlay */}
      {cropActive && src && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Dimmed area */}
          <div className="absolute inset-0 bg-black/50" />
          {/* Crop rect */}
          <div
            className="absolute border-2 border-dashed border-white/80 pointer-events-auto"
            style={{
              left: `${pendingCrop.x * 100}%`,
              top: `${pendingCrop.y * 100}%`,
              width: `${pendingCrop.width * 100}%`,
              height: `${pendingCrop.height * 100}%`,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
            }}
          />
        </div>
      )}

      {/* Drag hint */}
      {src && !readOnly && (
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/60 text-white/80 text-[10px] px-1.5 py-0.5 rounded">
          <Move className="h-2.5 w-2.5" />
          Drag to pan
        </div>
      )}
    </div>
  );

  const renderPositionScale = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Position & Scale
        </span>
        {!readOnly && (
          <button
            onClick={() => setTransform({ ...DEFAULT_TRANSFORM, crop: transform.crop })}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      {/* X */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-6 shrink-0">X</span>
        <Slider
          min={-100}
          max={100}
          step={1}
          value={[transform.panX]}
          onValueChange={([v]) => setTransform({ ...transform, panX: v })}
          disabled={readOnly}
          className="flex-1"
        />
        <span className="text-[10px] text-muted-foreground w-10 text-right tabular-nums">
          {transform.panX.toFixed(0)}%
        </span>
      </div>

      {/* Y */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-6 shrink-0">Y</span>
        <Slider
          min={-100}
          max={100}
          step={1}
          value={[transform.panY]}
          onValueChange={([v]) => setTransform({ ...transform, panY: v })}
          disabled={readOnly}
          className="flex-1"
        />
        <span className="text-[10px] text-muted-foreground w-10 text-right tabular-nums">
          {transform.panY.toFixed(0)}%
        </span>
      </div>

      {/* Scale */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-6 shrink-0">
          <span className="text-[10px]">Sc</span>
        </span>
        <Slider
          min={10}
          max={500}
          step={1}
          value={[Math.round(transform.scale * 100)]}
          onValueChange={([v]) => setTransform({ ...transform, scale: v / 100 })}
          disabled={readOnly}
          className="flex-1"
        />
        <span className="text-[10px] text-muted-foreground w-10 text-right tabular-nums">
          {transform.scale.toFixed(2)}x
        </span>
      </div>
    </div>
  );

  const renderCropControls = () => {
    if (!showCrop) return null;
    return (
      <div className="space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Crop
        </span>

        {/* Aspect presets */}
        <div className="flex flex-wrap gap-1">
          {ASPECT_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setSelectedAspect(p.ratio);
                if (p.ratio !== null) {
                  // Adjust pending crop to match ratio
                  const w = pendingCrop.width;
                  const h = w / p.ratio;
                  setPendingCrop({ ...pendingCrop, height: clamp(h, 0.05, 1 - pendingCrop.y) });
                }
              }}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] border transition-colors",
                selectedAspect === p.ratio
                  ? "bg-primary/20 border-primary text-primary"
                  : "border-border/50 text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Toggle + Apply/Cancel */}
        <div className="flex items-center gap-2">
          {!cropActive ? (
            <button
              onClick={() => setCropActive(true)}
              disabled={!src || readOnly}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-muted/30 border border-border/50 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
            >
              <Crop className="h-3 w-3" />
              Crop
            </button>
          ) : (
            <>
              <button
                onClick={applyCrop}
                className="px-2 py-1 rounded text-xs bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30 transition-colors"
              >
                Apply Crop
              </button>
              <button
                onClick={cancelCrop}
                className="px-2 py-1 rounded text-xs bg-muted/30 border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderMetaEditor = () => {
    if (!showMeta) return null;
    return (
      <div className="space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Metadata
        </span>

        {/* Label */}
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Label</label>
          <input
            value={meta.label}
            onChange={(e) => setMeta({ ...meta, label: e.target.value })}
            disabled={readOnly}
            className="w-full rounded border border-border/50 bg-muted/30 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
            placeholder="Image label..."
          />
        </div>

        {/* Alt Text */}
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Alt Text</label>
          <input
            value={meta.altText}
            onChange={(e) => setMeta({ ...meta, altText: e.target.value })}
            disabled={readOnly}
            className="w-full rounded border border-border/50 bg-muted/30 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
            placeholder="Describe the image for accessibility..."
          />
        </div>

        {/* Description */}
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Description</label>
          <textarea
            value={meta.description}
            onChange={(e) => setMeta({ ...meta, description: e.target.value })}
            disabled={readOnly}
            rows={2}
            className="w-full rounded border border-border/50 bg-muted/30 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
            placeholder="Detailed description..."
          />
        </div>

        {/* Tags */}
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Tag className="h-2.5 w-2.5" />
            Tags
          </label>
          <div className="flex flex-wrap gap-1 min-h-[24px]">
            {meta.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px]"
              >
                {tag}
                {!readOnly && (
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:text-destructive transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
            ))}
          </div>
          {!readOnly && (
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag(tagInput);
                  setTagInput("");
                }
              }}
              className="w-full rounded border border-border/50 bg-muted/30 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
              placeholder="Type + Enter to add tag..."
            />
          )}
        </div>
      </div>
    );
  };

  const renderActions = () => {
    if (readOnly) return null;
    return (
      <div className="flex items-center gap-2">
        {onRemoveBackground && (
          <button
            onClick={onRemoveBackground}
            disabled={!src}
            className="px-2 py-1 rounded text-xs bg-muted/30 border border-border/50 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          >
            Remove Background
          </button>
        )}
        {onClear && (
          <button
            onClick={onClear}
            disabled={!src}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-muted/30 border border-border/50 text-muted-foreground hover:text-destructive disabled:opacity-40 transition-colors"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>
    );
  };

  const renderUploadZone = () => (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onClick={() => fileInputRef.current?.click()}
      className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border/50 bg-muted/10 hover:bg-muted/20 cursor-pointer transition-colors py-10 px-4"
    >
      <Upload className="h-8 w-8 text-muted-foreground/50" />
      <span className="text-xs text-muted-foreground">Drop an image here or click to browse</span>
      <span className="text-[10px] text-muted-foreground/50">PNG, JPG, GIF, SVG, WebP</span>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );

  const renderGenerateTab = () => (
    <div className="space-y-2">
      <textarea
        value={genPrompt}
        onChange={(e) => setGenPrompt(e.target.value)}
        rows={3}
        className="w-full rounded border border-border/50 bg-muted/30 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
        placeholder="Describe the image you want to generate..."
      />
      <button
        onClick={() => {
          if (genPrompt.trim()) onGenerate?.(genPrompt.trim());
        }}
        disabled={!genPrompt.trim() || isGenerating}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30 disabled:opacity-40 transition-colors"
      >
        <Sparkles className="h-3 w-3" />
        {isGenerating ? "Generating..." : "Generate"}
      </button>
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────────────

  const controlsContent = (
    <div className={cn("space-y-3", compact ? "text-xs" : "")}>
      {renderPositionScale()}
      {renderCropControls()}
      {renderMetaEditor()}
      {renderActions()}
    </div>
  );

  // If we have tabs, wrap in tab interface
  if (hasTabs) {
    return (
      <div className={cn("space-y-2", compact ? "text-xs" : "")}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-8 w-full">
            {tabItems.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs gap-1 flex-1">
                {tab.icon}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="current" className="mt-2 space-y-3">
            {renderViewport()}
            {controlsContent}
          </TabsContent>

          {showUpload && (
            <TabsContent value="upload" className="mt-2">
              {renderUploadZone()}
            </TabsContent>
          )}

          {showGenerate && (
            <TabsContent value="generate" className="mt-2">
              {renderGenerateTab()}
            </TabsContent>
          )}
        </Tabs>
      </div>
    );
  }

  // No tabs — just viewport + controls
  return (
    <div className={cn("space-y-3", compact ? "text-xs" : "")}>
      {renderViewport()}
      {controlsContent}
    </div>
  );
}

// ── Utility ─────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
