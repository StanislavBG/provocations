import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, BookmarkPlus, Loader2, Sparkles, Trash2, Compass, ShieldCheck, Database, FlaskConical, Layers, BrainCircuit, Microscope } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ProvokeText } from "@/components/ProvokeText";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { ChatMessage } from "@shared/schema";
import type { ResearchFocus } from "@shared/schema";
import type { LucideIcon } from "lucide-react";

const FOCUS_MODES: { id: ResearchFocus; label: string; icon: LucideIcon; description: string }[] = [
  { id: "explore", label: "Explore", icon: Compass, description: "Discover angles, brainstorm, map the landscape" },
  { id: "verify", label: "Verify", icon: ShieldCheck, description: "Fact-check claims, validate sources, find evidence" },
  { id: "gather", label: "Gather", icon: Database, description: "Collect structured data, schemas, specifications" },
  { id: "analyze", label: "Analyze", icon: FlaskConical, description: "Compare options, evaluate trade-offs, decide" },
  { id: "synthesize", label: "Synthesize", icon: Layers, description: "Weave sources into coherent narratives, find themes" },
  { id: "reason", label: "Reason", icon: BrainCircuit, description: "Step-by-step logical reasoning, break down complexity" },
  { id: "deep-research", label: "Deep Research", icon: Microscope, description: "Deep multi-step investigation with cited findings" },
];

interface NotebookResearchChatProps {
  objective: string;
  /** Called when user captures an AI response as session context */
  onCaptureToContext: (text: string, label: string) => void;
  /** Reports message count changes to parent */
  onMessageCountChange?: (count: number) => void;
}

export function NotebookResearchChat({
  objective,
  onCaptureToContext,
  onMessageCountChange,
}: NotebookResearchChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [focusMode, setFocusMode] = useState<ResearchFocus>("explore");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingContent]);

  // Report message count to parent
  useEffect(() => {
    onMessageCountChange?.(messages.length);
  }, [messages.length, onMessageCountChange]);

  const handleClear = useCallback(() => {
    setMessages([]);
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          objective: objective || "General research",
          history: messages.slice(-30),
          researchFocus: focusMode,
        }),
      });

      if (!response.ok) throw new Error("Chat request failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "content") {
              accumulated += data.content;
              setStreamingContent(accumulated);
            } else if (data.type === "done") {
              // Streaming complete
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      // Commit the full response as a message
      if (accumulated) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: accumulated },
        ]);
      }
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Research chat failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
      setStreamingContent("");
    }
  }, [input, isLoading, messages, objective, focusMode, toast]);

  const handleCapture = useCallback(
    (content: string) => {
      // Use first line or first 40 chars as label
      const firstLine = content.split("\n")[0].replace(/^#+\s*/, "").trim();
      const label =
        firstLine.length > 40
          ? firstLine.slice(0, 40) + "..."
          : firstLine || "Research finding";
      onCaptureToContext(content, label);
      toast({
        title: "Sent to Notes",
        description: "Response added to your notes",
      });
    },
    [onCaptureToContext, toast],
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Sticky header: message count + Clear */}
      {hasMessages && (
        <div className="flex items-center justify-between px-3 py-1 border-b shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {messages.length} message{messages.length !== 1 ? "s" : ""}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] gap-1 text-muted-foreground hover:text-destructive"
            onClick={handleClear}
          >
            <Trash2 className="w-2.5 h-2.5" />
            Clear
          </Button>
        </div>
      )}

      {/* Focus mode selector */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b shrink-0 bg-muted/20">
        {FOCUS_MODES.map((mode) => {
          const Icon = mode.icon;
          const isActive = focusMode === mode.id;
          return (
            <Tooltip key={mode.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setFocusMode(mode.id)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {mode.label}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                {mode.description}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        {!hasMessages && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground/50 py-12">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary/60" />
            </div>
            <div className="text-center space-y-1.5 max-w-[260px]">
              <p className="text-sm font-medium text-foreground/60">
                Research assistant
              </p>
              <p className="text-xs leading-relaxed">
                Ask questions, explore ideas, and capture useful responses as
                context for your document. Click the{" "}
                <BookmarkPlus className="inline w-3 h-3" /> button on any
                response to save it.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "user" ? (
                  <div className="max-w-[85%] bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <User className="w-3 h-3" />
                      <span className="text-[10px] opacity-70">You</span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ) : (
                  <div className="max-w-[90%] group">
                    <div className="bg-muted/40 rounded-lg px-3 py-2 text-sm">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Bot className="w-3 h-3 text-blue-500" />
                        <span className="text-[10px] text-muted-foreground">
                          Research
                        </span>
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                    {/* Capture button */}
                    <div className="mt-1 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-primary"
                        onClick={() => handleCapture(msg.content)}
                      >
                        <BookmarkPlus className="w-3 h-3" />
                        Send to Notes
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Streaming response */}
            {streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[90%] bg-muted/40 rounded-lg px-3 py-2 text-sm">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Bot className="w-3 h-3 text-blue-500" />
                    <span className="text-[10px] text-muted-foreground">
                      Research
                    </span>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown>{streamingContent}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && !streamingContent && (
              <div className="flex justify-start">
                <div className="bg-muted/30 rounded-lg px-3 py-2 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                  <span className="text-xs text-muted-foreground">
                    Researching...
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-2 shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <ProvokeText
              chrome="bare"
              variant="textarea"
              value={input}
              onChange={setInput}
              placeholder="Ask anything..."
              className="text-sm"
              minRows={1}
              maxRows={4}
              showCopy={false}
              showClear={false}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </div>
          <VoiceRecorder
            onTranscript={(text) => setInput(text)}
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-8 w-8 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
