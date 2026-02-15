import { useState, useRef, useCallback, forwardRef } from "react";
import { AutoExpandTextarea } from "@/components/ui/auto-expand-textarea";
import { Input } from "@/components/ui/input";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Copy, Eraser, Loader2, Wand2, ListCollapse, Eye, EyeOff, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAutoDictate } from "@/hooks/use-auto-dictate";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/* ══════════════════════════════════════════════════════════════
   Public types
   ══════════════════════════════════════════════════════════════ */

/**
 * Definition for an additional smart mode that uses the `textProcessor` pipeline.
 * Unlike custom `ProvokeAction` entries, these modes get full snapshot management,
 * loading states, and undo support — just like the built-in Clean / Summarize buttons.
 */
export interface SmartModeDef {
  mode: string;
  label: string;
  loadingLabel: string;
  description: string;
  icon: LucideIcon;
}

/**
 * A custom action button rendered in the smart-button row.
 *
 * Use this for actions specific to your page/feature that don't fit the
 * built-in text-processing pattern (Clean / Summarize).
 */
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
  /** When true, automatically starts voice recording on mount. Resets after triggering. */
  autoRecord?: boolean;

  /* ── Text processor (smart actions) ──────────────────────────
   *
   * When provided, ProvokeText automatically renders **Clean** and
   * **Summarize** buttons and manages the full lifecycle:
   *
   *   1. User clicks a smart button (e.g. "Clean")
   *   2. ProvokeText saves a snapshot of the current text
   *   3. Calls `textProcessor(currentText, "clean")`
   *   4. Replaces the value with the returned string
   *   5. Shows "Show original" / "Restore original" actions
   *   6. Renders the raw snapshot in a collapsible panel
   *
   * The parent only needs to provide this one async function.
   * ProvokeText owns all loading states, snapshot storage, and undo UI.
   *
   * ### Example
   * ```tsx
   * <ProvokeText
   *   value={text}
   *   onChange={setText}
   *   textProcessor={async (text, mode) => {
   *     const res = await fetch("/api/process-text", {
   *       method: "POST",
   *       headers: { "Content-Type": "application/json" },
   *       body: JSON.stringify({ text, mode }),
   *     });
   *     const data = await res.json();
   *     return data.result;
   *   }}
   * />
   * ```
   *
   * Built-in modes passed to `textProcessor`:
   *   - `"clean"` — tidy up filler words, fix grammar, clarify language
   *   - `"summarize"` — condense to a shorter summary
   */
  textProcessor?: (text: string, mode: string) => Promise<string>;

  /**
   * Additional smart modes rendered alongside Clean / Summarize.
   * Each mode uses the `textProcessor` pipeline and gets full snapshot
   * management, loading states, and undo support.
   */
  extraSmartModes?: SmartModeDef[];

  /* ── Custom actions ── */
  actions?: ProvokeAction[];

  /* ── Submit ── */
  onSubmit?: () => void;
  submitIcon?: LucideIcon;

  /* ── Metrics ── */
  showCharCount?: boolean;
  showWordCount?: boolean;
  showReadingTime?: boolean;
  maxCharCount?: number;
  maxAudioDuration?: string;

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

