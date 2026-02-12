import { useState, useRef, useCallback, forwardRef } from "react";
import { AutoExpandTextarea } from "@/components/ui/auto-expand-textarea";
import { Input } from "@/components/ui/input";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Copy, Eraser, Loader2, Wand2, ListCollapse } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/* ── Public types ── */

export interface ProvokeAction {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  variant?: "ghost" | "outline" | "default";
  visible?: boolean;
}

export interface ProvokeTextProps {
  /* ── Core ── */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
  className?: string;
  id?: string;
  "data-testid"?: string;

  /**
   * `"input"` — single-line (renders shadcn Input)
   * `"textarea"` — multi-line, auto-expanding (default)
   * `"editor"` — full-height document canvas
   */
  variant?: "input" | "textarea" | "editor";

  /**
   * `"container"` — bordered card with header, actions row, footer
   * `"inline"` — bare input with floating toolbar (default)
   * `"bare"` — no chrome at all, just the control
   */
  chrome?: "container" | "inline" | "bare";

  /* ── Sizing (textarea / editor) ── */
  minRows?: number;
  maxRows?: number;

  /* ── Container chrome header ── */
  label?: string;
  labelIcon?: LucideIcon;
  description?: React.ReactNode;

  /* ── Toolbar buttons ── */
  showCopy?: boolean;
  showClear?: boolean;

  /* ── Voice ── */
  voice?: {
    mode: "append" | "replace";
    /** Show interim speech inline in the textarea (default: true) */
    inline?: boolean;
  };
  onVoiceTranscript?: (transcript: string) => void;
  onVoiceInterimTranscript?: (interim: string) => void;
  onRecordingChange?: (isRecording: boolean) => void;

  /* ── Smart buttons (AI actions) ── */
  actions?: ProvokeAction[];

  /* ── Built-in smart buttons ──
   * These are standard AI-powered actions that ProvokeText renders
   * automatically when the corresponding callback is provided.
   * They appear in the actions row alongside any custom `actions`.
   *
   *   - **Clean**: Tidies up voice transcripts — removes filler words,
   *     fixes grammar, and distils text into clear, concise language.
   *   - **Summarize**: Condenses the text into a shorter summary,
   *     keeping the core meaning intact.
   */
  onClean?: () => void;
  isCleanLoading?: boolean;
  onSummarize?: () => void;
  isSummarizeLoading?: boolean;

  /* ── Submit ── */
  onSubmit?: () => void;
  submitIcon?: LucideIcon;

  /* ── Metrics ── */
  showCharCount?: boolean;
  showWordCount?: boolean;
  showReadingTime?: boolean;

  /* ── Keyboard ── */
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement | HTMLInputElement>;

  /* ── Selection (editor variant) ── */
  onSelect?: React.ReactEventHandler<HTMLTextAreaElement>;

  /* ── Extra rendered slots ── */
  extraActions?: React.ReactNode;
  headerActions?: React.ReactNode;
  footerExtra?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  containerClassName?: string;
  panelClassName?: string;

  /**
   * **External Actions** — a clearly delineated section at the bottom of
   * the component for buttons that belong to the *page/feature* rather
   * than to ProvokeText itself.
   *
   * Use this for navigation, submission, or workflow buttons (e.g.
   * "Cancel", "Begin Analysis", "Next Step") that sit visually inside
   * the ProvokeText card but are owned and wired by the parent.
   *
   * ### Why this exists
   * ProvokeText owns its own toolbar (copy, clear, mic) and smart-button
   * row (Clean, Summarize, custom actions). Anything outside that domain
   * — page-level navigation, form submission, workflow transitions —
   * should go here so the separation is explicit in code and on screen.
   *
   * ### Example
   * ```tsx
   * <ProvokeText
   *   value={text}
   *   onChange={setText}
   *   externalActions={
   *     <>
   *       <Button variant="ghost" onClick={onCancel}>Cancel</Button>
   *       <Button onClick={onSubmit}>Begin Analysis</Button>
   *     </>
   *   }
   * />
   * ```
   */
  externalActions?: React.ReactNode;
}

