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
import { Lock, AlertTriangle, Copy, Check, KeyRound } from "lucide-react";
import {
  encrypt,
  hashPassphrase,
  getOrCreateDeviceKey,
} from "@/lib/crypto";

export interface SaveCredentials {
  documentId: number;
  title: string;
  passphrase: string;
  ownerHash: string;
}

interface SaveDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentText: string;
  onSaved?: (credentials: SaveCredentials) => void;
}

export function SaveDocumentDialog({
  open,
  onOpenChange,
  documentText,
  onSaved,
}: SaveDocumentDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [deviceKey, setDeviceKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Load or create device key when dialog opens
  useEffect(() => {
    if (open) {
      const key = getOrCreateDeviceKey();
      setDeviceKey(key);
    }
  }, [open]);

  const copyDeviceKey = async () => {
    if (!deviceKey) return;
    try {
      await navigator.clipboard.writeText(deviceKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard. Select and copy the key manually.",
        variant: "destructive",
      });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (passphrase !== confirmPassphrase) {
        throw new Error("Passphrases do not match");
      }
      if (passphrase.length < 8) {
        throw new Error("Passphrase must be at least 8 characters");
      }
      if (!deviceKey) {
        throw new Error("Device key not available");
      }

      // All encryption happens here in the browser
      const ownerHash = await hashPassphrase(passphrase);
      const encrypted = await encrypt(documentText, passphrase, deviceKey);

      const response = await apiRequest("POST", "/api/documents/save", {
        ownerHash,
        title: title.trim() || "Untitled Document",
        ciphertext: encrypted.ciphertext,
        salt: encrypted.salt,
        iv: encrypted.iv,
      });

      return { ...(await response.json()), ownerHash };
    },
    onSuccess: (data) => {
      const savedTitle = title.trim() || "Untitled Document";
      toast({
        title: "Document Saved",
        description: "Encrypted in your browser and stored on the server.",
      });
      onSaved?.({
        documentId: data.id,
        title: savedTitle,
        passphrase,
        ownerHash: data.ownerHash,
      });
      setTitle("");
      setPassphrase("");
      setConfirmPassphrase("");
      setCopiedKey(false);
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const canSave =
    passphrase.length >= 8 &&
    passphrase === confirmPassphrase &&
    title.trim().length > 0 &&
    deviceKey !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Save Document
          </DialogTitle>
          <DialogDescription>
            Your document is encrypted in your browser before being stored.
            The server never sees your text or passphrase.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="doc-title">Document Title</Label>
            <Input
              id="doc-title"
              placeholder="My document"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="passphrase">Passphrase</Label>
            <Input
              id="passphrase"
              type="password"
              placeholder="At least 8 characters"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-passphrase">Confirm Passphrase</Label>
            <Input
              id="confirm-passphrase"
              type="password"
              placeholder="Type passphrase again"
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
            />
            {confirmPassphrase && passphrase !== confirmPassphrase && (
              <p className="text-xs text-destructive">Passphrases do not match</p>
            )}
          </div>

          {/* Device Key Display */}
          {deviceKey && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                Device Key
              </Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={deviceKey}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyDeviceKey}
                  title="Copy device key"
                >
                  {copiedKey ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This key is unique to this browser. Back it up to load documents on another device.
              </p>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              You need <strong>both your passphrase and this browser's device key</strong> to
              load your document. If you lose either one, your document cannot be recovered.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Encrypting..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