/* ══════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════ */

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
      autoRecord,

      textProcessor,
      extraSmartModes,

      actions,

      onSubmit,
      submitIcon: SubmitIcon,

      showCharCount,
      showWordCount,
      showReadingTime,
      maxCharCount,
      maxAudioDuration,

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
    const { autoDictate } = useAutoDictate();

    /* ── Voice state ── */
    const [isRecording, setIsRecording] = useState(false);
    const [interimText, setInterimText] = useState("");
    const [focusAutoRecord, setFocusAutoRecord] = useState(false);
    const internalRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

    /* ── Smart action state (owned by ProvokeText) ── */
    const [processingMode, setProcessingMode] = useState<string | null>(null);
    const [rawSnapshot, setRawSnapshot] = useState<string | null>(null);
    const [showRawSnapshot, setShowRawSnapshot] = useState(false);

    const voiceMode = voice?.mode ?? "append";
    const voiceInline = voice?.inline !== false;
    const hasVoice = !!voice && !!onVoiceTranscript;

    /* ── Auto-dictate on focus ── */
    const handleFocus = useCallback(() => {
      if (autoDictate && hasVoice && !isRecording) {
        setFocusAutoRecord(true);
      }
    }, [autoDictate, hasVoice, isRecording]);

    /* ── Voice handlers ── */

    const handleRecordingChange = useCallback(
      (recording: boolean) => {
        setIsRecording(recording);
        onRecordingChangeProp?.(recording);
        if (!recording) setInterimText("");
        // Reset the focus-triggered auto-record once recording actually starts
        if (recording && focusAutoRecord) {
          setFocusAutoRecord(false);
        }
      },
      [onRecordingChangeProp, focusAutoRecord],
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

    /* ── Smart action handler ──
     * Runs the textProcessor for any mode (clean, summarize, etc.).
     * Manages the full lifecycle: snapshot → process → update value.
     */

    const handleSmartAction = useCallback(
      async (mode: string) => {
        if (!value.trim() || !textProcessor || processingMode) return;
        setProcessingMode(mode);
        try {
          // Save snapshot before the first processing operation
          if (!rawSnapshot) {
            setRawSnapshot(value);
          }
          const result = await textProcessor(value, mode);
          onChange(result);
        } catch (error) {
          console.error(`ProvokeText: "${mode}" action failed:`, error);
          toast({
            title: "Processing failed",
            description: error instanceof Error ? error.message : "Something went wrong",
            variant: "destructive",
          });
        } finally {
          setProcessingMode(null);
        }
      },
      [value, textProcessor, processingMode, rawSnapshot, onChange, toast],
    );

    /* ── Restore snapshot ── */

    const handleRestore = useCallback(() => {
      if (rawSnapshot) {
        onChange(rawSnapshot);
        setShowRawSnapshot(false);
      }
    }, [rawSnapshot, onChange]);

    /* ── Clipboard / clear ── */

    const handleCopy = useCallback(async () => {
      if (!value) return;
      try {
        // Normalize to clean plain text: trim, collapse 3+ consecutive newlines
        const plain = value.trim().replace(/\n{3,}/g, "\n\n");
        const blob = new Blob([plain], { type: "text/plain" });
        await navigator.clipboard.write([
          new ClipboardItem({ "text/plain": blob }),
        ]);
        toast({ title: "Copied as plain text" });
      } catch {
        // Fallback for browsers that don't support ClipboardItem
        try {
          await navigator.clipboard.writeText(value.trim());
          toast({ title: "Copied as plain text" });
        } catch {
          toast({ title: "Failed to copy", variant: "destructive" });
        }
      }
    }, [value, toast]);

    const handleClear = useCallback(() => {
      onChange("");
      setRawSnapshot(null);
      setShowRawSnapshot(false);
    }, [onChange]);

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
    const isProcessing = !!processingMode;
    const hasSnapshot = !!rawSnapshot && rawSnapshot !== value;
    const visibleActions = actions?.filter((a) => a.visible !== false) ?? [];
    const wordCount = value.split(/\s+/).filter(Boolean).length;
    const readingTime = Math.ceil(wordCount / 200);

    /* ── Built-in smart action buttons ──
     * Rendered automatically when `textProcessor` is provided.
     * Order: Clean → Summarize → Show/Restore original → custom actions
     */

    const builtInSmartActions: ProvokeAction[] = textProcessor
      ? [
          {
            key: "_smart-clean",
            label: "Clean",
            loadingLabel: "Cleaning...",
            description:
              "Tidy up the text — removes filler words, fixes grammar, and distils into clear, concise language.",
            icon: Wand2,
            onClick: () => handleSmartAction("clean"),
            disabled: !hasContent || isProcessing,
            loading: processingMode === "clean",
          },
          {
            key: "_smart-summarize",
            label: "Summarize",
            loadingLabel: "Summarizing...",
            description:
              "Condense the text into a shorter summary, keeping the core meaning intact.",
            icon: ListCollapse,
            onClick: () => handleSmartAction("summarize"),
            disabled: !hasContent || isProcessing,
            loading: processingMode === "summarize",
          },
        ]
      : [];

    const extraSmartActions: ProvokeAction[] =
      textProcessor && extraSmartModes
        ? extraSmartModes.map((def) => ({
            key: `_smart-${def.mode}`,
            label: def.label,
            loadingLabel: def.loadingLabel,
            description: def.description,
            icon: def.icon,
            onClick: () => handleSmartAction(def.mode),
            disabled: !hasContent || isProcessing,
            loading: processingMode === def.mode,
          }))
        : [];

    const smartActions = [...builtInSmartActions, ...extraSmartActions];

    const snapshotActions: ProvokeAction[] =
      hasSnapshot && !isRecording
        ? [
            {
              key: "_smart-show-original",
              label: showRawSnapshot ? "Hide original" : "Show original",
              description:
                "Toggle between the processed version and the original text so you can compare what changed.",
              icon: showRawSnapshot ? EyeOff : Eye,
              onClick: () => setShowRawSnapshot(!showRawSnapshot),
            },
            {
              key: "_smart-restore",
              label: "Restore original",
              description:
                "Discard the processed version and revert to the original text.",
              icon: RotateCcw,
              onClick: handleRestore,
            },
          ]
        : [];

    const allActions = [...smartActions, ...snapshotActions, ...visibleActions];

    /* ── Metrics badge ── */

    const metricsEl =
      showCharCount || showWordCount || showReadingTime || maxAudioDuration ? (
        <span className="text-xs text-muted-foreground tabular-nums flex items-center gap-2">
          {showCharCount && (
            <span>
              {maxCharCount
                ? `${value.length.toLocaleString()}/${maxCharCount.toLocaleString()}`
                : `${value.length.toLocaleString()} characters`}
            </span>
          )}
          {maxAudioDuration && (
            <span>
              {isRecording ? "Recording" : "0"}/{maxAudioDuration}
            </span>
          )}
          {showWordCount && <span>{wordCount.toLocaleString()} words</span>}
          {showReadingTime && <span>· {readingTime} min read</span>}
        </span>
      ) : null;

    /* ── Toolbar buttons (copy, clear, mic) ──
     * Icons are always rendered (when their prop is enabled) but
     * disabled when there's no content, so users know the features exist.
     */

    const toolbarSize =
      chrome === "container"
        ? { btn: "h-8 w-8", icon: "w-4 h-4" }
        : { btn: "h-7 w-7", icon: "w-3.5 h-3.5" };

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
            title="Copy as plain text"
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
            autoStart={autoRecord || focusAutoRecord}
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

    /* ── Actions row (smart buttons + snapshot buttons + custom actions) ── */

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

    /* ── Internal rendered sections ──
     * These are owned by ProvokeText and render automatically based on state.
     * They appear after the actions row, before any `children` slot.
     */

    const recordingIndicator =
      isRecording && hasVoice ? (
        <p className="text-xs text-primary animate-pulse px-4 pb-2">
          Listening...
        </p>
      ) : null;

    const rawSnapshotPanel =
      showRawSnapshot && rawSnapshot ? (
        <div className="mx-4 mb-2 p-3 rounded-lg bg-muted/50 border text-sm max-h-60 overflow-y-auto">
          <p className="text-xs text-muted-foreground mb-1">Original text:</p>
          <p className="text-muted-foreground whitespace-pre-wrap">{rawSnapshot}</p>
        </div>
      ) : null;

    /* ── External actions section ── */

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
          onFocus={handleFocus}
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
          onFocus={handleFocus}
          className={cn(
            chrome === "container" && "border-none shadow-none focus-visible:ring-0",
            chrome === "bare" &&
              "border-none shadow-none focus-visible:ring-0 resize-none bg-transparent outline-none",
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
            variant === "editor" && "flex flex-col",
            containerClassName,
          )}
        >
          {/* Header */}
          <div className="flex items-start gap-2 px-4 pt-4 pb-2 shrink-0">
            <div className="flex-1 min-w-0 flex items-baseline gap-x-2 flex-wrap">
              {(LabelIcon || label) && (
                <div className="flex items-center gap-2 text-base font-semibold text-foreground shrink-0">
                  {LabelIcon && <LabelIcon className="w-5 h-5 text-primary" />}
                  {label && <span>{label}</span>}
                </div>
              )}
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
          <div className={cn("px-4", variant !== "input" && "flex-1 min-h-0 overflow-y-auto")}>{inputControl}</div>

          {/* Actions row (smart + snapshot + custom actions) + metrics */}
          {(actionsRow || metricsEl) && (
            <div className="flex items-center justify-between px-4 pb-2 gap-2 shrink-0">
              {actionsRow ?? <div />}
              {metricsEl}
            </div>
          )}

          {/* Internal sections (recording indicator, raw snapshot) */}
          {recordingIndicator}
          {rawSnapshotPanel}

          {/* Children slot (additional content from parent) */}
          {children}

          {/* Footer extra */}
          {footerExtra}

          {/* Footer */}
          {footer}

          {/* External actions (page-level buttons) */}
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

          {recordingIndicator}
          {rawSnapshotPanel}

          {children}

          {metricsEl && <div className="mt-1">{metricsEl}</div>}

          {footer}

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
