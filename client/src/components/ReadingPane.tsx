import { useState, useCallback, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Eye, Download, Pencil, Check, Mic, Square } from "lucide-react";
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
  onVoiceMerge?: (selectedText: string, transcript: string) => void;
  isMerging?: boolean;
}

export function ReadingPane({ text, activeLens, lensSummary, onTextChange, highlightText, onVoiceMerge, isMerging }: ReadingPaneProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(text);
  const [selectedText, setSelectedText] = useState("");
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef("");
  
  const paragraphs = text.split(/\n\n+/).filter(Boolean);

  // Handle text selection using document event
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !articleRef.current) {
        return;
      }
      
      // Check if selection is within our article
      const anchorNode = selection.anchorNode;
      if (!anchorNode || !articleRef.current.contains(anchorNode)) {
        return;
      }
      
      const text = selection.toString().trim();
      if (text.length < 5) {
        return;
      }
      
      // Get position relative to the article container
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const articleRect = articleRef.current.getBoundingClientRect();
      
      // Position button at top-right of selection, clamped to visible area
      const x = Math.min(Math.max(10, rect.right - articleRect.left), articleRect.width - 50);
      const y = Math.max(10, rect.top - articleRect.top - 45);
      
      setSelectedText(text);
      setSelectionPosition({ x, y });
    };

    const handleMouseUp = () => {
      // Small delay to let selection complete
      setTimeout(handleSelectionChange, 10);
    };

    // Also listen for selectionchange to hide mic when selection is cleared
    const handleSelectionClear = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        // Selection was cleared - hide the mic
        setSelectedText("");
        setSelectionPosition(null);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('selectionchange', handleSelectionClear);
    
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('selectionchange', handleSelectionClear);
    };
  }, []);

  // Clear selection when clicking elsewhere (only if no active selection)
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't clear if clicking the voice button
    if (target.closest('[data-voice-button]')) {
      return;
    }
    // Don't clear if there's an active text selection
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      return;
    }
    // Clear the floating mic state
    setSelectedText("");
    setSelectionPosition(null);
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        transcriptRef.current += finalTranscript + " ";
      }
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      const transcript = transcriptRef.current.trim();
      if (transcript && selectedText && onVoiceMerge) {
        onVoiceMerge(selectedText, transcript);
      }
      transcriptRef.current = "";
      setIsRecording(false);
      setSelectedText("");
      setSelectionPosition(null);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [selectedText, onVoiceMerge]);

  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) return;
    
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      transcriptRef.current = "";
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (error) {
        console.error("Failed to start recording:", error);
      }
    }
  }, [isRecording]);
  
  // Normalize text for matching - handle punctuation and whitespace variations
  const normalizeForMatch = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[""'']/g, '"')  // Normalize smart quotes
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
  };

  // Function to find the best matching substring for highlighting
  const findBestMatch = (paragraph: string, excerpt: string): { start: number; end: number } | null => {
    const normalizedParagraph = normalizeForMatch(paragraph);
    // Clean up excerpt - remove surrounding quotes and normalize
    let normalizedExcerpt = normalizeForMatch(excerpt).replace(/^["']|["']$/g, '');
    
    // Try exact match first
    const exactIndex = normalizedParagraph.indexOf(normalizedExcerpt);
    if (exactIndex !== -1) {
      return { start: exactIndex, end: exactIndex + normalizedExcerpt.length };
    }
    
    // Handle AI-truncated excerpts with "..." or "…"
    if (normalizedExcerpt.includes('...') || normalizedExcerpt.includes('…')) {
      const parts = normalizedExcerpt.split(/\.{3}|…/).map(p => p.trim()).filter(p => p.length > 5);
      if (parts.length >= 2) {
        // Find start of first part and end of last part
        const startPart = parts[0];
        const endPart = parts[parts.length - 1];
        const startIdx = normalizedParagraph.indexOf(startPart);
        if (startIdx !== -1) {
          const endIdx = normalizedParagraph.indexOf(endPart, startIdx);
          if (endIdx !== -1) {
            return { start: startIdx, end: endIdx + endPart.length };
          }
        }
      } else if (parts.length === 1 && parts[0].length > 10) {
        // Just one part - find it
        const partIdx = normalizedParagraph.indexOf(parts[0]);
        if (partIdx !== -1) {
          return { start: partIdx, end: partIdx + parts[0].length };
        }
      }
    }
    
    // Try matching a significant substring (first 40 chars) to handle truncated excerpts
    if (normalizedExcerpt.length > 30) {
      const shortExcerpt = normalizedExcerpt.slice(0, 40).replace(/\.{3}|….*$/, '').trim();
      if (shortExcerpt.length > 15) {
        const shortIndex = normalizedParagraph.indexOf(shortExcerpt);
        if (shortIndex !== -1) {
          // Try to find the ending phrase from the excerpt
          const endWords = normalizedExcerpt.split(/\s+/).slice(-4).join(' ').replace(/^\.{3}|…/, '').trim();
          if (endWords.length > 10) {
            const endIdx = normalizedParagraph.indexOf(endWords, shortIndex);
            if (endIdx !== -1) {
              return { start: shortIndex, end: endIdx + endWords.length };
            }
          }
          // Fallback: find sentence boundary
          const restOfParagraph = normalizedParagraph.slice(shortIndex);
          const sentenceEnd = restOfParagraph.search(/[.!?](\s|$)/);
          if (sentenceEnd !== -1) {
            return { start: shortIndex, end: shortIndex + sentenceEnd + 1 };
          }
        }
      }
    }
    
    // Try to find a contiguous sequence of words from the excerpt
    const excerptWords = normalizedExcerpt.split(/\s+/).filter(w => w.length > 3 && !w.includes('.'));
    if (excerptWords.length >= 3) {
      // Look for first 3-4 consecutive words as a phrase
      const phraseToFind = excerptWords.slice(0, 4).join(" ");
      const phraseIndex = normalizedParagraph.indexOf(phraseToFind);
      if (phraseIndex !== -1) {
        // Expand to find a reasonable end point using last words
        const endPhrase = excerptWords.slice(-3).join(" ");
        const endIndex = normalizedParagraph.indexOf(endPhrase, phraseIndex);
        if (endIndex !== -1) {
          return { start: phraseIndex, end: endIndex + endPhrase.length };
        }
        // Fallback: highlight from start phrase to sentence end
        const remaining = normalizedParagraph.slice(phraseIndex);
        const boundary = remaining.search(/[.!?](\s|$)/);
        if (boundary !== -1) {
          return { start: phraseIndex, end: phraseIndex + boundary + 1 };
        }
      }
    }
    
    return null;
  };

  // Function to highlight matching text within a paragraph
  const highlightMatchingText = (paragraph: string): React.ReactNode => {
    if (!highlightText || highlightText.length < 10) {
      return paragraph;
    }
    
    const match = findBestMatch(paragraph, highlightText);
    
    if (match) {
      const before = paragraph.slice(0, match.start);
      const highlighted = paragraph.slice(match.start, match.end);
      const after = paragraph.slice(match.end);
      
      return (
        <>
          {before}
          <span className="bg-primary/25 dark:bg-primary/40 px-0.5 rounded transition-colors duration-300">
            {highlighted}
          </span>
          {after}
        </>
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
          <div className="p-6 max-w-3xl mx-auto" onClick={handleClick}>
            <article 
              ref={articleRef}
              className="prose-reading font-serif text-base leading-[1.8] relative"
            >
              {paragraphs.map((paragraph, index) => (
                <p 
                  key={index} 
                  className="mb-6 text-foreground/90"
                  data-testid={`paragraph-${index}`}
                >
                  {highlightMatchingText(paragraph)}
                </p>
              ))}
              
              {/* Floating microphone button on text selection */}
              {selectedText && selectionPosition && !isEditing && (
                <div
                  data-voice-button
                  className="absolute z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
                  style={{
                    left: `${Math.max(0, selectionPosition.x - 20)}px`,
                    top: `${Math.max(0, selectionPosition.y)}px`,
                  }}
                >
                  <Button
                    data-testid="button-selection-voice"
                    size="icon"
                    variant={isRecording ? "destructive" : "default"}
                    onClick={toggleRecording}
                    disabled={isMerging}
                    className={`shadow-lg ${isRecording ? "animate-pulse" : ""}`}
                    title={isRecording ? "Stop recording" : "Speak to add feedback about this text"}
                  >
                    {isRecording ? (
                      <Square className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              )}
            </article>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
