import { useState, useRef } from "react";
import { AutoExpandTextarea } from "@/components/ui/auto-expand-textarea";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Copy,
  Eraser,
  Loader2,
  MessageCircleQuestion,
  Mic,
  PenLine,
  Send,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/* ── Public types ── */

export interface BilkoAction {
  /** Unique key for React rendering */
  key: string;
  /** Button label text */
  label: string;
  /** Hover description explaining what the action does */
  description: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Click handler */
  onClick: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Whether the action is currently in progress (shows spinner) */
  loading?: boolean;
  /** Label to show while loading */
  loadingLabel?: string;
  /** Button variant (default: "ghost") */
  variant?: "ghost" | "outline" | "default";
  /** Whether to show the button (default: true) */
  visible?: boolean;
}

export interface BilkoTextFormProps {
  /* ── Core ── */

  /** Current text value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Minimum visible rows (default: 3) */
  minRows?: number;
  /** Maximum visible rows before scroll (default: 20) */
  maxRows?: number;
  /** Extra classes on the textarea element */
  className?: string;
  /** Extra classes on the outer wrapper (inline mode only) */
  panelClassName?: string;
  /** Auto-focus the textarea on mount */
  autoFocus?: boolean;
  /** Make the textarea read-only */
  readOnly?: boolean;
  /** Disable the textarea */
  disabled?: boolean;
  /** HTML id attribute */
  id?: string;
  /** Test id for testing frameworks */
  "data-testid"?: string;
  /** Key-down handler on the textarea */
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;

  /* ── Voice ── */

  /** Called when voice recording completes with the final transcript */
  onVoiceTranscript?: (transcript: string) => void;
  /** Called during recording with interim speech text */
  onVoiceInterimTranscript?: (interim: string) => void;
  /** Called when recording state changes */
  onRecordingChange?: (isRecording: boolean) => void;
  /** Show interim speech text inline in the textarea during recording (default: true) */
  voiceInline?: boolean;
  /** How voice input is displayed during recording: "append" adds to existing text, "replace" shows only the new speech (default: "append") */
  voiceMode?: "append" | "replace";

  /* ── Toolbar toggles ── */

  /** Show mic button in the toolbar (default: true) */
  showMic?: boolean;
  /** Show clear/eraser button in the toolbar (default: true) */
  showClear?: boolean;
  /** Show copy button in the toolbar (default: true) */
  showCopy?: boolean;

  /* ── Actions & slots ── */

  /** Additional custom elements rendered in the icon toolbar */
  extraActions?: React.ReactNode;
  /** AI action buttons rendered below the textarea with tooltip descriptions */
  actions?: BilkoAction[];
  /** Extra elements in the header row (badges, download button, etc.) — container mode only */
  headerActions?: React.ReactNode;
  /** Content rendered after the actions row (recording indicators, raw transcript, etc.) */
  children?: React.ReactNode;
  /** Footer rendered at the bottom of the container with a top border */
  footer?: React.ReactNode;

  /* ── Container-mode props ── */

  /** Header label — when provided, renders the full bordered container */
  label?: string;
  /** Icon rendered next to the label */
  labelIcon?: LucideIcon;
  /** Description text rendered inline with the label */
  description?: React.ReactNode;
  /** Extra classes on the outer container */
  containerClassName?: string;

  /* ── Questions feature ── */

  /** List of guided questions rendered as expandable prompts inside the container */
  questions?: string[];
  /** Called when the user responds to a guided question */
  onQuestionResponse?: (question: string, response: string) => void;
}

/* ── Internal: Questions Section ── */

interface QuestionInputState {
  expandedIndex: number | null;
  inputMode: "voice" | "text" | null;
  textValue: string;
  isRecording: boolean;
  interimTranscript: string;
  responded: Set<number>;
}

