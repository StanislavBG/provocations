import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { decrypt, hashPassphrase } from "@/lib/crypto";
import { apiRequest } from "@/lib/queryClient";
import { FolderOpen, Trash2, Loader2, ShieldCheck } from "lucide-react";
import type { EncryptedDocumentListItem, EncryptedDocumentFull } from "@shared/schema";

interface LoadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoad: (text: string, title: string) => void;
}

export function LoadDocumentDialog({
  open,
  onOpenChange,
  onLoad,
}: LoadDocumentDialogProps) {
  const { toast } = useToast();
  const [passphrase, setPassphrase] = useState("");
  const [documents, setDocuments] = useState<EncryptedDocumentListItem[] | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);

  const listMutation = useMutation({
    mutationFn: async () => {
      if (passphrase.length < 8) {
        throw new Error("Passphrase must be at least 8 characters");
      }
      const ownerHash = await hashPassphrase(passphrase);
      const response = await apiRequest("POST", "/api/documents/list", { ownerHash });
      return await response.json() as { documents: EncryptedDocumentListItem[] };
    },
    onSuccess: (data) => {
      setDocuments(data.documents);
      if (data.documents.length === 0) {
        toast({
          title: "No Documents Found",
          description: "No saved documents found for this passphrase.",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to List Documents",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const loadMutation = useMutation({
    mutationFn: async (docId: number) => {
      const response = await apiRequest("GET", `/api/documents/${docId}`);
      const doc = await response.json() as EncryptedDocumentFull;

      const plaintext = await decrypt(
        {
          ciphertext: doc.ciphertext,
          salt: doc.salt,
          iv: doc.iv,
        },
        passphrase
      );

      return { text: plaintext, title: doc.title };
    },
    onSuccess: (data) => {
      onLoad(data.text, data.title);
      toast({
        title: "Document Loaded",
        description: `"${data.title}" has been decrypted and loaded.`,
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Decryption Failed",
        description: "Wrong passphrase or corrupted data. The document could not be decrypted.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("DELETE", `/api/documents/${docId}`);
      return docId;
    },
    onSuccess: (docId) => {
      setDocuments((prev) => prev?.filter((d) => d.id !== docId) ?? null);
      if (selectedDocId === docId) {
        setSelectedDocId(null);
      }
      toast({ title: "Document Deleted" });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setPassphrase("");
    setDocuments(null);
    setSelectedDocId(null);
    onOpenChange(false);
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Load Encrypted Document
          </DialogTitle>
          <DialogDescription>
            Enter your passphrase to find and decrypt your saved documents.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 p-2.5 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
            <span>
              Your documents are decrypted in your browser. The server never sees
              your passphrase or plaintext — it only stores encrypted data it
              cannot read.
            </span>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="load-passphrase">Passphrase</Label>
              <Input
                id="load-passphrase"
                type="password"
                placeholder="Enter your passphrase"
                value={passphrase}
                onChange={(e) => {
                  setPassphrase(e.target.value);
                  setDocuments(null);
                  setSelectedDocId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && passphrase.length >= 8) {
                    listMutation.mutate();
                  }
                }}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => listMutation.mutate()}
                disabled={passphrase.length < 8 || listMutation.isPending}
              >
                {listMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Find"
                )}
              </Button>
            </div>
          </div>

          {documents !== null && (
            <div className="space-y-2">
              <Label>Your Documents</Label>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No documents found for this passphrase.
                </p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-1 border rounded-md p-1">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                        selectedDocId === doc.id
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedDocId(doc.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(doc.updatedAt)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(doc.id);
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (selectedDocId !== null) {
                loadMutation.mutate(selectedDocId);
              }
            }}
            disabled={selectedDocId === null || loadMutation.isPending}
          >
            {loadMutation.isPending ? "Decrypting..." : "Load"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
