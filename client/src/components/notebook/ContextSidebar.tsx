import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2,
  X,
  FolderOpen,
  Folder,
  FileText,
  ChevronRight,
  ChevronDown,
  Search,
  Upload,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  FolderPlus,
  Pencil,
  Trash2,
  Zap,
  BookmarkPlus,
  FileOutput,
} from "lucide-react";
import type { DocumentListItem, FolderItem } from "@shared/schema";

interface ContextSidebarProps {
  pinnedDocIds: Set<number>;
  onPinDoc: (id: number) => void;
  onUnpinDoc: (id: number) => void;
  /** Called on single-click to preview a document */
  onPreviewDoc?: (id: number, title: string) => void;
  /** Called on double-click to open a document for editing */
  onOpenDoc?: (id: number, title: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  /** When true, renders without its own header/border (used inside NotebookLeftPanel tabs) */
  embedded?: boolean;
}

/** Compute tree indent padding — depth 0 is fully left-aligned, scales to 10+ levels */
function treeIndent(depth: number): number {
  if (depth === 0) return 0;
  let px = 0;
  for (let i = 1; i <= depth; i++) {
    if (i <= 4) px += 14;
    else if (i <= 7) px += 10;
    else px += 7;
  }
  return px;
}

/* ── Drag-and-drop helpers ── */
interface DragData {
  type: "folder" | "document";
  id: number;
  title: string;
}

const DRAG_MIME = "application/x-context-sidebar-drag";

function encodeDragData(data: DragData, dt: DataTransfer) {
  dt.setData(DRAG_MIME, JSON.stringify(data));
  dt.effectAllowed = "move";
}

function decodeDragData(dt: DataTransfer): DragData | null {
  try {
    const raw = dt.getData(DRAG_MIME);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Inline rename input — auto-focuses, submits on Enter, cancels on Escape */
function InlineRenameInput({
  value,
  onSubmit,
  onCancel,
}: {
  value: string;
  onSubmit: (newValue: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <Input
      ref={ref}
      value={text}
      onChange={(e) => setText(e.target.value)}
      className="h-6 text-xs px-1.5"
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

export function ContextSidebar({
  pinnedDocIds,
  onPinDoc,
  onUnpinDoc,
  onPreviewDoc,
  onOpenDoc,
  isCollapsed,
  onToggleCollapse,
  embedded = false,
}: ContextSidebarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  // CRUD state
  const [editingItem, setEditingItem] = useState<{
    id: number;
    type: "doc" | "folder";
    value: string;
  } | null>(null);
  const [deletingItem, setDeletingItem] = useState<{
    id: number;
    type: "doc" | "folder";
    name: string;
  } | null>(null);
  // parentFolderId for new item: null = root, number = inside that folder, false = not creating
  const [creatingFolderIn, setCreatingFolderIn] = useState<number | null | false>(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingDocIn, setCreatingDocIn] = useState<number | null | false>(false);
  const [newDocTitle, setNewDocTitle] = useState("");

  // Drag-and-drop state
  const [dragOverFolderId, setDragOverFolderId] = useState<number | "root" | null>(null);
  const dragExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data queries ──
  const { data: docsData } = useQuery<{ documents: DocumentListItem[] }>({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/documents");
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: foldersData } = useQuery<FolderItem[]>({
    queryKey: ["/api/folders/all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/folders");
      const data = await res.json();
      return data.folders ?? data;
    },
    staleTime: 30_000,
  });

  const docs = docsData?.documents ?? [];
  const folders = foldersData ?? [];

  // ── CRUD mutations ──
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const res = await apiRequest("POST", "/api/documents", {
        title: file.name,
        content: text,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      // Auto-pin uploaded file to active context
      if (data?.id) onPinDoc(data.id);
      toast({ title: "Uploaded", description: "File added to active context" });
    },
  });

  const createDocMutation = useMutation({
    mutationFn: async ({ title, folderId }: { title: string; folderId: number | null }) => {
      const res = await apiRequest("POST", "/api/documents", {
        title,
        content: " ",
        folderId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setCreatingDocIn(false);
      setNewDocTitle("");
      toast({ title: "Created", description: "New document created" });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async ({ name, parentFolderId }: { name: string; parentFolderId: number | null }) => {
      const res = await apiRequest("POST", "/api/folders", {
        name,
        parentFolderId,
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders/all"] });
      setCreatingFolderIn(false);
      setNewFolderName("");
      // Auto-expand parent folder so the new subfolder is visible
      if (variables.parentFolderId !== null) {
        setExpandedFolders((prev) => new Set(prev).add(variables.parentFolderId!));
      }
      toast({ title: "Created", description: "New folder created" });
    },
  });

  const renameDocMutation = useMutation({
    mutationFn: async ({ id, title }: { id: number; title: string }) => {
      await apiRequest("PATCH", `/api/documents/${id}`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setEditingItem(null);
    },
  });

  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      await apiRequest("PATCH", `/api/folders/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders/all"] });
      setEditingItem(null);
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      if (pinnedDocIds.has(id)) onUnpinDoc(id);
      setDeletingItem(null);
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/folders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders/all"] });
      setDeletingItem(null);
    },
  });

  // ── Move mutations (drag-and-drop) ──
  const moveDocMutation = useMutation({
    mutationFn: async ({ id, folderId }: { id: number; folderId: number | null }) => {
      await apiRequest("PATCH", `/api/documents/${id}/move`, { folderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
  });

  const moveFolderMutation = useMutation({
    mutationFn: async ({ id, parentFolderId }: { id: number; parentFolderId: number | null }) => {
      await apiRequest("PATCH", `/api/folders/${id}/move`, { parentFolderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders/all"] });
    },
    onError: (err: Error) => {
      toast({ title: "Cannot move folder", description: err.message, variant: "destructive" });
    },
  });

  // ── Helpers ──
  const handleFileUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.md,.csv,.json,.xml,.yaml,.toml,.html";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) uploadMutation.mutate(file);
    };
    input.click();
  }, [uploadMutation]);

  const toggleFolder = (id: number) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Drag-and-drop handlers ──
  const handleDrop = useCallback(
    (targetFolderId: number | null, e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (dragExpandTimerRef.current) {
        clearTimeout(dragExpandTimerRef.current);
        dragExpandTimerRef.current = null;
      }
      setDragOverFolderId(null);
      const data = decodeDragData(e.dataTransfer);
      if (!data) return;
      if (data.type === "document") {
        moveDocMutation.mutate({ id: data.id, folderId: targetFolderId });
      } else if (data.type === "folder") {
        if (data.id === targetFolderId) return;
        moveFolderMutation.mutate({ id: data.id, parentFolderId: targetFolderId });
      }
    },
    [moveDocMutation, moveFolderMutation],
  );

  const handleDragOver = useCallback(
    (folderId: number | "root", e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      setDragOverFolderId((prev) => {
        // When entering a new folder, start auto-expand timer
        if (prev !== folderId) {
          if (dragExpandTimerRef.current) clearTimeout(dragExpandTimerRef.current);
          if (typeof folderId === "number") {
            dragExpandTimerRef.current = setTimeout(() => {
              setExpandedFolders((folders) => {
                const next = new Set(folders);
                next.add(folderId);
                return next;
              });
            }, 600);
          }
        }
        return folderId;
      });
    },
    [],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (dragExpandTimerRef.current) {
        clearTimeout(dragExpandTimerRef.current);
        dragExpandTimerRef.current = null;
      }
      setDragOverFolderId(null);
    }
  }, []);

  // ── Filtering ──
  const q = searchQuery.toLowerCase();
  const filteredDocs = q
    ? docs.filter((d) => d.title.toLowerCase().includes(q))
    : docs;
  const filteredFolders = q
    ? folders.filter((f) => f.name.toLowerCase().includes(q))
    : folders;

  // Pinned docs resolved from full list
  const pinnedDocs = docs.filter((d) => pinnedDocIds.has(d.id));

  // Tree helpers
  const rootFolders = filteredFolders.filter((f) => f.parentFolderId === null);
  const getChildren = (parentId: number) =>
    filteredFolders.filter((f) => f.parentFolderId === parentId);
  const getDocsInFolder = (folderId: number | null) =>
    filteredDocs.filter((d) =>
      folderId === null ? !d.folderId : d.folderId === folderId,
    );
  const rootDocs = getDocsInFolder(null);

  // ── Collapsed view (only when not embedded — parent handles collapse) ──
  if (isCollapsed && !embedded) {
    return (
      <div className="h-full flex flex-col items-center py-2 gap-2 bg-card border-r w-12">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleCollapse}
            >
              <PanelLeftOpen className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Expand context</TooltipContent>
        </Tooltip>

        {pinnedDocIds.size > 0 && (
          <Tooltip>
            <TooltipTrigger>
              <Badge className="text-[10px] h-5 min-w-[20px] justify-center bg-green-600">
                {pinnedDocIds.size}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="right">
              {pinnedDocIds.size} document{pinnedDocIds.size > 1 ? "s" : ""} in
              active context
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 mt-auto"
              onClick={handleFileUpload}
            >
              <Upload className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Upload file</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // ── Document row renderer (Context Store tree) ──
  const renderDocRow = (doc: DocumentListItem, indent: number, hasTreeLine = false) => {
    const isPinned = pinnedDocIds.has(doc.id);
    const isEditing =
      editingItem?.id === doc.id && editingItem?.type === "doc";

    return (
      <div
        key={`d-${doc.id}`}
        draggable={!isEditing}
        onDragStart={(e) => {
          encodeDragData({ type: "document", id: doc.id, title: doc.title }, e.dataTransfer);
        }}
        className={`flex items-center gap-1 group rounded-md transition-all overflow-hidden pr-1 cursor-grab active:cursor-grabbing ${
          isPinned
            ? "bg-green-500/10 border-l-2 border-green-500"
            : "hover:bg-muted/50"
        }`}
        style={{ paddingLeft: `${isPinned ? indent - 2 : indent}px` }}
      >
        {/* Tree connector line: tiny gray angled line from parent folder */}
        {hasTreeLine && !isPinned && (
          <span className="inline-flex items-center h-full shrink-0 text-muted-foreground/25 select-none" style={{ width: '10px', marginRight: '-2px' }}>
            <svg width="10" height="20" viewBox="0 0 10 20" fill="none" className="shrink-0">
              <path d="M1 0 L1 10 L9 10" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          </span>
        )}
        {isEditing ? (
          <div className="flex-1 py-1 px-1">
            <InlineRenameInput
              value={editingItem.value}
              onSubmit={(newTitle) =>
                renameDocMutation.mutate({ id: doc.id, title: newTitle })
              }
              onCancel={() => setEditingItem(null)}
            />
          </div>
        ) : (
          <>
            <button
              className="flex-1 flex items-center gap-1.5 py-1.5 px-1 text-left min-w-0"
              onClick={() => {
                onPreviewDoc?.(doc.id, doc.title);
              }}
              onDoubleClick={(e) => {
                e.preventDefault();
                onOpenDoc?.(doc.id, doc.title);
              }}
              title="Click to preview, double-click to edit"
            >
              {isPinned ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
              )}
              <span
                className={`text-xs truncate ${
                  isPinned ? "font-medium text-green-700 dark:text-green-400" : ""
                }`}
              >
                {doc.title}
              </span>
            </button>

            {/* Hover actions */}
            <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {isPinned && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-green-600 hover:text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnpinDoc(doc.id);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Remove from active context
                  </TooltipContent>
                </Tooltip>
              )}
              {!isPinned && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground/50 hover:text-green-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPinDoc(doc.id);
                      }}
                    >
                      <BookmarkPlus className="w-2.5 h-2.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Load to context</TooltipContent>
                </Tooltip>
              )}
              {onOpenDoc && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground/50 hover:text-amber-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDoc(doc.id, doc.title);
                      }}
                    >
                      <FileOutput className="w-2.5 h-2.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Open as document</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground/50 hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingItem({
                        id: doc.id,
                        type: "doc",
                        value: doc.title,
                      });
                    }}
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Rename</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground/50 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingItem({
                        id: doc.id,
                        type: "doc",
                        name: doc.title,
                      });
                    }}
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Delete</TooltipContent>
              </Tooltip>
            </div>
          </>
        )}
      </div>
    );
  };

  // ── Folder tree renderer ──
  const renderFolder = (
    folder: FolderItem,
    depth: number,
  ): React.ReactNode => {
    const isExpanded = expandedFolders.has(folder.id);
    const children = getChildren(folder.id);
    const folderDocs = getDocsInFolder(folder.id);
    const hasContent = children.length > 0 || folderDocs.length > 0;
    const indent = treeIndent(depth);
    const isEditing =
      editingItem?.id === folder.id && editingItem?.type === "folder";
    const isDragOver = dragOverFolderId === folder.id;

    // Count how many docs in this folder are pinned
    const pinnedInFolder = folderDocs.filter((d) =>
      pinnedDocIds.has(d.id),
    ).length;

    return (
      <div key={`f-${folder.id}`}>
        <div
          className={`flex items-center gap-0.5 group rounded-md transition-colors overflow-hidden pr-1 ${
            isDragOver
              ? "bg-amber-500/15 ring-1 ring-amber-500/40"
              : "hover:bg-muted/50"
          }`}
          style={{ paddingLeft: `${indent}px` }}
          onDragOver={(e) => handleDragOver(folder.id, e)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(folder.id, e)}
        >
          {isEditing ? (
            <div className="flex-1 py-1 px-1">
              <InlineRenameInput
                value={editingItem.value}
                onSubmit={(newName) =>
                  renameFolderMutation.mutate({ id: folder.id, name: newName })
                }
                onCancel={() => setEditingItem(null)}
              />
            </div>
          ) : (
            <>
              {/* Drag handle — only the folder icon + name are draggable */}
              <button
                draggable
                onDragStart={(e) => {
                  encodeDragData({ type: "folder", id: folder.id, title: folder.name }, e.dataTransfer);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolder(folder.id);
                }}
                className="flex-1 text-left py-1.5 px-1 text-xs flex items-center gap-1.5 min-w-0 cursor-pointer"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 shrink-0" />
                ) : (
                  <ChevronRight className="w-3 h-3 shrink-0" />
                )}
                {isExpanded ? (
                  <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                ) : (
                  <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="truncate font-medium">{folder.name}</span>
                {pinnedInFolder > 0 && (
                  <Badge className="text-[8px] h-3.5 px-1 bg-green-600 ml-auto shrink-0">
                    {pinnedInFolder}
                  </Badge>
                )}
              </button>

              {/* Hover actions */}
              <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Add document / subfolder — hidden at max depth (10th level = depth 9) */}
                {depth < 9 && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-muted-foreground/50 hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCreatingDocIn(folder.id);
                            setNewDocTitle("");
                            setExpandedFolders((prev) => new Set(prev).add(folder.id));
                          }}
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">New document</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-muted-foreground/50 hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCreatingFolderIn(folder.id);
                            setNewFolderName("");
                            setExpandedFolders((prev) => new Set(prev).add(folder.id));
                          }}
                        >
                          <FolderPlus className="w-2.5 h-2.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">New subfolder</TooltipContent>
                    </Tooltip>
                  </>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground/50 hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingItem({
                          id: folder.id,
                          type: "folder",
                          value: folder.name,
                        });
                      }}
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Rename</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground/50 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingItem({
                          id: folder.id,
                          type: "folder",
                          name: folder.name,
                        });
                      }}
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Delete</TooltipContent>
                </Tooltip>
              </div>
            </>
          )}
        </div>

        {isExpanded && (
          <div>
            {/* Inline create subfolder */}
            {creatingFolderIn === folder.id && (
              <div
                className="flex items-center gap-1 my-0.5"
                style={{ paddingLeft: `${treeIndent(depth + 1)}px` }}
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name..."
                  className="h-6 text-xs flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newFolderName.trim() && !createFolderMutation.isPending)
                      createFolderMutation.mutate({ name: newFolderName.trim(), parentFolderId: folder.id });
                    if (e.key === "Escape") setCreatingFolderIn(false);
                  }}
                  onBlur={() => {
                    if (!newFolderName.trim()) setCreatingFolderIn(false);
                  }}
                />
              </div>
            )}
            {children.map((child) => renderFolder(child, depth + 1))}
            {/* Inline create document in folder */}
            {creatingDocIn === folder.id && (
              <div
                className="flex items-center gap-1 my-0.5"
                style={{ paddingLeft: `${treeIndent(depth + 1)}px` }}
              >
                <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <Input
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="Document title..."
                  className="h-6 text-xs flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newDocTitle.trim() && !createDocMutation.isPending)
                      createDocMutation.mutate({ title: newDocTitle.trim(), folderId: folder.id });
                    if (e.key === "Escape") setCreatingDocIn(false);
                  }}
                  onBlur={() => {
                    if (!newDocTitle.trim()) setCreatingDocIn(false);
                  }}
                />
              </div>
            )}
            {folderDocs.map((doc) =>
              renderDocRow(doc, treeIndent(depth + 1), true),
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col overflow-hidden ${embedded ? "flex-1 min-h-0" : "h-full bg-card border-r"}`}>
      {/* ─── Header (hidden when embedded in tab panel) ─── */}
      {!embedded && (
        <div className="p-2 border-b flex items-center justify-between gap-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Context
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onToggleCollapse}
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* ─── Search ─── */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="h-7 text-xs pl-7"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 min-w-0 [&_[data-radix-scroll-area-viewport]>div]:!block">
        {/* ═══ ACTIVE CONTEXT ═══ */}
        <div className="border-b overflow-hidden">
          <div className="px-2 pt-2 pb-1 flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-green-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400">
              Active Context
            </span>
            {pinnedDocs.length > 0 && (
              <Badge className="text-[9px] h-4 px-1.5 bg-green-600 ml-auto">
                {pinnedDocs.length}
              </Badge>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-5 w-5 shrink-0 ${pinnedDocs.length > 0 ? "" : "ml-auto"}`}
                  onClick={handleFileUpload}
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upload file to active context</TooltipContent>
            </Tooltip>
          </div>

          {pinnedDocs.length === 0 ? (
            <div className="px-3 pb-3 pt-1">
              <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                Upload files or click documents below to add them as context.
                Only documents in Active Context are shared with your AI advisors.
              </p>
            </div>
          ) : (
            <div className="px-2 pb-2 space-y-0.5">
              {pinnedDocs.map((doc) => (
                <div
                  key={`active-${doc.id}`}
                  className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-green-500/10 border border-green-500/20 group min-w-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  <span className="text-xs font-medium truncate flex-1 text-green-700 dark:text-green-400">
                    {doc.title}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={() => onUnpinDoc(doc.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ CONTEXT STORE (Persisted) — root drop zone ═══ */}
        <div
          className={`p-2 overflow-hidden min-h-[60px] ${
            dragOverFolderId === "root" ? "bg-amber-500/5" : ""
          }`}
          onDragOver={(e) => handleDragOver("root", e)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(null, e)}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Context Store
            </span>
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => {
                      setCreatingDocIn(null);
                      setNewDocTitle("");
                    }}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New document</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => {
                      setCreatingFolderIn(null);
                      setNewFolderName("");
                    }}
                  >
                    <FolderPlus className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New folder</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Root drop indicator */}
          {dragOverFolderId === "root" && (
            <div className="mb-1 py-1 px-2 rounded border border-dashed border-amber-500/50 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400 text-center">
              Drop here to move to root
            </div>
          )}

          {/* Create new folder inline (root level) */}
          {creatingFolderIn === null && (
            <div className="flex items-center gap-1 mb-1 pl-1">
              <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name..."
                className="h-6 text-xs flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFolderName.trim() && !createFolderMutation.isPending)
                    createFolderMutation.mutate({ name: newFolderName.trim(), parentFolderId: null });
                  if (e.key === "Escape") setCreatingFolderIn(false);
                }}
                onBlur={() => {
                  if (!newFolderName.trim()) setCreatingFolderIn(false);
                }}
              />
            </div>
          )}

          {/* Create new document inline (root level) */}
          {creatingDocIn === null && (
            <div className="flex items-center gap-1 mb-1 pl-1">
              <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <Input
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="Document title..."
                className="h-6 text-xs flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newDocTitle.trim() && !createDocMutation.isPending)
                    createDocMutation.mutate({ title: newDocTitle.trim(), folderId: null });
                  if (e.key === "Escape") setCreatingDocIn(false);
                }}
                onBlur={() => {
                  if (!newDocTitle.trim()) setCreatingDocIn(false);
                }}
              />
            </div>
          )}

          {/* Folder tree */}
          {rootFolders.map((folder) => renderFolder(folder, 0))}

          {/* Root-level documents */}
          {rootDocs.map((doc) =>
            renderDocRow(doc, treeIndent(0)),
          )}

          {/* Empty state */}
          {docs.length === 0 && creatingDocIn === false && creatingFolderIn === false && (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground/50">
              <FileText className="w-6 h-6" />
              <p className="text-xs text-center">
                No documents yet.
                <br />
                Upload files or create new ones.
              </p>
            </div>
          )}

          {/* Spacer to keep root drop zone accessible at bottom */}
          <div className="min-h-[40px]" />
        </div>
      </ScrollArea>

      {/* ─── Delete confirmation dialog ─── */}
      <AlertDialog
        open={!!deletingItem}
        onOpenChange={(open) => {
          if (!open) setDeletingItem(null);
        }}
      >
        <AlertDialogContent
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!deletingItem) return;
              if (deletingItem.type === "doc")
                deleteDocMutation.mutate(deletingItem.id);
              else deleteFolderMutation.mutate(deletingItem.id);
              setDeletingItem(null);
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deletingItem?.type === "folder" ? "folder" : "document"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingItem?.type === "folder"
                ? `This will permanently delete "${deletingItem.name}" and all its contents.`
                : `This will permanently delete "${deletingItem?.name}".`}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deletingItem) return;
                if (deletingItem.type === "doc")
                  deleteDocMutation.mutate(deletingItem.id);
                else deleteFolderMutation.mutate(deletingItem.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
