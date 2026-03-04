import { useState, useRef, useCallback, useEffect } from "react";

export type ConversationState = "IDLE" | "PROCESSING" | "AI_SPEAKING" | "LISTENING";

export interface ConversationTurnOptions {
  onTranscript: (text: string, isFinal: boolean) => void;
  onStateChange?: (state: ConversationState) => void;
  silenceTimeout?: number; // ms after final transcript before auto-submitting (default: 1500)
}

// SpeechRecognition type shim for browsers that lack built-in typings
interface SpeechRecognitionResultAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultItem {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionResultAlternative;
  [index: number]: SpeechRecognitionResultAlternative;
}

interface SpeechRecognitionResultsList {
  readonly length: number;
  item(index: number): SpeechRecognitionResultItem;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: SpeechRecognitionResultsList;
}

interface SpeechRecognitionErrorInfo {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorInfo) => void) | null;
  onend: (() => void) | null;
}

function createSpeechRecognition(): SpeechRecognitionInstance | null {
  const SpeechRecognition =
    (window as unknown as Record<string, unknown>).SpeechRecognition ??
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  return new (SpeechRecognition as new () => SpeechRecognitionInstance)();
}

export function useConversationTurn(options: ConversationTurnOptions) {
  const { onTranscript, onStateChange, silenceTimeout = 1000 } = options;

  const [state, setState] = useState<ConversationState>("IDLE");
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);

  const stateRef = useRef<ConversationState>("IDLE");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef("");
  const onTranscriptRef = useRef(onTranscript);
  const onStateChangeRef = useRef(onStateChange);
  const silenceTimeoutRef = useRef(silenceTimeout);

  // Keep refs in sync with latest props
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    silenceTimeoutRef.current = silenceTimeout;
  }, [silenceTimeout]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const transition = useCallback(
    (newState: ConversationState) => {
      stateRef.current = newState;
      setState(newState);
      onStateChangeRef.current?.(newState);
    },
    [],
  );

  const stopRecognition = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {
        // Already stopped
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, [clearSilenceTimer]);

  const submitAnswer = useCallback(() => {
    if (stateRef.current !== "LISTENING") return;

    clearSilenceTimer();
    const transcript = finalTranscriptRef.current;

    // Notify parent with the final transcript
    if (transcript.trim()) {
      onTranscriptRef.current(transcript, true);
    }

    stopRecognition();
    setCurrentTranscript("");
    finalTranscriptRef.current = "";
    transition("PROCESSING");
  }, [clearSilenceTimer, stopRecognition, transition]);

  const startRecognition = useCallback(() => {
    stopRecognition();
    finalTranscriptRef.current = "";
    setCurrentTranscript("");

    const recognition = createSpeechRecognition();
    if (!recognition) {
      console.warn("useConversationTurn: SpeechRecognition not available in this browser");
      return;
    }

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      let interim = "";
      let final = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      // Accumulate final transcript segments
      if (final) {
        finalTranscriptRef.current = final;
      }

      const displayText = final + interim;
      setCurrentTranscript(displayText);

      if (interim) {
        // Interim result — clear any silence timer, user is still talking
        clearSilenceTimer();
        onTranscriptRef.current(displayText, false);
      }

      if (final && stateRef.current === "LISTENING") {
        // Final result arrived — start silence timer
        onTranscriptRef.current(final, false);
        clearSilenceTimer();
        silenceTimerRef.current = setTimeout(() => {
          // Auto-submit after silence
          if (stateRef.current === "LISTENING") {
            submitAnswer();
          }
        }, silenceTimeoutRef.current);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorInfo) => {
      // "no-speech" and "aborted" are not real errors — they happen normally
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.warn("useConversationTurn: SpeechRecognition error:", event.error);
      }
    };

    recognition.onend = () => {
      // Recognition ended unexpectedly (browser can stop it). Restart if still in LISTENING state.
      if (stateRef.current === "LISTENING") {
        try {
          recognition.start();
        } catch {
          // May fail if context is destroyed; that's fine
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error("useConversationTurn: failed to start SpeechRecognition", err);
      setIsListening(false);
    }
  }, [stopRecognition, clearSilenceTimer, submitAnswer]);

  // IDLE -> PROCESSING
  const startProcessing = useCallback(() => {
    if (stateRef.current !== "IDLE") return;
    stopRecognition();
    setCurrentTranscript("");
    finalTranscriptRef.current = "";
    transition("PROCESSING");
  }, [stopRecognition, transition]);

  // PROCESSING -> AI_SPEAKING
  const startSpeaking = useCallback(() => {
    if (stateRef.current !== "PROCESSING") return;
    transition("AI_SPEAKING");
  }, [transition]);

  // AI_SPEAKING -> LISTENING (auto-starts mic)
  const finishSpeaking = useCallback(() => {
    if (stateRef.current !== "AI_SPEAKING") return;
    transition("LISTENING");
    startRecognition();
  }, [transition, startRecognition]);

  // AI_SPEAKING -> LISTENING (interrupt: user speaks during AI audio)
  const interrupt = useCallback(() => {
    if (stateRef.current !== "AI_SPEAKING") return;
    transition("LISTENING");
    startRecognition();
  }, [transition, startRecognition]);

  // Any -> IDLE
  const reset = useCallback(() => {
    clearSilenceTimer();
    stopRecognition();
    setCurrentTranscript("");
    finalTranscriptRef.current = "";
    transition("IDLE");
  }, [clearSilenceTimer, stopRecognition, transition]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      stopRecognition();
    };
  }, [clearSilenceTimer, stopRecognition]);

  return {
    state,
    startProcessing,
    startSpeaking,
    finishSpeaking,
    submitAnswer,
    interrupt,
    reset,
    currentTranscript,
    isListening,
  };
}
