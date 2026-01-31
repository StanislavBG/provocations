import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Eye, Download, Pencil, Check } from "lucide-react";
import type { LensType } from "@shared/schema";

const lensLabels: Record<LensType, string> = {
  consumer: "Consumer's Lens",
  executive: "Executive's Lens",
  technical: "Technical Lens",
  financial: "Financial Lens",
  strategic: "Strategic Lens",
  skeptic: "Skeptic's Lens",
};

interface ReadingPaneProps {
  text: string;
  activeLens: LensType | null;
  lensSummary?: string;
  onTextChange?: (text: string) => void;
  highlightText?: string;
}

export function ReadingPane({ text, activeLens, lensSummary, onTextChange, highlightText }: ReadingPaneProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(text);
  
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  
  // Function to highlight matching text within a paragraph
  const highlightMatchingText = (paragraph: string): React.ReactNode => {
    if (!highlightText || highlightText.length < 10) {
      return paragraph;
    }
    
    // Normalize whitespace for comparison
    const normalizedHighlight = highlightText.trim().toLowerCase();
    const normalizedParagraph = paragraph.toLowerCase();
    
    // Check if this paragraph contains any significant portion of the highlight text
    // We use a fuzzy match approach - check if key words appear
    const highlightWords = normalizedHighlight.split(/\s+/).filter(w => w.length > 4);
    const matchingWords = highlightWords.filter(word => normalizedParagraph.includes(word));
    const matchRatio = highlightWords.length > 0 ? matchingWords.length / highlightWords.length : 0;
    
    // If more than 40% of significant words match, highlight the whole paragraph
    if (matchRatio > 0.4) {
      return (
        <span className="bg-primary/20 dark:bg-primary/30 px-1 py-0.5 rounded transition-colors duration-300">
          {paragraph}
        </span>
      );
    }
    
    return paragraph;
  };
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const readingTime = Math.ceil(wordCount / 200);

  const handleEditToggle = () => {
    if (isEditing) {
      // Save changes
      onTextChange?.(editedText);
    } else {
      // Start editing
      setEditedText(text);
    }
    setIsEditing(!isEditing);
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `document-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="flex items-center gap-2 p-4 border-b flex-wrap">
        <BookOpen className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Source Material</h3>
        <div className="flex items-center gap-2 ml-auto">
          <Badge variant="outline">{wordCount.toLocaleString()} words</Badge>
          <Badge variant="secondary">{readingTime} min read</Badge>
          <Button
            data-testid="button-edit-document"
            variant={isEditing ? "default" : "ghost"}
            size="icon"
            onClick={handleEditToggle}
            title={isEditing ? "Save changes" : "Edit document"}
          >
            {isEditing ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
          </Button>
          <Button
            data-testid="button-download-document"
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            title="Download document"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {activeLens && lensSummary && (
        <div className="p-4 border-b bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Viewing through {lensLabels[activeLens]}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lensSummary}
          </p>
        </div>
      )}
      
      {isEditing ? (
        <div className="flex-1 p-4 overflow-hidden">
          <Textarea
            data-testid="textarea-edit-document"
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="h-full w-full resize-none font-serif text-base leading-[1.8]"
            placeholder="Edit your document here..."
          />
        </div>
      ) : (
        <ScrollArea className="flex-1 custom-scrollbar">
          <div className="p-6 max-w-3xl mx-auto">
            <article className="prose-reading font-serif text-base leading-[1.8]">
              {paragraphs.map((paragraph, index) => (
                <p 
                  key={index} 
                  className="mb-6 text-foreground/90"
                  data-testid={`paragraph-${index}`}
                >
                  {highlightMatchingText(paragraph)}
                </p>
              ))}
            </article>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
