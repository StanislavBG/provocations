import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileDown, FileArchive, Mic, Square, Send, X, Pencil, FileText, Copy, Image as ImageIcon, Info, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ProvokeText } from "@/components/ProvokeText";
import { MarkdownRenderer, markdownToHtml } from "@/components/MarkdownRenderer";

/** Extract all markdown image entries (alt + src) from text */
function extractMarkdownImages(md: string): { alt: string; src: string }[] {
  const results: { alt: string; src: string }[] = [];
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(md)) !== null) {
    results.push({ alt: match[1], src: match[2] });
  }
  return results;
}

/** Fetch an image URL (or data-URL) as a PNG blob suitable for clipboard */
async function fetchImageAsBlob(src: string): Promise<Blob> {
  // Draw image onto a canvas and export as PNG — works for data URLs,
  // cross-origin images, and ensures we always get image/png for clipboard.
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Failed to create blob"))),
        "image/png",
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

interface ReadingPaneProps {
  text: string;
  onTextChange?: (text: string) => void;
  highlightText?: string;
  onVoiceMerge?: (selectedText: string, transcript: string) => void;
  isMerging?: boolean;
  onTranscriptUpdate?: (transcript: string, isRecording: boolean) => void;
  onTextEdit?: (newText: string) => void;
  onSendFeedback?: (text: string) => void;
  /** Word count of the AI-generated first draft (versions[0]). Used for time-saved calculation. */
  draftWordCount?: number;
}

export function ReadingPane({ text, onTextChange, highlightText, onVoiceMerge, isMerging, onTranscriptUpdate, onTextEdit, onSendFeedback, draftWordCount }: ReadingPaneProps) {
  const { toast } = useToast();
  const [selectedText, setSelectedText] = useState("");
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [isProcessingEdit, setIsProcessingEdit] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef("");
  const promptInputRef = useRef<HTMLInputElement>(null);
  const isRecordingRef = useRef(false);
  const showPromptInputRef = useRef(false);

  // Keep refs in sync with state for use in event handlers
  isRecordingRef.current = isRecording;
  showPromptInputRef.current = showPromptInput;

  // Handle text selection in edit mode
  const handleSelect = useCallback(() => {
    if (!editorRef.current || !containerRef.current) return;

    const textarea = editorRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
      // No selection
      if (!isRecordingRef.current && !showPromptInputRef.current) {
        setSelectedText("");
        setSelectionPosition(null);
      }
      return;
    }

    const selected = text.substring(start, end).trim();
    if (selected.length < 5) return;

    setSelectedText(selected);

    // Position the toolbar near the selection
    const textareaRect = textarea.getBoundingClientRect();

    const textBeforeSelection = text.substring(0, start);
    const lines = textBeforeSelection.split('\n');
    const lineHeight = 28;
    const y = Math.min(lines.length * lineHeight, textareaRect.height - 50);
    const x = Math.min(textareaRect.width - 120, 400);

    setSelectionPosition({ x, y });
  }, [text]);

  // Handle text selection in preview mode (from MarkdownRenderer)
  const handlePreviewSelect = useCallback((selected: string, position: { x: number; y: number }) => {
    if (isRecordingRef.current || showPromptInputRef.current) return;
    setSelectedText(selected);
    // Adjust position relative to container
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      setSelectionPosition({
        x: Math.min(position.x - containerRect.left, containerRect.width - 120),
        y: Math.max(position.y - containerRect.top - 10, 60),
      });
    }
  }, []);

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
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [toast]);

  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isRecordingRef.current) {
      recognitionRef.current.stop();
    } else {
      transcriptRef.current = "";
      onTranscriptUpdateRef.current?.("", true);
      try {
        recognitionRef.current.start();
        isRecordingRef.current = true;
        setIsRecording(true);
      } catch (error) {
        console.error("Failed to start recording:", error);
        isRecordingRef.current = false;
        setIsRecording(false);
        onTranscriptUpdateRef.current?.("", false);
      }
    }
  }, []);

  // Handle closing the prompt input
  const handleClosePrompt = useCallback(() => {
    setShowPromptInput(false);
    setPromptText("");
    setSelectedText("");
    setSelectionPosition(null);
  }, []);

  // Handle voice feedback submission
  const handleSubmitFeedback = useCallback(() => {
    if (feedbackText.trim() && onSendFeedback) {
      onSendFeedback(feedbackText.trim());
      setFeedbackText("");
      setShowFeedbackInput(false);
    }
  }, [feedbackText, onSendFeedback]);

  const handleCloseFeedback = useCallback(() => {
    setShowFeedbackInput(false);
    setFeedbackText("");
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

        handleClosePrompt();
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
  }, [promptText, selectedText, text, onTextEdit, toast, handleClosePrompt]);

  // Handle Enter key in prompt input
  const handlePromptKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitEdit();
    } else if (e.key === "Escape") {
      handleClosePrompt();
    }
  }, [handleSubmitEdit, handleClosePrompt]);

  // Handle showing prompt input
  const handleShowPrompt = useCallback(() => {
    setShowPromptInput(true);
    showPromptInputRef.current = true;
    setPromptText("");
    setTimeout(() => {
      promptInputRef.current?.focus();
    }, 50);
  }, []);

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const readingTime = Math.ceil(wordCount / 200);

  // ── Time-saved metric ──
  // Author words = total words − AI-generated draft words
  // Composition speed: 19 WPM (Karat et al. 1999 — knowledge worker average)
  // Time saved = author words / 19 WPM + reading time of entire document
  const COMPOSITION_WPM = 19;
  const authorWords = draftWordCount != null ? Math.max(0, wordCount - draftWordCount) : 0;
  const compositionMinutes = authorWords > 0 ? Math.round(authorWords / COMPOSITION_WPM) : 0;
  const timeSavedMinutes = compositionMinutes + readingTime;

  // Images in the document
  const docImages = useMemo(() => extractMarkdownImages(text), [text]);
  const [copyingImage, setCopyingImage] = useState(false);

  const handleCopyImage = useCallback(async (src: string, alt: string) => {
    setCopyingImage(true);
    try {
      const blob = await fetchImageAsBlob(src);
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      toast({
        title: "Image copied",
        description: alt
          ? `"${alt.slice(0, 40)}${alt.length > 40 ? "..." : ""}" copied — paste into Claude.`
          : "Image copied to clipboard — paste into Claude.",
      });
    } catch (err) {
      console.error("Image copy failed:", err);
      toast({
        title: "Copy failed",
        description: "Could not copy image. Try right-click → Copy image instead.",
        variant: "destructive",
      });
    } finally {
      setCopyingImage(false);
    }
  }, [toast]);

  /** Build markdown text with data-URL images replaced by file references */
  const buildExportMarkdown = (images: { alt: string; src: string }[], dateStr: string) => {
    let mdText = text;
    images.forEach((img, idx) => {
      const safeAlt = img.alt || `image-${idx + 1}`;
      const safeName = safeAlt.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 60);
      if (img.src.startsWith("data:")) {
        mdText = mdText.replace(
          `![${img.alt}](${img.src})`,
          `![${safeAlt}](${safeName}-${dateStr}.png)`,
        );
      }
    });
    return mdText;
  };

  /** Download as individual files (markdown + each image separately) */
  const handleDownloadIndividual = async () => {
    const dateStr = new Date().toISOString().split("T")[0];
    const images = extractMarkdownImages(text);

    let imageIndex = 0;
    for (const img of images) {
      imageIndex++;
      try {
        const blob = await fetchImageAsBlob(img.src);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const safeName = (img.alt || `image-${imageIndex}`)
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .substring(0, 60);
        link.download = `${safeName}-${dateStr}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.warn(`Failed to download image ${imageIndex}:`, err);
      }
    }

    const mdText = buildExportMarkdown(images, dateStr);
    const blob = new Blob([mdText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `document-${dateStr}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (images.length > 0) {
      toast({
        title: `Downloaded ${images.length} image${images.length > 1 ? "s" : ""} + document`,
      });
    }
  };

  /** Download everything as a single ZIP file */
  const handleDownloadZip = async () => {
    const dateStr = new Date().toISOString().split("T")[0];
    const images = extractMarkdownImages(text);

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    // Add images
    let imageIndex = 0;
    for (const img of images) {
      imageIndex++;
      try {
        const blob = await fetchImageAsBlob(img.src);
        const safeName = (img.alt || `image-${imageIndex}`)
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .substring(0, 60);
        zip.file(`${safeName}-${dateStr}.png`, blob);
      } catch (err) {
        console.warn(`Failed to add image ${imageIndex} to zip:`, err);
      }
    }

    // Add markdown
    const mdText = buildExportMarkdown(images, dateStr);
    zip.file(`document-${dateStr}.md`, mdText);

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `document-${dateStr}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "ZIP downloaded",
      description: `Document${images.length > 0 ? ` + ${images.length} image${images.length > 1 ? "s" : ""}` : ""} saved as ZIP.`,
    });
  };

  // Clear selection toolbar when clicking outside in preview mode
  const handleContainerClick = useCallback(() => {
    if (!isRecordingRef.current && !showPromptInputRef.current) {
      if (viewMode === "preview") {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          setSelectedText("");
          setSelectionPosition(null);
        }
      } else {
        const textarea = editorRef.current as HTMLTextAreaElement | null;
        if (textarea && textarea.selectionStart === textarea.selectionEnd) {
          setSelectedText("");
          setSelectionPosition(null);
        }
      }
    }
  }, [viewMode]);

  return (
    <div
      ref={containerRef}
      className="h-full relative flex flex-col min-h-0"
      onClick={handleContainerClick}
    >
      {/* Panel Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-amber-50/40 dark:bg-amber-950/10 shrink-0">
        <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <h3 className="font-semibold text-sm text-amber-900/80 dark:text-amber-200/80">Draft</h3>
        <Badge variant="outline" className="text-xs ml-1">{wordCount.toLocaleString()} words</Badge>
        <Badge variant="secondary" className="text-xs">{readingTime} min read</Badge>
        {timeSavedMinutes > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="text-xs gap-1 cursor-help bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60">
                <Clock className="w-3 h-3" />
                ~{timeSavedMinutes} min saved
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
              <p className="font-semibold mb-1">Estimated time saved</p>
              <p>
                You shaped <strong>{authorWords.toLocaleString()} words</strong> through
                iterative AI collaboration instead of writing from scratch.
              </p>
              <p className="mt-1 text-muted-foreground">
                At a knowledge-worker composition speed of {COMPOSITION_WPM} WPM
                (Karat et al., 1999), writing those words would take
                ~{compositionMinutes} min — plus {readingTime} min to read the
                full {wordCount.toLocaleString()}-word document.
              </p>
            </TooltipContent>
          </Tooltip>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-0.5">
          <Button
            data-testid="button-document-mic"
            variant={showFeedbackInput ? "default" : "ghost"}
            size="icon"
            className={`h-8 w-8 ${showFeedbackInput ? "" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => {
              if (showFeedbackInput) {
                handleCloseFeedback();
              } else {
                setShowFeedbackInput(true);
              }
            }}
            title={showFeedbackInput ? "Close voice feedback" : "Voice feedback"}
          >
            <Mic className="w-4 h-4" />
          </Button>
          <Button
            data-testid="button-document-pencil"
            variant={viewMode === "edit" ? "default" : "ghost"}
            size="icon"
            className={`h-8 w-8 ${viewMode === "edit" ? "" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setViewMode(viewMode === "edit" ? "preview" : "edit")}
            title={viewMode === "edit" ? "Switch to preview" : "Edit document"}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            data-testid="button-copy-document"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => {
              const textOnly = text.replace(/!\[[^\]]*\]\([^)]+\)/g, "").replace(/\n{3,}/g, "\n\n").trim();
              navigator.clipboard.writeText(textOnly);
              toast({
                title: "Copied",
                description: "Document text copied to clipboard.",
              });
            }}
            title="Copy document"
          >
            <Copy className="w-4 h-4" />
          </Button>
          {/* Copy Image button — only when document has images */}
          {docImages.length === 1 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="button-copy-image"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  disabled={copyingImage}
                  onClick={() => handleCopyImage(docImages[0].src, docImages[0].alt)}
                  title="Copy image to clipboard"
                >
                  {copyingImage ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Copy image — paste into Claude</p>
              </TooltipContent>
            </Tooltip>
          )}
          {docImages.length > 1 && (
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      data-testid="button-copy-image"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      disabled={copyingImage}
                      title="Copy an image to clipboard"
                    >
                      {copyingImage ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <ImageIcon className="w-4 h-4" />
                      )}
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Copy an image — paste into Claude</p>
                </TooltipContent>
              </Tooltip>
              <PopoverContent align="end" className="w-64 p-2">
                <p className="text-xs text-muted-foreground mb-2 px-1">Select an image to copy</p>
                <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                  {docImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleCopyImage(img.src, img.alt)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-left text-sm transition-colors"
                    >
                      <img
                        src={img.src}
                        alt={img.alt}
                        className="w-10 h-10 object-cover rounded border shrink-0"
                      />
                      <span className="truncate text-xs">
                        {img.alt || `Image ${idx + 1}`}
                      </span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                data-testid="button-download-document"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDownloadIndividual} className="gap-2">
                <FileDown className="w-4 h-4" />
                All Individual Files
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadZip} className="gap-2">
                <FileArchive className="w-4 h-4" />
                Single Zip
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Voice feedback input bar */}
      {showFeedbackInput && (
        <div className="px-3 py-2 border-b bg-primary/5">
          <ProvokeText
            variant="input"
            chrome="bare"
            data-testid="input-voice-feedback"
            value={feedbackText}
            onChange={setFeedbackText}
            placeholder="Speak or type feedback to evolve the document..."
            voice={{ mode: "replace" }}
            onVoiceTranscript={(transcript) => setFeedbackText(transcript)}
            autoRecord
            onSubmit={handleSubmitFeedback}
            submitIcon={Send}
            showCopy={false}
            showClear={false}
            disabled={isMerging}
            onKeyDown={(e) => {
              if (e.key === "Escape") handleCloseFeedback();
            }}
            extraActions={
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCloseFeedback}
                className="h-7 w-7"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </Button>
            }
          />
        </div>
      )}

      {/* Content area — notebook-style draft canvas */}
      <div className="flex-1 overflow-hidden relative min-h-0 notebook-canvas">
        {viewMode === "preview" ? (
          <MarkdownRenderer
            content={text}
            onSelectText={handlePreviewSelect}
            className="font-serif"
          />
        ) : (
          <ProvokeText
            ref={editorRef}
            variant="editor"
            chrome="bare"
            data-testid="editor-document"
            value={text}
            onChange={(val) => onTextChange?.(val)}
            onSelect={handleSelect}
            className="w-full text-foreground/90 font-mono text-sm"
            placeholder="Start typing your markdown document..."
            showCopy={true}
            showClear={false}
            voice={{ mode: "append", inline: false }}
            onVoiceTranscript={(transcript) => {
              onTranscriptUpdate?.(transcript, false);
            }}
            onVoiceInterimTranscript={(interim) => {
              onTranscriptUpdate?.(interim, true);
            }}
            onRecordingChange={(recording) => {
              onTranscriptUpdate?.("", recording);
            }}
          />
        )}
      </div>

      {/* Floating toolbar on text selection */}
      {selectedText && selectionPosition && (
        <div
          data-selection-toolbar
          className="absolute z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{
            left: `${Math.max(24, selectionPosition.x)}px`,
            top: `${Math.max(60, selectionPosition.y + 60)}px`,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {showPromptInput ? (
            <div className="flex items-center gap-1 bg-card border rounded-lg shadow-lg p-1">
              <ProvokeText
                variant="input"
                chrome="bare"
                data-testid="input-edit-instruction"
                value={promptText}
                onChange={setPromptText}
                onKeyDown={handlePromptKeyDown}
                placeholder="How to modify this text..."
                className="min-w-[200px] h-8 text-sm"
                disabled={isProcessingEdit}
                autoFocus
                showCopy={false}
                showClear={false}
                voice={{ mode: "replace" }}
                onVoiceTranscript={(transcript) => setPromptText(transcript)}
                onSubmit={handleSubmitEdit}
                submitIcon={Send}
                extraActions={
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
                }
              />
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-card border rounded-lg shadow-lg p-1">
              <Button
                data-testid="button-selection-voice"
                size="sm"
                variant={isRecording ? "destructive" : "default"}
                onClick={toggleRecording}
                disabled={isMerging || isProcessingEdit}
                className={`gap-1.5 ${isRecording ? "animate-pulse" : ""}`}
                title={isRecording ? "Stop recording" : "Speak feedback about selection"}
              >
                {isRecording ? (
                  <>
                    <Square className="w-3 h-3" />
                    Stop
                  </>
                ) : (
                  <>
                    <Mic className="w-3 h-3" />
                    Voice
                  </>
                )}
              </Button>
              <Button
                data-testid="button-selection-edit"
                size="sm"
                variant="secondary"
                onClick={handleShowPrompt}
                disabled={isMerging || isProcessingEdit || isRecording}
                className="gap-1.5"
                title="Type instruction to modify"
              >
                <Send className="w-3 h-3" />
                Edit
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
