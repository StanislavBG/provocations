import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ProvokeText } from "@/components/ProvokeText";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import {
  X,
  FolderOpen,
  Folder,
  FolderPlus,
  FileText,
  Trash2,
  Pencil,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Loader2,
  Save,
  Check,
  HardDrive,
  ArrowUpRight,
  Calendar,
  Type,
  Eye,
  GripVertical,
  FolderInput,
  Lock,
} from "lucide-react";
import type { DocumentListItem, FolderItem } from "@shared/schema";

// ── Drag-and-drop data types ──
type DragItemType = "document" | "folder";
interface DragData {
  type: DragItemType;
  id: number;
  title: string;
}

const DRAG_MIME = "application/x-provocations-drag";

/**
 * Compute left-padding for folder tree items at a given depth.
 * Uses a diminishing scale so levels 1-4 get full 12px increments,
 * levels 5-7 get 8px, and levels 8-10 get 5px.
 * This keeps the tree readable up to 10 levels inside the left panel.
 */
function treeIndent(depth: number): number {
  let px = 4; // base padding
  for (let i = 1; i <= depth; i++) {
    if (i <= 4) px += 12;
    else if (i <= 7) px += 8;
    else px += 5;
  }
  return px;
}

function encodeDragData(data: DragData): string {
  return JSON.stringify(data);
}

function decodeDragData(dt: DataTransfer): DragData | null {
  try {
    const raw = dt.getData(DRAG_MIME);
    if (!raw) return null;
    return JSON.parse(raw) as DragData;
  } catch {
    return null;
  }
}

interface StoragePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadDocument: (doc: { id: number; title: string; content: string }) => void;
  onSave: (title: string, folderId: number | null) => Promise<void>;
  hasContent: boolean;
  currentDocId?: number | null;
  currentTitle?: string;
}

interface PreviewDoc {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export function StoragePanel({
  isOpen,
  onClose,
  onLoadDocument,
  onSave,
  hasContent,
  currentDocId,
  currentTitle,
}: StoragePanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin } = useRole();
  const hasSyncedRef = useRef(false);

