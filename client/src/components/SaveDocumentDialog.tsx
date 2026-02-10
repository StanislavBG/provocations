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
import { apiRequest } from "@/lib/queryClient";
import { Lock, AlertTriangle } from "lucide-react";

export interface SaveCredentials {
  documentId: number;
  title: string;
  passphrase: string;
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (passphrase !== confirmPassphrase) {
        throw new Error("Passphrases do not match");
      }
      if (passphrase.length < 8) {
        throw new Error("Passphrase must be at least 8 characters");
      }

      const response = await apiRequest("POST", "/api/documents/save", {
        title: title.trim() || "Untitled Document",
        text: documentText,
        passphrase,
      });

      return await response.json();
    },
    onSuccess: (data) => {
      const savedTitle = title.trim() || "Untitled Document";
      toast({
        title: "Document Saved",
        description: "Your document has been saved. Remember your passphrase — it cannot be recovered.",
      });
      onSaved?.({
        documentId: data.id,
        title: savedTitle,
        passphrase,
      });
      setTitle("");
      setPassphrase("");
      setConfirmPassphrase("");
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
    title.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Save Document
          </DialogTitle>
          <DialogDescription>
            Your document is encrypted on the server with your passphrase.
            Only someone with the passphrase can load it.
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

          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              If you forget your passphrase, your document cannot be recovered.
              There is no password reset.
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
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
