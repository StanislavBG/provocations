import { useState } from "react";
import { AutoExpandTextarea } from "@/components/ui/auto-expand-textarea";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Copy, Eraser, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface SmartAction {
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

interface SmartTextPanelProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  className?: string;
  panelClassName?: string;
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
  showMic?: boolean;
  showClear?: boolean;
  showCopy?: boolean;
  /** Additional action buttons rendered in the icon toolbar */
  extraActions?: React.ReactNode;
  /** AI action buttons rendered below the textarea with tooltip descriptions */
  actions?: SmartAction[];
  autoFocus?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  id?: string;
  "data-testid"?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;

  /* ── Container-mode props (Smart Text standard) ── */

  /** Header label — when provided, renders the full bordered container */
  label?: string;
  /** Icon rendered next to the label */
  labelIcon?: LucideIcon;
  /** Description text below the label */
  description?: React.ReactNode;
  /** Extra elements in the header row (badges, download button, etc.) */
  headerActions?: React.ReactNode;
  /** Content rendered after the actions row (recording indicators, raw transcript, etc.) */
  children?: React.ReactNode;
  /** Footer rendered at the bottom of the container with a top border */
  footer?: React.ReactNode;
  /** Extra classes on the outer container */
  containerClassName?: string;
}

export function SmartTextPanel({
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
}: SmartTextPanelProps) {
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

        {/* Footer */}
        {footer}
      </div>
    );
  }

  // ── Inline mode (no label — backwards compatible) ──
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
