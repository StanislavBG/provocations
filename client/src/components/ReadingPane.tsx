import { useState, useCallback, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Mic, Square, Send, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ProvokeText } from "@/components/ProvokeText";

interface ReadingPaneProps {
  text: string;
  onTextChange?: (text: string) => void;
  highlightText?: string;
  onVoiceMerge?: (selectedText: string, transcript: string) => void;
  isMerging?: boolean;
  onTranscriptUpdate?: (transcript: string, isRecording: boolean) => void;
  onTextEdit?: (newText: string) => void;
}

export function ReadingPane({ text, onTextChange, highlightText, onVoiceMerge, isMerging, onTranscriptUpdate, onTextEdit }: ReadingPaneProps) {
  const { toast } = useToast();
  const [selectedText, setSelectedText] = useState("");
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [isProcessingEdit, setIsProcessingEdit] = useState(false);
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

  // Handle text selection in the editor
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
    // Get textarea position and calculate approximate position
    const textareaRect = textarea.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    // Estimate position based on character position
    const textBeforeSelection = text.substring(0, start);
    const lines = textBeforeSelection.split('\n');
    const lineHeight = 28; // approximate line height
    const y = Math.min(lines.length * lineHeight, textareaRect.height - 50);

    // Position toolbar to the right
    const x = Math.min(textareaRect.width - 120, 400);

    setSelectionPosition({ x, y });
  }, [text]);

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
    <div
      ref={containerRef}
      className="h-full relative"
      onClick={() => {
        // Clear toolbar if clicking without selection
        if (!isRecordingRef.current && !showPromptInputRef.current) {
          const textarea = editorRef.current as HTMLTextAreaElement | null;
          if (textarea && textarea.selectionStart === textarea.selectionEnd) {
            setSelectedText("");
            setSelectionPosition(null);
          }
        }
      }}
    >
      <ProvokeText
        ref={editorRef}
        variant="editor"
        chrome="container"
        containerClassName="h-full"
        data-testid="editor-document"
        value={text}
        onChange={(val) => onTextChange?.(val)}
        onSelect={handleSelect}
        className="w-full text-foreground/90"
        placeholder="Start typing your document..."
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
        headerActions={
          <>
            <Badge variant="outline" className="text-xs">{wordCount.toLocaleString()} words</Badge>
            <Badge variant="secondary" className="text-xs">{readingTime} min read</Badge>
            <div className="w-px h-5 bg-border mx-1" />
            <Button
              data-testid="button-download-document"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleDownload}
              title="Download document"
            >
              <Download className="w-4 h-4" />
            </Button>
          </>
        }
      />

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
