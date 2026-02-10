import { useState, useEffect } from "react";
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
import { apiRequest } from "@/lib/queryClient";
import { FolderOpen, Trash2, Loader2, KeyRound, AlertTriangle } from "lucide-react";
import type { EncryptedDocumentListItem, EncryptedDocumentFull } from "@shared/schema";
import {
  decrypt,
  hashPassphrase,
  getDeviceKey,
  importDeviceKey,
  hasDeviceKey,
} from "@/lib/crypto";

interface LoadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoad: (text: string, title: string, docId: number, passphrase: string, ownerHash: string) => void;
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
  const [deviceKeyInput, setDeviceKeyInput] = useState("");
  const [showDeviceKeyInput, setShowDeviceKeyInput] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [ownerHash, setOwnerHash] = useState<string | null>(null);

  // Check for device key when dialog opens
  useEffect(() => {
    if (open) {
      setHasKey(hasDeviceKey());
    }
  }, [open]);

  const handleImportDeviceKey = () => {
    const trimmed = deviceKeyInput.trim();
    if (!trimmed) return;
    if (importDeviceKey(trimmed)) {
      setHasKey(true);
      setShowDeviceKeyInput(false);
      setDeviceKeyInput("");
      toast({ title: "Device Key Imported", description: "You can now decrypt documents saved from that browser." });
    } else {
      toast({
        title: "Invalid Device Key",
        description: "The key format is incorrect. It should be a 44-character base64 string.",
        variant: "destructive",
      });
    }
  };

  const listMutation = useMutation({
    mutationFn: async () => {
      if (passphrase.length < 8) {
        throw new Error("Passphrase must be at least 8 characters");
      }
      // Compute ownerHash client-side — server never sees the passphrase
      const hash = await hashPassphrase(passphrase);
      setOwnerHash(hash);
      const response = await apiRequest("POST", "/api/documents/list", { ownerHash: hash });
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
      const deviceKey = getDeviceKey();
      if (!deviceKey) {
        throw new Error("No device key found. Import your device key to decrypt documents.");
      }

      // Fetch the encrypted blob from the server
      const response = await apiRequest("GET", `/api/documents/${docId}`);
      const doc = await response.json() as EncryptedDocumentFull;

      // Decrypt entirely in the browser
      const text = await decrypt(
        { ciphertext: doc.ciphertext, salt: doc.salt, iv: doc.iv },
        passphrase,
        deviceKey,
      );

      return { id: doc.id, title: doc.title, text };
    },
    onSuccess: (data, docId) => {
      onLoad(data.text, data.title, docId, passphrase, ownerHash!);
      toast({
        title: "Document Loaded",
        description: `"${data.title}" decrypted and loaded.`,
      });
      handleClose();
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("device key")) {
        toast({
          title: "Missing Device Key",
          description: msg,
          variant: "destructive",
        });
        setShowDeviceKeyInput(true);
      } else {
        toast({
          title: "Decryption Failed",
          description: "Wrong passphrase or wrong device key. Both are required to decrypt.",
          variant: "destructive",
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: number) => {
      if (!ownerHash) throw new Error("No owner hash");
      await apiRequest("DELETE", `/api/documents/${docId}?ownerHash=${encodeURIComponent(ownerHash)}`);
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
    setDeviceKeyInput("");
    setShowDeviceKeyInput(false);
    setOwnerHash(null);
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
            Load Document
          </DialogTitle>
          <DialogDescription>
            Enter your passphrase to find your documents. Decryption happens
            entirely in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Device Key Warning */}
          {!hasKey && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-700 dark:text-amber-400">
                <p className="font-medium">No device key found in this browser.</p>
                <p className="mt-1">
                  If you saved documents from a different browser, you'll need to
                  import your device key to decrypt them.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs text-amber-700 dark:text-amber-400 underline hover:bg-transparent"
                  onClick={() => setShowDeviceKeyInput(true)}
                >
                  Import a device key
                </Button>
              </div>
            </div>
          )}

          {/* Device Key Import */}
          {showDeviceKeyInput && (
            <div className="space-y-2 p-3 rounded-md border bg-muted/30">
              <Label className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                Import Device Key
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Paste your device key here"
                  value={deviceKeyInput}
                  onChange={(e) => setDeviceKeyInput(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button
                  size="sm"
                  onClick={handleImportDeviceKey}
                  disabled={!deviceKeyInput.trim()}
                >
                  Import
                </Button>
              </div>
            </div>
          )}

          {/* Passphrase + Find */}
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

          {/* Document List */}
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
