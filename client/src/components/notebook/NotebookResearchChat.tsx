import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Bot, User, BookmarkPlus, Loader2, Sparkles, Trash2, Compass, ShieldCheck, Database, FlaskConical, Layers, BrainCircuit, Microscope, FileText, Target, MessageSquare, SlidersHorizontal, ChevronDown, AlignLeft, List, GraduationCap, BookOpen, Users, Code2, Zap, MessageCircle, Shield, Search as SearchIcon, Square, Clock, Cpu, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ProvokeText } from "@/components/ProvokeText";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { LlmHoverButton, type ContextBlock, type SummaryItem } from "@/components/LlmHoverButton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { ChatMessage, ChatMessageWithMeta } from "@shared/schema";
import type { ResearchFocus, ResponseConfig, ResponseDetailLevel, ResponseFormat, ResponseAudienceLevel, ResponseTone } from "@shared/schema";
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

// ── Response configuration options ──

const DETAIL_OPTIONS: { id: ResponseDetailLevel; label: string; icon: LucideIcon; description: string }[] = [
  { id: "brief", label: "Brief", icon: Zap, description: "Short, scannable — key facts only" },
  { id: "standard", label: "Standard", icon: AlignLeft, description: "Balanced coverage with supporting detail" },
  { id: "detailed", label: "Detailed", icon: List, description: "Thorough with examples and context" },
  { id: "exhaustive", label: "Exhaustive", icon: BookOpen, description: "Comprehensive reference — leave nothing out" },
];

const FORMAT_OPTIONS: { id: ResponseFormat; label: string; icon: LucideIcon; description: string }[] = [
  { id: "prose", label: "Prose", icon: AlignLeft, description: "Flowing narrative paragraphs" },
  { id: "structured", label: "Structured", icon: List, description: "Headers, bullet points, tables" },
  { id: "outline", label: "Outline", icon: List, description: "Hierarchical numbered outline" },
  { id: "academic", label: "Academic", icon: GraduationCap, description: "Formal sections, citations, abstract" },
];

const AUDIENCE_OPTIONS: { id: ResponseAudienceLevel; label: string; icon: LucideIcon; description: string }[] = [
  { id: "non-technical", label: "Simple", icon: Users, description: "Plain language, no jargon" },
  { id: "general", label: "General", icon: MessageCircle, description: "Some technical terms, explained" },
  { id: "technical", label: "Technical", icon: Code2, description: "Assumes domain knowledge" },
  { id: "expert", label: "Expert", icon: Zap, description: "Deep technical, no hand-holding" },
];

const TONE_OPTIONS: { id: ResponseTone; label: string; icon: LucideIcon; description: string }[] = [
  { id: "neutral", label: "Neutral", icon: Shield, description: "Objective and balanced" },
  { id: "conversational", label: "Casual", icon: MessageCircle, description: "Friendly, like a colleague" },
  { id: "assertive", label: "Assertive", icon: Zap, description: "Clear opinions and recommendations" },
  { id: "critical", label: "Critical", icon: SearchIcon, description: "Skeptical, surfaces risks and flaws" },
];

interface NotebookResearchChatProps {
  objective: string;
  /** Called when user captures an AI response as active context */
  onCaptureToContext: (text: string, label: string) => void;
  /** Reports message count changes to parent */
  onMessageCountChange?: (count: number) => void;
}

