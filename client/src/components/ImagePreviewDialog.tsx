import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Copy, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCallback } from "react";

interface ImagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  prompt?: string;
  title?: string;
}

export function ImagePreviewDialog({
  open,
  onOpenChange,
  imageUrl,
  prompt,
  title = "Generated Image",
}: ImagePreviewDialogProps) {
  const { toast } = useToast();

  const handleDownload = useCallback(() => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `provocations-visual.png`;
    a.click();
  }, [imageUrl]);

  const handleCopy = useCallback(async () => {
    if (!imageUrl) return;
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      toast({ title: "Copied", description: "Image copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy image", variant: "destructive" });
    }
  }, [imageUrl, toast]);

  if (!imageUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title}
            <div className="flex-1" />
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleCopy}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleDownload}>
              <Download className="w-3.5 h-3.5" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="rounded-lg overflow-hidden border bg-muted/20">
          <img src={imageUrl} alt="Generated visual" className="w-full h-auto" />
        </div>
        {prompt && (
          <p className="text-xs text-muted-foreground italic mt-2">
            Prompt: {prompt}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
