/**
 * UploadExpandedView -- Full expanded view for Upload nodes.
 *
 * Left panel: drag-and-drop upload zone + file list.
 * Right panel: preview + image customizer for selected file.
 */

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Video,
  FileType,
  Trash2,
  Save,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProvokeText } from "@/components/ProvokeText";
import { ImageCustomizer } from "@/components/ImageCustomizer";
import { useToast } from "@/hooks/use-toast";
import { generateId } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { FlowNode } from "../useFlowCanvas";

interface UploadFile {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  docType: string;
  savedDocId?: number;
  meta?: {
    tags: string[];
    label: string;
    altText: string;
    description: string;
  };
  transform?: {
    panX: number;
    panY: number;
    scale: number;
  };
}

interface UploadExpandedViewProps {
  node: FlowNode;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
}

const ACCEPTED_TYPES = [
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp",
  ".mp4", ".webm",
  ".pdf", ".md", ".txt",
];

const ACCEPTED_MIME =
  "image/png,image/jpeg,image/gif,image/svg+xml,image/webp,video/mp4,video/webm,application/pdf,text/markdown,text/plain";

function getDocType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  return "document";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(docType: string) {
  switch (docType) {
    case "image": return ImageIcon;
    case "video": return Video;
    case "pdf": return FileType;
    default: return FileText;
  }
}