export function NotebookResearchChat({
  objective,
  onCaptureToContext,
  onMessageCountChange,
}: NotebookResearchChatProps) {
  const [messages, setMessages] = useState<ChatMessageWithMeta[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [focusMode, setFocusMode] = useState<ResearchFocus>("explore");
  const [responseConfig, setResponseConfig] = useState<ResponseConfig>({
    detail: "standard",
    format: "structured",
    audience: "general",
    tone: "neutral",
  });
  const [showResponseConfig, setShowResponseConfig] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // Check if any response config differs from defaults
  const hasCustomConfig = responseConfig.detail !== "standard" ||
    responseConfig.format !== "structured" ||
    responseConfig.audience !== "general" ||
    responseConfig.tone !== "neutral";

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

  // Stop generation
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessageWithMeta = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          objective: objective || "General research",
          history: messages.slice(-30).map((m) => ({ role: m.role, content: m.content })),
          researchFocus: focusMode,
          responseConfig: hasCustomConfig ? responseConfig : undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error("Chat request failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let accumulated = "";
      let followUps: string[] | undefined;
      let durationMs: number | undefined;
      let model: string | undefined;

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
            } else if (data.type === "followups") {
              followUps = data.followUps;
            } else if (data.type === "meta") {
              durationMs = data.durationMs;
              model = data.model;
            } else if (data.type === "done") {
              // Streaming complete
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      // Commit the full response as a message with metadata
      if (accumulated) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: accumulated, followUps, durationMs, model },
        ]);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // User stopped generation — commit what we have
        const partial = streamingContent;
        if (partial) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: partial },
          ]);
        }
      } else {
        const msg =
          error instanceof Error ? error.message : "Research chat failed";
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
      setStreamingContent("");
      abortRef.current = null;
    }
  }, [input, isLoading, messages, objective, focusMode, hasCustomConfig, responseConfig, streamingContent, toast]);

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

  // Click a follow-up suggestion to auto-populate and send
  const handleFollowUp = useCallback(
    (question: string) => {
      setInput(question);
    },
    [],
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
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b shrink-0 bg-muted/20">
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

      {/* Response config toggle + panel */}
      <div className="border-b shrink-0">
        <button
          type="button"
          onClick={() => setShowResponseConfig(!showResponseConfig)}
          className={`flex items-center gap-1.5 w-full px-2 py-1 text-[10px] font-medium transition-colors hover:bg-muted/30 ${
            hasCustomConfig ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <SlidersHorizontal className="w-3 h-3" />
          <span>Response</span>
          {hasCustomConfig && (
            <span className="px-1 py-px rounded bg-primary/15 text-primary text-[9px]">
              Custom
            </span>
          )}
          <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${showResponseConfig ? "rotate-180" : ""}`} />
        </button>

        {showResponseConfig && (
          <div className="px-2 pb-2 space-y-1.5">
            {/* Detail Level */}
            <ResponseConfigRow
              label="Detail"
              options={DETAIL_OPTIONS}
              value={responseConfig.detail || "standard"}
              onChange={(v) => setResponseConfig((prev) => ({ ...prev, detail: v as ResponseDetailLevel }))}
            />
            {/* Format */}
            <ResponseConfigRow
              label="Format"
              options={FORMAT_OPTIONS}
              value={responseConfig.format || "structured"}
              onChange={(v) => setResponseConfig((prev) => ({ ...prev, format: v as ResponseFormat }))}
            />
            {/* Audience */}
            <ResponseConfigRow
              label="Audience"
              options={AUDIENCE_OPTIONS}
              value={responseConfig.audience || "general"}
              onChange={(v) => setResponseConfig((prev) => ({ ...prev, audience: v as ResponseAudienceLevel }))}
            />
            {/* Tone */}
            <ResponseConfigRow
              label="Tone"
              options={TONE_OPTIONS}
              value={responseConfig.tone || "neutral"}
              onChange={(v) => setResponseConfig((prev) => ({ ...prev, tone: v as ResponseTone }))}
            />
          </div>
        )}
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
                        {/* Response metadata */}
                        {msg.durationMs != null && (
                          <span className="text-[9px] text-muted-foreground/60 ml-auto flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {(msg.durationMs / 1000).toFixed(1)}s
                          </span>
                        )}
                        {msg.model && (
                          <span className="text-[9px] text-muted-foreground/60 flex items-center gap-0.5">
                            <Cpu className="w-2.5 h-2.5" />
                            {msg.model.replace(/^models\//, "")}
                          </span>
                        )}
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>

                    {/* Action row: capture + follow-ups */}
                    <div className="mt-1 flex flex-col gap-1">
                      {/* Capture button */}
                      <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
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

                      {/* Follow-up suggestions */}
                      {msg.followUps && msg.followUps.length > 0 && i === messages.length - 1 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {msg.followUps.map((q, j) => (
                            <button
                              key={j}
                              type="button"
                              onClick={() => handleFollowUp(q)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-muted/50 hover:bg-muted text-foreground/70 hover:text-foreground transition-colors border border-border/50 hover:border-border"
                            >
                              <ArrowRight className="w-2.5 h-2.5 text-primary/60 shrink-0" />
                              <span className="text-left">{q}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Streaming response */}
            {streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[90%]">
                  <div className="bg-muted/40 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Bot className="w-3 h-3 text-blue-500" />
                      <span className="text-[10px] text-muted-foreground">
                        Research
                      </span>
                      <span className="text-[9px] text-muted-foreground/50 ml-auto">
                        streaming...
                      </span>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{streamingContent}</ReactMarkdown>
                    </div>
                  </div>
                  {/* Stop button */}
                  <div className="mt-1 flex justify-start">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-destructive border-muted"
                      onClick={handleStop}
                    >
                      <Square className="w-2.5 h-2.5 fill-current" />
                      Stop generating
                    </Button>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-[9px] gap-0.5 text-muted-foreground hover:text-destructive ml-1"
                    onClick={handleStop}
                  >
                    <Square className="w-2 h-2 fill-current" />
                    Stop
                  </Button>
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
          <ResearchSendButton
            input={input}
            isLoading={isLoading}
            objective={objective}
            messages={messages}
            focusMode={focusMode}
            responseConfig={hasCustomConfig ? responseConfig : undefined}
            onSend={handleSend}
          />
        </div>
      </div>
    </div>
  );
}

// ── Send button with LLM hover preview ──

function ResearchSendButton({
  input,
  isLoading,
  objective,
  messages,
  focusMode,
  responseConfig,
  onSend,
}: {
  input: string;
  isLoading: boolean;
  objective: string;
  messages: ChatMessage[];
  focusMode: ResearchFocus;
  responseConfig?: ResponseConfig;
  onSend: () => void;
}) {
  const historyChars = useMemo(
    () => messages.reduce((s, m) => s + m.content.length, 0),
    [messages],
  );

  const responseConfigChars = responseConfig ? 300 : 0;

  const blocks: ContextBlock[] = useMemo(() => {
    const b: ContextBlock[] = [
      { label: "System Prompt", chars: 1500, color: "text-purple-400" },
      { label: "User Query", chars: input.length, color: "text-blue-400" },
      { label: "Objective", chars: objective.length, color: "text-amber-400" },
      { label: "Chat History", chars: historyChars, color: "text-cyan-400" },
    ];
    if (responseConfigChars > 0) {
      b.push({ label: "Response Config", chars: responseConfigChars, color: "text-rose-400" });
    }
    return b;
  }, [input, objective, historyChars, responseConfigChars]);

  const responseConfigDetail = responseConfig
    ? [responseConfig.detail, responseConfig.format, responseConfig.audience, responseConfig.tone].filter(Boolean).join(", ")
    : undefined;

  const summary: SummaryItem[] = useMemo(() => {
    const s: SummaryItem[] = [
      { icon: <MessageSquare className="w-3 h-3 text-blue-400" />, label: "Query", count: input.trim() ? 1 : 0, detail: input.trim() ? input.slice(0, 60) + (input.length > 60 ? "..." : "") : undefined },
      { icon: <Target className="w-3 h-3 text-amber-400" />, label: "Objective", count: objective.trim() ? 1 : 0, detail: objective.trim() ? objective.slice(0, 50) + (objective.length > 50 ? "..." : "") : undefined },
      { icon: <FileText className="w-3 h-3 text-cyan-400" />, label: "Chat History", count: messages.length, detail: messages.length > 0 ? `${messages.length} message${messages.length !== 1 ? "s" : ""}` : undefined },
      { icon: <Compass className="w-3 h-3 text-emerald-400" />, label: "Focus Mode", count: 1, detail: focusMode },
    ];
    if (responseConfigDetail) {
      s.push({ icon: <SlidersHorizontal className="w-3 h-3 text-rose-400" />, label: "Response Config", count: 1, detail: responseConfigDetail });
    }
    return s;
  }, [input, objective, messages, focusMode, responseConfigDetail]);

  return (
    <LlmHoverButton
      previewTitle="Research Chat"
      previewBlocks={blocks}
      previewSummary={summary}
      side="top"
      align="end"
    >
      <Button
        size="icon"
        variant="ghost"
        onClick={onSend}
        disabled={!input.trim() || isLoading}
        className="h-8 w-8 shrink-0"
      >
        <Send className="w-4 h-4" />
      </Button>
    </LlmHoverButton>
  );
}

// ── Response config row (compact pill selector) ──

function ResponseConfigRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string; icon: LucideIcon; description: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-medium text-muted-foreground w-[46px] shrink-0 text-right">
        {label}
      </span>
      <div className="flex flex-wrap gap-0.5">
        {options.map((opt) => {
          const Icon = opt.icon;
          const isActive = value === opt.id;
          return (
            <Tooltip key={opt.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onChange(opt.id)}
                  className={`flex items-center gap-0.5 px-1.5 py-px rounded text-[9px] font-medium transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
                  }`}
                >
                  <Icon className="w-2.5 h-2.5" />
                  {opt.label}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                {opt.description}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
