import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
} from "lucide-react";
import type { DocumentListItem, FolderItem } from "@shared/schema";

interface StoragePanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Load a saved document into the workspace */
  onLoadDocument: (doc: { id: number; title: string; content: string }) => void;
  /** Save the current workspace document */
  onSave: (title: string, folderId: number | null) => Promise<void>;
  /** Whether the workspace has content worth saving */
  hasContent: boolean;
  /** Current saved document ID (if editing an existing doc) */
  currentDocId?: number | null;
  /** Current document title */
  currentTitle?: string;
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

  useEffect(() => {
    if (currentTitle) setSaveTitle(currentTitle);
  }, [currentTitle]);

  // ── Queries ──

  const foldersQuery = useQuery({
    queryKey: ["/api/folders", currentFolderId],
    queryFn: async () => {
      const url = currentFolderId != null
        ? `/api/folders?parentFolderId=${currentFolderId}`
        : "/api/folders?parentFolderId=null";
      const res = await apiRequest("GET", url);
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
      // Filter to current folder
      if (currentFolderId === null) {
        return all.filter((d) => !d.folderId);
      }
      return all.filter((d) => d.folderId === currentFolderId);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document deleted" });
    },
  });

  // ── Handlers ──

  const navigateToFolder = useCallback((folderId: number, folderName: string) => {
    setCurrentFolderId(folderId);
    setFolderPath((prev) => [...prev, { id: folderId, name: folderName }]);
  }, []);

  const navigateToPathIndex = useCallback((index: number) => {
    const entry = folderPath[index];
    setCurrentFolderId(entry.id);
    setFolderPath((prev) => prev.slice(0, index + 1));
  }, [folderPath]);

  const handleLoadDocument = useCallback(async (docId: number) => {
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

  const isLoading = foldersQuery.isLoading || documentsQuery.isLoading;
  const foldersList = foldersQuery.data || [];
  const documentsList = documentsQuery.data || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
          <HardDrive className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm flex-1">Storage</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Save bar — only if workspace has content */}
        {hasContent && (
          <div className="px-4 py-3 border-b bg-muted/20 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder="Document title..."
                className="h-8 text-sm flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
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
            <p className="text-[11px] text-muted-foreground">
              {currentDocId ? "Saving will update the existing document." : `Saving to: ${folderPath[folderPath.length - 1].name}`}
            </p>
          </div>
        )}

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 px-4 py-2 border-b text-xs overflow-x-auto shrink-0">
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
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-1">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && foldersList.length === 0 && documentsList.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                <FolderOpen className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No documents or folders here yet.</p>
                <p className="text-xs text-muted-foreground/60">Save your work or create a folder to get started.</p>
              </div>
            )}

            {/* New folder creation */}
            {isCreatingFolder && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name..."
                  className="h-7 text-sm flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newFolderName.trim()) {
                      createFolderMutation.mutate(newFolderName.trim());
                    }
                    if (e.key === "Escape") {
                      setIsCreatingFolder(false);
                      setNewFolderName("");
                    }
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={!newFolderName.trim()}
                  onClick={() => newFolderName.trim() && createFolderMutation.mutate(newFolderName.trim())}
                >
                  <Check className="w-3 h-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => { setIsCreatingFolder(false); setNewFolderName(""); }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}

            {/* Folders */}
            {foldersList.map((folder) => (
              <div
                key={`f-${folder.id}`}
                className="group flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
              >
                {renamingFolderId === folder.id ? (
                  <>
                    <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                    <Input
                      value={renameText}
                      onChange={(e) => setRenameText(e.target.value)}
                      className="h-7 text-sm flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && renameText.trim()) {
                          renameFolderMutation.mutate({ id: folder.id, name: renameText.trim() });
                        }
                        if (e.key === "Escape") {
                          setRenamingFolderId(null);
                          setRenameText("");
                        }
                      }}
                    />
                  </>
                ) : (
                  <>
                    <FolderOpen
                      className="w-4 h-4 text-amber-500 shrink-0"
                      onClick={() => navigateToFolder(folder.id, folder.name)}
                    />
                    <span
                      className="text-sm flex-1 truncate"
                      onClick={() => navigateToFolder(folder.id, folder.name)}
                    >
                      {folder.name}
                    </span>
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingFolderId(folder.id);
                          setRenameText(folder.name);
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFolderMutation.mutate(folder.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  </>
                )}
              </div>
            ))}

            {/* Documents */}
            {documentsList.map((doc) => (
              <div
                key={`d-${doc.id}`}
                className={`group flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer ${
                  currentDocId === doc.id ? "bg-primary/10 border border-primary/20" : ""
                }`}
              >
                {renamingDocId === doc.id ? (
                  <>
                    <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                    <Input
                      value={renameText}
                      onChange={(e) => setRenameText(e.target.value)}
                      className="h-7 text-sm flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && renameText.trim()) {
                          renameDocMutation.mutate({ id: doc.id, title: renameText.trim() });
                        }
                        if (e.key === "Escape") {
                          setRenamingDocId(null);
                          setRenameText("");
                        }
                      }}
                    />
                  </>
                ) : (
                  <>
                    <FileText
                      className="w-4 h-4 text-blue-500 shrink-0"
                      onClick={() => handleLoadDocument(doc.id)}
                    />
                    <div className="flex-1 min-w-0" onClick={() => handleLoadDocument(doc.id)}>
                      <p className="text-sm truncate">{doc.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(doc.updatedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
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
                        className="h-6 w-6 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteDocMutation.mutate(doc.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    {currentDocId === doc.id && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">Current</Badge>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-2 border-t shrink-0">
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
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => setIsCreatingFolder(true)}
            disabled={isCreatingFolder}
          >
            <FolderPlus className="w-3 h-3" />
            New Folder
          </Button>
        </div>
      </div>
    </div>
  );
}
