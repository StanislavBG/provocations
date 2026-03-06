import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FolderInput, FolderOpen, Folder, ChevronDown, ChevronRight, Save, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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

export function StoreExpandedView({
  node,
  onUpdateNode,
}: StoreExpandedViewProps) {
  const { toast } = useToast();
  const [docName, setDocName] = useState(node.storeName || "");
  const [autoSave, setAutoSave] = useState(node.storeAutoSave || false);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  // Fetch user folders
  const { data: folders = [] } = useQuery({
    queryKey: ["/api/folders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/folders");
      return (await res.json()) as FolderItem[];
    },
  });

  const rootFolders = folders.filter((f) => f.parentId === null);
  const getChildren = (parentId: number) => folders.filter((f) => f.parentId === parentId);

  // Sync name and autoSave back to node
  useEffect(() => {
    onUpdateNode(node.id, { storeName: docName, storeAutoSave: autoSave });
  }, [docName, autoSave, node.id, onUpdateNode]);

  const selectFolder = useCallback(
    (folderId: number | null, folderName: string, folderPath: string) => {
      onUpdateNode(node.id, {
        storeFolderId: folderId ?? undefined,
        storeFolderName: folderName,
        storeFolderPath: folderPath,
      });
      toast({ title: "Folder selected", description: folderPath });
    },
    [node.id, onUpdateNode, toast],
  );

  const toggleExpand = (id: number) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderFolder = (f: FolderItem, depth: number, parentPath: string) => {
    const isExpanded = expandedFolders.has(f.id);
    const children = getChildren(f.id);
    const path = parentPath ? `${parentPath} > ${f.name}` : f.name;
    const isSelected = node.storeFolderId === f.id;

    return (
      <div key={f.id}>
        <div
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors cursor-pointer ${
            isSelected ? "bg-primary/15 border border-primary/30" : "hover:bg-muted/50"
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {children.length > 0 ? (
            <button className="shrink-0" onClick={() => toggleExpand(f.id)}>
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <button
            className="flex items-center gap-1.5 flex-1 text-left min-w-0"
            onClick={() => selectFolder(f.id, f.name, path)}
          >
            {isSelected ? (
              <FolderOpen className="w-3.5 h-3.5 text-primary shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            )}
            <span className="text-xs font-medium truncate">{f.name}</span>
          </button>
        </div>
        {isExpanded && children.map((child) => renderFolder(child, depth + 1, path))}
      </div>
    );
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
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Destination Folder
            </label>

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
              {rootFolders.map((folder) => renderFolder(folder, 0, ""))}
              {folders.length === 0 && (
                <p className="text-[10px] text-muted-foreground/60 py-3 text-center">
                  No folders yet. Create folders in the Context Store.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel: Preview / Status */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-border/50">
          <h3 className="text-sm font-semibold">Save Preview</h3>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-md mx-auto space-y-4">
            {/* Save summary card */}
            <div className="border border-border rounded-xl p-4 bg-card shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {docName || "(auto-named)"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {node.storeFolderPath || "/ (Root)"}
                  </div>
                </div>
              </div>
            </div>

            {/* Info text */}
            <div className="text-center text-xs text-muted-foreground space-y-1">
              <p>
                When upstream nodes complete, their output will be saved as a document
                in the selected folder.
              </p>
              {autoSave && (
                <p className="text-primary">
                  Auto-save is enabled — documents will be created automatically.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