export function UploadExpandedView({ node, onUpdateNode }: UploadExpandedViewProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [savingFileId, setSavingFileId] = useState<string | null>(null);

  const files: UploadFile[] = (node.uploadFiles as UploadFile[]) || [];
  const selectedFile = files.find((f) => f.id === selectedFileId) || null;

  // ---- File handling ----

  const handleFiles = useCallback(
    (fileList: FileList) => {
      const newFiles: UploadFile[] = [];

      Array.from(fileList).forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const docType = getDocType(file.type);
          const newFile: UploadFile = {
            id: generateId(),
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl,
            docType,
          };
          // Update node with the new file appended
          onUpdateNode(node.id, {
            uploadFiles: [...(node.uploadFiles || []), newFile],
            snippet: `${(node.uploadFiles || []).length + 1} file(s)`,
            uploadStatus: "done",
          });
        };

        if (
          file.type.startsWith("text/") ||
          file.name.endsWith(".md") ||
          file.name.endsWith(".txt")
        ) {
          reader.readAsText(file);
        } else {
          reader.readAsDataURL(file);
        }
      });
    },
    [node.id, node.uploadFiles, onUpdateNode],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleBrowse = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        handleFiles(e.target.files);
        e.target.value = "";
      }
    },
    [handleFiles],
  );

  const handleRemoveFile = useCallback(
    (fileId: string) => {
      const updated = files.filter((f) => f.id !== fileId);
      onUpdateNode(node.id, {
        uploadFiles: updated,
        snippet: updated.length ? `${updated.length} file(s)` : "Double-click to upload files",
        uploadStatus: updated.length ? "done" : "idle",
      });
      if (selectedFileId === fileId) setSelectedFileId(null);
    },
    [files, node.id, onUpdateNode, selectedFileId],
  );

  // ---- Save to Context Store ----

  const handleSaveFile = useCallback(
    async (file: UploadFile) => {
      setSavingFileId(file.id);
      try {
        const formData = new FormData();
        // For text content stored as plain text, create a blob from the string
        let blob: Blob;
        if (file.docType === "document" && !file.dataUrl.startsWith("data:")) {
          blob = new Blob([file.dataUrl], { type: "text/plain" });
        } else {
          const response = await fetch(file.dataUrl);
          blob = await response.blob();
        }
        formData.append("file", blob, file.name);
        formData.append("title", file.meta?.label || file.name);
        formData.append("docType", file.docType);
        if (node.storeFolderId) {
          formData.append("folderId", String(node.storeFolderId));
        }

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Upload failed: ${res.statusText}`);
        }

        const data = await res.json();

        // Update the file with its saved doc ID
        const updatedFiles = files.map((f) =>
          f.id === file.id ? { ...f, savedDocId: data.id } : f,
        );
        onUpdateNode(node.id, { uploadFiles: updatedFiles });

        toast({
          title: "Saved to Context Store",
          description: `"${file.name}" saved successfully.`,
        });
      } catch (error) {
        console.error("Save to context store error:", error);
        toast({
          title: "Save failed",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setSavingFileId(null);
      }
    },
    [files, node.id, node.storeFolderId, onUpdateNode, toast],
  );

  const handleSaveAll = useCallback(async () => {
    const unsaved = files.filter((f) => !f.savedDocId);
    for (const file of unsaved) {
      await handleSaveFile(file);
    }
  }, [files, handleSaveFile]);

  // ---- Image customizer callbacks ----

  const handleMetaChange = useCallback(
    (meta: { tags: string[]; label: string; altText: string; description: string }) => {
      if (!selectedFile) return;
      const updatedFiles = files.map((f) =>
        f.id === selectedFile.id ? { ...f, meta } : f,
      );
      onUpdateNode(node.id, { uploadFiles: updatedFiles });
    },
    [selectedFile, files, node.id, onUpdateNode],
  );

  const handleTransformChange = useCallback(
    (transform: { panX: number; panY: number; scale: number; crop?: unknown }) => {
      if (!selectedFile) return;
      const updatedFiles = files.map((f) =>
        f.id === selectedFile.id
          ? { ...f, transform: { panX: transform.panX, panY: transform.panY, scale: transform.scale } }
          : f,
      );
      onUpdateNode(node.id, { uploadFiles: updatedFiles });
    },
    [selectedFile, files, node.id, onUpdateNode],
  );

  // ---- Render ----

  return (
    <div className="flex h-full gap-4 p-4">
      {/* Left panel: upload zone + file list */}
      <div className="flex w-1/2 flex-col gap-3">
        {/* Drop zone */}
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer",
            dragOver
              ? "border-emerald-500 bg-emerald-500/10"
              : "border-muted-foreground/30 hover:border-emerald-500/50 hover:bg-emerald-500/5",
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleBrowse}
        >
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">
            Drop files here or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Images, video, PDF, Markdown, Text
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_MIME}
            multiple
            className="hidden"
            onChange={handleInputChange}
          />
        </div>

        {/* File list */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {files.length} file{files.length !== 1 ? "s" : ""}
          </span>
          {files.some((f) => !f.savedDocId) && (
            <Button size="sm" variant="outline" onClick={handleSaveAll} className="h-7 text-xs">
              <Save className="mr-1 h-3 w-3" />
              Save All
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1.5 pr-2">
            {files.map((file) => {
              const Icon = fileIcon(file.docType);
              const isSaved = !!file.savedDocId;
              const isSaving = savingFileId === file.id;
              const isSelected = selectedFileId === file.id;

              return (
                <div
                  key={file.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm cursor-pointer transition-colors",
                    isSelected
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-border hover:bg-muted/50",
                  )}
                  onClick={() => setSelectedFileId(file.id)}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatSize(file.size)}
                  </span>
                  {isSaved && (
                    <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  )}
                  {!isSaved && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveFile(file);
                      }}
                      disabled={isSaving}
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(file.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}

            {files.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                <Upload className="mb-2 h-6 w-6" />
                <p className="text-xs">No files uploaded yet</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right panel: preview + customizer */}
      <div className="flex w-1/2 flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3">
        {!selectedFile && (
          <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground/50">
            <ImageIcon className="mb-2 h-8 w-8" />
            <p className="text-sm">Select a file to preview</p>
          </div>
        )}

        {selectedFile && selectedFile.docType === "image" && (
          <ScrollArea className="flex-1">
            <ImageCustomizer
              src={selectedFile.dataUrl}
              transform={
                selectedFile.transform
                  ? { panX: selectedFile.transform.panX, panY: selectedFile.transform.panY, scale: selectedFile.transform.scale }
                  : undefined
              }
              onTransformChange={handleTransformChange}
              meta={selectedFile.meta}
              onMetaChange={handleMetaChange}
              showMeta
              showCrop
              showUpload={false}
              showGenerate={false}
            />
          </ScrollArea>
        )}

        {selectedFile && selectedFile.docType === "video" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2">
            <video
              src={selectedFile.dataUrl}
              controls
              className="max-h-[400px] w-full rounded-md"
            />
            <p className="text-xs text-muted-foreground">
              {selectedFile.name} ({formatSize(selectedFile.size)})
            </p>
          </div>
        )}

        {selectedFile && selectedFile.docType === "pdf" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileType className="h-12 w-12" />
            <p className="text-sm font-medium">{selectedFile.name}</p>
            <p className="text-xs">{formatSize(selectedFile.size)}</p>
            <Badge variant="outline" className="mt-1">PDF preview not available</Badge>
          </div>
        )}

        {selectedFile && selectedFile.docType === "document" && (
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{selectedFile.name}</span>
              <span className="text-xs text-muted-foreground">({formatSize(selectedFile.size)})</span>
            </div>
            <div className="flex-1">
              <ProvokeText
                value={selectedFile.dataUrl}
                onChange={() => {}}
                readOnly
                showCopy
                showClear={false}
                chrome="container"
                variant="textarea"
                label="Content"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
