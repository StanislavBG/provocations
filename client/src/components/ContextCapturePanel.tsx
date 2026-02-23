import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProvokeText } from "@/components/ProvokeText";
import {
  Plus,
  Type,
  Image,
  Link,
  X,
  FileText,
  HardDrive,
  MessageSquareText,
  ExternalLink,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
  Upload,
  Folder,
  Lock,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ContextItem, ContextItemType, FolderItem } from "@shared/schema";
import { generateId } from "@/lib/utils";

interface ContextCapturePanelProps {
  items: ContextItem[];
  onItemsChange: (items: ContextItem[]) => void;
}

export function ContextCapturePanel({ items, onItemsChange }: ContextCapturePanelProps) {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [addingType, setAddingType] = useState<ContextItemType | null>(null);
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [loadingStoreDocId, setLoadingStoreDocId] = useState<number | null>(null);
  const [loadedStoreDocIds, setLoadedStoreDocIds] = useState<Set<number>>(new Set());

  // Inline form state
  const [formContent, setFormContent] = useState("");
  const [formAnnotation, setFormAnnotation] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  // Fetch saved documents for Context Store picker
  const { data: savedDocs, isLoading: isLoadingDocs } = useQuery<{ documents: { id: number; title: string; folderId?: number | null; locked?: boolean; updatedAt: string }[] }>({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/documents");
      return res.json();
    },
    enabled: showStorePicker,
    staleTime: 30_000,
  });

  // Fetch folders for grouped view
  const { data: foldersData } = useQuery<{ folders: FolderItem[] }>({
    queryKey: ["/api/folders/all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/folders");
      return res.json();
    },
    enabled: showStorePicker,
    staleTime: 30_000,
  });

  // Expanded folders in the store picker
  const [expandedPickerFolders, setExpandedPickerFolders] = useState<Set<number>>(new Set());

  const handleLoadStoreDoc = useCallback(async (docId: number, docTitle: string) => {
    setLoadingStoreDocId(docId);
    try {
      const res = await apiRequest("GET", `/api/documents/${docId}`);
      const data = await res.json();
      if (data.content) {
        const newItem: ContextItem = {
          id: generateId("ctx"),
          type: "text",
          content: data.content,
          annotation: `Loaded from Context Store: "${docTitle}"`,
          createdAt: Date.now(),
        };
        onItemsChange([...items, newItem]);
        setLoadedStoreDocIds((prev) => new Set(prev).add(docId));
      }
    } catch {
      // Silently fail — user sees no new item added
    } finally {
      setLoadingStoreDocId(null);
    }
  }, [items, onItemsChange]);

  const handleFileUploadAsContext = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === "string" && content.trim()) {
        const newItem: ContextItem = {
          id: generateId("ctx"),
          type: "text",
          content: content.trim(),
          annotation: `Uploaded file: "${file.name}"`,
          createdAt: Date.now(),
        };
        onItemsChange([...items, newItem]);
        toast({ title: "File uploaded", description: `"${file.name}" added as context.` });
      }
    };
    reader.readAsText(file);
  }, [items, onItemsChange, toast]);

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
      {isAdding && !addingType && !showStorePicker && (
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
            {/* Context Store — first option */}
            <button
              onClick={() => setShowStorePicker(true)}
              className="flex-1 flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border border-primary/30 bg-primary/5 hover:border-primary/50 hover:bg-primary/10 transition-all"
            >
              <HardDrive className="w-5 h-5 text-primary" />
              <span className="text-xs font-medium">Context Store</span>
            </button>
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

      {/* Context Store document picker */}
      {showStorePicker && (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Context Store
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setShowStorePicker(false); resetForm(); }}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Select documents to attach as context</p>
          <ScrollArea className="max-h-64">
            {isLoadingDocs ? (
              <div className="py-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : !savedDocs?.documents?.length ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No saved documents yet
              </div>
            ) : (
              <div className="space-y-0.5">
                {(() => {
                  const allDocs = savedDocs.documents;
                  const allFolders = foldersData?.folders || [];

                  // Root-level docs (no folder)
                  const rootDocs = allDocs.filter((d) => !d.folderId);
                  // Root-level folders
                  const rootFolders = allFolders.filter((f) => f.parentFolderId === null);
                  const getChildren = (parentId: number) => allFolders.filter((f) => f.parentFolderId === parentId);
                  const getDocsInFolder = (folderId: number) => allDocs.filter((d) => d.folderId === folderId);

                  const renderDoc = (doc: typeof allDocs[0]) => (
                    <button
                      key={doc.id}
                      onClick={() => handleLoadStoreDoc(doc.id, doc.title)}
                      disabled={loadingStoreDocId !== null || loadedStoreDocIds.has(doc.id)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-sm rounded-md hover:bg-muted/50 transition-colors disabled:opacity-50"
                    >
                      {loadingStoreDocId === doc.id ? (
                        <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-primary" />
                      ) : loadedStoreDocIds.has(doc.id) ? (
                        <Check className="w-3.5 h-3.5 shrink-0 text-primary" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate flex-1">{doc.title}</span>
                      {loadedStoreDocIds.has(doc.id) && (
                        <span className="text-[10px] text-primary font-medium shrink-0">Added</span>
                      )}
                    </button>
                  );

                  const renderFolder = (folder: FolderItem, depth: number): React.ReactNode => {
                    const children = getChildren(folder.id);
                    const docs = getDocsInFolder(folder.id);
                    const hasContent = children.length > 0 || docs.length > 0;
                    if (!hasContent) return null;
                    const isExpanded = expandedPickerFolders.has(folder.id);
                    return (
                      <div key={folder.id}>
                        <button
                          type="button"
                          onClick={() => setExpandedPickerFolders((prev) => {
                            const next = new Set(prev);
                            if (next.has(folder.id)) next.delete(folder.id); else next.add(folder.id);
                            return next;
                          })}
                          className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-xs rounded-md hover:bg-muted/50 transition-colors"
                          style={{ paddingLeft: `${8 + depth * 12}px` }}
                        >
                          {isExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                          {folder.locked ? (
                            <Lock className="w-3 h-3 shrink-0 text-muted-foreground/50" />
                          ) : null}
                          <Folder className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                          <span className="font-medium truncate">{folder.name}</span>
                        </button>
                        {isExpanded && (
                          <div style={{ paddingLeft: `${depth * 8}px` }}>
                            {children.map((c) => renderFolder(c, depth + 1))}
                            {docs.map(renderDoc)}
                          </div>
                        )}
                      </div>
                    );
                  };

                  return (
                    <>
                      {rootFolders.map((f) => renderFolder(f, 0))}
                      {rootDocs.length > 0 && rootFolders.length > 0 && <div className="border-t my-1" />}
                      {rootDocs.map(renderDoc)}
                    </>
                  );
                })()}
              </div>
            )}
          </ScrollArea>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              <Upload className="w-3.5 h-3.5" />
              Upload file
              <input
                type="file"
                accept=".txt,.md,.text,.csv,.json,.xml,.yaml,.yml,.toml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUploadAsContext(file);
                  e.target.value = "";
                }}
              />
            </label>
            <Button variant="outline" size="sm" onClick={() => { setShowStorePicker(false); resetForm(); }}>
              Done
            </Button>
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
            <ProvokeText
              chrome="inline"
              variant="textarea"
              placeholder="Paste or type your text context..."
              value={formContent}
              onChange={setFormContent}
              className="text-sm"
              minRows={3}
              maxRows={8}
              autoFocus
              voice={{ mode: "append" }}
              onVoiceTranscript={(transcript) => setFormContent(prev => prev ? `${prev} ${transcript}` : transcript)}
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
            <ProvokeText
              chrome="inline"
              variant="input"
              placeholder="https://docs.google.com/..."
              value={formContent}
              onChange={setFormContent}
              className="text-sm"
              autoFocus
              voice={{ mode: "replace" }}
              onVoiceTranscript={(transcript) => setFormContent(transcript)}
              showCopy={false}
            />
          )}

          {/* Annotation field (shared across all types) */}
          <ProvokeText
            chrome="inline"
            variant="input"
            label="Annotation (why does this matter?)"
            placeholder="Explain why this context is important..."
            value={formAnnotation}
            onChange={setFormAnnotation}
            className="text-sm"
            voice={{ mode: "replace" }}
            onVoiceTranscript={(transcript) => setFormAnnotation(transcript)}
            showCopy={false}
          />

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
