import { useState, useCallback, useRef, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Trash2,
  Pencil,
  Check,
  X,
  Archive,
} from "lucide-react";
import type { DocumentListItem } from "@shared/schema";

interface DrawlerProps {
  documents: DocumentListItem[];
  currentDocId: number | null;
  onLoad: (docId: number) => void;
  onDocumentsChange: (documents: DocumentListItem[]) => void;
  onCurrentDocIdChange: (id: number | null) => void;
}

export function Drawler({
  documents,
  currentDocId,
  onLoad,
  onDocumentsChange,
  onCurrentDocIdChange,
}: DrawlerProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId !== null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleRename = useCallback(
    async (docId: number) => {
      const trimmed = renameValue.trim();
      if (!trimmed) {
        setRenamingId(null);
        return;
      }

      try {
        const response = await apiRequest("PATCH", `/api/documents/${docId}`, {
          title: trimmed,
        });
        const data = (await response.json()) as {
          id: number;
          title: string;
          updatedAt: string;
        };
        onDocumentsChange(
          documents.map((d) =>
            d.id === docId
              ? { ...d, title: data.title, updatedAt: data.updatedAt }
              : d
          )
        );
        toast({ title: "Renamed", description: `Document renamed to "${data.title}".` });
      } catch {
        toast({
          title: "Rename Failed",
          description: "Could not rename document.",
          variant: "destructive",
        });
      } finally {
        setRenamingId(null);
      }
    },
    [renameValue, documents, onDocumentsChange, toast]
  );

  const handleDelete = useCallback(
    async (docId: number, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await apiRequest("DELETE", `/api/documents/${docId}`);
        onDocumentsChange(documents.filter((d) => d.id !== docId));
        if (currentDocId === docId) {
          onCurrentDocIdChange(null);
        }
        toast({ title: "Document Deleted" });
      } catch {
        toast({
          title: "Delete Failed",
          description: "Could not delete document.",
          variant: "destructive",
        });
      }
    },
    [documents, currentDocId, onDocumentsChange, onCurrentDocIdChange, toast]
  );

  const startRename = useCallback(
    (docId: number, currentTitle: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setRenamingId(docId);
      setRenameValue(currentTitle);
    },
    []
  );

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          data-testid="button-drawler"
        >
          <Archive className="w-4 h-4" />
          Drawler
          {documents.length > 0 && (
            <span className="ml-0.5 text-xs bg-muted text-muted-foreground rounded-full px-1.5 min-w-[1.25rem] text-center">
              {documents.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0"
        data-testid="drawler-panel"
      >
        <div className="px-3 py-2 border-b">
          <p className="text-sm font-medium">Your Drafts</p>
          <p className="text-xs text-muted-foreground">
            {documents.length === 0
              ? "No saved drafts yet"
              : `${documents.length} draft${documents.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {documents.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            Save a document to see it here.
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={`flex items-center gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-accent/50 cursor-pointer transition-colors group ${
                  currentDocId === doc.id ? "bg-accent/30" : ""
                }`}
                onClick={() => {
                  if (renamingId !== doc.id) {
                    onLoad(doc.id);
                    setOpen(false);
                  }
                }}
              >
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  {renamingId === doc.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRename(doc.id);
                      }}
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="h-6 text-sm px-1.5 py-0"
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(null);
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(doc.updatedAt)}
                      </p>
                    </>
                  )}
                </div>
                {renamingId !== doc.id && (
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={(e) => startRename(doc.id, doc.title, e)}
                      title="Rename"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={(e) => handleDelete(doc.id, e)}
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
