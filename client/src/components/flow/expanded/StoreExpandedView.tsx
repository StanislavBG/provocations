import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  FolderInput,
  FolderOpen,
  Folder,
  ChevronDown,
  ChevronRight,
  Save,
  FileText,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  FolderPlus,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FlowNode } from "../useFlowCanvas";

interface StoreExpandedViewProps {
  node: FlowNode;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
}

interface FolderItem {
  id: number;
  name: string;
  parentId: number | null;
}

interface DocItem {
  id: number;
  title: string;
  folderId: number | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Auto-focusing inline input for rename / create operations */
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
        if (e.key === "Enter" && text.trim()) {
          onSubmit(text.trim());
          e.stopPropagation();
        }
        if (e.key === "Escape") {
          onCancel();
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      onBlur={() => {
        if (text.trim() && text.trim() !== value) onSubmit(text.trim());
        else onCancel();
      }}
    />
  );
}

export function StoreExpandedView({
  node,
  onUpdateNode,
}: StoreExpandedViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [docName, setDocName] = useState(node.storeName || "");
  const [autoSave, setAutoSave] = useState(node.storeAutoSave || false);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  // Folder CRUD state
  const [creatingFolderIn, setCreatingFolderIn] = useState<number | null | false>(false);
  const [renamingFolderId, setRenamingFolderId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; folderId: number; folderName: string } | null>(null);

  // Document CRUD state
  const [renamingDocId, setRenamingDocId] = useState<number | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<{ id: number; title: string } | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<{ id: number; name: string } | null>(null);

  // ── Data queries ──

  const { data: rawFolderData } = useQuery({
    queryKey: ["/api/folders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/folders");
      return res.json();
    },
  });

  const folders: FolderItem[] = Array.isArray(rawFolderData)
    ? rawFolderData
    : Array.isArray((rawFolderData as any)?.folders)
      ? (rawFolderData as any).folders
      : [];

  const { data: rawDocData } = useQuery({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/documents");
      return res.json();
    },
  });

  // Normalise: cache may hold { documents: [...] } or a bare array depending on
  // which component populated the shared ["/api/documents"] key first.
  const documents: DocItem[] = Array.isArray(rawDocData)
    ? rawDocData
    : Array.isArray((rawDocData as any)?.documents)
      ? (rawDocData as any).documents
      : [];

  const rootFolders = folders.filter((f) => f.parentId === null);
  const getChildren = (parentId: number) => folders.filter((f) => f.parentId === parentId);

  // Filter documents by selected folder
  const filteredDocs = node.storeFolderId
    ? documents.filter((d) => d.folderId === node.storeFolderId)
    : documents;

  // Build folder name lookup for path display
  const folderNameMap = new Map(folders.map((f) => [f.id, f.name]));
  const getFolderPath = (folderId: number | null | undefined): string => {
    if (!folderId) return "/ (Root)";
    const parts: string[] = [];
    let current = folderId;
    while (current) {
      const folder = folders.find((f) => f.id === current);
      if (!folder) break;
      parts.unshift(folder.name);
      current = folder.parentId!;
    }
    return parts.join(" > ") || "/ (Root)";
  };

  // ── Folder mutations ──

  const invalidateFolders = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/folders/all"] });
  };

  const createFolderMutation = useMutation({
    mutationFn: async (data: { name: string; parentFolderId?: number | null }) => {
      const res = await apiRequest("POST", "/api/folders", data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      invalidateFolders();
      setCreatingFolderIn(false);
      if (variables.parentFolderId != null) {
        setExpandedFolders((prev) => new Set(prev).add(variables.parentFolderId!));
      }
      toast({ title: "Folder created" });
    },
    onError: () => {
      toast({ title: "Failed to create folder", variant: "destructive" });
    },
  });

  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      await apiRequest("PATCH", `/api/folders/${id}`, { name });
    },
    onSuccess: () => {
      invalidateFolders();
      setRenamingFolderId(null);
      toast({ title: "Folder renamed" });
    },
    onError: () => {
      toast({ title: "Failed to rename folder", variant: "destructive" });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/folders/${id}`);
    },
    onSuccess: () => {
      invalidateFolders();
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setDeletingFolder(null);
      // Clear selection if we deleted the selected folder
      if (node.storeFolderId === deletingFolder?.id) {
        onUpdateNode(node.id, { storeFolderId: undefined, storeFolderName: undefined, storeFolderPath: undefined });
      }
      toast({ title: "Folder deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete folder", variant: "destructive" });
      setDeletingFolder(null);
    },
  });

  // ── Document mutations ──

  const renameDocMutation = useMutation({
    mutationFn: async ({ id, title }: { id: number; title: string }) => {
      await apiRequest("PATCH", `/api/documents/${id}`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setRenamingDocId(null);
      toast({ title: "Document renamed" });
    },
    onError: () => {
      toast({ title: "Failed to rename document", variant: "destructive" });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setDeletingDoc(null);
      toast({ title: "Document deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete document", variant: "destructive" });
      setDeletingDoc(null);
    },
  });

  // Sync name and autoSave back to node
  useEffect(() => {
    onUpdateNode(node.id, { storeName: docName, storeAutoSave: autoSave });
  }, [docName, autoSave, node.id, onUpdateNode]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu]);

  const selectFolder = useCallback(
    (folderId: number | null, folderName: string, folderPath: string) => {
      onUpdateNode(node.id, {
        storeFolderId: folderId ?? undefined,
        storeFolderName: folderName,
        storeFolderPath: folderPath,
      });
    },
    [node.id, onUpdateNode],
  );

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
    setContextMenu({ x: e.clientX, y: e.clientY, folderId: f.id, folderName: f.name });
  };

  const renderFolder = (f: FolderItem, depth: number, parentPath: string) => {
    const isExpanded = expandedFolders.has(f.id);
    const children = getChildren(f.id);
    const path = parentPath ? `${parentPath} > ${f.name}` : f.name;
    const isSelected = node.storeFolderId === f.id;
    const isRenaming = renamingFolderId === f.id;

    return (
      <div key={f.id}>
        <div
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors cursor-pointer group ${
            isSelected ? "bg-primary/15 border border-primary/30" : "hover:bg-muted/50"
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onContextMenu={(e) => handleFolderContextMenu(e, f)}
        >
          {children.length > 0 ? (
            <button className="shrink-0" onClick={() => toggleExpand(f.id)}>
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          ) : (
            <span className="w-3 shrink-0" />
          )}

          {isRenaming ? (
            <div className="flex-1 min-w-0">
              <InlineInput
                value={f.name}
                onSubmit={(name) => renameFolderMutation.mutate({ id: f.id, name })}
                onCancel={() => setRenamingFolderId(null)}
              />
            </div>
          ) : (
            <button
              className="flex items-center gap-1.5 flex-1 text-left min-w-0"
              onClick={() => selectFolder(f.id, f.name, path)}
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
                  setExpandedFolders((prev) => new Set(prev).add(f.id));
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
          <div className="flex items-center gap-1.5 px-2 py-1" style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}>
            <FolderPlus className="w-3.5 h-3.5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <InlineInput
                value=""
                placeholder="Folder name..."
                onSubmit={(name) => createFolderMutation.mutate({ name, parentFolderId: f.id })}
                onCancel={() => setCreatingFolderIn(false)}
              />
            </div>
          </div>
        )}

        {isExpanded && children.map((child) => renderFolder(child, depth + 1, path))}
      </div>
    );
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: Configuration */}
      <div className="w-80 border-r flex flex-col bg-card/50">
        <div className="p-4 border-b border-border/50">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FolderInput className="w-4 h-4 text-primary" />
            Store Configuration
          </h3>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-5">
          {/* Document name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Document Name
            </label>
            <input
              className="w-full text-sm bg-muted/30 border border-border/50 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="Auto-generated if empty"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Leave empty to auto-name from upstream node label.
            </p>
          </div>

          {/* Auto-save toggle */}
          <div className="flex items-center gap-2">
            <button
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                autoSave ? "bg-primary border-primary" : "border-border"
              }`}
              onClick={() => setAutoSave(!autoSave)}
            >
              {autoSave && <Save className="w-2.5 h-2.5 text-white" />}
            </button>
            <span className="text-xs">Auto-save when chain completes</span>
          </div>

          {/* Destination folder */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Destination Folder
              </label>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-primary hover:text-primary"
                onClick={() => setCreatingFolderIn(node.storeFolderId ?? null)}
              >
                <Plus className="w-3 h-3 mr-0.5" />
                New Folder
              </Button>
            </div>

            {/* Current selection */}
            {node.storeFolderPath && (
              <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{node.storeFolderPath}</span>
              </div>
            )}

            {/* Folder tree */}
            <div className="border border-border/50 rounded-lg max-h-[250px] overflow-auto">
              <button
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors ${
                  !node.storeFolderId ? "bg-primary/15" : "hover:bg-muted/50"
                }`}
                onClick={() => selectFolder(null, "Root", "/ (Root)")}
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-xs font-medium">/ (Root)</span>
              </button>

              {/* Inline new folder at root */}
              {creatingFolderIn === null && (
                <div className="flex items-center gap-1.5 px-2 py-1" style={{ paddingLeft: "8px" }}>
                  <FolderPlus className="w-3.5 h-3.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <InlineInput
                      value=""
                      placeholder="Folder name..."
                      onSubmit={(name) => createFolderMutation.mutate({ name, parentFolderId: null })}
                      onCancel={() => setCreatingFolderIn(false)}
                    />
                  </div>
                </div>
              )}

              {rootFolders.map((folder) => renderFolder(folder, 0, ""))}
              {folders.length === 0 && creatingFolderIn === false && (
                <p className="text-[10px] text-muted-foreground/60 py-3 text-center">
                  No folders yet. Click "New Folder" to create one.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel: Document Browser + Save Preview */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Documents
            <span className="text-[10px] font-normal text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
              {filteredDocs.length}
            </span>
          </h3>
          <span className="text-[10px] text-muted-foreground">
            {node.storeFolderId
              ? `In: ${folderNameMap.get(node.storeFolderId) || "Selected folder"}`
              : "All documents"}
          </span>
        </div>

        <div className="flex-1 overflow-auto">
          {filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <FileText className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground/60">
                {node.storeFolderId
                  ? "No documents in this folder."
                  : "No documents yet."}
              </p>
              <p className="text-[10px] text-muted-foreground/40 mt-1">
                Documents saved by the store node will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filteredDocs.map((doc) => {
                const isRenaming = renamingDocId === doc.id;

                return (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 px-4 py-2.5 group hover:bg-muted/30 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />

                    {isRenaming ? (
                      <div className="flex-1 min-w-0">
                        <InlineInput
                          value={doc.title}
                          onSubmit={(title) => renameDocMutation.mutate({ id: doc.id, title })}
                          onCancel={() => setRenamingDocId(null)}
                        />
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{doc.title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {!node.storeFolderId && doc.folderId && (
                            <span className="text-[10px] text-muted-foreground/50 truncate">
                              {getFolderPath(doc.folderId)}
                            </span>
                          )}
                          {doc.updatedAt && (
                            <span className="text-[10px] text-muted-foreground/40">
                              {formatDate(doc.updatedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Hover action buttons */}
                    {!isRenaming && (
                      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                        <button
                          className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                          title="Rename"
                          onClick={() => setRenamingDocId(doc.id)}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-destructive"
                          title="Delete"
                          onClick={() => setDeletingDoc({ id: doc.id, title: doc.title })}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Save preview card at bottom */}
        <div className="border-t border-border/50 p-4 bg-card/30">
          <div className="border border-border rounded-xl p-3 bg-card shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Save className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">
                  {docName || "(auto-named)"}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {node.storeFolderPath || "/ (Root)"}
                </div>
                {autoSave && (
                  <div className="text-[10px] text-primary mt-1">
                    Auto-save enabled
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

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
              setExpandedFolders((prev) => new Set(prev).add(contextMenu.folderId));
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
              setDeletingFolder({ id: contextMenu.folderId, name: contextMenu.folderName });
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
              Are you sure you want to delete <span className="font-medium text-foreground">"{deletingFolder.name}"</span>?
              Documents inside may be moved to root.
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
                onClick={() => deleteFolderMutation.mutate(deletingFolder.id)}
                disabled={deleteFolderMutation.isPending}
              >
                {deleteFolderMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete document confirmation */}
      {deletingDoc && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-popover border border-border rounded-xl shadow-2xl p-5 max-w-sm w-full mx-4">
            <h4 className="text-sm font-semibold mb-2">Delete document?</h4>
            <p className="text-xs text-muted-foreground mb-4">
              Are you sure you want to delete <span className="font-medium text-foreground">"{deletingDoc.title}"</span>?
              This cannot be undone.
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
                onClick={() => deleteDocMutation.mutate(deletingDoc.id)}
                disabled={deleteDocMutation.isPending}
              >
                {deleteDocMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
