import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, User, Bot, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProvokeText } from "@/components/ProvokeText";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { ChatMessage } from "@shared/schema";

interface ChatSessionPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  streamingContent: string;
  onSendMessage: (message: string) => void;
  onCaptureToNotes?: (text: string) => void;
  objective: string;
  researchTopic?: string;
}

export function ChatSessionPanel({
  messages,
  isLoading,
  streamingContent,
  onSendMessage,
  onCaptureToNotes,
  objective,
  researchTopic,
}: ChatSessionPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingContent]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInput("");
  }, [input, isLoading, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleCapture = useCallback((content: string) => {
    // Check if user has selected text
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    const textToCapture = selectedText || content;
    onCaptureToNotes?.(textToCapture);
    if (selectedText) selection?.removeAllRanges();
    toast({
      title: "Captured to notes",
      description: selectedText ? "Selected text added to your notes" : "Response added to your notes",
    });
  }, [onCaptureToNotes, toast]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b bg-card/50">
        <h3 className="text-sm font-semibold">Researcher</h3>
        {researchTopic && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {researchTopic}
          </p>
        )}
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 min-h-0">
        <div ref={scrollRef} className="p-4 space-y-4">
          {messages.length === 0 && !streamingContent && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground/50">
              <Bot className="w-10 h-10" />
              <p className="text-sm text-center max-w-xs">
                Start your research by asking a question. Capture useful responses into your notes as you go.
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm group relative ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 border"
                }`}
              >
                <div className="whitespace-pre-wrap break-words leading-relaxed font-serif">
                  {msg.content}
                </div>
                {msg.role === "assistant" && onCaptureToNotes && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -right-2 -top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-card border shadow-sm"
                    onClick={() => handleCapture(msg.content)}
                    title="Capture to notes (or select text first)"
                  >
                    <BookmarkPlus className="w-3 h-3" />
                  </Button>
                )}
              </div>
              {msg.role === "user" && (
                <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {/* Streaming response */}
          {streamingContent && (
            <div className="flex gap-3 justify-start">
              <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-muted/50 border group relative">
                <div className="whitespace-pre-wrap break-words leading-relaxed font-serif">
                  {streamingContent}
                  <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-text-bottom" />
                </div>
              </div>
            </div>
          )}

          {/* Loading indicator (non-streaming) */}
          {isLoading && !streamingContent && (
            <div className="flex gap-3 justify-start">
              <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="rounded-lg px-3 py-2 text-sm bg-muted/50 border">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Researching...
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="shrink-0 border-t p-3 bg-card/50">
        <div className="flex gap-2 items-end">
          <div className="flex-1 min-w-0" onKeyDown={handleKeyDown}>
            <ProvokeText
              chrome="bare"
              variant="textarea"
              placeholder="Ask a research question..."
              className="text-sm font-serif"
              value={input}
              onChange={setInput}
              minRows={1}
              maxRows={4}
              voice={{ mode: "replace" }}
              onVoiceTranscript={setInput}
              showCopy={false}
              showClear={false}
            />
          </div>
          <Button
            size="icon"
            className="shrink-0 h-9 w-9"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