  // Navigation state
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: number | null; name: string }[]>([
    { id: null, name: "My Documents" },
  ]);

  // Inline editing state
  const [renamingDocId, setRenamingDocId] = useState<number | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<number | null>(null);
  const [renameText, setRenameText] = useState("");

  // New folder creation
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Save dialog
  const [isSaving, setIsSaving] = useState(false);
  const [saveTitle, setSaveTitle] = useState(currentTitle || "");

  // Preview state
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PreviewDoc | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Expand/collapse state for folder tree (folder id → expanded)
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  // Drag-and-drop state
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null | undefined>(undefined);
  // undefined = nothing being dragged over, null = root "My Documents"

  // Move-to dialog state
  const [moveTarget, setMoveTarget] = useState<DragData | null>(null);

  useEffect(() => {
    if (currentTitle) setSaveTitle(currentTitle);
  }, [currentTitle]);

  // ── Queries ──

  // Fetch ALL folders in a single request (no parentFolderId param = all folders)
  const allFoldersQuery = useQuery({
    queryKey: ["/api/folders/all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/folders");
      const data = await res.json();
      return (data.folders || []) as FolderItem[];
    },
    enabled: isOpen,
  });

  const documentsQuery = useQuery({
    queryKey: ["/api/documents", currentFolderId],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/documents");
      const data = await res.json();
      const all = (data.documents || []) as DocumentListItem[];
      if (currentFolderId === null) {
        return all.filter((d) => !d.folderId);
      }
      return all.filter((d) => d.folderId === currentFolderId);
    },
    enabled: isOpen,
  });

  // All documents (for sidebar counts)
  // NOTE: Returns { documents: [...] } to match the cache shape used by
  // Workspace, TextInputForm, ContextCapturePanel, InfographicStudioWorkspace.
  // All share queryKey ["/api/documents"] so the return shape MUST be identical.
  const allDocsQuery = useQuery<{ documents: DocumentListItem[] }>({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/documents");
      return res.json();
    },
    enabled: isOpen,
  });

  // ── Auto-sync locked folders for admin ──
  // When an admin opens the storage panel, sync Personas and Applications
  // folders from disk / persona definitions into the context store.
  useEffect(() => {
    if (!isOpen || !isAdmin || hasSyncedRef.current) return;
    hasSyncedRef.current = true;
    (async () => {
      try {
        await Promise.all([
          apiRequest("POST", "/api/admin/sync-app-docs"),
          apiRequest("POST", "/api/admin/sync-persona-docs"),
        ]);
        queryClient.invalidateQueries({ queryKey: ["/api/folders/all"] });
        queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
        queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      } catch {
        // Non-critical — folders may already exist or user isn't admin
      }
    })();
  }, [isOpen, isAdmin, queryClient]);

  // ── Mutations ──

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/folders", {
        name,
        parentFolderId: currentFolderId,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders/all"] });
      setIsCreatingFolder(false);
      setNewFolderName("");
    },
  });

  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await apiRequest("PATCH", `/api/folders/${id}`, { name });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders/all"] });
      setRenamingFolderId(null);
      setRenameText("");
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/folders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
  });

  const renameDocMutation = useMutation({
    mutationFn: async ({ id, title }: { id: number; title: string }) => {
      const res = await apiRequest("PATCH", `/api/documents/${id}`, { title });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setRenamingDocId(null);
      setRenameText("");
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      if (selectedDocId === deletedId) {
        setSelectedDocId(null);
        setPreviewDoc(null);
      }
      toast({ title: "Document deleted" });
    },
  });

  const moveDocMutation = useMutation({
    mutationFn: async ({ id, folderId }: { id: number; folderId: number | null }) => {
      const res = await apiRequest("PATCH", `/api/documents/${id}/move`, { folderId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document moved" });
    },
    onError: () => {
      toast({ title: "Failed to move document", variant: "destructive" });
    },
  });

  const moveFolderMutation = useMutation({
    mutationFn: async ({ id, parentFolderId }: { id: number; parentFolderId: number | null }) => {
      const res = await apiRequest("PATCH", `/api/folders/${id}/move`, { parentFolderId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Folder moved" });
    },
    onError: () => {
      toast({ title: "Failed to move folder", variant: "destructive" });
    },
  });

  // ── Expand/collapse helpers ──

  const toggleFolder = useCallback((folderId: number) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  // Auto-expand folders in the current path
  useEffect(() => {
    if (folderPath.length > 1) {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        for (const entry of folderPath) {
          if (entry.id !== null) next.add(entry.id);
        }
        return next;
      });
    }
  }, [folderPath]);

  // ── Drop handler ──

  const handleDrop = useCallback(
    (targetFolderId: number | null, e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverFolderId(undefined);

      const data = decodeDragData(e.dataTransfer);
      if (!data) return;

      if (data.type === "document") {
        moveDocMutation.mutate({ id: data.id, folderId: targetFolderId });
      } else if (data.type === "folder") {
        // Don't move folder into itself
        if (data.id === targetFolderId) return;
        moveFolderMutation.mutate({ id: data.id, parentFolderId: targetFolderId });
      }
    },
    [moveDocMutation, moveFolderMutation],
  );

  // ── Move-to dialog handler ──

  const handleMoveToFolder = useCallback(
    (targetFolderId: number | null) => {
      if (!moveTarget) return;
      if (moveTarget.type === "document") {
        moveDocMutation.mutate({ id: moveTarget.id, folderId: targetFolderId });
      } else if (moveTarget.type === "folder") {
        if (moveTarget.id === targetFolderId) return;
        moveFolderMutation.mutate({ id: moveTarget.id, parentFolderId: targetFolderId });
      }
      setMoveTarget(null);
    },
    [moveTarget, moveDocMutation, moveFolderMutation],
  );

  // ── Navigation ──

  const navigateToFolder = useCallback((folderId: number | null, folderName: string) => {
    setCurrentFolderId(folderId);
    if (folderId === null) {
      setFolderPath([{ id: null, name: "My Documents" }]);
    } else {
      setFolderPath((prev) => [...prev, { id: folderId, name: folderName }]);
    }
    setSelectedDocId(null);
    setPreviewDoc(null);
  }, []);

  const navigateToPathIndex = useCallback((index: number) => {
    const entry = folderPath[index];
    setCurrentFolderId(entry.id);
    setFolderPath((prev) => prev.slice(0, index + 1));
    setSelectedDocId(null);
    setPreviewDoc(null);
  }, [folderPath]);

  // Preview a document in the right panel
  const handlePreviewDocument = useCallback(async (docId: number) => {
    setSelectedDocId(docId);
    setIsLoadingPreview(true);
    try {
      const res = await apiRequest("GET", `/api/documents/${docId}`);
      const data = await res.json();
      setPreviewDoc({
        id: data.id,
        title: data.title,
        content: data.content,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    } catch {
      toast({ title: "Failed to load preview", variant: "destructive" });
      setPreviewDoc(null);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [toast]);

  // Open a document in the workspace
  const handleOpenDocument = useCallback(async (docId: number) => {
    try {
      const res = await apiRequest("GET", `/api/documents/${docId}`);
      const data = await res.json();
      onLoadDocument({ id: data.id, title: data.title, content: data.content });
      onClose();
      toast({ title: "Document loaded", description: data.title });
    } catch {
      toast({ title: "Failed to load document", variant: "destructive" });
    }
  }, [onLoadDocument, onClose, toast]);

  const handleSave = useCallback(async () => {
    if (!saveTitle.trim()) return;
    setIsSaving(true);
    try {
      await onSave(saveTitle.trim(), currentFolderId);
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document saved", description: saveTitle.trim() });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [saveTitle, currentFolderId, onSave, queryClient, toast]);

  if (!isOpen) return null;

  const isLoading = allFoldersQuery.isLoading || documentsQuery.isLoading;
  const allFolders = allFoldersQuery.data || [];
  const documentsList = documentsQuery.data || [];
  const allDocs = allDocsQuery.data?.documents || [];

  // Build folder tree structure
  const rootFolders = allFolders.filter((f) => f.parentFolderId === null);
  const getChildren = (parentId: number) => allFolders.filter((f) => f.parentFolderId === parentId);
  const getDocCount = (folderId: number | null) => {
    if (folderId === null) return allDocs.filter((d) => !d.folderId).length;
    return allDocs.filter((d) => d.folderId === folderId).length;
  };

  // Recursive total count (docs in folder + all subfolders)
  const getTotalDocCount = (folderId: number | null): number => {
    let count = getDocCount(folderId);
    if (folderId !== null) {
      for (const child of getChildren(folderId)) {
        count += getTotalDocCount(child.id);
      }
    }
    return count;
  };

  // Get depth of a folder in the hierarchy
  const getFolderDepth = (folderId: number): number => {
    const folder = allFolders.find((f) => f.id === folderId);
    if (!folder || folder.parentFolderId === null) return 1;
    return 1 + getFolderDepth(folder.parentFolderId);
  };

  // Check if a folder is a descendant of another
  const isDescendant = (folderId: number, ancestorId: number): boolean => {
    const folder = allFolders.find((f) => f.id === folderId);
    if (!folder || !folder.parentFolderId) return false;
    if (folder.parentFolderId === ancestorId) return true;
    return isDescendant(folder.parentFolderId, ancestorId);
  };

  // Word count for preview
  const previewWordCount = previewDoc?.content
    ? previewDoc.content.trim().split(/\s+/).filter(Boolean).length
    : 0;

  // Detect if content looks like markdown
  const isMarkdown = previewDoc?.content
    ? /^#{1,6}\s|^\*\*|^\-\s|^\d+\.\s|```/.test(previewDoc.content.slice(0, 500))
    : false;

  // ── Subfolders in current directory (for middle panel) ──
  const currentSubfolders = currentFolderId === null
    ? rootFolders
    : getChildren(currentFolderId);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in duration-200">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-card shrink-0">
        <HardDrive className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-base flex-1">Private Context Store</h2>

        {/* Save bar — inline in header when content exists */}
        {hasContent && (
          <div className="flex items-center gap-2">
            <Input
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              placeholder="Document title..."
              className="h-8 text-sm w-48 sm:w-64"
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            />
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!saveTitle.trim() || isSaving}
              className="gap-1.5 shrink-0"
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {currentDocId ? "Update" : "Save"}
            </Button>
          </div>
        )}

        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* ── 3-panel layout ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT PANEL: Folder tree ── */}
        <div className="w-64 shrink-0 border-r flex flex-col overflow-hidden bg-card">
          <div className="px-3 py-2.5 border-b flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Folders</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsCreatingFolder(true)}
              disabled={isCreatingFolder}
              title="New folder"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </Button>
          </div>

          <ScrollArea className="flex-1 min-h-0" type="auto">
            <div className="p-2 space-y-0.5 min-w-fit">
              {/* Root / My Documents — drop target */}
              <RootDropTarget
                isActive={currentFolderId === null}
                docCount={getDocCount(null)}
                isDragOver={dragOverFolderId === null}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverFolderId(null);
                }}
                onDragLeave={(e) => {
                  e.stopPropagation();
                  setDragOverFolderId(undefined);
                }}
                onDrop={(e) => handleDrop(null, e)}
                onClick={() => {
                  setCurrentFolderId(null);
                  setFolderPath([{ id: null, name: "My Documents" }]);
                  setSelectedDocId(null);
                  setPreviewDoc(null);
                }}
              />

              {/* New folder creation at root */}
              {isCreatingFolder && currentFolderId === null && (
                <InlineFolderCreate
                  depth={1}
                  value={newFolderName}
                  onChange={setNewFolderName}
                  onCreate={() => newFolderName.trim() && createFolderMutation.mutate(newFolderName.trim())}
                  onCancel={() => { setIsCreatingFolder(false); setNewFolderName(""); }}
                />
              )}

              {/* Render folder tree recursively */}
              {rootFolders.map((folder) => (
                <FolderTreeBranch
                  key={folder.id}
                  folder={folder}
                  allFolders={allFolders}
                  getChildren={getChildren}
                  getDocCount={getDocCount}
                  getTotalDocCount={getTotalDocCount}
                  currentFolderId={currentFolderId}
                  renamingFolderId={renamingFolderId}
                  renameText={renameText}
                  depth={1}
                  expandedFolders={expandedFolders}
                  onToggleExpand={toggleFolder}
                  dragOverFolderId={dragOverFolderId}
                  onDragOverFolder={setDragOverFolderId}
                  onDrop={handleDrop}
                  onNavigate={(id, name) => navigateToFolder(id, name)}
                  onStartRename={(id, name) => { setRenamingFolderId(id); setRenameText(name); }}
                  onRename={(id, name) => renameFolderMutation.mutate({ id, name })}
                  onCancelRename={() => { setRenamingFolderId(null); setRenameText(""); }}
                  onRenameTextChange={setRenameText}
                  onDelete={(id) => {
                    if (window.confirm("Delete this folder and all its contents?")) {
                      deleteFolderMutation.mutate(id);
                    }
                  }}
                  onMoveTo={(data) => setMoveTarget(data)}
                  isCreatingFolder={isCreatingFolder}
                  newFolderName={newFolderName}
                  onNewFolderNameChange={setNewFolderName}
                  onCreateFolder={() => newFolderName.trim() && createFolderMutation.mutate(newFolderName.trim())}
                  onCancelCreateFolder={() => { setIsCreatingFolder(false); setNewFolderName(""); }}
                  targetFolderId={currentFolderId}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* ── MIDDLE PANEL: Documents in current folder ── */}
        <div
          className="flex-1 min-w-0 flex flex-col overflow-hidden"
          onDragOver={(e) => {
            // Allow drops on the middle panel body (move to current folder)
            if (e.dataTransfer.types.includes(DRAG_MIME)) {
              e.preventDefault();
            }
          }}
          onDrop={(e) => {
            // Drop onto middle panel = move to current folder
            const data = decodeDragData(e.dataTransfer);
            if (data) {
              e.preventDefault();
              if (data.type === "document") {
                moveDocMutation.mutate({ id: data.id, folderId: currentFolderId });
              }
              // Don't allow folder drop onto the same parent
            }
          }}
        >
          {/* Breadcrumb + actions bar */}
          <div className="flex items-center gap-1 px-4 py-2 border-b text-xs overflow-x-auto shrink-0 bg-card/60">
            {folderPath.map((entry, idx) => (
              <span key={idx} className="flex items-center gap-1 shrink-0">
                {idx > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                <button
                  onClick={() => navigateToPathIndex(idx)}
                  className={`hover:text-foreground transition-colors ${
                    idx === folderPath.length - 1 ? "text-foreground font-medium" : "text-muted-foreground"
                  }`}
                >
                  {entry.name}
                </button>
              </span>
            ))}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <span className="text-muted-foreground/60">
                {currentSubfolders.length > 0 && (
                  <span className="mr-2">{currentSubfolders.length} folder{currentSubfolders.length !== 1 ? "s" : ""}</span>
                )}
                {documentsList.length} doc{documentsList.length !== 1 ? "s" : ""}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-xs px-2"
                onClick={() => setIsCreatingFolder(true)}
                disabled={isCreatingFolder}
                title="Create a new folder here"
              >
                <FolderPlus className="w-3 h-3" />
                New Folder
              </Button>
            </div>
          </div>

          {/* Document & subfolder list */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3 space-y-1">
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* Inline folder creation in middle panel */}
              {!isLoading && isCreatingFolder && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-primary/30 bg-primary/5">
                  <FolderOpen className="w-4 h-4 shrink-0 text-amber-500" />
                  <Input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="New folder name..."
                    className="h-7 text-sm flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newFolderName.trim()) createFolderMutation.mutate(newFolderName.trim());
                      if (e.key === "Escape") { setIsCreatingFolder(false); setNewFolderName(""); }
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={!newFolderName.trim()}
                    onClick={() => newFolderName.trim() && createFolderMutation.mutate(newFolderName.trim())}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => { setIsCreatingFolder(false); setNewFolderName(""); }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}

              {/* Subfolders in current directory */}
              {!isLoading && currentSubfolders.map((folder) => (
                <MiddlePanelFolder
                  key={`f-${folder.id}`}
                  folder={folder}
                  docCount={getTotalDocCount(folder.id)}
                  onNavigate={() => navigateToFolder(folder.id, folder.name)}
                  onStartRename={() => { setRenamingFolderId(folder.id); setRenameText(folder.name); }}
                  onDelete={() => {
                    if (window.confirm(`Delete "${folder.name}" and all its contents?`)) {
                      deleteFolderMutation.mutate(folder.id);
                    }
                  }}
                  onMoveTo={() => setMoveTarget({ type: "folder", id: folder.id, title: folder.name })}
                  isRenaming={renamingFolderId === folder.id}
                  renameText={renameText}
                  onRenameTextChange={setRenameText}
                  onRename={() => {
                    if (renameText.trim()) renameFolderMutation.mutate({ id: folder.id, name: renameText.trim() });
                  }}
                  onCancelRename={() => { setRenamingFolderId(null); setRenameText(""); }}
                />
              ))}

              {/* Separator between folders and docs */}
              {!isLoading && currentSubfolders.length > 0 && documentsList.length > 0 && (
                <div className="border-t my-2" />
              )}

              {!isLoading && documentsList.length === 0 && currentSubfolders.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <FolderOpen className="w-10 h-10 text-muted-foreground/20" />
                  <div>
                    <p className="text-sm text-muted-foreground">No documents here yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Save your work from the workspace or create a new folder
                    </p>
                  </div>
                </div>
              )}

              {!isLoading && documentsList.map((doc) => {
                const isSelected = selectedDocId === doc.id;
                const isCurrent = currentDocId === doc.id;
                return (
                  <DocumentRow
                    key={`d-${doc.id}`}
                    doc={doc}
                    isSelected={isSelected}
                    isCurrent={isCurrent}
                    isRenaming={renamingDocId === doc.id}
                    renameText={renameText}
                    onRenameTextChange={setRenameText}
                    onStartRename={() => { setRenamingDocId(doc.id); setRenameText(doc.title); }}
                    onRename={() => {
                      if (renameText.trim()) renameDocMutation.mutate({ id: doc.id, title: renameText.trim() });
                    }}
                    onCancelRename={() => { setRenamingDocId(null); setRenameText(""); }}
                    onPreview={() => handlePreviewDocument(doc.id)}
                    onOpen={() => handleOpenDocument(doc.id)}
                    onDelete={() => {
                      if (window.confirm(`Delete "${doc.title}"?`)) {
                        deleteDocMutation.mutate(doc.id);
                      }
                    }}
                    onMoveTo={() => setMoveTarget({ type: "document", id: doc.id, title: doc.title })}
                  />
                );
              })}
            </div>
          </ScrollArea>

          {/* Middle panel footer */}
          <div className="flex items-center gap-2 px-4 py-2 border-t shrink-0 bg-card/60">
            {folderPath.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => navigateToPathIndex(folderPath.length - 2)}
              >
                <ChevronLeft className="w-3 h-3" />
                Back
              </Button>
            )}
            <div className="flex-1" />
            <p className="text-[10px] text-muted-foreground/50">
              Drag items to move between folders. Click to preview, double-click to open.
            </p>
          </div>
        </div>

        {/* ── RIGHT PANEL: Document preview ── */}
        <div className="w-[40%] min-w-[300px] border-l flex flex-col overflow-hidden bg-card">
          {isLoadingPreview ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : previewDoc ? (
            <>
              {/* Preview header with metadata */}
              <div className="px-4 py-3 border-b shrink-0 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-tight flex-1 break-words">{previewDoc.title}</h3>
                  <Button
                    size="sm"
                    onClick={() => handleOpenDocument(previewDoc.id)}
                    className="gap-1.5 shrink-0"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    Open
                  </Button>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Modified {new Date(previewDoc.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Type className="w-3 h-3" />
                    {previewWordCount.toLocaleString()} words
                  </span>
                </div>
              </div>

              {/* Preview content */}
              <div className="flex-1 overflow-hidden">
                {isMarkdown ? (
                  <div className="h-full overflow-y-auto px-4 py-3">
                    <MarkdownRenderer content={previewDoc.content} />
                  </div>
                ) : (
                  <ProvokeText
                    chrome="bare"
                    variant="editor"
                    value={previewDoc.content}
                    onChange={() => {}}
                    readOnly
                    showCopy
                    showClear={false}
                    className="text-sm leading-relaxed font-serif px-4 py-3"
                    containerClassName="h-full"
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground/50 gap-3 px-8">
              <Eye className="w-10 h-10" />
              <div>
                <p className="text-sm font-medium">Select a document to preview</p>
                <p className="text-xs mt-1">
                  Click any document in the list to see its contents here.
                  Double-click to open it in the workspace.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Move-to dialog (modal) ── */}
      {moveTarget && (
        <MoveToDialog
          item={moveTarget}
          allFolders={allFolders}
          rootFolders={rootFolders}
          getChildren={getChildren}
          getFolderDepth={getFolderDepth}
          isDescendant={isDescendant}
          onMove={handleMoveToFolder}
          onCancel={() => setMoveTarget(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root drop target (My Documents)
// ---------------------------------------------------------------------------

function RootDropTarget({
  isActive,
  docCount,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
}: {
  isActive: boolean;
  docCount: number;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-all ${
        isDragOver
          ? "bg-primary/20 ring-2 ring-primary/40 text-primary font-medium"
          : isActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-foreground/80 hover:bg-muted/50"
      }`}
      style={{ paddingLeft: "8px" }}
    >
      <FolderOpen className={`w-4 h-4 shrink-0 ${isActive || isDragOver ? "text-primary" : "text-amber-500"}`} />
      <span className="flex-1 truncate">My Documents</span>
      {docCount > 0 && (
        <span className="text-[10px] text-muted-foreground/60 shrink-0">{docCount}</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Folder tree sub-components (LEFT PANEL)
// ---------------------------------------------------------------------------

function InlineFolderCreate({
  depth,
  value,
  onChange,
  onCreate,
  onCancel,
}: {
  depth: number;
  value: string;
  onChange: (v: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30"
      style={{ paddingLeft: `${treeIndent(depth)}px` }}
    >
      <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Folder name..."
        className="h-6 text-xs flex-1"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") onCreate();
          if (e.key === "Escape") onCancel();
        }}
      />
      <Button size="icon" variant="ghost" className="h-5 w-5" disabled={!value.trim()} onClick={onCreate}>
        <Check className="w-3 h-3" />
      </Button>
      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={onCancel}>
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

function FolderTreeBranch({
  folder,
  allFolders,
  getChildren,
  getDocCount,
  getTotalDocCount,
  currentFolderId,
  renamingFolderId,
  renameText,
  depth,
  expandedFolders,
  onToggleExpand,
  dragOverFolderId,
  onDragOverFolder,
  onDrop,
  onNavigate,
  onStartRename,
  onRename,
  onCancelRename,
  onRenameTextChange,
  onDelete,
  onMoveTo,
  isCreatingFolder,
  newFolderName,
  onNewFolderNameChange,
  onCreateFolder,
  onCancelCreateFolder,
  targetFolderId,
}: {
  folder: FolderItem;
  allFolders: FolderItem[];
  getChildren: (parentId: number) => FolderItem[];
  getDocCount: (folderId: number | null) => number;
  getTotalDocCount: (folderId: number | null) => number;
  currentFolderId: number | null;
  renamingFolderId: number | null;
  renameText: string;
  depth: number;
  expandedFolders: Set<number>;
  onToggleExpand: (id: number) => void;
  dragOverFolderId: number | null | undefined;
  onDragOverFolder: (id: number | null | undefined) => void;
  onDrop: (targetFolderId: number | null, e: React.DragEvent) => void;
  onNavigate: (id: number, name: string) => void;
  onStartRename: (id: number, name: string) => void;
  onRename: (id: number, name: string) => void;
  onCancelRename: () => void;
  onRenameTextChange: (v: string) => void;
  onDelete: (id: number) => void;
  onMoveTo: (data: DragData) => void;
  isCreatingFolder: boolean;
  newFolderName: string;
  onNewFolderNameChange: (v: string) => void;
  onCreateFolder: () => void;
  onCancelCreateFolder: () => void;
  targetFolderId: number | null;
}) {
  const children = getChildren(folder.id);
  const hasChildren = children.length > 0;
  const isActive = currentFolderId === folder.id;
  const isRenaming = renamingFolderId === folder.id;
  const isExpanded = expandedFolders.has(folder.id);
  const isDragOver = dragOverFolderId === folder.id;
  const totalDocs = getTotalDocCount(folder.id);

  const isLocked = !!folder.locked;

  const handleDragStart = (e: React.DragEvent) => {
    if (isLocked) { e.preventDefault(); return; }
    e.dataTransfer.setData(DRAG_MIME, encodeDragData({ type: "folder", id: folder.id, title: folder.name }));
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <>
      {isRenaming && !isLocked ? (
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30"
          style={{ paddingLeft: `${treeIndent(depth)}px` }}
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <Input
            value={renameText}
            onChange={(e) => onRenameTextChange(e.target.value)}
            className="h-6 text-xs flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameText.trim()) onRename(folder.id, renameText.trim());
              if (e.key === "Escape") onCancelRename();
            }}
          />
        </div>
      ) : (
        <div
          className="group relative"
          draggable={!isLocked}
          onDragStart={handleDragStart}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDragOverFolder(folder.id);
          }}
          onDragLeave={(e) => {
            e.stopPropagation();
            onDragOverFolder(undefined);
          }}
          onDrop={(e) => onDrop(folder.id, e)}
        >
          <div
            className={`w-full flex items-center gap-1 py-1.5 rounded-md text-left text-sm transition-all cursor-pointer ${
              isDragOver
                ? "bg-primary/20 ring-2 ring-primary/40 text-primary font-medium"
                : isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground/80 hover:bg-muted/50"
            }`}
            style={{ paddingLeft: `${treeIndent(depth)}px`, paddingRight: "4px" }}
          >
            {/* Expand/collapse toggle */}
            <button
              type="button"
              className={`w-4 h-4 flex items-center justify-center shrink-0 rounded transition-colors hover:bg-muted ${
                hasChildren ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(folder.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>

            {/* Lock icon for system-managed folders, drag grip for user folders */}
            {isLocked ? (
              <span title="System-managed"><Lock className="w-3 h-3 text-muted-foreground/50 shrink-0" /></span>
            ) : (
              <GripVertical className="w-3 h-3 text-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
            )}

            {/* Folder icon + label */}
            <button
              type="button"
              className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
              onClick={() => onNavigate(folder.id, folder.name)}
              title={folder.name}
            >
              {isExpanded ? (
                <FolderOpen className={`w-4 h-4 shrink-0 ${isActive || isDragOver ? "text-primary" : "text-amber-500"}`} />
              ) : (
                <Folder className={`w-4 h-4 shrink-0 ${isActive || isDragOver ? "text-primary" : "text-amber-500"}`} />
              )}
              <span className="flex-1 truncate text-xs whitespace-nowrap">{folder.name}</span>
            </button>

            {/* Doc count */}
            {totalDocs > 0 && (
              <span className="text-[10px] text-muted-foreground/60 shrink-0 mr-1">{totalDocs}</span>
            )}
          </div>

          {/* Hover actions — hidden for locked folders */}
          {!isLocked && (
            <div className="absolute right-1 top-1 hidden group-hover:flex items-center gap-0.5">
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                title="Move to..."
                onClick={(e) => { e.stopPropagation(); onMoveTo({ type: "folder", id: folder.id, title: folder.name }); }}
              >
                <FolderInput className="w-2.5 h-2.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                title="Rename folder"
                onClick={(e) => { e.stopPropagation(); onStartRename(folder.id, folder.name); }}
              >
                <Pencil className="w-2.5 h-2.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 text-destructive"
                title="Delete folder"
                onClick={(e) => { e.stopPropagation(); onDelete(folder.id); }}
              >
                <Trash2 className="w-2.5 h-2.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Inline create inside this folder */}
      {isCreatingFolder && targetFolderId === folder.id && (
        <InlineFolderCreate
          depth={depth + 1}
          value={newFolderName}
          onChange={onNewFolderNameChange}
          onCreate={onCreateFolder}
          onCancel={onCancelCreateFolder}
        />
      )}

      {/* Children (only if expanded) */}
      {isExpanded && children.map((child) => (
        <FolderTreeBranch
          key={child.id}
          folder={child}
          allFolders={allFolders}
          getChildren={getChildren}
          getDocCount={getDocCount}
          getTotalDocCount={getTotalDocCount}
          currentFolderId={currentFolderId}
          renamingFolderId={renamingFolderId}
          renameText={renameText}
          depth={depth + 1}
          expandedFolders={expandedFolders}
          onToggleExpand={onToggleExpand}
          dragOverFolderId={dragOverFolderId}
          onDragOverFolder={onDragOverFolder}
          onDrop={onDrop}
          onNavigate={onNavigate}
          onStartRename={onStartRename}
          onRename={onRename}
          onCancelRename={onCancelRename}
          onRenameTextChange={onRenameTextChange}
          onDelete={onDelete}
          onMoveTo={onMoveTo}
          isCreatingFolder={isCreatingFolder}
          newFolderName={newFolderName}
          onNewFolderNameChange={onNewFolderNameChange}
          onCreateFolder={onCreateFolder}
          onCancelCreateFolder={onCancelCreateFolder}
          targetFolderId={targetFolderId}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Middle panel: subfolder row
// ---------------------------------------------------------------------------

function MiddlePanelFolder({
  folder,
  docCount,
  onNavigate,
  onStartRename,
  onDelete,
  onMoveTo,
  isRenaming,
  renameText,
  onRenameTextChange,
  onRename,
  onCancelRename,
}: {
  folder: FolderItem;
  docCount: number;
  onNavigate: () => void;
  onStartRename: () => void;
  onDelete: () => void;
  onMoveTo: () => void;
  isRenaming: boolean;
  renameText: string;
  onRenameTextChange: (v: string) => void;
  onRename: () => void;
  onCancelRename: () => void;
}) {
  const isLocked = !!folder.locked;

  const handleDragStart = (e: React.DragEvent) => {
    if (isLocked) { e.preventDefault(); return; }
    e.dataTransfer.setData(DRAG_MIME, encodeDragData({ type: "folder", id: folder.id, title: folder.name }));
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      className="group w-full flex items-start gap-2 px-3 py-2.5 rounded-lg transition-colors hover:bg-muted/40 border border-transparent cursor-pointer"
      draggable={!isRenaming && !isLocked}
      onDragStart={handleDragStart}
      onClick={onNavigate}
      onDoubleClick={onNavigate}
    >
      {isLocked ? (
        <span title="System-managed"><Lock className="w-3.5 h-3.5 mt-1 text-muted-foreground/50 shrink-0" /></span>
      ) : (
        <GripVertical className="w-3.5 h-3.5 mt-1 text-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
      )}
      <Folder className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
      <div className="flex-1 min-w-0">
        {isRenaming && !isLocked ? (
          <Input
            value={renameText}
            onChange={(e) => onRenameTextChange(e.target.value)}
            className="h-7 text-sm"
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") onRename();
              if (e.key === "Escape") onCancelRename();
            }}
          />
        ) : (
          <>
            <div className="flex items-start gap-1">
              <p className="text-sm font-medium break-words leading-snug flex-1">{folder.name}</p>
              {!isLocked && (
                <button
                  type="button"
                  className="shrink-0 mt-0.5 p-0.5 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  title="Rename folder"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); onStartRename(); }}
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {docCount} item{docCount !== 1 ? "s" : ""}
            </p>
          </>
        )}
      </div>

      {/* Actions — hidden for locked folders */}
      {!isLocked && (
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            title="Move to..."
            onClick={(e) => { e.stopPropagation(); onMoveTo(); }}
          >
            <FolderInput className="w-3 h-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            title="Rename"
            onClick={(e) => { e.stopPropagation(); onStartRename(); }}
          >
            <Pencil className="w-3 h-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-destructive/60 hover:text-destructive"
            title="Delete"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Middle panel: document row (draggable)
// ---------------------------------------------------------------------------

function DocumentRow({
  doc,
  isSelected,
  isCurrent,
  isRenaming,
  renameText,
  onRenameTextChange,
  onStartRename,
  onRename,
  onCancelRename,
  onPreview,
  onOpen,
  onDelete,
  onMoveTo,
}: {
  doc: DocumentListItem;
  isSelected: boolean;
  isCurrent: boolean;
  isRenaming: boolean;
  renameText: string;
  onRenameTextChange: (v: string) => void;
  onStartRename: () => void;
  onRename: () => void;
  onCancelRename: () => void;
  onPreview: () => void;
  onOpen: () => void;
  onDelete: () => void;
  onMoveTo: () => void;
}) {
  const isLocked = !!doc.locked;

  const handleDragStart = (e: React.DragEvent) => {
    if (isLocked) { e.preventDefault(); return; }
    e.dataTransfer.setData(DRAG_MIME, encodeDragData({ type: "document", id: doc.id, title: doc.title }));
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      className={`group w-full flex items-start gap-2 px-3 py-2.5 rounded-lg transition-colors ${
        isSelected
          ? "bg-primary/10 border border-primary/30"
          : isCurrent
            ? "bg-muted/50 border border-muted"
            : "hover:bg-muted/40 border border-transparent"
      }`}
      draggable={!isRenaming && !isLocked}
      onDragStart={handleDragStart}
    >
      {/* Lock icon for system docs, drag grip for user docs */}
      {isLocked ? (
        <span title="System-managed"><Lock className="w-3.5 h-3.5 mt-1 text-muted-foreground/50 shrink-0" /></span>
      ) : (
        <GripVertical className="w-3.5 h-3.5 mt-1 text-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
      )}

      {/* Click area — file icon + title/date */}
      <button
        type="button"
        onClick={onPreview}
        onDoubleClick={onOpen}
        className="flex items-start gap-2 flex-1 min-w-0 text-left"
      >
        <FileText className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? "text-primary" : "text-blue-500"}`} />
        <div className="flex-1 min-w-0">
          {isRenaming && !isLocked ? (
            <Input
              value={renameText}
              onChange={(e) => onRenameTextChange(e.target.value)}
              className="h-7 text-sm"
              autoFocus
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") onRename();
                if (e.key === "Escape") onCancelRename();
              }}
            />
          ) : (
            <>
              <div className="flex items-start gap-1">
                <p className="text-sm font-medium break-words leading-snug flex-1">{doc.title}</p>
                {!isLocked && (
                  <button
                    type="button"
                    className="shrink-0 mt-0.5 p-0.5 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                    title="Rename document"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onStartRename(); }}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {new Date(doc.updatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </>
          )}
        </div>
      </button>

      {/* Actions — hidden for locked documents */}
      <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
        {isCurrent && (
          <Badge variant="secondary" className="text-[10px] mr-1">Current</Badge>
        )}
        {!isLocked && (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              title="Move to..."
              onClick={(e) => { e.stopPropagation(); onMoveTo(); }}
            >
              <FolderInput className="w-3 h-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              title="Rename"
              onClick={(e) => { e.stopPropagation(); onStartRename(); }}
            >
              <Pencil className="w-3 h-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-destructive/60 hover:text-destructive"
              title="Delete"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Move-to dialog
// ---------------------------------------------------------------------------

function MoveToDialog({
  item,
  allFolders,
  rootFolders,
  getChildren,
  getFolderDepth,
  isDescendant,
  onMove,
  onCancel,
}: {
  item: DragData;
  allFolders: FolderItem[];
  rootFolders: FolderItem[];
  getChildren: (parentId: number) => FolderItem[];
  getFolderDepth: (folderId: number) => number;
  isDescendant: (folderId: number, ancestorId: number) => boolean;
  onMove: (targetFolderId: number | null) => void;
  onCancel: () => void;
}) {
  const [selectedTarget, setSelectedTarget] = useState<number | null | undefined>(undefined);

  const canSelectFolder = (folderId: number): boolean => {
    // Can't move folder into itself
    if (item.type === "folder" && item.id === folderId) return false;
    // Can't move folder into its own descendant
    if (item.type === "folder" && isDescendant(folderId, item.id)) return false;
    // Max 10 levels of nesting
    if (item.type === "folder") {
      const targetDepth = getFolderDepth(folderId);
      if (targetDepth >= 10) return false;
    }
    return true;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card border rounded-xl shadow-2xl w-[400px] max-h-[500px] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
          <FolderInput className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold">Move "{item.title}"</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Select a destination folder</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Folder tree */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-0.5">
            {/* Root */}
            <button
              type="button"
              onClick={() => setSelectedTarget(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                selectedTarget === null
                  ? "bg-primary/10 text-primary font-medium ring-1 ring-primary/30"
                  : "hover:bg-muted/50"
              }`}
            >
              <FolderOpen className="w-4 h-4 shrink-0 text-amber-500" />
              <span>My Documents (root)</span>
            </button>

            {/* Folders */}
            {rootFolders.map((f) => (
              <MoveToFolderItem
                key={f.id}
                folder={f}
                getChildren={getChildren}
                selectedTarget={selectedTarget}
                onSelect={setSelectedTarget}
                canSelect={canSelectFolder}
                depth={1}
                itemBeingMoved={item}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t shrink-0">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={selectedTarget === undefined}
            onClick={() => {
              if (selectedTarget !== undefined) onMove(selectedTarget);
            }}
            className="gap-1.5"
          >
            <FolderInput className="w-3.5 h-3.5" />
            Move here
          </Button>
        </div>
      </div>
    </div>
  );
}

function MoveToFolderItem({
  folder,
  getChildren,
  selectedTarget,
  onSelect,
  canSelect,
  depth,
  itemBeingMoved,
}: {
  folder: FolderItem;
  getChildren: (parentId: number) => FolderItem[];
  selectedTarget: number | null | undefined;
  onSelect: (id: number) => void;
  canSelect: (id: number) => boolean;
  depth: number;
  itemBeingMoved: DragData;
}) {
  const [expanded, setExpanded] = useState(depth <= 2);
  const children = getChildren(folder.id);
  const hasChildren = children.length > 0;
  const disabled = !canSelect(folder.id);
  const isSelected = selectedTarget === folder.id;
  const isSelf = itemBeingMoved.type === "folder" && itemBeingMoved.id === folder.id;

  return (
    <>
      <div
        className={`flex items-center gap-1 rounded-md transition-colors ${
          disabled ? "opacity-40 cursor-not-allowed" : ""
        }`}
        style={{ paddingLeft: `${treeIndent(depth)}px` }}
      >
        {/* Expand toggle */}
        <button
          type="button"
          className={`w-4 h-4 flex items-center justify-center shrink-0 rounded ${
            hasChildren ? "hover:bg-muted" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>

        {/* Folder button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onSelect(folder.id)}
          title={folder.name}
          className={`flex items-center gap-2 flex-1 px-2 py-1.5 rounded-md text-left text-sm transition-colors ${
            isSelected
              ? "bg-primary/10 text-primary font-medium ring-1 ring-primary/30"
              : disabled
                ? ""
                : "hover:bg-muted/50"
          }`}
        >
          {expanded ? (
            <FolderOpen className="w-4 h-4 shrink-0 text-amber-500" />
          ) : (
            <Folder className="w-4 h-4 shrink-0 text-amber-500" />
          )}
          <span className="truncate">{folder.name}</span>
          {isSelf && (
            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">(this item)</span>
          )}
        </button>
      </div>

      {/* Children */}
      {expanded && children.map((child) => (
        <MoveToFolderItem
          key={child.id}
          folder={child}
          getChildren={getChildren}
          selectedTarget={selectedTarget}
          onSelect={onSelect}
          canSelect={canSelect}
          depth={depth + 1}
          itemBeingMoved={itemBeingMoved}
        />
      ))}
    </>
  );
}
