import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, FileText, FileDown, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExportMenuProps {
  /** Current document text (markdown) */
  text: string;
  /** Document title for file naming */
  title: string;
  /** Disabled when no content */
  disabled?: boolean;
}

export function ExportMenu({ text, title, disabled }: ExportMenuProps) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const { toast } = useToast();

  const fileName = title || "document";

  const handleMarkdownDownload = () => {
    const frontmatter = `---\ntitle: "${fileName}"\ndate: "${new Date().toISOString().split("T")[0]}"\nexported_from: Provocations\n---\n\n`;
    const blob = new Blob([frontmatter + text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePdfDownload = async () => {
    setPdfLoading(true);
    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: fileName, content: text }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export failed" }));
        throw new Error(err.error || "PDF export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "PDF exported", description: `${fileName}.pdf downloaded` });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Could not generate PDF",
        variant: "destructive",
      });
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={disabled}
            >
              {pdfLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Export document</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleMarkdownDownload}>
          <FileText className="w-4 h-4 mr-2" />
          Download as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePdfDownload} disabled={pdfLoading}>
          <FileDown className="w-4 h-4 mr-2" />
          {pdfLoading ? "Generating PDF..." : "Download as PDF"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
