import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  FolderPlus,
  FileText,
  Trash2,
  Pencil,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Save,
  Check,
  HardDrive,
  ArrowUpRight,
  Calendar,
  Type,
  Eye,
} from "lucide-react";
import type { DocumentListItem, FolderItem } from "@shared/schema";

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

  useEffect(() => {
    if (currentTitle) setSaveTitle(currentTitle);
  }, [currentTitle]);

  // ── Queries ──

  // Fetch ALL folders (flat) so we can build the tree
  const allFoldersQuery = useQuery({
    queryKey: ["/api/folders/all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/folders?parentFolderId=null");
      const rootData = await res.json();
      const rootFolders = (rootData.folders || []) as FolderItem[];

      // Recursively fetch children for deeper hierarchy
      const allFolders: FolderItem[] = [...rootFolders];
      const queue = [...rootFolders];
      while (queue.length > 0) {
        const folder = queue.shift()!;
        try {
          const childRes = await apiRequest("GET", `/api/folders?parentFolderId=${folder.id}`);
          const childData = await childRes.json();
          const children = (childData.folders || []) as FolderItem[];
          allFolders.push(...children);
          queue.push(...children);
        } catch {
          // Folder has no children or error — continue
        }
      }
      return allFolders;
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
  const allDocsQuery = useQuery({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/documents");
      const data = await res.json();
      return (data.documents || []) as DocumentListItem[];
    },
    enabled: isOpen,
  });

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

  // ── Handlers ──

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
  const allDocs = allDocsQuery.data || [];

  // Build folder tree structure
  const rootFolders = allFolders.filter((f) => f.parentFolderId === null);
  const getChildren = (parentId: number) => allFolders.filter((f) => f.parentFolderId === parentId);
  const getDocCount = (folderId: number | null) => {
    if (folderId === null) return allDocs.filter((d) => !d.folderId).length;
    return allDocs.filter((d) => d.folderId === folderId).length;
  };

  // Word count for preview
  const previewWordCount = previewDoc?.content
    ? previewDoc.content.trim().split(/\s+/).filter(Boolean).length
    : 0;

  // Detect if content looks like markdown
  const isMarkdown = previewDoc?.content
    ? /^#{1,6}\s|^\*\*|^\-\s|^\d+\.\s|```/.test(previewDoc.content.slice(0, 500))
    : false;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md animate-in fade-in duration-200">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-card shrink-0">
        <HardDrive className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-base flex-1">Storage</h2>

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
        <div className="w-56 shrink-0 border-r flex flex-col overflow-hidden bg-card/40">
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

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-2 space-y-0.5">
              {/* Root / My Documents */}
              <FolderTreeItem
                label="My Documents"
                folderId={null}
                isActive={currentFolderId === null}
                docCount={getDocCount(null)}
                depth={0}
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
                  getChildren={getChildren}
                  getDocCount={getDocCount}
                  currentFolderId={currentFolderId}
                  renamingFolderId={renamingFolderId}
                  renameText={renameText}
                  depth={1}
                  onNavigate={(id, name) => navigateToFolder(id, name)}
                  onStartRename={(id, name) => { setRenamingFolderId(id); setRenameText(name); }}
                  onRename={(id, name) => renameFolderMutation.mutate({ id, name })}
                  onCancelRename={() => { setRenamingFolderId(null); setRenameText(""); }}
                  onRenameTextChange={setRenameText}
                  onDelete={(id) => deleteFolderMutation.mutate(id)}
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
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 px-4 py-2 border-b text-xs overflow-x-auto shrink-0 bg-card/20">
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
            <span className="ml-auto text-muted-foreground/60">
              {documentsList.length} document{documentsList.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Document list */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3 space-y-1">
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!isLoading && documentsList.length === 0 && (
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

              {documentsList.map((doc) => {
                const isSelected = selectedDocId === doc.id;
                const isCurrent = currentDocId === doc.id;
                return (
                  <div
                    key={`d-${doc.id}`}
                    className={`group w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors overflow-hidden ${
                      isSelected
                        ? "bg-primary/10 border border-primary/30"
                        : isCurrent
                          ? "bg-muted/50 border border-muted"
                          : "hover:bg-muted/40 border border-transparent"
                    }`}
                  >
                    {/* Click area — file icon + title/date */}
                    <button
                      type="button"
                      onClick={() => handlePreviewDocument(doc.id)}
                      onDoubleClick={() => handleOpenDocument(doc.id)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    >
                      <FileText className={`w-4 h-4 shrink-0 ${isSelected ? "text-primary" : "text-blue-500"}`} />
                      <div className="flex-1 min-w-0 overflow-hidden">
                        {renamingDocId === doc.id ? (
                          <Input
                            value={renameText}
                            onChange={(e) => setRenameText(e.target.value)}
                            className="h-7 text-sm"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter" && renameText.trim()) {
                                renameDocMutation.mutate({ id: doc.id, title: renameText.trim() });
                              }
                              if (e.key === "Escape") {
                                setRenamingDocId(null);
                                setRenameText("");
                              }
                            }}
                          />
                        ) : (
                          <>
                            <p className="text-sm font-medium truncate">{doc.title}</p>
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

                    {/* Always-visible actions: rename (hover) + delete (always) */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {isCurrent && (
                        <Badge variant="secondary" className="text-[10px] mr-1">Current</Badge>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Rename"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingDocId(doc.id);
                          setRenameText(doc.title);
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive/60 hover:text-destructive"
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete "${doc.title}"?`)) {
                            deleteDocMutation.mutate(doc.id);
                          }
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Middle panel footer */}
          <div className="flex items-center gap-2 px-4 py-2 border-t shrink-0 bg-card/20">
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
              Click to preview, double-click to open
            </p>
          </div>
        </div>

        {/* ── RIGHT PANEL: Document preview ── */}
        <div className="w-[40%] min-w-[300px] border-l flex flex-col overflow-hidden bg-card/20">
          {isLoadingPreview ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : previewDoc ? (
            <>
              {/* Preview header with metadata */}
              <div className="px-4 py-3 border-b shrink-0 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-tight flex-1">{previewDoc.title}</h3>
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Folder tree sub-components
// ---------------------------------------------------------------------------

function FolderTreeItem({
  label,
  folderId,
  isActive,
  docCount,
  depth,
  onClick,
}: {
  label: string;
  folderId: number | null;
  isActive: boolean;
  docCount: number;
  depth: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors ${
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-foreground/80 hover:bg-muted/50"
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <FolderOpen className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-amber-500"}`} />
      <span className="flex-1 truncate">{label}</span>
      {docCount > 0 && (
        <span className="text-[10px] text-muted-foreground/60 shrink-0">{docCount}</span>
      )}
    </button>
  );
}

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
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
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
  getChildren,
  getDocCount,
  currentFolderId,
  renamingFolderId,
  renameText,
  depth,
  onNavigate,
  onStartRename,
  onRename,
  onCancelRename,
  onRenameTextChange,
  onDelete,
  isCreatingFolder,
  newFolderName,
  onNewFolderNameChange,
  onCreateFolder,
  onCancelCreateFolder,
  targetFolderId,
}: {
  folder: FolderItem;
  getChildren: (parentId: number) => FolderItem[];
  getDocCount: (folderId: number | null) => number;
  currentFolderId: number | null;
  renamingFolderId: number | null;
  renameText: string;
  depth: number;
  onNavigate: (id: number, name: string) => void;
  onStartRename: (id: number, name: string) => void;
  onRename: (id: number, name: string) => void;
  onCancelRename: () => void;
  onRenameTextChange: (v: string) => void;
  onDelete: (id: number) => void;
  isCreatingFolder: boolean;
  newFolderName: string;
  onNewFolderNameChange: (v: string) => void;
  onCreateFolder: () => void;
  onCancelCreateFolder: () => void;
  targetFolderId: number | null;
}) {
  const children = getChildren(folder.id);
  const isActive = currentFolderId === folder.id;
  const isRenaming = renamingFolderId === folder.id;

  return (
    <>
      {isRenaming ? (
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
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
        <div className="group relative">
          <FolderTreeItem
            label={folder.name}
            folderId={folder.id}
            isActive={isActive}
            docCount={getDocCount(folder.id)}
            depth={depth}
            onClick={() => onNavigate(folder.id, folder.name)}
          />
          {/* Hover actions */}
          <div className="absolute right-1 top-1 hidden group-hover:flex items-center gap-0.5">
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

      {/* Children */}
      {children.map((child) => (
        <FolderTreeBranch
          key={child.id}
          folder={child}
          getChildren={getChildren}
          getDocCount={getDocCount}
          currentFolderId={currentFolderId}
          renamingFolderId={renamingFolderId}
          renameText={renameText}
          depth={depth + 1}
          onNavigate={onNavigate}
          onStartRename={onStartRename}
          onRename={onRename}
          onCancelRename={onCancelRename}
          onRenameTextChange={onRenameTextChange}
          onDelete={onDelete}
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