/* ── Component ── */

export const ProvokeText = forwardRef<HTMLTextAreaElement | HTMLInputElement, ProvokeTextProps>(
  function ProvokeText(
    {
      value,
      onChange,
      placeholder,
      disabled,
      readOnly,
      autoFocus,
      className,
      id,
      "data-testid": dataTestId,

      variant = "textarea",
      chrome = "inline",

      minRows = 3,
      maxRows = 20,

      label,
      labelIcon: LabelIcon,
      description,

      showCopy = true,
      showClear = true,

      voice,
      onVoiceTranscript,
      onVoiceInterimTranscript,
      onRecordingChange: onRecordingChangeProp,

      actions,

      onClean,
      isCleanLoading,
      onSummarize,
      isSummarizeLoading,

      onSubmit,
      submitIcon: SubmitIcon,

      showCharCount,
      showWordCount,
      showReadingTime,

      onKeyDown,
      onSelect,

      extraActions,
      headerActions,
      footerExtra,
      children,
      footer,
      containerClassName,
      panelClassName,

      externalActions,
    },
    ref,
  ) {
    const { toast } = useToast();
    const [isRecording, setIsRecording] = useState(false);
    const [interimText, setInterimText] = useState("");
    const internalRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

    const voiceMode = voice?.mode ?? "append";
    const voiceInline = voice?.inline !== false;
    const hasVoice = !!voice && !!onVoiceTranscript;

    /* ── Voice handlers ── */

    const handleRecordingChange = useCallback(
      (recording: boolean) => {
        setIsRecording(recording);
        onRecordingChangeProp?.(recording);
        if (!recording) setInterimText("");
      },
      [onRecordingChangeProp],
    );

    const handleInterimTranscript = useCallback(
      (interim: string) => {
        setInterimText(interim);
        onVoiceInterimTranscript?.(interim);
      },
      [onVoiceInterimTranscript],
    );

    const handleTranscript = useCallback(
      (transcript: string) => {
        setInterimText("");
        onVoiceTranscript?.(transcript);
      },
      [onVoiceTranscript],
    );

    /* ── Clipboard / clear ── */

    const handleCopy = useCallback(async () => {
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        toast({ title: "Copied to clipboard" });
      } catch {
        toast({ title: "Failed to copy", variant: "destructive" });
      }
    }, [value, toast]);

    const handleClear = useCallback(() => onChange(""), [onChange]);

    /* ── Key handling (submit on Enter for input variant) ── */

    const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement | HTMLInputElement> =
      useCallback(
        (e) => {
          if (variant === "input" && e.key === "Enter" && !e.shiftKey && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
          onKeyDown?.(e as any);
        },
        [variant, onSubmit, onKeyDown],
      );

    /* ── Display value during recording ── */

    let displayValue = value;
    if (isRecording && voiceInline && interimText) {
      if (voiceMode === "replace") {
        displayValue = interimText;
      } else {
        displayValue = value ? value + " " + interimText : interimText;
      }
    }

    /* ── Derived ── */

    const hasContent = value.length > 0;
    const visibleActions = actions?.filter((a) => a.visible !== false) ?? [];
    const wordCount = value.split(/\s+/).filter(Boolean).length;
    const readingTime = Math.ceil(wordCount / 200);

    /* ── Built-in smart buttons ── */

    const builtInActions: ProvokeAction[] = [];

    if (onClean) {
      builtInActions.push({
        key: "_builtin-clean",
        label: "Clean",
        loadingLabel: "Cleaning...",
        description: "Tidy up the text — removes filler words, fixes grammar, and distils into clear, concise language.",
        icon: Wand2,
        onClick: onClean,
        disabled: !hasContent || isCleanLoading,
        loading: isCleanLoading,
      });
    }

    if (onSummarize) {
      builtInActions.push({
        key: "_builtin-summarize",
        label: "Summarize",
        loadingLabel: "Summarizing...",
        description: "Condense the text into a shorter summary, keeping the core meaning intact.",
        icon: ListCollapse,
        onClick: onSummarize,
        disabled: !hasContent || isSummarizeLoading,
        loading: isSummarizeLoading,
      });
    }

    const allActions = [...builtInActions, ...visibleActions];

    /* ── Metrics badge ── */

    const metricsEl =
      showCharCount || showWordCount || showReadingTime ? (
        <span className="text-xs text-muted-foreground tabular-nums">
          {showCharCount && `${value.length.toLocaleString()} characters`}
          {showWordCount && `${wordCount.toLocaleString()} words`}
          {showReadingTime && ` · ${readingTime} min read`}
        </span>
      ) : null;

    /* ── Toolbar buttons (copy, clear, mic) ──
     * Icons are always rendered (when their prop is enabled) but
     * disabled when there's no content. This ensures the toolbar
     * is always visible so users know the features exist.
     */

    const toolbarSize = chrome === "container" ? { btn: "h-8 w-8", icon: "w-4 h-4" } : { btn: "h-7 w-7", icon: "w-3.5 h-3.5" };

    const toolbarButtons = (
      <>
        {extraActions}
        {showCopy && (
          <Button
            size="icon"
            variant="ghost"
            className={cn(toolbarSize.btn, "text-muted-foreground hover:text-foreground")}
            onClick={handleCopy}
            disabled={!hasContent}
            title="Copy text"
          >
            <Copy className={toolbarSize.icon} />
          </Button>
        )}
        {showClear && !isRecording && (
          <Button
            size="icon"
            variant="ghost"
            className={cn(toolbarSize.btn, "text-muted-foreground hover:text-foreground")}
            onClick={handleClear}
            disabled={!hasContent}
            title="Clear all"
          >
            <Eraser className={toolbarSize.icon} />
          </Button>
        )}
        {hasVoice && (
          <VoiceRecorder
            onTranscript={handleTranscript}
            onInterimTranscript={handleInterimTranscript}
            onRecordingChange={handleRecordingChange}
            size="icon"
            variant={isRecording ? "destructive" : "ghost"}
            className={toolbarSize.btn}
          />
        )}
        {SubmitIcon && onSubmit && (
          <Button
            size="icon"
            variant="default"
            className={toolbarSize.btn}
            onClick={onSubmit}
            disabled={!value.trim() || disabled}
            title="Submit"
          >
            <SubmitIcon className={toolbarSize.icon} />
          </Button>
        )}
      </>
    );

    /* ── Actions row (built-in smart buttons + custom actions) ── */

    const actionsRow =
      allActions.length > 0 ? (
        <div className="flex items-center gap-2 flex-wrap">
          {allActions.map((action) => (
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
      ) : null;

    /* ── External actions section ──
     * Renders page/feature-level buttons (navigation, form submit, etc.)
     * in a visually separated area at the bottom of the component.
     * See the `externalActions` prop docs for usage guidance.
     */

    const externalActionsSection = externalActions ? (
      <div
        className="flex items-center justify-between px-4 py-3 border-t flex-wrap gap-2"
        data-section="external-actions"
      >
        {externalActions}
      </div>
    ) : null;

    /* ── Build the input control ── */

    const inputControl =
      variant === "input" ? (
        <Input
          ref={ref as React.Ref<HTMLInputElement>}
          id={id}
          data-testid={dataTestId}
          placeholder={placeholder}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          readOnly={isRecording || readOnly}
          disabled={disabled}
          autoFocus={autoFocus}
          onKeyDown={handleKeyDown}
          className={cn(
            chrome === "bare" && "border-none shadow-none focus-visible:ring-0",
            isRecording && "text-primary",
            className,
          )}
        />
      ) : (
        <AutoExpandTextarea
          ref={ref as React.Ref<HTMLTextAreaElement>}
          id={id}
          data-testid={dataTestId}
          placeholder={placeholder}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          readOnly={isRecording || readOnly}
          disabled={disabled}
          minRows={variant === "editor" ? 25 : minRows}
          maxRows={variant === "editor" ? 999 : maxRows}
          autoFocus={autoFocus}
          onKeyDown={handleKeyDown as React.KeyboardEventHandler<HTMLTextAreaElement>}
          onSelect={onSelect}
          className={cn(
            chrome === "container" && "border-none shadow-none focus-visible:ring-0",
            chrome === "bare" && "border-none shadow-none focus-visible:ring-0 resize-none bg-transparent outline-none",
            variant === "editor" && "min-h-[600px] font-serif text-base leading-[1.8]",
            isRecording && (chrome === "container" ? "text-primary" : "border-primary"),
            className,
          )}
          style={variant === "editor" ? { caretColor: "hsl(var(--primary))" } : undefined}
        />
      );

    /* ══════════════════════════════════════════════════════════════
       CONTAINER chrome
       ══════════════════════════════════════════════════════════════ */

    if (chrome === "container") {
      return (
        <div
          className={cn(
            "rounded-xl border-2 border-border bg-card overflow-hidden",
            containerClassName,
          )}
        >
          {/* Header */}
          <div className="flex items-start gap-2 px-4 pt-4 pb-2">
            <div className="flex-1 min-w-0 flex items-baseline gap-x-2 flex-wrap">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground shrink-0">
                {LabelIcon && <LabelIcon className="w-5 h-5 text-primary" />}
                <span>{label}</span>
              </div>
              {description && (
                <span className="text-sm text-muted-foreground line-clamp-2">
                  {description}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {headerActions}
              {toolbarButtons}
            </div>
          </div>

          {/* Input */}
          <div className="px-4">{inputControl}</div>

          {/* Actions row (built-in smart buttons + custom actions) */}
          {actionsRow && <div className="px-4 pb-2">{actionsRow}</div>}

          {/* Children slot (recording indicators, raw transcript, etc.) */}
          {children}

          {/* Metrics */}
          {metricsEl && (
            <div className="px-4 pb-2">{metricsEl}</div>
          )}

          {/* Footer extra */}
          {footerExtra}

          {/* Footer */}
          {footer}

          {/* ── External actions ──
           * Page-level buttons (Cancel, Submit, navigation) go here.
           * This section is visually separated from the ProvokeText
           * component's own controls by a top border.
           */}
          {externalActionsSection}
        </div>
      );
    }

    /* ══════════════════════════════════════════════════════════════
       INLINE chrome
       ══════════════════════════════════════════════════════════════ */

    if (chrome === "inline") {
      return (
        <div className={cn("relative", panelClassName)}>
          {variant === "input" ? (
            /* input variant rendered inline with toolbar next to it */
            <div className="flex items-center gap-1">
              {inputControl}
              {toolbarButtons}
            </div>
          ) : (
            <>
              {inputControl}
              <div className="absolute top-2 right-2 flex items-center gap-0.5">
                {toolbarButtons}
              </div>
            </>
          )}

          {actionsRow && <div className="mt-1">{actionsRow}</div>}

          {children}

          {metricsEl && <div className="mt-1">{metricsEl}</div>}

          {footer}

          {/* ── External actions (inline chrome) ── */}
          {externalActionsSection}
        </div>
      );
    }

    /* ══════════════════════════════════════════════════════════════
       BARE chrome — just the control + optional inline toolbar
       ══════════════════════════════════════════════════════════════ */

    return (
      <div className={cn("flex items-center gap-1", panelClassName)}>
        {inputControl}
        {toolbarButtons}
      </div>
    );
  },
);

ProvokeText.displayName = "ProvokeText";
