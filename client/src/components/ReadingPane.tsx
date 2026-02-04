import { useState, useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { BookOpen, Eye, Download, Pencil, Check, Mic, Square, Send, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
  onTranscriptUpdate?: (transcript: string, isRecording: boolean) => void;
  onTextEdit?: (newText: string) => void;
}

export function ReadingPane({ text, activeLens, lensSummary, onTextChange, highlightText, onVoiceMerge, isMerging, onTranscriptUpdate, onTextEdit }: ReadingPaneProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(text);
  const [selectedText, setSelectedText] = useState("");
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [isProcessingEdit, setIsProcessingEdit] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef("");
  const promptInputRef = useRef<HTMLInputElement>(null);
  const isRecordingRef = useRef(false);
  const showPromptInputRef = useRef(false);
  
  // Keep refs in sync with state for use in event handlers
  isRecordingRef.current = isRecording;
  showPromptInputRef.current = showPromptInput;

  // Helper to find text offset in the full document text
  const findSelectionOffset = useCallback((selectedStr: string): { start: number; end: number } | null => {
    // Find all occurrences and return the first one
    // This is a simple approach - for more accuracy, we could track the paragraph index
    const index = text.indexOf(selectedStr);
    if (index !== -1) {
      return { start: index, end: index + selectedStr.length };
    }
    return null;
  }, [text]);

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

      const selectedStr = selection.toString().trim();
      if (selectedStr.length < 5) {
        return;
      }

      // Get position relative to the article container
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const articleRect = articleRef.current.getBoundingClientRect();

      // Position button at top-right of selection, clamped to visible area
      const x = Math.min(Math.max(10, rect.right - articleRect.left), articleRect.width - 50);
      const y = Math.max(10, rect.top - articleRect.top - 45);

      setSelectedText(selectedStr);
      setSelectionPosition({ x, y });

      // Track the text offset for accurate replacement
      const offset = findSelectionOffset(selectedStr);
      setSelectionRange(offset);
    };

    const handleMouseUp = () => {
      // Small delay to let selection complete
      setTimeout(handleSelectionChange, 10);
    };

    // Also listen for selectionchange to hide mic when selection is cleared
    const handleSelectionClear = () => {
      // Don't clear if we're recording or showing the prompt input
      if (isRecordingRef.current || showPromptInputRef.current) {
        return;
      }
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        // Selection was cleared - hide the toolbar
        setSelectedText("");
        setSelectionPosition(null);
        setSelectionRange(null);
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
    // Don't clear if clicking the selection toolbar
    if (target.closest('[data-selection-toolbar]')) {
      return;
    }
    // Don't clear if we're recording or showing the prompt input
    if (isRecording || showPromptInput) {
      return;
    }
    // Don't clear if there's an active text selection
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      return;
    }
    // Clear the floating toolbar state
    setSelectedText("");
    setSelectionPosition(null);
    setSelectionRange(null);
  }, [isRecording, showPromptInput]);

  // Store callbacks in refs to avoid re-initializing recognition
  const onVoiceMergeRef = useRef(onVoiceMerge);
  const onTranscriptUpdateRef = useRef(onTranscriptUpdate);
  const selectedTextRef = useRef(selectedText);

  useEffect(() => {
    onVoiceMergeRef.current = onVoiceMerge;
  }, [onVoiceMerge]);

  useEffect(() => {
    onTranscriptUpdateRef.current = onTranscriptUpdate;
  }, [onTranscriptUpdate]);

  useEffect(() => {
    selectedTextRef.current = selectedText;
  }, [selectedText]);

  // Initialize speech recognition only once
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        transcriptRef.current += finalTranscript + " ";
      }
      const displayTranscript = transcriptRef.current + interimTranscript;
      onTranscriptUpdateRef.current?.(displayTranscript, true);
    };

    recognition.onerror = (event: any) => {
      isRecordingRef.current = false;
      setIsRecording(false);
      onTranscriptUpdateRef.current?.("", false);
      if (event.error === 'not-allowed') {
        toast({
          title: "Microphone Access Required",
          description: "Please allow microphone access in your browser to use voice input.",
          variant: "destructive",
        });
      } else if (event.error === 'no-speech') {
        toast({
          title: "No Speech Detected",
          description: "Please speak into your microphone and try again.",
        });
      } else if (event.error !== 'aborted') {
        toast({
          title: "Voice Recording Error",
          description: "Speech recognition failed. Please try again.",
          variant: "destructive",
        });
      }
    };

    recognition.onend = () => {
      const transcript = transcriptRef.current.trim();
      const currentSelectedText = selectedTextRef.current;
      if (transcript && currentSelectedText && onVoiceMergeRef.current) {
        onVoiceMergeRef.current(currentSelectedText, transcript);
      }
      onTranscriptUpdateRef.current?.(transcript, false);
      transcriptRef.current = "";
      isRecordingRef.current = false;
      setIsRecording(false);
      setSelectedText("");
      setSelectionPosition(null);
      setSelectionRange(null);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [toast]); // Only toast needed - callbacks use refs

  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isRecordingRef.current) {
      recognitionRef.current.stop();
    } else {
      transcriptRef.current = "";
      // Show the overlay immediately before starting (optimistic UI)
      onTranscriptUpdateRef.current?.("", true);
      try {
        recognitionRef.current.start();
        isRecordingRef.current = true;
        setIsRecording(true);
      } catch (error) {
        console.error("Failed to start recording:", error);
        // Hide overlay on failure
        isRecordingRef.current = false;
        setIsRecording(false);
        onTranscriptUpdateRef.current?.("", false);
      }
    }
  }, []);

  // Handle pencil mousedown to show prompt input immediately (before selectionchange fires)
  const handlePencilMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); // Prevent selection collapse
    e.stopPropagation();
    setShowPromptInput(true);
    showPromptInputRef.current = true; // Update ref immediately
    setPromptText("");
    // Focus the input after a short delay to allow render
    setTimeout(() => {
      promptInputRef.current?.focus();
    }, 50);
  }, []);

  // Handle closing the prompt input
  const handleClosePrompt = useCallback(() => {
    setShowPromptInput(false);
    setPromptText("");
  }, []);

  // Handle submitting the text edit instruction
  const handleSubmitEdit = useCallback(async () => {
    if (!promptText.trim() || !selectedText) return;

    setIsProcessingEdit(true);
    try {
      const response = await apiRequest("POST", "/api/write", {
        document: text,
        objective: "Edit the document according to the user's instruction",
        instruction: promptText.trim(),
        selectedText: selectedText,
      });

      const data = await response.json();

      if (data.document) {
        if (onTextEdit) {
          onTextEdit(data.document);
        }

        toast({
          title: "Text Updated",
          description: data.summary || "Your selected text has been modified.",
        });

        // Clear selection and prompt
        setShowPromptInput(false);
        setPromptText("");
        setSelectedText("");
        setSelectionPosition(null);
        setSelectionRange(null);
        window.getSelection()?.removeAllRanges();
      }
    } catch (error) {
      console.error("Edit text error:", error);
      toast({
        title: "Edit Failed",
        description: "Could not modify the selected text. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingEdit(false);
    }
  }, [promptText, selectedText, text, onTextEdit, toast]);

  // Handle Enter key in prompt input
  const handlePromptKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitEdit();
    } else if (e.key === "Escape") {
      handleClosePrompt();
    }
  }, [handleSubmitEdit, handleClosePrompt]);
  
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
              className="prose prose-slate dark:prose-invert prose-headings:font-serif prose-headings:text-foreground prose-p:text-foreground/90 prose-p:leading-[1.8] prose-li:text-foreground/90 prose-strong:text-foreground prose-em:text-foreground/80 max-w-none font-serif text-base relative"
            >
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-6 leading-[1.8]">{children}</p>,
                  h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 mt-8">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-xl font-bold mb-3 mt-6">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-lg font-semibold mb-2 mt-4">{children}</h3>,
                  ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary/50 pl-4 italic text-muted-foreground my-4">
                      {children}
                    </blockquote>
                  ),
                  code: ({ children }) => (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-4 font-mono text-sm">
                      {children}
                    </pre>
                  ),
                }}
              >
                {text}
              </ReactMarkdown>
              
              {/* Floating toolbar on text selection */}
              {selectedText && selectionPosition && !isEditing && (
                <div
                  data-selection-toolbar
                  className="absolute z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
                  style={{
                    left: `${Math.max(0, selectionPosition.x - 50)}px`,
                    top: `${Math.max(0, selectionPosition.y)}px`,
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  {showPromptInput ? (
                    <div className="flex items-center gap-1 bg-card border rounded-lg shadow-lg p-1">
                      <Input
                        ref={promptInputRef}
                        data-testid="input-edit-instruction"
                        value={promptText}
                        onChange={(e) => setPromptText(e.target.value)}
                        onKeyDown={handlePromptKeyDown}
                        placeholder="How to modify this text..."
                        className="min-w-[200px] h-8 text-sm"
                        disabled={isProcessingEdit}
                      />
                      <Button
                        data-testid="button-submit-edit"
                        size="icon"
                        variant="default"
                        onClick={handleSubmitEdit}
                        disabled={!promptText.trim() || isProcessingEdit}
                        className="h-8 w-8"
                        title="Apply modification"
                      >
                        {isProcessingEdit ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        data-testid="button-close-edit"
                        size="icon"
                        variant="ghost"
                        onClick={handleClosePrompt}
                        disabled={isProcessingEdit}
                        className="h-8 w-8"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button
                        data-testid="button-selection-voice"
                        size="icon"
                        variant={isRecording ? "destructive" : "default"}
                        onClick={toggleRecording}
                        disabled={isMerging || isProcessingEdit}
                        className={`shadow-lg ${isRecording ? "animate-pulse" : ""}`}
                        title={isRecording ? "Stop recording" : "Speak to add feedback about this text"}
                      >
                        {isRecording ? (
                          <Square className="w-4 h-4" />
                        ) : (
                          <Mic className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        data-testid="button-selection-edit"
                        size="icon"
                        variant="secondary"
                        onMouseDown={handlePencilMouseDown}
                        disabled={isMerging || isProcessingEdit || isRecording}
                        className="shadow-lg"
                        title="Type instruction to modify this text"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </article>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