function QuestionsSection({
  questions,
  onQuestionResponse,
}: {
  questions: string[];
  onQuestionResponse?: (question: string, response: string) => void;
}) {
  const [minimized, setMinimized] = useState(false);
  const [state, setState] = useState<QuestionInputState>({
    expandedIndex: null,
    inputMode: null,
    textValue: "",
    isRecording: false,
    interimTranscript: "",
    responded: new Set(),
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleExpand = (index: number) => {
    if (state.expandedIndex === index) {
      setState((prev) => ({
        ...prev,
        expandedIndex: null,
        inputMode: null,
        textValue: "",
        isRecording: false,
        interimTranscript: "",
      }));
    } else {
      setState((prev) => ({
        ...prev,
        expandedIndex: index,
        inputMode: null,
        textValue: "",
        isRecording: false,
        interimTranscript: "",
      }));
    }
  };

  const handleStartText = (e: React.MouseEvent) => {
    e.stopPropagation();
    setState((prev) => ({ ...prev, inputMode: "text", textValue: "" }));
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleStartVoice = (e: React.MouseEvent) => {
    e.stopPropagation();
    setState((prev) => ({ ...prev, inputMode: "voice", interimTranscript: "" }));
  };

  const handleVoiceTranscript = (transcript: string) => {
    if (state.expandedIndex === null || !transcript.trim()) return;
    const question = questions[state.expandedIndex];
    onQuestionResponse?.(question, transcript.trim());
    setState((prev) => ({
      ...prev,
      inputMode: null,
      isRecording: false,
      interimTranscript: "",
      responded: new Set(prev.responded).add(prev.expandedIndex!),
      expandedIndex: null,
    }));
  };

  const handleSubmitText = () => {
    if (state.expandedIndex === null || !state.textValue.trim()) return;
    const question = questions[state.expandedIndex];
    onQuestionResponse?.(question, state.textValue.trim());
    setState((prev) => ({
      ...prev,
      inputMode: null,
      textValue: "",
      responded: new Set(prev.responded).add(prev.expandedIndex!),
      expandedIndex: null,
    }));
  };

  const handleCancelInput = (e: React.MouseEvent) => {
    e.stopPropagation();
    setState((prev) => ({
      ...prev,
      inputMode: null,
      textValue: "",
      isRecording: false,
      interimTranscript: "",
    }));
  };

  const handleTextKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitText();
    }
    if (e.key === "Escape") {
      setState((prev) => ({ ...prev, inputMode: null, textValue: "" }));
    }
  };

  const respondedCount = state.responded.size;

  return (
    <div className="border-t">
      {/* Collapsible header */}
      <button
        onClick={() => setMinimized(!minimized)}
        className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
      >
        <MessageCircleQuestion className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Think about
        </span>
        <Badge variant="outline" className="text-[10px]">
          {respondedCount}/{questions.length}
        </Badge>
        <span className="ml-auto text-muted-foreground">
          {minimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </span>
      </button>

      {/* Question list */}
      {!minimized && (
        <div className="px-4 pb-3 flex flex-col gap-2">
          {questions.map((question, index) => {
            const isExpanded = state.expandedIndex === index;
            const isResponded = state.responded.has(index);

            return (
              <div key={index}>
                {isExpanded ? (
                  <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                    <button
                      onClick={() => handleExpand(index)}
                      className="w-full text-left"
                    >
                      <p className="text-sm font-medium leading-relaxed">
                        {question}
                      </p>
                    </button>

                    {state.inputMode === "text" ? (
                      <div className="space-y-2">
                        <AutoExpandTextarea
                          ref={textareaRef}
                          value={state.textValue}
                          onChange={(e) =>
                            setState((prev) => ({
                              ...prev,
                              textValue: e.target.value,
                            }))
                          }
                          placeholder="Type your response..."
                          minRows={2}
                          maxRows={6}
                          className="text-sm bg-background/80"
                          onKeyDown={handleTextKeyDown}
                        />
                        <div className="flex items-center gap-1.5 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={handleCancelInput}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={handleSubmitText}
                            disabled={!state.textValue.trim()}
                          >
                            <Send className="w-3 h-3" />
                            Add to draft
                          </Button>
                        </div>
                      </div>
                    ) : state.inputMode === "voice" ? (
                      <div className="space-y-2">
                        {state.interimTranscript && (
                          <p className="text-xs text-muted-foreground italic px-1 leading-relaxed">
                            {state.interimTranscript}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <VoiceRecorder
                            onTranscript={handleVoiceTranscript}
                            onInterimTranscript={(interim) =>
                              setState((prev) => ({
                                ...prev,
                                interimTranscript: interim,
                              }))
                            }
                            onRecordingChange={(recording) =>
                              setState((prev) => ({
                                ...prev,
                                isRecording: recording,
                              }))
                            }
                            size="sm"
                            variant={state.isRecording ? "destructive" : "default"}
                            className="gap-1.5"
                            label={state.isRecording ? "Stop" : "Record"}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={handleCancelInput}
                          >
                            Cancel
                          </Button>
                        </div>
                        {state.isRecording && (
                          <p className="text-xs text-primary animate-pulse px-1">
                            Listening...
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs flex-1 bg-background/60"
                          onClick={handleStartVoice}
                        >
                          <Mic className="w-3.5 h-3.5" />
                          Speak
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs flex-1 bg-background/60"
                          onClick={handleStartText}
                        >
                          <PenLine className="w-3.5 h-3.5" />
                          Type
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => handleExpand(index)}
                    className={`w-full text-left text-sm p-2.5 rounded-lg border transition-all leading-relaxed ${
                      isResponded
                        ? "border-primary/20 bg-primary/5 text-muted-foreground"
                        : "border-border hover:border-primary/30 hover:bg-primary/5"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex-1">{question}</span>
                      {isResponded && (
                        <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      )}
                    </div>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */

export function BilkoTextForm({
  value,
  onChange,
  placeholder,
  minRows = 3,
  maxRows = 20,
  className,
  panelClassName,
  onVoiceTranscript,
  onVoiceInterimTranscript,
  onRecordingChange,
  voiceInline = true,
  voiceMode = "append",
  showMic = true,
  showClear = true,
  showCopy = true,
  extraActions,
  actions,
  autoFocus,
  readOnly,
  disabled,
  id,
  "data-testid": dataTestId,
  onKeyDown,
  // Container-mode props
  label,
  labelIcon: LabelIcon,
  description,
  headerActions,
  children,
  footer,
  containerClassName,
  // Questions feature
  questions,
  onQuestionResponse,
}: BilkoTextFormProps) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");

  const handleRecordingChange = (recording: boolean) => {
    setIsRecording(recording);
    onRecordingChange?.(recording);
    if (!recording) {
      setInterimText("");
    }
  };

  const handleInterimTranscript = (interim: string) => {
    setInterimText(interim);
    onVoiceInterimTranscript?.(interim);
  };

  const handleTranscript = (transcript: string) => {
    setInterimText("");
    onVoiceTranscript?.(transcript);
  };

  const handleClear = () => {
    onChange("");
  };

  const handleCopy = async () => {
    if (value) {
      try {
        await navigator.clipboard.writeText(value);
        toast({ title: "Copied to clipboard" });
      } catch {
        toast({ title: "Failed to copy", variant: "destructive" });
      }
    }
  };

  // Determine display value during recording
  let displayValue = value;
  if (isRecording && voiceInline && interimText) {
    if (voiceMode === "replace") {
      displayValue = interimText;
    } else {
      displayValue = value ? value + " " + interimText : interimText;
    }
  }

  const hasContent = value.length > 0;
  const shouldShowMic = showMic && !!onVoiceTranscript;
  const visibleActions = actions?.filter((a) => a.visible !== false) ?? [];
  const hasQuestions = questions && questions.length > 0;

  // ── Container mode (when label is provided) ──
  if (label) {
    return (
      <div className={cn("rounded-xl border-2 border-border bg-card overflow-hidden", containerClassName)}>
        {/* Header bar */}
        <div className="flex items-start gap-2 px-4 pt-4 pb-2">
          <div className="flex-1 min-w-0 flex items-baseline gap-x-2 flex-wrap">
            <div className="flex items-center gap-2 text-base font-semibold text-foreground shrink-0">
              {LabelIcon && <LabelIcon className="w-5 h-5 text-primary" />}
              <span>{label}</span>
            </div>
            {description && (
              <span className="text-sm text-muted-foreground line-clamp-2">{description}</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {headerActions}
            {extraActions}
            {showCopy && hasContent && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handleCopy}
                title="Copy text"
              >
                <Copy className="w-4 h-4" />
              </Button>
            )}
            {showClear && hasContent && !isRecording && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handleClear}
                title="Clear all"
              >
                <Eraser className="w-4 h-4" />
              </Button>
            )}
            {shouldShowMic && (
              <VoiceRecorder
                onTranscript={handleTranscript}
                onInterimTranscript={handleInterimTranscript}
                onRecordingChange={handleRecordingChange}
                size="icon"
                variant={isRecording ? "destructive" : "ghost"}
                className="h-8 w-8"
              />
            )}
          </div>
        </div>

        {/* Textarea — borderless since the container provides the chrome */}
        <div className="px-4">
          <AutoExpandTextarea
            id={id}
            data-testid={dataTestId}
            placeholder={placeholder}
            value={displayValue}
            onChange={(e) => onChange(e.target.value)}
            readOnly={isRecording || readOnly}
            disabled={disabled}
            minRows={minRows}
            maxRows={maxRows}
            className={cn(
              "border-none shadow-none focus-visible:ring-0",
              isRecording && "text-primary",
              className
            )}
            autoFocus={autoFocus}
            onKeyDown={onKeyDown}
          />
        </div>

        {/* Agentic actions row */}
        {visibleActions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap px-4 pb-2">
            {visibleActions.map((action) => (
              <Tooltip key={action.key}>
                <TooltipTrigger asChild>
                  <Button
                    variant={action.variant ?? "ghost"}
                    size="sm"
                    onClick={action.onClick}
                    disabled={action.disabled || action.loading}
                    className="gap-1.5 text-xs h-7"
                  >
                    {action.loading ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {action.loadingLabel ?? action.label}
                      </>
                    ) : (
                      <>
                        <action.icon className="w-3 h-3" />
                        {action.label}
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p>{action.description}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}

        {/* Extra content (recording indicators, raw transcript, etc.) */}
        {children}

        {/* Questions section */}
        {hasQuestions && (
          <QuestionsSection
            questions={questions}
            onQuestionResponse={onQuestionResponse}
          />
        )}

        {/* Footer */}
        {footer}
      </div>
    );
  }

  // ── Inline mode (no label) ──
  return (
    <div className={cn("relative", panelClassName)}>
      <AutoExpandTextarea
        id={id}
        data-testid={dataTestId}
        placeholder={placeholder}
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
        readOnly={isRecording || readOnly}
        disabled={disabled}
        minRows={minRows}
        maxRows={maxRows}
        className={cn(
          "pr-24",
          isRecording && "border-primary",
          className
        )}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
      />
      <div className="absolute top-2 right-2 flex items-center gap-0.5">
        {extraActions}
        {showCopy && hasContent && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
            title="Copy text"
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
        )}
        {showClear && hasContent && !isRecording && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleClear}
            title="Clear all"
          >
            <Eraser className="w-3.5 h-3.5" />
          </Button>
        )}
        {shouldShowMic && (
          <VoiceRecorder
            onTranscript={handleTranscript}
            onInterimTranscript={handleInterimTranscript}
            onRecordingChange={handleRecordingChange}
            size="icon"
            variant={isRecording ? "destructive" : "ghost"}
            className="h-7 w-7"
          />
        )}
      </div>
      {visibleActions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mt-1">
          {visibleActions.map((action) => (
            <Tooltip key={action.key}>
              <TooltipTrigger asChild>
                <Button
                  variant={action.variant ?? "ghost"}
                  size="sm"
                  onClick={action.onClick}
                  disabled={action.disabled || action.loading}
                  className="gap-1.5 text-xs h-7"
                >
                  {action.loading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {action.loadingLabel ?? action.label}
                    </>
                  ) : (
                    <>
                      <action.icon className="w-3 h-3" />
                      {action.label}
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p>{action.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}
