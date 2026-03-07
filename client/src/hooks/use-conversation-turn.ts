import { useState, useRef, useCallback, useEffect } from "react";

export type ConversationState = "IDLE" | "PROCESSING" | "AI_SPEAKING" | "LISTENING";

export interface ConversationTurnOptions {
  onTranscript: (text: string, isFinal: boolean) => void;
  onStateChange?: (state: ConversationState) => void;
  onInterrupt?: () => void; // called when user interrupts during AI_SPEAKING
  silenceTimeout?: number; // ms after final transcript before auto-submitting (default: 1500)
  /** When true, enables echo-cancelled voice activity detection during AI_SPEAKING.
   *  Uses getUserMedia with echoCancellation to filter out speaker output, so only
   *  genuine user speech triggers an interrupt — no feedback loops from laptop speakers. */
  alwaysListening?: boolean;
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
  const { onTranscript, onStateChange, onInterrupt, silenceTimeout = 1000, alwaysListening = false } = options;

  const [state, setState] = useState<ConversationState>("IDLE");
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);

  const stateRef = useRef<ConversationState>("IDLE");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef("");
  const onTranscriptRef = useRef(onTranscript);
  const onStateChangeRef = useRef(onStateChange);
  const onInterruptRef = useRef(onInterrupt);
  const silenceTimeoutRef = useRef(silenceTimeout);
  const alwaysListeningRef = useRef(alwaysListening);
  // ── Echo-cancelled voice activity detection (for interrupt during AI_SPEAKING) ──
  const vadStreamRef = useRef<MediaStream | null>(null);
  const vadContextRef = useRef<AudioContext | null>(null);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** RMS threshold above which we consider the user to be speaking (after echo cancellation) */
  const VAD_THRESHOLD = 0.02;
  /** How many consecutive frames must exceed the threshold before we fire an interrupt */
  const VAD_CONSECUTIVE_FRAMES = 3;
  const vadFrameCountRef = useRef(0);

  // Keep refs in sync with latest props
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    onInterruptRef.current = onInterrupt;
  }, [onInterrupt]);

  useEffect(() => {
    silenceTimeoutRef.current = silenceTimeout;
  }, [silenceTimeout]);

  useEffect(() => {
    alwaysListeningRef.current = alwaysListening;
  }, [alwaysListening]);

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

  /** Stop echo-cancelled voice activity detection */
  const stopVAD = useCallback(() => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (vadContextRef.current) {
      vadContextRef.current.close().catch(() => {});
      vadContextRef.current = null;
    }
    if (vadStreamRef.current) {
      vadStreamRef.current.getTracks().forEach((t) => t.stop());
      vadStreamRef.current = null;
    }
    vadFrameCountRef.current = 0;
  }, []);

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

    // Stop recognition and transition to PROCESSING first,
    // so that when the parent processes the answer and triggers
    // the next question cycle, the state machine is ready.
    stopRecognition();
    setCurrentTranscript("");
    finalTranscriptRef.current = "";
    transition("PROCESSING");

    // Notify parent with the final transcript after state transition
    if (transcript.trim()) {
      onTranscriptRef.current(transcript, true);
    }
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
      // Recognition ended unexpectedly (browser can stop it). Restart if still listening.
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

  /** Start echo-cancelled voice activity detection — listens for real user speech while AI audio plays.
   *  Uses getUserMedia with echoCancellation so the browser's AEC suppresses speaker output.
   *  Only genuine user speech registers as significant volume → triggers interrupt. */
  const startVAD = useCallback(async () => {
    stopVAD();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      vadStreamRef.current = stream;
      vadContextRef.current = audioCtx;
      vadFrameCountRef.current = 0;

      const dataArray = new Float32Array(analyser.fftSize);
      vadIntervalRef.current = setInterval(() => {
        analyser.getFloatTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i] * dataArray[i];
        const rms = Math.sqrt(sum / dataArray.length);

        if (rms > VAD_THRESHOLD) {
          vadFrameCountRef.current++;
          if (vadFrameCountRef.current >= VAD_CONSECUTIVE_FRAMES && stateRef.current === "AI_SPEAKING") {
            // Genuine user speech detected through echo-cancelled stream — interrupt
            stopVAD();
            onInterruptRef.current?.();
            transition("LISTENING");
            startRecognition();
          }
        } else {
          vadFrameCountRef.current = 0;
        }
      }, 80); // ~12.5 checks/sec
    } catch (err) {
      console.warn("useConversationTurn: VAD getUserMedia failed — voice interrupt unavailable", err);
    }
  }, [stopVAD, transition, startRecognition]);

  // PROCESSING -> AI_SPEAKING
  const startSpeaking = useCallback(() => {
    if (stateRef.current !== "PROCESSING") return;
    // SpeechRecognition stays OFF during AI playback — it can't distinguish speaker from user.
    // Instead, in alwaysListening mode we use echo-cancelled VAD to detect real user speech.
    stopRecognition();
    transition("AI_SPEAKING");
    if (alwaysListeningRef.current) {
      startVAD();
    }
  }, [transition, stopRecognition, startVAD]);

  // AI_SPEAKING -> LISTENING (audio finished naturally)
  const finishSpeaking = useCallback(() => {
    if (stateRef.current !== "AI_SPEAKING") return;
    stopVAD();
    transition("LISTENING");
    startRecognition();
  }, [transition, startRecognition, stopVAD]);

  // AI_SPEAKING -> LISTENING (interrupt: user speaks during AI audio, or manual button)
  const interrupt = useCallback(() => {
    if (stateRef.current !== "AI_SPEAKING") return;
    stopVAD();
    onInterruptRef.current?.();
    transition("LISTENING");
    startRecognition();
  }, [transition, startRecognition, stopVAD]);

  // Any -> IDLE
  const reset = useCallback(() => {
    clearSilenceTimer();
    stopRecognition();
    stopVAD();
    setCurrentTranscript("");
    finalTranscriptRef.current = "";
    transition("IDLE");
  }, [clearSilenceTimer, stopRecognition, stopVAD, transition]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      stopRecognition();
      stopVAD();
    };
  }, [clearSilenceTimer, stopRecognition, stopVAD]);

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
