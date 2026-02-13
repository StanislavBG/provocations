import { useState, useCallback, useRef } from "react";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Camera, Send, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProvokeText } from "@/components/ProvokeText";

interface ScreenCaptureButtonProps {
  /** Element selector or ref to capture. Defaults to document body. */
  captureTarget?: string;
  /** Called with the base64 image data URL and user commentary */
  onCapture: (imageDataUrl: string, commentary: string) => void;
  disabled?: boolean;
}

/**
 * Screen capture button that:
 * 1. Captures the current app state as a screenshot
 * 2. Shows a dialog for the user to preview + add commentary
 * 3. Fires onCapture with the base64 image and commentary text
 */
export function ScreenCaptureButton({
  captureTarget,
  onCapture,
  disabled,
}: ScreenCaptureButtonProps) {
  const { toast } = useToast();
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [commentary, setCommentary] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleCapture = useCallback(async () => {
    setIsCapturing(true);
    try {
      const target = captureTarget
        ? document.querySelector(captureTarget)
        : document.body;

      if (!target) {
        toast({
          title: "Capture Failed",
          description: "Could not find the target element to capture.",
          variant: "destructive",
        });
        return;
      }

      const canvas = await html2canvas(target as HTMLElement, {
        useCORS: true,
        allowTaint: true,
        scale: 1, // Keep at 1x for reasonable file size
        logging: false,
        backgroundColor: null,
      });

      const dataUrl = canvas.toDataURL("image/png");
      setCapturedImage(dataUrl);
      setCommentary("");
      setShowDialog(true);
    } catch (error) {
      console.error("Screen capture failed:", error);
      toast({
        title: "Capture Failed",
        description: "Could not capture the screen. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCapturing(false);
    }
  }, [captureTarget, toast]);

  const handleSubmit = useCallback(() => {
    if (!capturedImage) return;

    onCapture(capturedImage, commentary.trim());
    setShowDialog(false);
    setCapturedImage(null);
    setCommentary("");

    toast({
      title: "Screenshot Added",
      description: "Screenshot and commentary will be merged into the document.",
    });
  }, [capturedImage, commentary, onCapture, toast]);

  const handleClose = useCallback(() => {
    setShowDialog(false);
    setCapturedImage(null);
    setCommentary("");
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        handleClose();
      }
    },
    [handleSubmit, handleClose]
  );

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCapture}
        disabled={disabled || isCapturing}
        className="gap-1.5"
        title="Capture screen and add to document"
      >
        {isCapturing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Camera className="w-4 h-4" />
        )}
        Capture
      </Button>

      {/* Capture preview + commentary dialog */}
      {showDialog && capturedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            ref={dialogRef}
            className="bg-card border rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col"
            onKeyDown={handleKeyDown}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Screen Capture</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleClose}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Preview */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <img
                src={capturedImage}
                alt="Screen capture preview"
                className="w-full rounded-lg border"
              />
            </div>

            {/* Commentary input */}
            <div className="px-4 py-3 border-t">
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Add your commentary (what should the reader know about this screenshot?)
              </label>
              <ProvokeText
                variant="textarea"
                chrome="bare"
                value={commentary}
                onChange={setCommentary}
                placeholder="Describe what this screenshot shows, what needs to change, or any observations..."
                className="text-sm"
                minRows={2}
                maxRows={5}
                autoFocus
                showCopy={false}
                showClear={false}
                voice={{ mode: "replace" }}
                onVoiceTranscript={(text) => setCommentary(text)}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                className="gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Add to Document
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
