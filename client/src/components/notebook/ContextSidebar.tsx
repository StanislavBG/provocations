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
} from "lucide-react";
import type { DocumentListItem, FolderItem } from "@shared/schema";

interface ContextSidebarProps {
  pinnedDocIds: Set<number>;
  onPinDoc: (id: number) => void;
  onUnpinDoc: (id: number) => void;
  /** Called when user wants to open a document (load its content) */
  onOpenDoc?: (id: number, title: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  /** When true, renders without its own header/border (used inside NotebookLeftPanel tabs) */
  embedded?: boolean;
}

/** Compute tree indent padding */
function treeIndent(depth: number): number {
  let px = 4;
  for (let i = 1; i <= depth; i++) {
    if (i <= 4) px += 12;
    else if (i <= 7) px += 8;
    else px += 5;
  }
  return px;
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
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Uploaded", description: "File added to your documents" });
    },
  });

  const createDocMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest("POST", "/api/documents", {
        title,
        content: " ",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setCreatingDoc(false);
      setNewDocTitle("");
      toast({ title: "Created", description: "New document created" });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/folders", {
        name,
        parentFolderId: null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders/all"] });
      setCreatingFolder(false);
      setNewFolderName("");
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
              session context
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

  // ── Document row renderer ──
  const renderDocRow = (doc: DocumentListItem, indent: number) => {
    const isPinned = pinnedDocIds.has(doc.id);
    const isEditing =
      editingItem?.id === doc.id && editingItem?.type === "doc";

    return (
      <div
        key={`d-${doc.id}`}
        className={`flex items-center gap-1 group rounded-md transition-all overflow-hidden pr-1 ${
          isPinned
            ? "bg-green-500/10 border-l-2 border-green-500"
            : "hover:bg-muted/50"
        }`}
        style={{ paddingLeft: `${isPinned ? indent - 2 : indent}px` }}
      >
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
                if (isPinned) {
                  onOpenDoc?.(doc.id, doc.title);
                } else {
                  onPinDoc(doc.id);
                }
              }}
              title={
                isPinned
                  ? `${doc.title} (in session context)`
                  : `Click to add "${doc.title}" to session context`
              }
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
                    Remove from session
                  </TooltipContent>
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

    // Count how many docs in this folder (recursively) are pinned
    const pinnedInFolder = folderDocs.filter((d) =>
      pinnedDocIds.has(d.id),
    ).length;

    return (
      <div key={`f-${folder.id}`}>
        <div
          className="flex items-center gap-0.5 group hover:bg-muted/50 rounded-md transition-colors overflow-hidden pr-1"
          style={{ paddingLeft: `${indent}px` }}
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
              <button
                onClick={() => hasContent && toggleFolder(folder.id)}
                className={`flex-1 text-left py-1.5 px-1 text-xs flex items-center gap-1.5 min-w-0 ${
                  hasContent ? "cursor-pointer" : "opacity-50 cursor-default"
                }`}
              >
                {hasContent ? (
                  isExpanded ? (
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 shrink-0" />
                  )
                ) : (
                  <span className="w-3" />
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
            {children.map((child) => renderFolder(child, depth + 1))}
            {folderDocs.map((doc) =>
              renderDocRow(doc, treeIndent(depth + 1)),
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
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleFileUpload}
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upload file</TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onToggleCollapse}
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Search ─── */}
      <div className="p-2 border-b">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="h-7 text-xs pl-7"
            />
          </div>
          {embedded && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={handleFileUpload}
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upload file</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 min-w-0 [&_[data-radix-scroll-area-viewport]>div]:!block">
        {/* ═══ SESSION CONTEXT ═══ */}
        <div className="border-b overflow-hidden">
          <div className="px-2 pt-2 pb-1 flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-green-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400">
              Session Context
            </span>
            {pinnedDocs.length > 0 && (
              <Badge className="text-[9px] h-4 px-1.5 bg-green-600 ml-auto">
                {pinnedDocs.length}
              </Badge>
            )}
          </div>

          {pinnedDocs.length === 0 ? (
            <div className="px-3 pb-3 pt-1">
              <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                Click any document below to add it as context for this session.
                Only selected documents are shared with your AI advisors.
              </p>
            </div>
          ) : (
            <div className="px-2 pb-2 space-y-0.5">
              {pinnedDocs.map((doc) => (
                <div
                  key={`session-${doc.id}`}
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

        {/* ═══ CONTEXT STORE (Persisted) ═══ */}
        <div className="p-2 overflow-hidden">
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
                      setCreatingDoc(true);
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
                      setCreatingFolder(true);
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

          {/* Create new folder inline */}
          {creatingFolder && (
            <div className="flex items-center gap-1 mb-1 pl-1">
              <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name..."
                className="h-6 text-xs flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFolderName.trim())
                    createFolderMutation.mutate(newFolderName.trim());
                  if (e.key === "Escape") setCreatingFolder(false);
                }}
                onBlur={() => {
                  if (!newFolderName.trim()) setCreatingFolder(false);
                }}
              />
            </div>
          )}

          {/* Create new document inline */}
          {creatingDoc && (
            <div className="flex items-center gap-1 mb-1 pl-1">
              <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <Input
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="Document title..."
                className="h-6 text-xs flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newDocTitle.trim())
                    createDocMutation.mutate(newDocTitle.trim());
                  if (e.key === "Escape") setCreatingDoc(false);
                }}
                onBlur={() => {
                  if (!newDocTitle.trim()) setCreatingDoc(false);
                }}
              />
            </div>
          )}

          {/* Folder tree */}
          {rootFolders.map((folder) => renderFolder(folder, 0))}
          {rootFolders.length > 0 && rootDocs.length > 0 && (
            <div className="border-t my-1" />
          )}
          {rootDocs.map((doc) => renderDocRow(doc, 4))}

          {/* Empty state */}
          {docs.length === 0 && !creatingDoc && !creatingFolder && (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground/50">
              <FileText className="w-6 h-6" />
              <p className="text-xs text-center">
                No documents yet.
                <br />
                Upload files or create new ones.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ─── Delete confirmation dialog ─── */}
      <AlertDialog
        open={!!deletingItem}
        onOpenChange={(open) => {
          if (!open) setDeletingItem(null);
        }}
      >
        <AlertDialogContent>
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
