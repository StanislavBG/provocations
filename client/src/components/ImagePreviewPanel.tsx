import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Image, Loader2, Download, RefreshCw, AlertCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenerateImageResponse {
  imageUrl: string;
  revisedPrompt?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ImagePreviewPanelProps {
  /** The document text used as the image description prompt */
  documentText: string;
}

export function ImagePreviewPanel({ documentText }: ImagePreviewPanelProps) {
  const { toast } = useToast();
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [revisedPrompt, setRevisedPrompt] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!documentText.trim()) throw new Error("No description to generate from");
      const response = await apiRequest("POST", "/api/generate-image", {
        description: documentText,
      });
      return (await response.json()) as GenerateImageResponse;
    },
    onSuccess: (data) => {
      setGeneratedImage(data.imageUrl);
      setRevisedPrompt(data.revisedPrompt ?? null);
      toast({
        title: "Image Generated",
        description: "Your infographic image has been created.",
      });
    },
    onError: (error) => {
      toast({
        title: "Image Generation Failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = useCallback(() => {
    generateMutation.mutate();
  }, [generateMutation]);

  const handleDownload = useCallback(() => {
    if (!generatedImage) return;
    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `infographic-${Date.now()}.png`;
    link.click();
  }, [generatedImage]);

  const hasContent = documentText.trim().length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <Image className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Image Preview</h3>
        </div>
        <div className="flex items-center gap-2">
          {generatedImage && (
            <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={handleDownload}>
              <Download className="w-3 h-3" />
              Download
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={!hasContent || generateMutation.isPending}
            className="w-full gap-2"
            size="lg"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating image...
              </>
            ) : generatedImage ? (
              <>
                <RefreshCw className="w-4 h-4" />
                Regenerate Image
              </>
            ) : (
              <>
                <Image className="w-4 h-4" />
                Generate Image
              </>
            )}
          </Button>

          {!hasContent && (
            <div className="text-center py-8 space-y-2">
              <AlertCircle className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Write a textual description in the document panel first, then generate an image from it.
              </p>
            </div>
          )}

          {/* Generated image display */}
          {generatedImage && (
            <div className="space-y-3">
              <div className="rounded-lg border overflow-hidden bg-muted/10">
                <img
                  src={generatedImage}
                  alt="Generated infographic"
                  className="w-full h-auto"
                />
              </div>

              {revisedPrompt && (
                <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">Revised prompt</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {revisedPrompt}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Empty state when there's content but no image yet */}
          {hasContent && !generatedImage && !generateMutation.isPending && (
            <div className="text-center py-6 space-y-2">
              <Image className="w-12 h-12 text-muted-foreground/20 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Click "Generate Image" to create a visual from your description.
              </p>
              <p className="text-xs text-muted-foreground/60">
                The image will be generated based on the content in the document panel.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
