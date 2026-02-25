import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, User, Bot, BookmarkPlus, ChevronDown, Crown, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { ProvokeText } from "@/components/ProvokeText";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { ChatMessage } from "@shared/schema";

interface ChatModelDef {
  id: string;
  label: string;
  provider: "openai" | "anthropic" | "gemini";
  tier: "premium" | "value";
}

const PROVIDER_DISPLAY: Record<string, string> = {
  gemini: "Google",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

interface ChatSessionPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  streamingContent: string;
  onSendMessage: (message: string) => void;
  onCaptureToNotes?: (text: string) => void;
  objective: string;
  researchTopic?: string;
  chatModel: string;
  onModelChange: (modelId: string) => void;
}

export function ChatSessionPanel({
  messages,
  isLoading,
  streamingContent,
  onSendMessage,
  onCaptureToNotes,
  objective,
  researchTopic,
  chatModel,
  onModelChange,
}: ChatSessionPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [availableModels, setAvailableModels] = useState<ChatModelDef[]>([]);

  // Fetch available models from backend (filtered by configured API keys)
  useEffect(() => {
    fetch("/api/chat/models")
      .then((r) => r.json())
      .then((data) => {
        if (data.models?.length) {
          setAvailableModels(data.models);
        }
      })
      .catch(() => {});
  }, []);

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

  // Group models by provider
  const groupedModels = availableModels.reduce<Record<string, ChatModelDef[]>>(
    (acc, model) => {
      const key = model.provider;
      if (!acc[key]) acc[key] = [];
      acc[key].push(model);
      return acc;
    },
    {},
  );

  // Provider order: Google first, then OpenAI, then Anthropic
  const providerOrder = ["gemini", "openai", "anthropic"] as const;
  const activeModel = availableModels.find((m) => m.id === chatModel);
  const activeLabel = activeModel?.label || chatModel;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b bg-card/50">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Researcher</h3>
            {researchTopic && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {researchTopic}
              </p>
            )}
          </div>
          {/* Model selector dropdown */}
          {availableModels.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs font-medium px-2.5"
                >
                  {activeModel?.tier === "premium" ? (
                    <Crown className="w-3 h-3 text-amber-500" />
                  ) : (
                    <Zap className="w-3 h-3 text-emerald-500" />
                  )}
                  {activeLabel}
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {providerOrder.map((provider, idx) => {
                  const models = groupedModels[provider];
                  if (!models?.length) return null;
                  return (
                    <div key={provider}>
                      {idx > 0 && groupedModels[providerOrder[idx - 1]]?.length ? (
                        <DropdownMenuSeparator />
                      ) : null}
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        {PROVIDER_DISPLAY[provider] || provider}
                      </DropdownMenuLabel>
                      <DropdownMenuGroup>
                        {models.map((model) => (
                          <DropdownMenuItem
                            key={model.id}
                            onClick={() => onModelChange(model.id)}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className={chatModel === model.id ? "font-semibold" : ""}>
                              {model.label}
                            </span>
                            <span className="flex items-center gap-1">
                              {model.tier === "premium" ? (
                                <span className="text-[10px] text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded font-medium">
                                  Premium
                                </span>
                              ) : (
                                <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded font-medium">
                                  Value
                                </span>
                              )}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </div>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
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
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-stone dark:prose-invert max-w-none break-words leading-relaxed font-serif [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_p]:my-1.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-bold [&_h2]:font-semibold [&_h3]:font-medium [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:text-xs [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded-md [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_table]:text-xs [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-words leading-relaxed font-serif">
                    {msg.content}
                  </div>
                )}
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
                <div className="prose prose-sm prose-stone dark:prose-invert max-w-none break-words leading-relaxed font-serif [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_p]:my-1.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-bold [&_h2]:font-semibold [&_h3]:font-medium [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:text-xs [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded-md [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_table]:text-xs [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1">
                  <ReactMarkdown>{streamingContent}</ReactMarkdown>
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
