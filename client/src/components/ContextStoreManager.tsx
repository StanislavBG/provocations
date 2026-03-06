import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  HardDrive,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderInput,
  FileText,
  FileType,
  ImageIcon,
  Video,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Upload,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  LayoutList,
  X,
  Download,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface ContextStoreManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FolderItem {
  id: number;
  name: string;
  parentId: number | null;
}

interface DocItem {
  id: number;
  title: string;
  content?: string;
  folderId: number | null;
  docType?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDocType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  return "document";
}

function getDocIcon(docType?: string | null) {
  switch (docType) {
    case "image":
      return ImageIcon;
    case "video":
      return Video;
    case "pdf":
      return FileType;
    default:
      return FileText;
  }
}

function getDocBadge(docType?: string | null): string {
  switch (docType) {
    case "image":
      return "Image";
    case "video":
      return "Video";
    case "pdf":
      return "PDF";
    default:
      return "Document";
  }
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Inline Input ─────────────────────────────────────────────────────────────

function InlineInput({
  value,
  onSubmit,
  onCancel,
  placeholder,
}: {
  value: string;
  onSubmit: (v: string) => void;
  onCancel: () => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder={placeholder}
      className="w-full text-xs bg-muted/30 border border-primary/40 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
      onKeyDown={(e) => {
        if (e.key === "Enter" && text.trim()) onSubmit(text.trim());
        if (e.key === "Escape") onCancel();
      }}
      onBlur={() => {
        if (text.trim() && text.trim() !== value) onSubmit(text.trim());
        else onCancel();
      }}
    />
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function ContextStoreManager({
  open,
  onOpenChange,
}: ContextStoreManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Selection state
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortBy, setSortBy] = useState<"date" | "name" | "type">("date");
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  // Folder tree state
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(
    new Set()
  );
  const [creatingFolderIn, setCreatingFolderIn] = useState<
    number | null | false
  >(false);
  const [renamingFolderId, setRenamingFolderId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    folderId: number;
    folderName: string;
  } | null>(null);

  // Document state
  const [renamingDocId, setRenamingDocId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [deletingDoc, setDeletingDoc] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [movingDoc, setMovingDoc] = useState<{
    id: number;
    title: string;
  } | null>(null);

  // Drag-and-drop
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Data queries ───────────────────────────────────────────────────────

  const { data: folders = [] } = useQuery({
    queryKey: ["/api/folders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/folders");
      const data = await res.json();
      return (data.folders ?? data) as FolderItem[];
    },
    enabled: open,
  });

  const { data: rawDocData } = useQuery({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/documents");
      return res.json();
    },
    enabled: open,
  });

  // The shared query key may hold either { documents: [...] } (from FlowWorkspace)
  // or a bare array (from our own queryFn). Normalise to a flat array.
  const documents: DocItem[] = Array.isArray(rawDocData)
    ? rawDocData
    : Array.isArray((rawDocData as any)?.documents)
      ? (rawDocData as any).documents
      : [];

  // Selected document full content (lazy load)
  const { data: selectedDoc } = useQuery({
    queryKey: ["/api/documents", selectedDocId],
    enabled: !!selectedDocId && open,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/documents/${selectedDocId}`);
      return (await res.json()) as DocItem;
    },
  });

  // ── Derived data ───────────────────────────────────────────────────────

  const rootFolders = folders.filter((f) => f.parentId === null);
  const getChildren = (parentId: number) =>
    folders.filter((f) => f.parentId === parentId);
  const folderNameMap = new Map(folders.map((f) => [f.id, f.name]));

  const getFolderPath = (folderId: number | null | undefined): string => {
    if (!folderId) return "/ (Root)";
    const parts: string[] = [];
    let current: number | null = folderId;
    while (current) {
      const folder = folders.find((f) => f.id === current);
      if (!folder) break;
      parts.unshift(folder.name);
      current = folder.parentId;
    }
    return parts.join(" / ") || "/ (Root)";
  };

  // Filter docs by selected folder
  const filteredDocs = useMemo(() => {
    const base =
      selectedFolderId === null
        ? documents
        : documents.filter((d) => d.folderId === selectedFolderId);

    const sorted = Array.isArray(base) ? [...base] : [];
    switch (sortBy) {
      case "name":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "type":
        sorted.sort((a, b) =>
          (a.docType || "document").localeCompare(b.docType || "document")
        );
        break;
      case "date":
      default:
        sorted.sort((a, b) => {
          const da = a.updatedAt || a.createdAt || "";
          const db = b.updatedAt || b.createdAt || "";
          return db.localeCompare(da); // newest first
        });
        break;
    }
    return sorted;
  }, [documents, selectedFolderId, sortBy]);

  const selectedFolderName =
    selectedFolderId === null
      ? "All Files"
      : folderNameMap.get(selectedFolderId) || "Folder";

  // ── Folder mutations ───────────────────────────────────────────────────

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
  };

  const createFolderMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      parentFolderId?: number | null;
    }) => {
      const res = await apiRequest("POST", "/api/folders", data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      invalidate();
      setCreatingFolderIn(false);
      if (variables.parentFolderId != null) {
        setExpandedFolders(
          (prev) => new Set(prev).add(variables.parentFolderId!)
        );
      }
      toast({ title: "Folder created" });
    },
    onError: () =>
      toast({ title: "Failed to create folder", variant: "destructive" }),
  });

  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      await apiRequest("PATCH", `/api/folders/${id}`, { name });
    },
    onSuccess: () => {
      invalidate();
      setRenamingFolderId(null);
      toast({ title: "Folder renamed" });
    },
    onError: () =>
      toast({ title: "Failed to rename folder", variant: "destructive" }),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/folders/${id}`);
    },
    onSuccess: () => {
      invalidate();
      setDeletingFolder(null);
      if (selectedFolderId === deletingFolder?.id) {
        setSelectedFolderId(null);
      }
      toast({ title: "Folder deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete folder", variant: "destructive" });
      setDeletingFolder(null);
    },
  });

  // ── Document mutations ─────────────────────────────────────────────────

  const renameDocMutation = useMutation({
    mutationFn: async ({ id, title }: { id: number; title: string }) => {
      await apiRequest("PATCH", `/api/documents/${id}`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      if (selectedDocId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/documents", selectedDocId],
        });
      }
      setRenamingDocId(null);
      toast({ title: "Document renamed" });
    },
    onError: () =>
      toast({ title: "Failed to rename document", variant: "destructive" }),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      if (selectedDocId === deletingDoc?.id) {
        setSelectedDocId(null);
      }
      setDeletingDoc(null);
      toast({ title: "Document deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete document", variant: "destructive" });
      setDeletingDoc(null);
    },
  });

  const updateDocMutation = useMutation({
    mutationFn: async ({
      id,
      title,
      content,
      folderId,
    }: {
      id: number;
      title: string;
      content: string;
      folderId?: number | null;
    }) => {
      await apiRequest("PUT", `/api/documents/${id}`, {
        title,
        content,
        ...(folderId !== undefined ? { folderId } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      if (selectedDocId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/documents", selectedDocId],
        });
      }
      setEditingContent(false);
      toast({ title: "Document updated" });
    },
    onError: () =>
      toast({ title: "Failed to update document", variant: "destructive" }),
  });

  // ── File upload ────────────────────────────────────────────────────────

  const handleUpload = useCallback(
    async (files: FileList) => {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file, file.name);
        formData.append("title", file.name);
        formData.append("docType", getDocType(file.type));
        if (selectedFolderId) {
          formData.append("folderId", String(selectedFolderId));
        }

        await fetch("/api/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Files uploaded" });
    },
    [selectedFolderId, queryClient, toast]
  );

  // ── Drag-and-drop handlers ────────────────────────────────────────────

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.types.includes("Files")) {
        setIsDraggingOver(true);
      }
    },
    []
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      if (e.dataTransfer.files?.length) {
        handleUpload(e.dataTransfer.files);
      }
    },
    [handleUpload]
  );

  // ── Context menu close ────────────────────────────────────────────────

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedDocId(null);
      setEditingContent(false);
      setMovingDoc(null);
    }
  }, [open]);

  // ── Folder tree toggle ────────────────────────────────────────────────

  const toggleExpand = (id: number) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleFolderContextMenu = (e: React.MouseEvent, f: FolderItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      folderId: f.id,
      folderName: f.name,
    });
  };

  // ── Move doc to folder ────────────────────────────────────────────────

  const handleMoveDoc = useCallback(
    (docId: number, targetFolderId: number | null) => {
      const doc = documents.find((d) => d.id === docId);
      if (!doc) return;
      updateDocMutation.mutate({
        id: docId,
        title: doc.title,
        content: doc.content || "",
        folderId: targetFolderId,
      });
      setMovingDoc(null);
    },
    [documents, updateDocMutation]
  );

  // ── Render folder tree ────────────────────────────────────────────────

  const renderFolder = (
    f: FolderItem,
    depth: number
  ): React.ReactNode => {
    const isExpanded = expandedFolders.has(f.id);
    const children = getChildren(f.id);
    const isSelected = selectedFolderId === f.id;
    const isRenaming = renamingFolderId === f.id;

    return (
      <div key={f.id}>
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors cursor-pointer group",
            isSelected
              ? "bg-primary/15 border border-primary/30"
              : "hover:bg-muted/50"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onContextMenu={(e) => handleFolderContextMenu(e, f)}
        >
          {children.length > 0 ? (
            <button
              className="shrink-0"
              onClick={() => toggleExpand(f.id)}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          ) : (
            <span className="w-3 shrink-0" />
          )}

          {isRenaming ? (
            <div className="flex-1 min-w-0">
              <InlineInput
                value={f.name}
                onSubmit={(name) =>
                  renameFolderMutation.mutate({ id: f.id, name })
                }
                onCancel={() => setRenamingFolderId(null)}
              />
            </div>
          ) : (
            <button
              className="flex items-center gap-1.5 flex-1 text-left min-w-0"
              onClick={() => {
                setSelectedFolderId(f.id);
                setSelectedDocId(null);
              }}
              onDoubleClick={(e) => {
                e.preventDefault();
                setRenamingFolderId(f.id);
              }}
            >
              {isSelected ? (
                <FolderOpen className="w-3.5 h-3.5 text-primary shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              )}
              <span className="text-xs font-medium truncate">{f.name}</span>
            </button>
          )}

          {/* Hover actions */}
          {!isRenaming && (
            <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
              <button
                className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                title="New subfolder"
                onClick={(e) => {
                  e.stopPropagation();
                  setCreatingFolderIn(f.id);
                  setExpandedFolders(
                    (prev) => new Set(prev).add(f.id)
                  );
                }}
              >
                <FolderPlus className="w-3 h-3" />
              </button>
              <button
                className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                title="Rename"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingFolderId(f.id);
                }}
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground hover:text-destructive"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingFolder({ id: f.id, name: f.name });
                }}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Inline new subfolder input */}
        {creatingFolderIn === f.id && isExpanded && (
          <div
            className="flex items-center gap-1.5 px-2 py-1"
            style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
          >
            <FolderPlus className="w-3.5 h-3.5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <InlineInput
                value=""
                placeholder="Folder name..."
                onSubmit={(name) =>
                  createFolderMutation.mutate({
                    name,
                    parentFolderId: f.id,
                  })
                }
                onCancel={() => setCreatingFolderIn(false)}
              />
            </div>
          </div>
        )}

        {isExpanded &&
          children.map((child) => renderFolder(child, depth + 1))}
      </div>
    );
  };

  // ── Preview panel content ─────────────────────────────────────────────

  const renderPreview = () => {
    if (!selectedDoc) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
          <Eye className="w-8 h-8 text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground/60">
            Select a file to preview
          </p>
        </div>
      );
    }

    const docType = selectedDoc.docType || "document";

    return (
      <div className="flex flex-col h-full">
        {/* Preview content */}
        <div className="flex-1 overflow-auto p-4">
          {docType === "image" && selectedDoc.content && (
            <div className="flex items-center justify-center h-full">
              <img
                src={selectedDoc.content}
                alt={selectedDoc.title}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          )}

          {docType === "video" && selectedDoc.content && (
            <div className="flex items-center justify-center h-full">
              <video
                src={selectedDoc.content}
                controls
                className="max-w-full max-h-full rounded-lg"
              />
            </div>
          )}

          {docType === "pdf" && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <FileType className="w-12 h-12 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                {selectedDoc.title}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => {
                  if (selectedDoc.content) {
                    const blob = new Blob([selectedDoc.content], {
                      type: "application/pdf",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = selectedDoc.title;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                }}
              >
                <Download className="w-3 h-3" />
                Download
              </Button>
            </div>
          )}

          {docType === "document" && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Content
                </span>
                {!editingContent ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px]"
                    onClick={() => {
                      setEditingContent(true);
                      setEditedContent(selectedDoc.content || "");
                    }}
                  >
                    <Pencil className="w-2.5 h-2.5 mr-0.5" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px]"
                      onClick={() => setEditingContent(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-5 px-1.5 text-[10px]"
                      onClick={() =>
                        updateDocMutation.mutate({
                          id: selectedDoc.id,
                          title: selectedDoc.title,
                          content: editedContent,
                        })
                      }
                      disabled={updateDocMutation.isPending}
                    >
                      Save
                    </Button>
                  </div>
                )}
              </div>
              {editingContent ? (
                <textarea
                  className="flex-1 w-full text-xs bg-muted/30 border border-border/50 rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                />
              ) : (
                <div className="flex-1 overflow-auto text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/20 rounded-lg p-3 border border-border/30">
                  {selectedDoc.content || (
                    <span className="italic text-muted-foreground/40">
                      No content
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* File info section */}
        <div className="border-t border-border/50 p-4 space-y-1.5 bg-card/30">
          <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            File Info
          </h4>
          <div className="grid grid-cols-[80px_1fr] gap-y-1 text-[10px]">
            <span className="text-muted-foreground">Name</span>
            <span className="truncate">{selectedDoc.title}</span>
            <span className="text-muted-foreground">Type</span>
            <span>{getDocBadge(selectedDoc.docType)}</span>
            <span className="text-muted-foreground">Location</span>
            <span className="truncate">
              {getFolderPath(selectedDoc.folderId)}
            </span>
            {selectedDoc.createdAt && (
              <>
                <span className="text-muted-foreground">Created</span>
                <span>{formatDateTime(selectedDoc.createdAt)}</span>
              </>
            )}
            {selectedDoc.updatedAt && (
              <>
                <span className="text-muted-foreground">Updated</span>
                <span>{formatDateTime(selectedDoc.updatedAt)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-6xl h-[85vh] p-0 overflow-hidden flex flex-col"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Context Store Manager</DialogTitle>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border/50 shrink-0">
          <HardDrive className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Context Store</h2>
          <span className="text-[10px] text-muted-foreground">
            {documents.length} files, {folders.length} folders
          </span>
        </div>

        {/* Three-panel layout */}
        <div className="flex flex-1 min-h-0">
          {/* Left panel: Folder tree */}
          <div className="w-[280px] border-r border-border/50 flex flex-col bg-card/50 shrink-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
              <span className="text-xs font-semibold">Folders</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-primary hover:text-primary"
                onClick={() => setCreatingFolderIn(null)}
              >
                <Plus className="w-3 h-3 mr-0.5" />
                New Folder
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="py-1">
                {/* All Files */}
                <button
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors",
                    selectedFolderId === null
                      ? "bg-primary/15"
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => {
                    setSelectedFolderId(null);
                    setSelectedDocId(null);
                  }}
                >
                  <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-xs font-medium">All Files</span>
                  <span className="text-[10px] text-muted-foreground/50 ml-auto">
                    {documents.length}
                  </span>
                </button>

                {/* Inline new folder at root */}
                {creatingFolderIn === null && (
                  <div
                    className="flex items-center gap-1.5 px-2 py-1"
                    style={{ paddingLeft: "8px" }}
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <InlineInput
                        value=""
                        placeholder="Folder name..."
                        onSubmit={(name) =>
                          createFolderMutation.mutate({
                            name,
                            parentFolderId: null,
                          })
                        }
                        onCancel={() => setCreatingFolderIn(false)}
                      />
                    </div>
                  </div>
                )}

                {rootFolders.map((folder) => renderFolder(folder, 0))}

                {folders.length === 0 && creatingFolderIn === false && (
                  <p className="text-[10px] text-muted-foreground/60 py-3 text-center">
                    No folders yet
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Center panel: File list */}
          <div
            className="flex-1 flex flex-col min-w-0 relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* File list header */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 shrink-0">
              <span className="text-xs font-semibold truncate">
                {selectedFolderName}
              </span>
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4 font-normal shrink-0"
              >
                {filteredDocs.length}
              </Badge>
              <div className="flex-1" />

              {/* Sort dropdown */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[10px] gap-1"
                  onClick={() => setSortDropdownOpen((v) => !v)}
                >
                  <ArrowUpDown className="w-3 h-3" />
                  {sortBy === "name"
                    ? "Name"
                    : sortBy === "type"
                      ? "Type"
                      : "Date"}
                </Button>
                {sortDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-50"
                      onClick={() => setSortDropdownOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[100px]">
                      {(["date", "name", "type"] as const).map((s) => (
                        <button
                          key={s}
                          className="w-full px-3 py-1 text-xs text-left hover:bg-muted transition-colors"
                          onClick={() => {
                            setSortBy(s);
                            setSortDropdownOpen(false);
                          }}
                        >
                          {s === "date"
                            ? "Date"
                            : s === "name"
                              ? "Name"
                              : "Type"}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* View toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6"
                onClick={() =>
                  setViewMode((v) => (v === "list" ? "grid" : "list"))
                }
              >
                {viewMode === "list" ? (
                  <LayoutGrid className="w-3 h-3" />
                ) : (
                  <LayoutList className="w-3 h-3" />
                )}
              </Button>

              {/* Upload button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[10px] gap-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3 h-3" />
                Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleUpload(e.target.files);
                    e.target.value = "";
                  }
                }}
              />
            </div>

            {/* File list / grid */}
            <ScrollArea className="flex-1">
              {filteredDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-6 py-12">
                  <FileText className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground/60">
                    No files in this folder
                  </p>
                  <p className="text-[10px] text-muted-foreground/40 mt-1">
                    Upload files or create documents to get started
                  </p>
                </div>
              ) : viewMode === "list" ? (
                <div className="divide-y divide-border/30">
                  {filteredDocs.map((doc) => {
                    const Icon = getDocIcon(doc.docType);
                    const isRenaming = renamingDocId === doc.id;
                    const isActive = selectedDocId === doc.id;

                    return (
                      <div
                        key={doc.id}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2.5 group transition-colors cursor-pointer",
                          isActive
                            ? "bg-primary/10"
                            : "hover:bg-muted/30"
                        )}
                        onClick={() => setSelectedDocId(doc.id)}
                      >
                        <Icon className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />

                        {isRenaming ? (
                          <div className="flex-1 min-w-0">
                            <InlineInput
                              value={doc.title}
                              onSubmit={(title) =>
                                renameDocMutation.mutate({
                                  id: doc.id,
                                  title,
                                })
                              }
                              onCancel={() => setRenamingDocId(null)}
                            />
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">
                              {doc.title}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 h-3.5 font-normal"
                              >
                                {getDocBadge(doc.docType)}
                              </Badge>
                              {doc.updatedAt && (
                                <span className="text-[10px] text-muted-foreground/40">
                                  {formatDate(doc.updatedAt)}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Hover actions */}
                        {!isRenaming && (
                          <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                            <button
                              className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                              title="Preview"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDocId(doc.id);
                              }}
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                            <button
                              className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                              title="Rename"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingDocId(doc.id);
                              }}
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                              title="Move to folder"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMovingDoc({
                                  id: doc.id,
                                  title: doc.title,
                                });
                              }}
                            >
                              <FolderInput className="w-3 h-3" />
                            </button>
                            <button
                              className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-destructive"
                              title="Delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingDoc({
                                  id: doc.id,
                                  title: doc.title,
                                });
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Grid view */
                <div className="grid grid-cols-3 gap-3 p-4">
                  {filteredDocs.map((doc) => {
                    const Icon = getDocIcon(doc.docType);
                    const isActive = selectedDocId === doc.id;

                    return (
                      <div
                        key={doc.id}
                        className={cn(
                          "border rounded-lg p-3 cursor-pointer transition-colors group",
                          isActive
                            ? "border-primary/40 bg-primary/5"
                            : "border-border/50 hover:bg-muted/30"
                        )}
                        onClick={() => setSelectedDocId(doc.id)}
                      >
                        <div className="flex items-center justify-center h-16 mb-2 bg-muted/20 rounded">
                          <Icon className="w-8 h-8 text-muted-foreground/30" />
                        </div>
                        <div className="text-xs font-medium truncate">
                          {doc.title}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 h-3.5 font-normal"
                          >
                            {getDocBadge(doc.docType)}
                          </Badge>
                          {doc.updatedAt && (
                            <span className="text-[9px] text-muted-foreground/40">
                              {formatDate(doc.updatedAt)}
                            </span>
                          )}
                        </div>
                        {/* Grid hover actions */}
                        <div className="hidden group-hover:flex items-center gap-1 mt-2 justify-end">
                          <button
                            className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                            title="Rename"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingDocId(doc.id);
                            }}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                            title="Move"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMovingDoc({
                                id: doc.id,
                                title: doc.title,
                              });
                            }}
                          >
                            <FolderInput className="w-3 h-3" />
                          </button>
                          <button
                            className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-destructive"
                            title="Delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingDoc({
                                id: doc.id,
                                title: doc.title,
                              });
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Drag-and-drop overlay */}
            {isDraggingOver && (
              <div className="absolute inset-0 z-10 bg-primary/5 border-2 border-dashed border-primary/40 rounded-lg flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <Upload className="w-8 h-8 text-primary/60 mx-auto mb-2" />
                  <p className="text-xs text-primary/80 font-medium">
                    Drop files here to upload
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right panel: Preview + Edit */}
          {selectedDocId && (
            <div className="w-[350px] border-l border-border/50 flex flex-col bg-card/30 shrink-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 shrink-0">
                <span className="text-xs font-semibold truncate">
                  Preview
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-5 h-5"
                  onClick={() => {
                    setSelectedDocId(null);
                    setEditingContent(false);
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
              {renderPreview()}
            </div>
          )}
        </div>

        {/* ── Overlays ─────────────────────────────────────────────────── */}

        {/* Context menu for folders */}
        {contextMenu && (
          <div
            className="fixed z-[9999] bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[140px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/50 text-left"
              onClick={() => {
                setRenamingFolderId(contextMenu.folderId);
                setContextMenu(null);
              }}
            >
              <Pencil className="w-3 h-3" />
              Rename
            </button>
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/50 text-left"
              onClick={() => {
                setCreatingFolderIn(contextMenu.folderId);
                setExpandedFolders(
                  (prev) => new Set(prev).add(contextMenu.folderId)
                );
                setContextMenu(null);
              }}
            >
              <FolderPlus className="w-3 h-3" />
              New Subfolder
            </button>
            <div className="border-t border-border/50 my-1" />
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/50 text-left text-destructive"
              onClick={() => {
                setDeletingFolder({
                  id: contextMenu.folderId,
                  name: contextMenu.folderName,
                });
                setContextMenu(null);
              }}
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        )}

        {/* Delete folder confirmation */}
        {deletingFolder && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
            <div className="bg-popover border border-border rounded-xl shadow-2xl p-5 max-w-sm w-full mx-4">
              <h4 className="text-sm font-semibold mb-2">Delete folder?</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Are you sure you want to delete{" "}
                <span className="font-medium text-foreground">
                  "{deletingFolder.name}"
                </span>
                ? Documents inside may be moved to root.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDeletingFolder(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    deleteFolderMutation.mutate(deletingFolder.id)
                  }
                  disabled={deleteFolderMutation.isPending}
                >
                  {deleteFolderMutation.isPending
                    ? "Deleting..."
                    : "Delete"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete document confirmation */}
        {deletingDoc && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
            <div className="bg-popover border border-border rounded-xl shadow-2xl p-5 max-w-sm w-full mx-4">
              <h4 className="text-sm font-semibold mb-2">
                Delete document?
              </h4>
              <p className="text-xs text-muted-foreground mb-4">
                Are you sure you want to delete{" "}
                <span className="font-medium text-foreground">
                  "{deletingDoc.title}"
                </span>
                ? This cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDeletingDoc(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    deleteDocMutation.mutate(deletingDoc.id)
                  }
                  disabled={deleteDocMutation.isPending}
                >
                  {deleteDocMutation.isPending
                    ? "Deleting..."
                    : "Delete"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Move document to folder */}
        {movingDoc && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
            <div className="bg-popover border border-border rounded-xl shadow-2xl p-5 max-w-sm w-full mx-4">
              <h4 className="text-sm font-semibold mb-2">
                Move "{movingDoc.title}"
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Select destination folder:
              </p>
              <div className="border border-border/50 rounded-lg max-h-[200px] overflow-auto mb-4">
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-muted/50 transition-colors"
                  onClick={() => handleMoveDoc(movingDoc.id, null)}
                >
                  <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                  / (Root)
                </button>
                {folders.map((f) => (
                  <button
                    key={f.id}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-muted/50 transition-colors"
                    style={{
                      paddingLeft: `${(f.parentId ? 2 : 1) * 12 + 12}px`,
                    }}
                    onClick={() => handleMoveDoc(movingDoc.id, f.id)}
                  >
                    <Folder className="w-3.5 h-3.5 text-amber-500" />
                    {f.name}
                  </button>
                ))}
              </div>
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setMovingDoc(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
