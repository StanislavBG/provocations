import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Pin,
  PinOff,
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

export function ContextSidebar({
  pinnedDocIds,
  onPinDoc,
  onUnpinDoc,
  onOpenDoc,
  isCollapsed,
  onToggleCollapse,
}: ContextSidebarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  // Fetch documents and folders
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

  // File upload
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

  // Filter
  const q = searchQuery.toLowerCase();
  const filteredDocs = q
    ? docs.filter((d) => d.title.toLowerCase().includes(q))
    : docs;
  const filteredFolders = q
    ? folders.filter((f) => f.name.toLowerCase().includes(q))
    : folders;

  // Pinned docs (resolved from full doc list)
  const pinnedDocs = docs.filter((d) => pinnedDocIds.has(d.id));

  // Folder tree helpers
  const rootFolders = filteredFolders.filter((f) => f.parentFolderId === null);
  const getChildren = (parentId: number) =>
    filteredFolders.filter((f) => f.parentFolderId === parentId);
  const getDocsInFolder = (folderId: number | null) =>
    filteredDocs.filter((d) =>
      folderId === null ? !d.folderId : d.folderId === folderId,
    );
  const rootDocs = getDocsInFolder(null);

  // Collapsed view
  if (isCollapsed) {
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
          <TooltipContent side="right">Expand sources</TooltipContent>
        </Tooltip>

        {pinnedDocIds.size > 0 && (
          <Badge
            variant="secondary"
            className="text-[10px] h-5 min-w-[20px] justify-center"
          >
            {pinnedDocIds.size}
          </Badge>
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

  // Doc row renderer
  const renderDocRow = (doc: DocumentListItem, indent: number) => {
    const isPinned = pinnedDocIds.has(doc.id);
    return (
      <div
        key={`d-${doc.id}`}
        className="flex items-center gap-1 group hover:bg-muted/50 rounded-md transition-colors"
        style={{ paddingLeft: `${indent}px` }}
      >
        <button
          className="flex-1 flex items-center gap-1.5 py-1.5 px-1 text-left min-w-0"
          onClick={() => onOpenDoc?.(doc.id, doc.title)}
          title={doc.title}
        >
          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs truncate">{doc.title}</span>
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 shrink-0 ${
                isPinned
                  ? "text-primary"
                  : "opacity-0 group-hover:opacity-100 text-muted-foreground"
              }`}
              onClick={() =>
                isPinned ? onUnpinDoc(doc.id) : onPinDoc(doc.id)
              }
            >
              {isPinned ? (
                <PinOff className="w-3 h-3" />
              ) : (
                <Pin className="w-3 h-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {isPinned ? "Unpin from context" : "Pin to context"}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  };

  // Folder tree renderer
  const renderFolder = (folder: FolderItem, depth: number): React.ReactNode => {
    const isExpanded = expandedFolders.has(folder.id);
    const children = getChildren(folder.id);
    const folderDocs = getDocsInFolder(folder.id);
    const hasContent = children.length > 0 || folderDocs.length > 0;
    const indent = treeIndent(depth);

    return (
      <div key={`f-${folder.id}`}>
        <button
          onClick={() => hasContent && toggleFolder(folder.id)}
          className={`w-full text-left py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-colors ${
            hasContent
              ? "hover:bg-muted/50 cursor-pointer"
              : "opacity-50 cursor-default"
          }`}
          style={{ paddingLeft: `${indent}px` }}
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
        </button>
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
    <div className="h-full flex flex-col bg-card border-r">
      {/* Header */}
      <div className="p-2 border-b flex items-center justify-between gap-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Sources
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

      {/* Search */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="h-7 text-xs pl-7"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {/* Pinned Context Section */}
        {pinnedDocs.length > 0 && (
          <div className="p-2 border-b bg-primary/5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Pin className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                Active Context
              </span>
              <Badge
                variant="secondary"
                className="text-[10px] h-4 min-w-[16px] justify-center ml-auto"
              >
                {pinnedDocs.length}
              </Badge>
            </div>
            {pinnedDocs.map((doc) => (
              <div
                key={`pinned-${doc.id}`}
                className="flex items-center gap-1.5 py-1 px-1 group"
              >
                <FileText className="w-3 h-3 text-primary/60 shrink-0" />
                <span className="text-xs truncate flex-1">{doc.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={() => onUnpinDoc(doc.id)}
                >
                  <PinOff className="w-2.5 h-2.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Document Browser */}
        <div className="p-2">
          {rootFolders.map((folder) => renderFolder(folder, 0))}
          {rootFolders.length > 0 && rootDocs.length > 0 && (
            <div className="border-t my-1" />
          )}
          {rootDocs.map((doc) => renderDocRow(doc, 4))}

          {/* Empty state */}
          {docs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground/50">
              <FileText className="w-6 h-6" />
              <p className="text-xs text-center">
                No documents yet.
                <br />
                Upload files or save from workspace.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-2 border-t">
        <p className="text-[10px] text-muted-foreground text-center">
          Click <Pin className="inline w-2.5 h-2.5" /> to add to context
        </p>
      </div>
    </div>
  );
}
