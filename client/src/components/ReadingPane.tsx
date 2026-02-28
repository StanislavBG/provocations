import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { trackEvent } from "@/lib/tracking";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileDown, FileArchive, Mic, Square, Send, X, FileText, Info, Clock, Loader2, ImageIcon, Paintbrush, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useWhisperRecorder } from "@/hooks/use-whisper";
import { ProvokeText } from "@/components/ProvokeText";
import { BlankCanvasGuide } from "@/components/BlankCanvasGuide";
import { ImagePreviewDialog } from "@/components/ImagePreviewDialog";

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
  /** Fired when the user copies the document (for usage metric recording) */
  onDocumentCopy?: () => void;
  /** The user's stated objective for this document */
  objective?: string;
  /** The selected template/application name (e.g. "Product Requirement") */
  templateName?: string;
  /** Called when a mic transcript is captured — routes to the Notes panel */
  onMicTranscript?: (transcript: string, selectedText?: string) => void;
  /** Called when user clicks Artify — opens the Artify panel with this document's text */
  onArtify?: () => void;
  /** Called when user clicks Save to Context — saves document to Context Store */
  onSaveToContext?: () => void;
  /** Whether a save-to-context operation is in progress */
  isSavingToContext?: boolean;
}

export function ReadingPane({ text, onTextChange, highlightText, onVoiceMerge, isMerging, onTranscriptUpdate, onTextEdit, onSendFeedback, draftWordCount, onDocumentCopy, objective, templateName, onMicTranscript, onArtify, onSaveToContext, isSavingToContext }: ReadingPaneProps) {
  const { toast } = useToast();
  const [selectedText, setSelectedText] = useState("");
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [isProcessingEdit, setIsProcessingEdit] = useState(false);
  // Document is always in edit mode — view/edit toggle removed
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  // Text to Visual state
  const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewPrompt, setPreviewPrompt] = useState("");
  const [showImagePreview, setShowImagePreview] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
  const onMicTranscriptRef = useRef(onMicTranscript);
  const selectedTextRef = useRef(selectedText);

  useEffect(() => {
    onVoiceMergeRef.current = onVoiceMerge;
  }, [onVoiceMerge]);

  useEffect(() => {
    onTranscriptUpdateRef.current = onTranscriptUpdate;
  }, [onTranscriptUpdate]);

  useEffect(() => {
    onMicTranscriptRef.current = onMicTranscript;
  }, [onMicTranscript]);

  useEffect(() => {
    selectedTextRef.current = selectedText;
  }, [selectedText]);

  // ── Whisper-powered voice recording (translates any language to English) ──
  const {
    isTranscribing,
    startRecording: whisperStart,
    stopRecording: whisperStop,
    toggleRecording,
  } = useWhisperRecorder({
    onTranscript: (text) => {
      const transcript = text.trim();
      const currentSelectedText = selectedTextRef.current;
      // Route transcript to the Transcript panel for review/editing
      if (transcript) {
        onMicTranscriptRef.current?.(transcript, currentSelectedText || undefined);
      }
      if (transcript && currentSelectedText && onVoiceMergeRef.current) {
        onVoiceMergeRef.current(currentSelectedText, transcript);
      }
      onTranscriptUpdateRef.current?.(transcript, false);
      transcriptRef.current = "";
      isRecordingRef.current = false;
      setIsRecording(false);
      setSelectedText("");
      setSelectionPosition(null);
    },
    onInterimTranscript: (text) => {
      transcriptRef.current = text;
      onTranscriptUpdateRef.current?.(text, true);
    },
    onRecordingChange: (recording) => {
      isRecordingRef.current = recording;
      setIsRecording(recording);
      if (recording) {
        transcriptRef.current = "";
        onTranscriptUpdateRef.current?.("", true);
      }
    },
  });

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
      trackEvent("document_feedback_sent");
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

    trackEvent("document_edit_inline");
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
    trackEvent("document_copied", { metadata: { type: "image" } });
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
    trackEvent("document_downloaded", { metadata: { format: "individual" } });
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
    trackEvent("document_downloaded", { metadata: { format: "zip" } });
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

  // Text to Visual: generate an image from the current document
  const handleTextToVisual = useCallback(async () => {
    if (!text.trim()) {
      toast({ title: "No content", description: "Document is empty.", variant: "destructive" });
      return;
    }
    setIsGeneratingVisual(true);
    try {
      const response = await apiRequest("POST", "/api/text-to-visual", { text });
      const data = (await response.json()) as { images?: string[]; imagePrompt?: string; error?: string };
      if (data.images && data.images.length > 0) {
        setPreviewImageUrl(data.images[0]);
        setPreviewPrompt(data.imagePrompt || "");
        setShowImagePreview(true);
        trackEvent("text_to_visual_generated");
      } else {
        toast({
          title: "No image generated",
          description: data.error || "The image could not be generated.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("[text-to-visual] error:", error);
      toast({ title: "Generation failed", description: "Could not generate visual.", variant: "destructive" });
    } finally {
      setIsGeneratingVisual(false);
    }
  }, [text, toast]);

  // Clear selection toolbar when clicking outside
  const handleContainerClick = useCallback(() => {
    if (!isRecordingRef.current && !showPromptInputRef.current) {
      const textarea = editorRef.current as HTMLTextAreaElement | null;
      if (textarea && textarea.selectionStart === textarea.selectionEnd) {
        setSelectedText("");
        setSelectionPosition(null);
      }
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full relative flex flex-col min-h-0"
      onClick={handleContainerClick}
    >
      {/* Panel Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-amber-50/40 dark:bg-amber-950/10 shrink-0">
        <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <h3 className="font-semibold text-sm text-amber-900/80 dark:text-amber-200/80 shrink-0">
          {templateName || "Draft"}
        </h3>
        {objective && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground truncate max-w-[200px] cursor-help border-b border-dotted border-muted-foreground/30">
                {objective}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-sm text-xs">
              {objective}
            </TooltipContent>
          </Tooltip>
        )}
        <Badge variant="outline" className="text-xs shrink-0">{wordCount.toLocaleString()} words</Badge>
        <Badge variant="secondary" className="text-xs shrink-0">{readingTime} min read</Badge>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-testid="button-text-to-visual"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={handleTextToVisual}
                disabled={isGeneratingVisual || !text.trim()}
                title="Text to Visual"
              >
                {isGeneratingVisual ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Generate a visual from this document</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-testid="button-artify"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:text-purple-600 dark:hover:text-purple-400"
                onClick={onArtify}
                disabled={!text.trim()}
                title="Artify"
              >
                <Paintbrush className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Artify — customize image generation style</TooltipContent>
          </Tooltip>
          <Button
            data-testid="button-document-mic"
            variant={showFeedbackInput ? "default" : "ghost"}
            size="icon"
            className={`h-7 w-7 ${showFeedbackInput ? "" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => {
              if (showFeedbackInput) {
                handleCloseFeedback();
              } else {
                setShowFeedbackInput(true);
              }
            }}
            title={showFeedbackInput ? "Close voice feedback" : "Voice feedback"}
          >
            <Mic className="w-3.5 h-3.5" />
          </Button>
          {onSaveToContext && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="button-save-to-context"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-green-600 dark:hover:text-green-400"
                  onClick={onSaveToContext}
                  disabled={!text.trim() || isSavingToContext}
                  title="Save to Context"
                >
                  {isSavingToContext ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save document to Context Store</TooltipContent>
            </Tooltip>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                data-testid="button-download-document"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Download"
              >
                <Download className="w-3.5 h-3.5" />
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
        {/* Blank canvas guidance when document is empty */}
        {text.trim().length === 0 && (
          <div className="absolute inset-0 z-10 overflow-y-auto bg-background/80 backdrop-blur-sm">
            <BlankCanvasGuide
              templateName={templateName}
              objective={objective}
              onFocusEditor={() => {
                setTimeout(() => editorRef.current?.focus(), 100);
              }}
              onStartDictating={() => {
                setTimeout(() => editorRef.current?.focus(), 100);
              }}
            />
          </div>
        )}
        <ProvokeText
          ref={editorRef}
          variant="editor"
          chrome="bare"
          data-testid="editor-document"
          value={text}
          onChange={(val) => onTextChange?.(val)}
          onSelect={handleSelect}
          className="w-full text-foreground font-mono text-sm"
          placeholder="Start typing your markdown document..."
          showCopy={true}
          showClear={true}
          voice={{ mode: "append", inline: false }}
          onVoiceTranscript={(transcript) => {
            onTranscriptUpdate?.(transcript, false);
            onMicTranscriptRef.current?.(transcript, undefined);
          }}
          onVoiceInterimTranscript={(interim) => {
            onTranscriptUpdate?.(interim, true);
          }}
          onRecordingChange={(recording) => {
            onTranscriptUpdate?.("", recording);
          }}
        />
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
            <div className="flex flex-col gap-1 bg-card border rounded-lg shadow-lg p-1.5">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-1">
                Targeted feedback
              </span>
              <div className="flex items-center gap-1">
              <Button
                data-testid="button-selection-voice"
                size="sm"
                variant={isRecording ? "destructive" : "default"}
                onClick={toggleRecording}
                disabled={isMerging || isProcessingEdit || isTranscribing}
                className={`gap-1.5 ${isRecording ? "animate-pulse" : ""}`}
                title={isTranscribing ? "Transcribing..." : isRecording ? "Stop recording" : "Speak feedback about this selection"}
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    ...
                  </>
                ) : isRecording ? (
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
            </div>
          )}
        </div>
      )}

      {/* Image preview dialog for Text to Visual */}
      <ImagePreviewDialog
        open={showImagePreview}
        onOpenChange={setShowImagePreview}
        imageUrl={previewImageUrl}
        prompt={previewPrompt}
        title="Text to Visual"
      />
    </div>
  );
}
