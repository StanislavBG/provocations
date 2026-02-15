import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Type,
  Image,
  Link,
  X,
  FileText,
  MessageSquareText,
  ExternalLink,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { ContextItem, ContextItemType } from "@shared/schema";
import { generateId } from "@/lib/utils";

interface ContextCapturePanelProps {
  items: ContextItem[];
  onItemsChange: (items: ContextItem[]) => void;
}

export function ContextCapturePanel({ items, onItemsChange }: ContextCapturePanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [addingType, setAddingType] = useState<ContextItemType | null>(null);

  // Inline form state
  const [formContent, setFormContent] = useState("");
  const [formAnnotation, setFormAnnotation] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  const resetForm = useCallback(() => {
    setIsAdding(false);
    setAddingType(null);
    setFormContent("");
    setFormAnnotation("");
    setImagePreview(null);
  }, []);

  const handleAdd = useCallback(() => {
    if (!addingType) return;

    const content = addingType === "image" ? (imagePreview || "") : formContent.trim();
    if (!content) return;

    const newItem: ContextItem = {
      id: generateId("ctx"),
      type: addingType,
      content,
      annotation: formAnnotation.trim() || undefined,
      createdAt: Date.now(),
    };

    onItemsChange([...items, newItem]);
    resetForm();
  }, [addingType, formContent, formAnnotation, imagePreview, items, onItemsChange, resetForm]);

  const handleRemove = useCallback((id: string) => {
    onItemsChange(items.filter(item => item.id !== id));
  }, [items, onItemsChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const clipboardItems = e.clipboardData.items;
    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            setImagePreview(dataUrl);
          };
          reader.readAsDataURL(file);
        }
        return;
      }
    }
  }, []);

  const handleImageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setImagePreview(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const typeConfig: Record<ContextItemType, { icon: typeof Type; label: string; color: string }> = {
    text: { icon: Type, label: "Text", color: "text-blue-600 dark:text-blue-400" },
    image: { icon: Image, label: "Image", color: "text-emerald-600 dark:text-emerald-400" },
    "document-link": { icon: Link, label: "Document Link", color: "text-violet-600 dark:text-violet-400" },
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Existing items */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <ContextItemCard key={item.id} item={item} onRemove={handleRemove} />
          ))}
        </div>
      )}

      {/* Add new context CTA */}
      {!isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 text-sm text-muted-foreground hover:text-foreground transition-all"
        >
          <Plus className="w-4 h-4" />
          Add context
        </button>
      )}

      {/* Type selector */}
      {isAdding && !addingType && (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Choose type
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetForm}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex gap-2">
            {(Object.entries(typeConfig) as [ContextItemType, typeof typeConfig["text"]][]).map(([type, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={type}
                  onClick={() => setAddingType(type)}
                  className="flex-1 flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border hover:border-primary/50 hover:bg-primary/5 transition-all"
                >
                  <Icon className={`w-5 h-5 ${config.color}`} />
                  <span className="text-xs font-medium">{config.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Content form for selected type */}
      {addingType && (
        <div className="rounded-lg border bg-card p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = typeConfig[addingType].icon;
                return <Icon className={`w-4 h-4 ${typeConfig[addingType].color}`} />;
              })()}
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {typeConfig[addingType].label}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetForm}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Type-specific input */}
          {addingType === "text" && (
            <Textarea
              placeholder="Paste or type your text context..."
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              className="text-sm min-h-[80px] resize-none"
              autoFocus
            />
          )}

          {addingType === "image" && (
            <div
              ref={pasteAreaRef}
              onPaste={handlePaste}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleImageDrop}
              className="min-h-[100px] rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
              tabIndex={0}
            >
              {imagePreview ? (
                <div className="relative w-full p-2">
                  <img
                    src={imagePreview}
                    alt="Pasted context"
                    className="max-h-[200px] rounded-md mx-auto object-contain"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-3 right-3 h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImagePreview(null);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6 px-4">
                  <Image className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Paste an image (Ctrl+V) or drag &amp; drop
                  </p>
                </div>
              )}
            </div>
          )}

          {addingType === "document-link" && (
            <Input
              type="url"
              placeholder="https://docs.google.com/..."
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              className="text-sm"
              autoFocus
            />
          )}

          {/* Annotation field (shared across all types) */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Annotation (why does this matter?)
            </label>
            <Input
              placeholder="Explain why this context is important..."
              value={formAnnotation}
              onChange={(e) => setFormAnnotation(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={resetForm}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={addingType === "image" ? !imagePreview : !formContent.trim()}
            >
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Individual context item card ──

function ContextItemCard({ item, onRemove }: { item: ContextItem; onRemove: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const typeIcons: Record<ContextItemType, typeof Type> = {
    text: FileText,
    image: Image,
    "document-link": ExternalLink,
  };

  const typeColors: Record<ContextItemType, string> = {
    text: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50",
    image: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50",
    "document-link": "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800/50",
  };

  const typeIconColors: Record<ContextItemType, string> = {
    text: "text-blue-600 dark:text-blue-400",
    image: "text-emerald-600 dark:text-emerald-400",
    "document-link": "text-violet-600 dark:text-violet-400",
  };

  const Icon = typeIcons[item.type];

  const preview = item.type === "text"
    ? item.content.slice(0, 80) + (item.content.length > 80 ? "..." : "")
    : item.type === "document-link"
    ? item.content
    : "Image";

  return (
    <div className={`rounded-lg border p-2.5 ${typeColors[item.type]}`}>
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${typeIconColors[item.type]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium capitalize">{item.type === "document-link" ? "Link" : item.type}</span>
            {item.annotation && (
              <MessageSquareText className="w-3 h-3 text-muted-foreground/60" />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{preview}</p>
          {item.annotation && expanded && (
            <p className="text-xs text-muted-foreground/80 italic mt-1 border-t border-current/10 pt-1">
              {item.annotation}
            </p>
          )}
          {item.type === "image" && expanded && (
            <img
              src={item.content}
              alt="Context"
              className="mt-2 max-h-[150px] rounded object-contain"
            />
          )}
          {item.type === "text" && expanded && (
            <p className="text-xs text-foreground/80 mt-1 border-t border-current/10 pt-1 whitespace-pre-wrap">
              {item.content}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(item.id)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
