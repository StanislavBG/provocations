import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Square, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWhisperRecorder } from "@/hooks/use-whisper";

interface VoiceRecorderProps {
  onTranscript: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  onRecordingChange?: (isRecording: boolean) => void;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "ghost" | "outline" | "secondary" | "destructive";
  className?: string;
  label?: string;
  /** When true, automatically starts recording once speech recognition is ready. */
  autoStart?: boolean;
}

export function VoiceRecorder({
  onTranscript,
  onInterimTranscript,
  onRecordingChange,
  size = "icon",
  variant = "ghost",
  className = "",
  label,
  autoStart,
}: VoiceRecorderProps) {
  const { toast } = useToast();

  const {
    isRecording,
    isSupported,
    isTranscribing,
    startRecording,
    stopRecording,
    toggleRecording,
  } = useWhisperRecorder({
    onTranscript: (text) => {
      onTranscript(text);
    },
    onInterimTranscript,
    onRecordingChange: (recording) => {
      onRecordingChange?.(recording);
      if (!recording && !isSupported) {
        toast({
          title: "Microphone Access Required",
          description: "Please allow microphone access in your browser to use voice input.",
          variant: "destructive",
        });
      }
    },
  });

  // Auto-start recording when requested
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStart && !autoStartedRef.current && isSupported) {
      autoStartedRef.current = true;
      const timer = setTimeout(() => {
        startRecording();
      }, 300);
      return () => clearTimeout(timer);
    }
    if (!autoStart) {
      autoStartedRef.current = false;
    }
  }, [autoStart, startRecording, isSupported]);

  if (!isSupported) {
    return (
      <Button
        data-testid="button-voice-record-unsupported"
        size={size}
        variant={variant}
        disabled
        title="Speech recognition not supported in this browser"
        className={className}
      >
        <MicOff className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Button
      data-testid="button-voice-record"
      size={size}
      variant={isRecording ? "destructive" : variant}
      onClick={toggleRecording}
      disabled={isTranscribing}
      title={isTranscribing ? "Transcribing..." : isRecording ? "Stop recording" : "Start voice recording"}
      className={`${className} ${isRecording ? "animate-pulse" : ""}`}
    >
      {isTranscribing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isRecording ? (
        <Square className="w-4 h-4" />
      ) : (
        <Mic className="w-4 h-4" />
      )}
      {label && <span>{isTranscribing ? "..." : isRecording ? "Stop" : label}</span>}
    </Button>
  );
}

export function LargeVoiceRecorder({
  onTranscript,
  isRecording: externalIsRecording,
  onToggleRecording
}: {
  onTranscript: (text: string) => void;
  isRecording: boolean;
  onToggleRecording: () => void;
}) {
  const {
    isSupported,
    isTranscribing,
    startRecording,
    stopRecording,
  } = useWhisperRecorder({
    onTranscript,
  });

  // Sync external recording state
  const prevRecordingRef = useRef(false);
  useEffect(() => {
    if (externalIsRecording && !prevRecordingRef.current) {
      startRecording();
    } else if (!externalIsRecording && prevRecordingRef.current) {
      stopRecording();
    }
    prevRecordingRef.current = externalIsRecording;
  }, [externalIsRecording, startRecording, stopRecording]);

  if (!isSupported) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center">
          <MicOff className="w-16 h-16 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-center">
          Speech recognition is not supported in this browser.<br />
          Please use Chrome or Edge for voice features.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8">
      <button
        data-testid="button-large-voice-record"
        onClick={onToggleRecording}
        disabled={isTranscribing}
        className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
          isTranscribing
            ? "bg-muted"
            : externalIsRecording
              ? "bg-destructive animate-pulse shadow-lg shadow-destructive/50"
              : "bg-primary hover-elevate"
        }`}
      >
        {isTranscribing ? (
          <Loader2 className="w-12 h-12 text-muted-foreground animate-spin" />
        ) : externalIsRecording ? (
          <Square className="w-12 h-12 text-destructive-foreground" />
        ) : (
          <Mic className="w-12 h-12 text-primary-foreground" />
        )}
      </button>
      <p className="text-muted-foreground text-center text-lg">
        {isTranscribing
          ? "Transcribing your audio..."
          : externalIsRecording
            ? "Listening... Click to stop and process your draft"
            : "Click the microphone to start speaking your first draft"
        }
      </p>
    </div>
  );
}
