import { useState } from "react";
import { AutoExpandTextarea } from "@/components/ui/auto-expand-textarea";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { Copy, Eraser } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  autoFocus?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  id?: string;
  "data-testid"?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
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
  autoFocus,
  readOnly,
  disabled,
  id,
  "data-testid": dataTestId,
  onKeyDown,
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
    </div>
  );
}
