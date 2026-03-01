import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { X, Download, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageLightboxProps {
  imageUrl: string;
  title?: string;
  onClose: () => void;
}

export function ImageLightbox({ imageUrl, title, onClose }: ImageLightboxProps) {
  const { toast } = useToast();

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `image-${Date.now()}.png`;
    a.click();
  }, [imageUrl]);

  const handleCopy = useCallback(async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast({ title: "Copied", description: "Image copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy image", variant: "destructive" });
    }
  }, [imageUrl, toast]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm text-white/70 truncate max-w-[50%]">
          {title || "Image"}
        </span>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/70 hover:text-white hover:bg-white/10" onClick={handleCopy}>
                <Copy className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy image</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/70 hover:text-white hover:bg-white/10" onClick={handleDownload}>
                <Download className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download image</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/70 hover:text-white hover:bg-white/10" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close (Esc)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        <img
          src={imageUrl}
          alt={title || "Fullscreen image"}
          className="max-w-full max-h-full object-contain"
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />
      </div>
    </div>
  );
}

/** Extract the first image URL from markdown content, if any */
export function extractImageUrl(content: string): string | null {
  // Match markdown image: ![alt](url)
  const mdMatch = content.match(/!\[.*?\]\((.*?)\)/);
  if (mdMatch) return mdMatch[1];
  // Match raw data URL or http image URL on its own line
  const urlMatch = content.match(/^(data:image\/[^\s]+|https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|svg))/m);
  if (urlMatch) return urlMatch[1];
  return null;
}
