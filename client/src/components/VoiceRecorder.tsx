import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VoiceRecorderProps {
  onTranscript: (text: string) => void;
  onRecordingChange?: (isRecording: boolean) => void;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "ghost" | "outline" | "secondary";
  className?: string;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

export function VoiceRecorder({
  onTranscript,
  onRecordingChange,
  size = "icon",
  variant = "ghost",
  className = ""
}: VoiceRecorderProps) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const isRecordingRef = useRef(false);

  // Store callbacks in refs to avoid re-initializing recognition
  const onTranscriptRef = useRef(onTranscript);
  const onRecordingChangeRef = useRef(onRecordingChange);

  // Keep refs in sync with props
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onRecordingChangeRef.current = onRecordingChange;
  }, [onRecordingChange]);

  // Initialize speech recognition only once
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        transcriptRef.current += finalTranscript + " ";
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      isRecordingRef.current = false;
      setIsRecording(false);
      onRecordingChangeRef.current?.(false);
      if (event.error === 'not-allowed') {
        toast({
          title: "Microphone Access Required",
          description: "Please allow microphone access in your browser to use voice input.",
          variant: "destructive",
        });
      } else if (event.error === 'no-speech') {
        toast({
          title: "No Speech Detected",
          description: "Please speak into your microphone and try again.",
        });
      } else if (event.error !== 'aborted') {
        toast({
          title: "Voice Recording Error",
          description: "Speech recognition failed. Please try again.",
          variant: "destructive",
        });
      }
    };

    recognition.onend = () => {
      if (transcriptRef.current.trim()) {
        onTranscriptRef.current(transcriptRef.current.trim());
      }
      transcriptRef.current = "";
      isRecordingRef.current = false;
      setIsRecording(false);
      onRecordingChangeRef.current?.(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [toast]); // Only toast is needed - callbacks use refs

  const startRecording = useCallback(() => {
    if (!recognitionRef.current || isRecordingRef.current) return;
    transcriptRef.current = "";
    try {
      recognitionRef.current.start();
      isRecordingRef.current = true;
      setIsRecording(true);
      onRecordingChangeRef.current?.(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      isRecordingRef.current = false;
      setIsRecording(false);
      onRecordingChangeRef.current?.(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!recognitionRef.current || !isRecordingRef.current) return;
    recognitionRef.current.stop();
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecordingRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [startRecording, stopRecording]);

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
      title={isRecording ? "Stop recording" : "Start voice recording"}
      className={`${className} ${isRecording ? "animate-pulse" : ""}`}
    >
      {isRecording ? (
        <Square className="w-4 h-4" />
      ) : (
        <Mic className="w-4 h-4" />
      )}
    </Button>
  );
}

export function LargeVoiceRecorder({
  onTranscript,
  isRecording,
  onToggleRecording
}: {
  onTranscript: (text: string) => void;
  isRecording: boolean;
  onToggleRecording: () => void;
}) {
  const { toast } = useToast();
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const isActiveRef = useRef(false);

  // Store callback in ref to avoid re-initializing recognition
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Initialize speech recognition only once
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      isActiveRef.current = true;
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        transcriptRef.current += finalTranscript + " ";
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      isActiveRef.current = false;
      if (event.error === 'not-allowed') {
        toast({
          title: "Microphone Access Required",
          description: "Please allow microphone access in your browser to use voice input.",
          variant: "destructive",
        });
      } else if (event.error === 'no-speech') {
        toast({
          title: "No Speech Detected",
          description: "Please speak into your microphone and try again.",
        });
      }
    };

    recognition.onend = () => {
      isActiveRef.current = false;
      if (transcriptRef.current.trim()) {
        onTranscriptRef.current(transcriptRef.current.trim());
      }
      transcriptRef.current = "";
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [toast]);

  // Handle external isRecording state changes
  useEffect(() => {
    if (!recognitionRef.current) return;

    if (isRecording && !isActiveRef.current) {
      transcriptRef.current = "";
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error("Failed to start recording:", error);
      }
    } else if (!isRecording && isActiveRef.current) {
      recognitionRef.current.stop();
    }
  }, [isRecording]);

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
        className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
          isRecording 
            ? "bg-destructive animate-pulse shadow-lg shadow-destructive/50" 
            : "bg-primary hover-elevate"
        }`}
      >
        {isRecording ? (
          <Square className="w-12 h-12 text-destructive-foreground" />
        ) : (
          <Mic className="w-12 h-12 text-primary-foreground" />
        )}
      </button>
      <p className="text-muted-foreground text-center text-lg">
        {isRecording 
          ? "Listening... Click to stop and process your draft" 
          : "Click the microphone to start speaking your first draft"
        }
      </p>
    </div>
  );
}
